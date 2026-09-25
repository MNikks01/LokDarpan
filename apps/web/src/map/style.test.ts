import { afterEach, describe, expect, it, vi } from "vitest";
import { basemapAvailable } from "./style";

const serve = (status: number, body: string | ArrayBuffer) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(body, { status }))),
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("whether the base map archive is there", () => {
  it("is when the first bytes are a PMTiles header", async () => {
    serve(
      206,
      new Uint8Array([...new TextEncoder().encode("PMTiles"), 3, 0, 0, 0, 0, 0, 0, 0, 0]).buffer,
    );
    await expect(basemapAvailable("/basemap/x.pmtiles")).resolves.toBe(true);
  });

  // The regression: production answered a missing file with 206 and the first
  // bytes of its HTML 404 page, and the map failed instead of drawing without a
  // base map.
  it("is not when a 206 carries a web page instead", async () => {
    serve(206, "<!DOCTYPE html><");
    await expect(basemapAvailable("/basemap/x.pmtiles")).resolves.toBe(false);
  });

  it("is not when the file is missing", async () => {
    serve(404, "not found");
    await expect(basemapAvailable("/basemap/x.pmtiles")).resolves.toBe(false);
  });

  it("is not when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    await expect(basemapAvailable("/basemap/x.pmtiles")).resolves.toBe(false);
  });
});
