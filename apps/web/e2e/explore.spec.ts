import { test, expect } from "@playwright/test";

/**
 * The explorer, asserted at the level a unit test cannot reach: what a reader
 * actually sees when the page is served.
 *
 * WHY THESE ASSERTIONS AND NOT A FULL DRILL-DOWN
 * CI runs this job without a database. The page is built to degrade to outlines
 * with nothing to descend into, which is a real deployment state and worth
 * pinning — a regression that turned that degradation into a 500 would take the
 * whole map down, and nothing else would catch it. The drill-down itself is
 * covered where the data lives, in `geography.integration.test.ts`.
 */
test.describe("explore", () => {
  test("serves the map, and its provenance, with or without a ledger", async ({ page }) => {
    await page.goto("/explore");

    // The map surface exists. A blank page and a broken map look identical to a
    // reader, so this asserts the container is actually rendered.
    await expect(page.getByTestId("map-canvas")).toBeVisible();

    // Where the reader is, before they have chosen anything.
    const location = page.getByRole("navigation", { name: "Location" });
    await expect(location.getByText("India")).toBeVisible();

    // Every boundary drawn is attributed. This is the claim the whole product
    // rests on, and it must not depend on a database being up.
    await expect(page.getByText(/OpenStreetMap/)).toBeVisible();
  });

  test("offers place selection without needing the map", async ({ page }) => {
    await page.goto("/explore");

    // Map interaction is never the only route to a place: a reader who cannot
    // click a small polygon must still be able to reach it.
    // By role, not by label text: "State" alone also matches the "State
    // boundaries" layer toggle.
    await expect(page.getByRole("combobox", { name: "State" })).toBeVisible();
  });

  test("layers can be turned off independently", async ({ page }) => {
    await page.goto("/explore");

    await page.getByRole("button", { name: "Layers" }).click();
    const placeNames = page.getByRole("checkbox", { name: /Place names/ });
    await expect(placeNames).toBeChecked();

    await placeNames.uncheck();
    await expect(placeNames).not.toBeChecked();

    // Turning one layer off leaves the others alone.
    await expect(page.getByRole("checkbox", { name: /State boundaries/ })).toBeChecked();
  });

  test("a deep link is restored rather than reset", async ({ page }) => {
    // §17: copy the address, open it elsewhere, arrive at the same place. The
    // state survives even when the ledger cannot name the unit.
    await page.goto("/explore?state=27&unit=3599");
    await expect(page).toHaveURL(/state=27/);
    await expect(page).toHaveURL(/unit=3599/);
  });

  test("a malformed link degrades to India instead of erroring", async ({ page }) => {
    await page.goto("/explore?state=27&unit=not-a-number");
    await expect(page.getByTestId("map-canvas")).toBeVisible();
    const location = page.getByRole("navigation", { name: "Location" });
    await expect(location.getByText("India")).toBeVisible();
  });
});
