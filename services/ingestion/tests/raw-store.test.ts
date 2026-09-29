import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  FileRawStore,
  ObjectRawStore,
  RawStoreMisconfigured,
  putArtifact,
  rawStoreFromEnv,
  retain,
  sha256Of,
  storagePathFor,
  type SignedFetch,
} from "../src/raw-store.js";

const meta = {
  sourceId: "lgd",
  sourceUrl: "https://lgdirectory.gov.in/globalviewstateforcitizen.do",
  retrievedAt: new Date("2026-08-25T00:00:00Z"),
  httpStatus: 200,
  contentType: "text/html;charset=UTF-8",
};

const root = (): Promise<string> => mkdtemp(join(tmpdir(), "lokdarpan-raw-"));

describe("storagePathFor", () => {
  it("fans out two levels so no directory holds the whole corpus", () => {
    const hash = "abcdef".padEnd(64, "0");
    expect(storagePathFor("lgd", hash)).toBe(join("lgd", "ab", "cd", hash));
  });
});

describe("putArtifact", () => {
  it("stores bytes at their content address and reports the hash", async () => {
    const dir = await root();
    const bytes = Buffer.from("<html>states</html>", "utf8");
    const artifact = await putArtifact(dir, bytes, meta);

    expect(artifact.sha256).toBe(sha256Of(bytes));
    expect(artifact.byteSize).toBe(bytes.byteLength);
    await expect(readFile(join(dir, artifact.storagePath))).resolves.toEqual(bytes);
  });

  // The same page fetched twice is one artefact. Without this, a daily ingest
  // would store an identical copy every day.
  it("is idempotent for identical content", async () => {
    const dir = await root();
    const bytes = Buffer.from("same", "utf8");
    const first = await putArtifact(dir, bytes, meta);
    const second = await putArtifact(dir, bytes, meta);
    expect(second.sha256).toBe(first.sha256);
    expect(second.storagePath).toBe(first.storagePath);
  });

  it("gives different content different addresses", async () => {
    const dir = await root();
    const a = await putArtifact(dir, Buffer.from("a"), meta);
    const b = await putArtifact(dir, Buffer.from("b"), meta);
    expect(a.sha256).not.toBe(b.sha256);
  });

  // The store is append-only. If a file no longer hashes to its own address,
  // something has rewritten history and every fact citing it is suspect.
  it("refuses to proceed when a stored file no longer matches its address", async () => {
    const dir = await root();
    const bytes = Buffer.from("original", "utf8");
    const path = join(dir, storagePathFor("lgd", sha256Of(bytes)));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, "tampered", "utf8");

    await expect(putArtifact(dir, bytes, meta)).rejects.toThrow(/integrity failure/i);
  });

  it("preserves the retrieval metadata it was given", async () => {
    const dir = await root();
    const artifact = await putArtifact(dir, Buffer.from("x"), meta);
    expect(artifact.sourceUrl).toBe(meta.sourceUrl);
    expect(artifact.httpStatus).toBe(200);
    expect(artifact.retrievedAt).toEqual(meta.retrievedAt);
  });

  it("says the bytes are on this machine's disk", async () => {
    const artifact = await putArtifact(await root(), Buffer.from("x"), meta);
    expect(artifact.storedIn).toBe("file");
  });
});

/**
 * An S3 bucket held in a map, answering the three requests the store makes.
 * Enough to show what is sent and what is refused, without a network.
 */
function fakeBucket(): {
  fetch: SignedFetch;
  objects: Map<string, { body: Buffer; headers: Headers }>;
} {
  const objects = new Map<string, { body: Buffer; headers: Headers }>();
  const fetch: SignedFetch = (url, init) => {
    const held = objects.get(url);
    if (init.method === "HEAD") {
      if (held === undefined) return Promise.resolve(new Response(null, { status: 404 }));
      return Promise.resolve(new Response(null, { status: 200, headers: held.headers }));
    }
    if (init.method === "PUT") {
      const body = init.body as Buffer;
      objects.set(url, { body, headers: new Headers(init.headers) });
      return Promise.resolve(new Response(null, { status: 200 }));
    }
    return Promise.resolve(new Response(null, { status: 405 }));
  };
  return { fetch, objects };
}

describe("ObjectRawStore", () => {
  const config = { endpoint: "https://acct.r2.example.invalid", bucket: "lokdarpan-raw" };

  it("puts the bytes under their content address, with the hash as metadata", async () => {
    const bucket = fakeBucket();
    const store = new ObjectRawStore(config, bucket.fetch);
    const bytes = Buffer.from("<html>tenders</html>", "utf8");

    const artifact = await putArtifact(store, bytes, { ...meta, sourceId: "gepnic-tn" });

    expect(artifact.storedIn).toBe("s3://lokdarpan-raw");
    const key = `${config.endpoint}/${config.bucket}/${artifact.storagePath}`;
    const held = bucket.objects.get(key);
    expect(held?.body).toEqual(bytes);
    expect(held?.headers.get("x-amz-meta-sha256")).toBe(sha256Of(bytes));
  });

  // The daily sweep sees most pages again. Writing each one again would be
  // wasteful; accepting a key that holds other bytes would be worse.
  it("leaves an identical object alone and refuses a different one at the same key", async () => {
    const bucket = fakeBucket();
    const store = new ObjectRawStore(config, bucket.fetch);
    const bytes = Buffer.from("same", "utf8");
    const sha = sha256Of(bytes);
    const path = storagePathFor("osm", sha);

    await store.put(path, bytes, sha, "application/json");
    await store.put(path, bytes, sha, "application/json");
    expect(bucket.objects.size).toBe(1);

    const held = bucket.objects.get(`${config.endpoint}/${config.bucket}/${path}`);
    held?.headers.set("x-amz-meta-sha256", "0".repeat(64));
    await expect(store.put(path, bytes, sha, "application/json")).rejects.toThrow(
      /integrity failure/i,
    );
  });

  it("fails loudly when the bucket will not answer, rather than recording a row", async () => {
    const store = new ObjectRawStore(config, () =>
      Promise.resolve(new Response(null, { status: 403 })),
    );
    await expect(putArtifact(store, Buffer.from("x"), meta)).rejects.toThrow(/403/);
  });
});

describe("retain", () => {
  it("stores a page fetched and hashed elsewhere, and reports where", async () => {
    const dir = await root();
    const body = "<html>landing</html>";
    const retained = await retain(
      new FileRawStore(dir),
      "gepnic-kl",
      { body, sha256: sha256Of(body) },
      "text/html",
    );

    expect(retained.storedIn).toBe("file");
    await expect(readFile(join(dir, retained.storagePath), "utf8")).resolves.toBe(body);
  });

  it("refuses a page whose bytes do not hash to the hash it arrived with", async () => {
    const dir = await root();
    await expect(
      retain(new FileRawStore(dir), "gepnic-kl", { body: "a", sha256: sha256Of("b") }, "text/html"),
    ).rejects.toThrow(/nothing was recorded/);
  });
});

describe("rawStoreFromEnv", () => {
  const complete = {
    RAW_STORE_S3_ENDPOINT: "https://acct.r2.example.invalid/",
    RAW_STORE_S3_BUCKET: "lokdarpan-raw",
    RAW_STORE_S3_ACCESS_KEY_ID: "id",
    RAW_STORE_S3_SECRET_ACCESS_KEY: "secret",
  };

  it("chooses the object store when all four variables are set", () => {
    expect(rawStoreFromEnv(complete).location).toBe("s3://lokdarpan-raw");
  });

  it("falls back to the local directory when none is set", () => {
    expect(rawStoreFromEnv({}, "/tmp/x").location).toBe("file");
  });

  // A half-configured store would otherwise quietly write to a disk nobody keeps.
  it("refuses a partial configuration and names what is missing", () => {
    const { RAW_STORE_S3_BUCKET: _bucket, ...partial } = complete;
    expect(() => rawStoreFromEnv(partial)).toThrow(RawStoreMisconfigured);
    expect(() => rawStoreFromEnv(partial)).toThrow(/RAW_STORE_S3_BUCKET/);
  });

  it("refuses the local directory where a durable store is required", () => {
    expect(() => rawStoreFromEnv({ RAW_STORE_REQUIRE_OBJECT: "true" })).toThrow(
      /would not outlive it/,
    );
  });
});
