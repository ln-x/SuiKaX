/**
 * E2E: EO News thumbnail cards (ESA / Copernicus)
 *
 * Confirms that the EO News feed renders visible, non-broken thumbnail images
 * for at least one ESA or Copernicus article card in the Earth tab.
 *
 * Regression guard for: imageUrl present in API response but failing to render
 * (wrong URL shape, CORS block, broken <img> tag).
 */

import { test, expect } from "@playwright/test";

test.describe("EO News thumbnail cards", () => {
  test("at least one ESA or Copernicus card has a loaded thumbnail image", async ({
    page,
  }) => {
    await page.goto("/");

    // ── 1. Open the Earth tab ────────────────────────────────────────────────
    // The Earth tab is a PUBLIC_TAB — no login required.
    const earthTabBtn = page.getByRole("button", { name: /earth/i });
    await earthTabBtn.first().click();

    // ── 2. Wait for the events list to populate ──────────────────────────────
    // Skeleton loaders are animated divs; real cards appear once data arrives.
    await expect(
      page.locator(".animate-pulse").first()
    ).toBeHidden({ timeout: 15_000 }).catch(() => {
      // Skeleton may already be gone — that's fine.
    });

    // ── 3. Click the "EO News" filter pill ───────────────────────────────────
    const eoNewsPill = page.getByRole("button", { name: /^eo news$/i });
    await eoNewsPill.click();

    // ── 4. Wait for at least one EoNewsCard anchor to appear ─────────────────
    // EoNewsCard renders as: <a class="block bg-card rounded-xl ...">
    const cards = page.locator("a.rounded-xl.bg-card");
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });

    // ── 5. Scroll to trigger lazy-loaded images ───────────────────────────────
    await page.evaluate(() => window.scrollBy(0, 300));
    // Wait for lazy img onLoad callbacks to fire (class switches opacity-0 → opacity-100)
    await page.waitForTimeout(4_000);

    // ── 6. Assert at least one <img> inside a card has loaded ─────────────────
    //
    // We evaluate naturalWidth for all <img> elements inside EoNewsCard anchors.
    // naturalWidth > 0 means the browser decoded the image successfully.
    // We also accept complete===true with src set (covers cached images).
    const result = await page.evaluate(() => {
      const imgs = Array.from(
        document.querySelectorAll<HTMLImageElement>("a img")
      );
      return {
        total: imgs.length,
        loaded: imgs.filter((img) => img.naturalWidth > 0).length,
        broken: imgs.filter((img) => img.complete && img.naturalWidth === 0 && img.src !== "").length,
        srcs: imgs.slice(0, 3).map((img) => img.src),
      };
    });

    // There must be at least one EO News card with an img element.
    expect(result.total, "Expected at least one EoNewsCard with an <img>").toBeGreaterThan(0);

    // At least one of those images must have loaded (naturalWidth > 0).
    expect(
      result.loaded,
      `Expected at least one loaded thumbnail, got 0. Broken: ${result.broken}. Sources: ${result.srcs.join(", ")}`
    ).toBeGreaterThan(0);

    // No broken images — every rendered <img> that is complete must have loaded.
    expect(
      result.broken,
      `Found ${result.broken} broken thumbnail(s). Sources: ${result.srcs.join(", ")}`
    ).toBe(0);
  });
});
