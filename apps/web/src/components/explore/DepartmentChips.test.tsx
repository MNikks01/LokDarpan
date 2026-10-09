import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DepartmentChips } from "./DepartmentChips";

const noop = (): void => undefined;
const departments = [
  { name: "PWD", tenderCount: 4 },
  { name: "Local Self Government Department", tenderCount: 7 },
  { name: "Kerala Water Authority", tenderCount: 1 },
];

describe("DepartmentChips", () => {
  it("lists departments alphabetically, never by size, each with its count", () => {
    const html = renderToStaticMarkup(
      <DepartmentChips departments={departments} selected={null} onSelect={noop} />,
    );
    const order = [
      "All departments",
      "Kerala Water Authority · 1",
      "Local Self Government Department · 7",
      "PWD · 4",
    ];
    const at = order.map((label) => html.indexOf(label));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("marks the chosen department as pressed, and offers all departments", () => {
    const html = renderToStaticMarkup(
      <DepartmentChips departments={departments} selected="PWD" onSelect={noop} />,
    );
    expect(html).toMatch(/aria-pressed="true"[^>]*>PWD · 4/u);
    expect(html).toMatch(/aria-pressed="false"[^>]*>All departments/u);
  });

  it("draws nothing for a state with no departments to choose from", () => {
    expect(
      renderToStaticMarkup(<DepartmentChips departments={[]} selected={null} onSelect={noop} />),
    ).toBe("");
  });
});
