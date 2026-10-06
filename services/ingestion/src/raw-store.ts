import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { AwsClient } from "aws4fetch";

export interface RawArtifact {
  readonly sha256: string;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly retrievedAt: Date;
  readonly httpStatus: number | null;
  readonly contentType: string | null;
  readonly byteSize: number;
  readonly storagePath: string;
  /** Which store holds the bytes — `file` or `s3://<bucket>`. Recorded on the row. */
  readonly storedIn: string;
}

/** Where a collector's bytes were put, for loaders that build their own row. */
export interface Retained {
  readonly storagePath: string;
  readonly storedIn: string;
}

export function sha256Of(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Content-addressed path, fanned out two levels so no directory accumulates
 * hundreds of thousands of entries: `ab/cd/abcd…`. The same string is the
 * object key in an object store.
 */
export function storagePathFor(sourceId: string, sha256: string): string {
  return join(sourceId, sha256.slice(0, 2), sha256.slice(2, 4), sha256);
}

/**
 * Somewhere bytes can be put and not changed afterwards.
 *
 * WHY THIS IS AN INTERFACE
 * Until 29 September 2026 the only store was a directory. Loads run from a
 * laptop left the bytes on the laptop, and the nightly tender sweep runs on a
 * GitHub runner that is deleted when the job ends, so its bytes were never kept
 * at all. Production rows carried hashes of bytes nobody held. An object store
 * is the durable home; the directory stays for local work.
 */
export interface RawStore {
  /** Recorded on every artefact row, so a reader can tell where the bytes are. */
  readonly location: string;
  put(
    relativePath: string,
    bytes: Buffer,
    sha256: string,
    contentType: string | null,
  ): Promise<void>;
}

/**
 * A store that can give bytes back, so a document can be re-read with a better
 * parser without being downloaded again — the reason the store exists
 * (ADR-069). A read is verified against the hash it is addressed by: bytes that
 * no longer match their address are a failure to surface, never data to parse.
 */
export interface ReadableRawStore extends RawStore {
  get(relativePath: string, sha256: string): Promise<Buffer>;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function integrityFailure(relativePath: string, why: string): Error {
  return new Error(
    `Raw store integrity failure: ${relativePath} ${why}. ` +
      `The store is append-only and its contents must never change.`,
  );
}

/** A directory. Durable only as long as the machine holding it. */
export class FileRawStore implements ReadableRawStore {
  readonly location = "file";

  constructor(private readonly root: string) {}

  async put(relativePath: string, bytes: Buffer, sha256: string): Promise<void> {
    const absolutePath = join(this.root, relativePath);
    if (await exists(absolutePath)) {
      // Verified rather than trusted: a mismatch means the store no longer
      // holds what it claims, and must surface rather than be overwritten.
      if (sha256Of(await readFile(absolutePath)) !== sha256) {
        throw integrityFailure(relativePath, "does not hash to its own content address");
      }
      return;
    }
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes, { flag: "wx" });
  }

  async get(relativePath: string, sha256: string): Promise<Buffer> {
    const bytes = await readFile(join(this.root, relativePath));
    if (sha256Of(bytes) !== sha256) {
      throw integrityFailure(relativePath, "does not hash to its own content address");
    }
    return bytes;
  }
}

/** A signed request, so tests can stand in for the network. */
export type SignedFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface ObjectStoreConfig {
  /** e.g. `https://<account>.r2.cloudflarestorage.com` — no bucket, no trailing slash. */
  readonly endpoint: string;
  readonly bucket: string;
}

/**
 * Any S3-compatible bucket: Cloudflare R2 in production, by decision on
 * 29 September 2026 (`.docs/16-operations/raw-store.md`).
 *
 * An object that already exists is checked against the hash and size it was
 * stored with, not downloaded and re-hashed: an OSM artefact is 200 MB, and the
 * sweep would re-read every one it had already kept. The check still catches a
 * key holding different bytes, which is the failure that matters.
 */
export class ObjectRawStore implements ReadableRawStore {
  readonly location: string;

  constructor(
    private readonly config: ObjectStoreConfig,
    private readonly signedFetch: SignedFetch,
  ) {
    this.location = `s3://${config.bucket}`;
  }

  private urlFor(relativePath: string): string {
    const key = relativePath.split("/").map(encodeURIComponent).join("/");
    return `${this.config.endpoint}/${this.config.bucket}/${key}`;
  }

  async put(
    relativePath: string,
    bytes: Buffer,
    sha256: string,
    contentType: string | null,
  ): Promise<void> {
    const url = this.urlFor(relativePath);

    const head = await this.signedFetch(url, { method: "HEAD" });
    if (head.ok) {
      const storedHash = head.headers.get("x-amz-meta-sha256");
      const storedSize = head.headers.get("content-length");
      if (storedHash !== sha256 || storedSize !== String(bytes.byteLength)) {
        throw integrityFailure(relativePath, "holds bytes other than the ones addressed");
      }
      return;
    }
    if (head.status !== 404) {
      throw new Error(
        `Raw store unavailable: HEAD ${relativePath} returned ${String(head.status)}.`,
      );
    }

    const put = await this.signedFetch(url, {
      method: "PUT",
      body: bytes,
      headers: {
        "content-type": contentType ?? "application/octet-stream",
        "content-length": String(bytes.byteLength),
        "x-amz-meta-sha256": sha256,
      },
    });
    if (!put.ok) {
      throw new Error(`Raw store refused ${relativePath}: PUT returned ${String(put.status)}.`);
    }
  }

  async get(relativePath: string, sha256: string): Promise<Buffer> {
    const response = await this.signedFetch(this.urlFor(relativePath), { method: "GET" });
    if (!response.ok) {
      throw new Error(`Raw store: GET ${relativePath} returned ${String(response.status)}.`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (sha256Of(bytes) !== sha256) {
      throw integrityFailure(relativePath, "holds bytes other than the ones addressed");
    }
    return bytes;
  }
}

/** Where local runs keep bytes when no object store is configured. */
export const DEFAULT_RAW_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../data/raw",
);

const OBJECT_STORE_VARIABLES = [
  "RAW_STORE_S3_ENDPOINT",
  "RAW_STORE_S3_BUCKET",
  "RAW_STORE_S3_ACCESS_KEY_ID",
  "RAW_STORE_S3_SECRET_ACCESS_KEY",
] as const;

export class RawStoreMisconfigured extends Error {}

/**
 * The store a collector writes to, chosen by the environment.
 *
 * All four `RAW_STORE_S3_*` variables select the object store. None selects the
 * local directory (`RAW_STORE_ROOT`, or `data/raw` at the repository root) — unless `RAW_STORE_REQUIRE_OBJECT=true`, which the scheduled
 * sweep sets, because a runner's directory is deleted with the runner. Some but
 * not all is a mistake and refused by name, not quietly treated as none.
 */
export function rawStoreFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
  root: string = env["RAW_STORE_ROOT"] ?? DEFAULT_RAW_ROOT,
): ReadableRawStore {
  const present = OBJECT_STORE_VARIABLES.filter((name) => (env[name] ?? "") !== "");

  if (present.length === OBJECT_STORE_VARIABLES.length) {
    const client = new AwsClient({
      accessKeyId: env["RAW_STORE_S3_ACCESS_KEY_ID"] ?? "",
      secretAccessKey: env["RAW_STORE_S3_SECRET_ACCESS_KEY"] ?? "",
      service: "s3",
      region: env["RAW_STORE_S3_REGION"] ?? "auto",
    });
    return new ObjectRawStore(
      {
        endpoint: (env["RAW_STORE_S3_ENDPOINT"] ?? "").replace(/\/+$/u, ""),
        bucket: env["RAW_STORE_S3_BUCKET"] ?? "",
      },
      (url, init) => client.fetch(url, init),
    );
  }

  if (present.length > 0) {
    const missing = OBJECT_STORE_VARIABLES.filter((name) => !present.includes(name));
    throw new RawStoreMisconfigured(
      `The object store is partly configured; missing ${missing.join(", ")}.`,
    );
  }

  if (env["RAW_STORE_REQUIRE_OBJECT"] === "true") {
    throw new RawStoreMisconfigured(
      "RAW_STORE_REQUIRE_OBJECT is set but no object store is configured. " +
        "Bytes written to this machine's disk would not outlive it.",
    );
  }

  return new FileRawStore(root);
}

/**
 * Puts a page a collector already fetched and hashed into the store.
 *
 * For the GePNIC and OSM collectors, which hash the body in memory when it
 * arrives. The hash is recomputed from the bytes actually written and must
 * match: a row that cites one hash while the store holds another is exactly the
 * disagreement this module exists to prevent.
 */
export async function retain(
  store: RawStore,
  sourceId: string,
  fetched: { readonly body: string; readonly sha256: string },
  contentType: string,
): Promise<Retained> {
  const bytes = Buffer.from(fetched.body, "utf8");
  const sha256 = sha256Of(bytes);
  if (sha256 !== fetched.sha256) {
    throw new Error(
      `A fetched ${sourceId} page hashed to ${fetched.sha256.slice(0, 12)}… when read ` +
        `and ${sha256.slice(0, 12)}… when stored; nothing was recorded.`,
    );
  }
  const storagePath = storagePathFor(sourceId, sha256);
  await store.put(storagePath, bytes, sha256, contentType);
  return { storagePath, storedIn: store.location };
}

/**
 * Writes bytes to the raw store and returns their descriptor.
 *
 * Identical content retrieved twice is one artefact, written once. A string is
 * read as a directory, which is how the existing CLIs and tests call it.
 */
export async function putArtifact(
  target: string | RawStore,
  bytes: Buffer,
  meta: Omit<RawArtifact, "sha256" | "byteSize" | "storagePath" | "storedIn">,
): Promise<RawArtifact> {
  const store = typeof target === "string" ? new FileRawStore(target) : target;
  const sha256 = sha256Of(bytes);
  const relativePath = storagePathFor(meta.sourceId, sha256);

  await store.put(relativePath, bytes, sha256, meta.contentType);

  return {
    sha256,
    sourceId: meta.sourceId,
    sourceUrl: meta.sourceUrl,
    retrievedAt: meta.retrievedAt,
    httpStatus: meta.httpStatus,
    contentType: meta.contentType,
    byteSize: bytes.byteLength,
    storagePath: relativePath,
    storedIn: store.location,
  };
}
