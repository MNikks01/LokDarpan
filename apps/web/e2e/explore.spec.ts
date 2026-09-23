import { test, expect, type Page } from "@playwright/test";

/**
 * The explorer, asserted at the level a unit test cannot reach: what a reader
 * actually sees when the page is served.
 *
 * TWO LEGITIMATE STATES, AND THE TESTS KNOW WHICH IS WHICH
 * Boundary geometry is fetched at setup and gitignored, because the upstream
 * dataset declares no licence. So a checkout without it — CI, and a fresh clone
 * — renders a page explaining the command instead of a map. That is not a
 * failure, and asserting the map unconditionally would make CI red for a
 * deliberate design decision.
 *
 * Each test therefore establishes which state it is in and asserts against that.
 * The setup path is what CI exercises; the map path runs where geometry exists.
 */
async function geometryInstalled(page: Page): Promise<boolean> {
  // Both states are rendered after hydration, so a bare isVisible() races the
  // mount and reports "no geometry" for a map that is one frame away. Wait for
  // the page to settle into one of the two, then report which.
  const map = page.getByTestId("map-canvas");
  const setup = page.getByRole("heading", { name: /boundary geometry/i });
  await expect(map.or(setup)).toBeVisible({ timeout: 15_000 });
  return map.isVisible();
}

test.describe("explore", () => {
  test("renders either the map or the command that produces it", async ({ page }) => {
    await page.goto("/explore");

    if (await geometryInstalled(page)) {
      await expect(page.getByTestId("map-canvas")).toBeVisible();
      // Every layer drawn is attributed, separately. Both are ODbL, which
      // permits redistribution only with attribution — so these two lines are
      // the condition on which the map may be shown at all, not decoration.
      await expect(page.getByText(/Base map © OpenStreetMap/)).toBeVisible();
      await expect(page.getByText(/State and district outlines: © OpenStreetMap/)).toBeVisible();
      return;
    }

    // The absence is explained, and the explanation is actionable rather than
    // an apology: a blank map and missing setup look identical otherwise.
    await expect(page.getByRole("heading", { name: /boundary geometry/i })).toBeVisible();
    await expect(page.getByText("geo:fetch")).toBeVisible();
  });

  test("offers place selection without needing the map", async ({ page }) => {
    await page.goto("/explore");
    test.skip(!(await geometryInstalled(page)), "no boundary geometry in this checkout");

    // Map interaction is never the only route to a place: a reader who cannot
    // click a small polygon must still be able to reach it. By role, not label
    // text — "State" alone also matches the "State boundaries" layer toggle.
    await expect(page.getByRole("combobox", { name: "State" })).toBeVisible();
  });

  test("layers can be turned off independently", async ({ page }) => {
    await page.goto("/explore");
    test.skip(!(await geometryInstalled(page)), "no boundary geometry in this checkout");

    await page.getByRole("button", { name: "Layers" }).click();
    const placeNames = page.getByRole("checkbox", { name: /Place names/ });
    await expect(placeNames).toBeChecked();

    await placeNames.uncheck();
    await expect(placeNames).not.toBeChecked();

    // Turning one layer off leaves the others alone.
    await expect(page.getByRole("checkbox", { name: /State boundaries/ })).toBeChecked();
  });

  test("place names never overlap once the map settles, and return after being hidden", async ({
    page,
  }) => {
    await page.goto("/explore");
    test.skip(!(await geometryInstalled(page)), "no boundary geometry in this checkout");

    /** Names drawn at full opacity, and how many pairs of them overlap on screen. */
    const drawn = (): Promise<{ count: number; overlaps: number }> =>
      page.evaluate(() => {
        const rects = [...document.querySelectorAll(".maplibregl-marker span")]
          .filter((e) => getComputedStyle(e).opacity === "1")
          .map((e) => e.getBoundingClientRect());
        let overlaps = 0;
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i];
            const b = rects[j];
            if (
              a &&
              b &&
              a.left < b.right &&
              a.right > b.left &&
              a.top < b.bottom &&
              a.bottom > b.top
            ) {
              overlaps++;
            }
          }
        }
        return { count: rects.length, overlaps };
      });

    // MapLibre's Marker resets its own element's opacity on every camera move.
    // Names hidden on that element came back after the first move — eleven
    // overlapping pairs on the India view — which only a browser shows.
    await expect.poll(async () => (await drawn()).count, { timeout: 10_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1_500);
    expect((await drawn()).overlaps).toBe(0);

    await page.getByRole("button", { name: "Layers" }).click();
    const placeNames = page.getByRole("checkbox", { name: /Place names/ });
    await placeNames.uncheck();
    await expect.poll(async () => (await drawn()).count).toBe(0);
    await placeNames.check();
    await expect.poll(async () => (await drawn()).count).toBeGreaterThan(0);
    expect((await drawn()).overlaps).toBe(0);
  });

  test("search opens and says so when it cannot answer", async ({ page }) => {
    await page.goto("/explore");
    test.skip(!(await geometryInstalled(page)), "no boundary geometry in this checkout");

    await page.getByRole("button", { name: "Search" }).click();
    const dialog = page.getByRole("dialog", { name: "Search places and records" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("searchbox")).toBeFocused();

    await dialog.getByRole("searchbox").fill("nagpur");
    // With or without a ledger it says something true: results, "nothing held
    // matches", or that search is unavailable — never an empty list that reads
    // as "no such place".
    // `.first()`: a working search answers with BOTH a Places and a Records
    // section, and matching two elements is not an ambiguity to resolve — it is
    // the successful case.
    await expect(
      dialog.getByText(/Search is unavailable|Nothing held matches|Places|Records/).first(),
    ).toBeVisible();
  });

  test("a deep link is carried, not reset", async ({ page }) => {
    // The URL is the shareable form of where the reader is: copy it, open it
    // elsewhere, arrive at the same place. True even where the ledger cannot
    // name the unit, because the state lives in the address.
    await page.goto("/explore?state=27&unit=3599");
    await expect(page).toHaveURL(/state=27/);
    await expect(page).toHaveURL(/unit=3599/);
  });

  test("a malformed link degrades instead of erroring", async ({ page }) => {
    const response = await page.goto("/explore?state=27&unit=not-a-number");
    // A junk id in a shared link must not produce a server error.
    expect(response?.status()).toBeLessThan(400);
  });
});
