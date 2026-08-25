import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import { putArtifact, sha256Of, storagePathFor } from "../src/raw-store.js";

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
});
