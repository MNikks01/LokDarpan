import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface RawArtifact {
  readonly sha256: string;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly retrievedAt: Date;
  readonly httpStatus: number | null;
  readonly contentType: string | null;
  readonly byteSize: number;
  readonly storagePath: string;
}

export function sha256Of(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Content-addressed path, fanned out two levels so no directory accumulates
 * hundreds of thousands of entries: `ab/cd/abcd…`.
 */
export function storagePathFor(sourceId: string, sha256: string): string {
  return join(sourceId, sha256.slice(0, 2), sha256.slice(2, 4), sha256);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Writes bytes to the immutable raw store and returns their descriptor.
 *
 * Identical content retrieved twice is one artefact, written once. If a file
 * already exists at the content address its bytes are verified rather than
 * trusted — a mismatch means the store no longer holds what it claims, and
 * that must surface loudly rather than be silently overwritten.
 */
export async function putArtifact(
  root: string,
  bytes: Buffer,
  meta: Omit<RawArtifact, "sha256" | "byteSize" | "storagePath">,
): Promise<RawArtifact> {
  const sha256 = sha256Of(bytes);
  const relativePath = storagePathFor(meta.sourceId, sha256);
  const absolutePath = join(root, relativePath);

  if (await exists(absolutePath)) {
    const existing = await readFile(absolutePath);
    if (sha256Of(existing) !== sha256) {
      throw new Error(
        `Raw store integrity failure: ${relativePath} does not hash to its own content address. ` +
          `The store is append-only and its contents must never change.`,
      );
    }
  } else {
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes, { flag: "wx" });
  }

  return {
    sha256,
    sourceId: meta.sourceId,
    sourceUrl: meta.sourceUrl,
    retrievedAt: meta.retrievedAt,
    httpStatus: meta.httpStatus,
    contentType: meta.contentType,
    byteSize: bytes.byteLength,
    storagePath: relativePath,
  };
}
