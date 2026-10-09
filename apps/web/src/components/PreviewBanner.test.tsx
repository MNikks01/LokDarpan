import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PreviewBanner } from "./PreviewBanner";

describe("PreviewBanner", () => {
  it("says the page is private and not to be shared", () => {
    const html = renderToStaticMarkup(<PreviewBanner />);
    expect(html).toContain("Private preview");
    expect(html).toContain("Do not share it.");
  });
});
