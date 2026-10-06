import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { geometryPath, projectionFor, ringPath } = await import("./india-map");

describe("the homepage map's projection", () => {
  const projection = projectionFor([70, 10, 90, 30], 600);

  it("puts the north-west corner at the origin and keeps north up", () => {
    expect(projection.project(70, 30)).toEqual([0, 0]);
    const [, south] = projection.project(70, 10);
    expect(south).toBeCloseTo(projection.height);
  });

  it("fills the requested width and shortens longitude by the cosine of the middle latitude", () => {
    const [east] = projection.project(90, 30);
    expect(east).toBeCloseTo(600);
    // 20° of latitude is taller than 20° of longitude at 20°N.
    expect(projection.height / projection.width).toBeCloseTo(1 / Math.cos((20 * Math.PI) / 180));
  });
});

describe("thinning a ring to what can be seen", () => {
  const projection = projectionFor([0, 0, 10, 10], 100);

  it("keeps a visible ring as a closed path in whole pixels", () => {
    const d = ringPath(
      [
        [0, 10],
        [5, 10],
        [5, 5],
        [0, 5],
        [0, 10],
      ],
      projection,
      1,
    );
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
    expect(d).not.toMatch(/\d\.\d/u);
  });

  it("drops a speck too small to see rather than drawing a dot", () => {
    const speck = ringPath(
      [
        [5, 5],
        [5.01, 5],
        [5.01, 5.01],
        [5, 5],
      ],
      projection,
      1.6,
    );
    expect(speck).toBe("");
  });

  it("draws every ring of a multipolygon", () => {
    const square = (x: number): number[][] => [
      [x, 0],
      [x + 4, 0],
      [x + 4, 4],
      [x, 4],
      [x, 0],
    ];
    const d = geometryPath(
      { type: "MultiPolygon", coordinates: [[square(0)], [square(5)]] },
      projection,
      1,
    );
    expect(d.match(/M/gu)).toHaveLength(2);
  });
});
