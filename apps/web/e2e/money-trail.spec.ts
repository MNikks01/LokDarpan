import { test, expect } from "@playwright/test";

/**
 * The critical journey: follow the money and reach a source.
 * Asserts the docs/15 guarantees a unit test cannot — what a reader actually sees.
 */
test.describe("project money trail", () => {
  test("renders both variances, each with its denominator in words", async ({ page }) => {
    await page.goto("/project/501");

    await expect(page.getByRole("heading", { name: /ODR-14/ })).toBeVisible();

    // Both variances present and named — never a single ambiguous "variance".
    await expect(page.getByText("Release variance (Released − Utilized)")).toBeVisible();
    await expect(page.getByText("Allocation variance (Allocated − Utilized)")).toBeVisible();

    // A percentage never appears without the base it is a percentage OF.
    await expect(page.getByText("% of the released amount")).toBeVisible();
    await expect(page.getByText("% of the allocated amount")).toBeVisible();
  });

  test("every figure carries a source affordance", async ({ page }) => {
    await page.goto("/project/501");
    const sources = page.getByRole("link", { name: /MH (PWD|Treasury|Finance)/ });
    expect(await sources.count()).toBeGreaterThanOrEqual(3);
  });

  test("low-confidence extraction is stated in words, not only a chip", async ({ page }) => {
    await page.goto("/project/501");
    await expect(page.getByText(/may contain a reading error/i)).toBeVisible();
  });

  test("states plainly that this is an arithmetic observation", async ({ page }) => {
    await page.goto("/project/501");
    await expect(page.getByText(/does not indicate that anything is wrong/i)).toBeVisible();
  });

  test("uses no accusatory language anywhere on the page", async ({ page }) => {
    await page.goto("/project/501");
    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const forbidden of ["corrupt", "fraud", "stolen", "scam", "illegal", "suspicious"]) {
      expect(body, `page must not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });

  test("labels fixture data so it cannot be mistaken for a government figure", async ({ page }) => {
    await page.goto("/project/501");
    await expect(page.getByText(/not a government source/i)).toBeVisible();
  });

  test("is keyboard navigable from the skip link", async ({ page }) => {
    await page.goto("/project/501");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /skip to main content/i })).toBeFocused();
  });
});
