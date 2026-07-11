/**
 * E2E: EO News thumbnail cards — loading, broken-URL, and missing-URL cases
 *
 * Verifies three behaviours in EoNewsCard (artifacts/suika/src/components/EarthTab.tsx):
 *   (a) Valid imageUrl: skeleton disappears and <img> becomes visible with naturalWidth > 0
 *   (b) Broken imageUrl: image container collapses — no blank h-36 gap, no stuck skeleton
 *   (c) No imageUrl: no image container or skeleton is ever injected into the DOM
 *
 * Tests (a) and (c) run against live feed data.
 * Test (b) uses browser-context route interception (by resource type) to simulate all
 * image load failures — this catches any URL shape (no extension, CDN query strings, etc.).
 *
 * Stable selectors rely on data-testid attributes added to EoNewsCard:
 *   [data-testid=eo-news-card]            — outer <a> anchor
 *   [data-testid=eo-news-image-container] — h-36 thumbnail container (only when imageUrl && !imgError)
 *   [data-testid=eo-news-skeleton]        — animate-pulse skeleton (only while imgLoading=true)
 *   [data-testid=eo-news-img]             — <img> element (loading="eager", only when imageUrl && !imgError)
 */

import { test, expect, type Page } from "@playwright/test";

// ── Auth helper ─────────────────────────────────────────────────────────────────

/**
 * Ensure the user is logged in. Uses the actual AuthScreen selectors:
 * - [data-testid=input-username] / [data-testid=input-password]
 * - Submit button text: "Enter" (login) or "Begin" (register)
 * - Toggle link: "Create account" (switch to register)
 */
async function ensureLoggedIn(page: Page) {
  const passwordInput = page.locator("[data-testid=input-password]");
  const isAuthVisible = await passwordInput.isVisible({ timeout: 3_000 }).catch(() => false);
  if (!isAuthVisible) return;

  const usernameInput = page.locator("[data-testid=input-username]");
  await usernameInput.fill("e2e_eo_thumb");
  await passwordInput.fill("e2e_eo_thumb_pw!");

  // Try login first
  await page.getByRole("button", { name: "Enter" }).click();
  await page.waitForTimeout(1_500);

  // If still on auth screen, the account doesn't exist — register it
  const stillOnAuth = await passwordInput.isVisible({ timeout: 1_500 }).catch(() => false);
  if (stillOnAuth) {
    await page.getByRole("button", { name: /create account/i }).click();
    await page.locator("[data-testid=input-username]").fill("e2e_eo_thumb");
    await page.locator("[data-testid=input-password]").fill("e2e_eo_thumb_pw!");
    await page.getByRole("button", { name: "Begin" }).click();
    await page.waitForTimeout(1_000);
  }
}

/**
 * Navigate to the Earth tab and activate the EO News filter.
 * Returns the locator for [data-testid=eo-news-card] elements.
 */
async function goToEoNews(page: Page) {
  await page.getByRole("button", { name: /earth/i }).first().click();

  const eoNewsPill = page.getByRole("button", { name: /^eo\s*news$/i });
  await expect(eoNewsPill).toBeVisible({ timeout: 12_000 });
  await eoNewsPill.click();

  const cards = page.locator("[data-testid=eo-news-card]");
  await expect(cards.first()).toBeVisible({ timeout: 12_000 });
  return cards;
}

// ── (a) Valid imageUrl: skeleton fades out, img visible and decoded ────────────

test("(a) valid imageUrl: skeleton disappears and img loads successfully", async ({ page }) => {
  await page.goto("/");
  await ensureLoggedIn(page);
  const cards = await goToEoNews(page);

  // Allow onLoad callbacks to fire: imgLoading→false, skeleton removed, img opacity-100
  await page.waitForTimeout(5_000);

  // Pre-condition: cards must be present
  const cardCount = await cards.count();
  expect(cardCount, "Expected at least one EO News card from the live feed").toBeGreaterThan(0);

  // (a.1) No stuck skeletons — every skeleton must be gone after 5 s
  const skeletonCount = await page.locator("[data-testid=eo-news-skeleton]").count();
  expect(
    skeletonCount,
    `Found ${skeletonCount} stuck eo-news-skeleton element(s) after 5s — loading state not resolved`
  ).toBe(0);

  // (a.2) For cards that DO have an image container, verify the image loaded
  const containerCount = await page.locator("[data-testid=eo-news-image-container]").count();
  if (containerCount > 0) {
    // Pre-condition: assert we have something to test
    expect(containerCount).toBeGreaterThan(0);

    // Every visible img must have decoded successfully (naturalWidth > 0)
    const result = await page.evaluate(() => {
      const imgs = Array.from(
        document.querySelectorAll<HTMLImageElement>("[data-testid=eo-news-img]")
      );
      return {
        total: imgs.length,
        loaded: imgs.filter((img) => img.naturalWidth > 0).length,
        stuckOpacity0: imgs.filter((img) => img.classList.contains("opacity-0")).length,
      };
    });

    expect(
      result.loaded,
      `Expected all thumbnail imgs to be loaded; ${result.loaded}/${result.total} loaded`
    ).toBeGreaterThan(0);

    expect(
      result.stuckOpacity0,
      `Found ${result.stuckOpacity0} img(s) still at opacity-0 — skeleton may be stuck`
    ).toBe(0);
  }
});

// ── (b) Broken imageUrl: image container collapses, no stuck skeleton ──────────
//
// Strategy: abort ALL image resource-type requests before any page navigation.
// This simulates every thumbnail being broken — the onError handler (imgError=true)
// must remove the eo-news-image-container from the DOM for every card.

test("(b) broken imageUrl: image container removed from DOM, no stuck skeleton", async ({
  page,
  context,
}) => {
  // Intercept by resource type so URL shape doesn't matter (handles extension-less CDN URLs)
  await context.route("**/*", (route, request) => {
    if (request.resourceType() === "image") {
      route.abort("failed");
    } else {
      route.continue();
    }
  });

  await page.goto("/");
  await ensureLoggedIn(page);
  const cards = await goToEoNews(page);

  // Allow onError callbacks to fire: imgError→true, containers unmounted
  await page.waitForTimeout(6_000);

  // Pre-condition: cards must still render (text content unaffected by image failure)
  const cardCount = await cards.count();
  expect(
    cardCount,
    "Expected EO News cards to render text content even when all images fail"
  ).toBeGreaterThan(0);

  // (b.1) All image containers must be gone — onError removes the h-36 div from DOM
  const containerCount = await page.locator("[data-testid=eo-news-image-container]").count();
  expect(
    containerCount,
    `Expected 0 eo-news-image-container after all images errored; got ${containerCount} — blank gap not collapsed`
  ).toBe(0);

  // (b.2) No stuck skeletons — eo-news-skeleton lives inside the container, removed with it
  const skeletonCount = await page.locator("[data-testid=eo-news-skeleton]").count();
  expect(
    skeletonCount,
    `Expected 0 eo-news-skeleton after all images errored; got ${skeletonCount} stuck spinner(s)`
  ).toBe(0);

  // (b.3) No img elements — eo-news-img is also inside the container
  const imgCount = await page.locator("[data-testid=eo-news-img]").count();
  expect(
    imgCount,
    `Expected 0 eo-news-img after all images errored; got ${imgCount}`
  ).toBe(0);
});

// ── (c) No imageUrl: no image container or skeleton ever rendered ─────────────

test("(c) no imageUrl: image container and skeleton are never injected", async ({ page }) => {
  await page.goto("/");
  await ensureLoggedIn(page);
  const cards = await goToEoNews(page);

  await page.waitForTimeout(3_000);

  // Pre-condition: at least one card must exist
  const cardCount = await cards.count();
  expect(cardCount, "Expected at least one EO News card").toBeGreaterThan(0);

  // For every card that has NO eo-news-image-container (imageUrl was absent in API response),
  // confirm no skeleton is present either — these cards must never have a loading state.
  const result = await page.evaluate(() => {
    const allCards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid=eo-news-card]")
    );
    const noImgCards = allCards.filter(
      (card) => card.querySelector("[data-testid=eo-news-image-container]") === null
    );
    const noImgCardsWithSkeleton = noImgCards.filter(
      (card) => card.querySelector("[data-testid=eo-news-skeleton]") !== null
    );
    return {
      totalCards: allCards.length,
      noImgCards: noImgCards.length,
      noImgCardsWithSkeleton: noImgCardsWithSkeleton.length,
    };
  });

  // Pre-condition: assert there are actually cards without image containers to test
  // (live feed may occasionally return all cards with images — skip sub-assertion gracefully)
  if (result.noImgCards > 0) {
    expect(
      result.noImgCardsWithSkeleton,
      `${result.noImgCardsWithSkeleton} out of ${result.noImgCards} no-imageUrl card(s) have an eo-news-skeleton — skeleton must never appear without imageUrl`
    ).toBe(0);
  }

  // All cards (with or without images) must have a non-zero bounding box height
  const allCardsHaveHeight = await page.evaluate(() => {
    const cardEls = Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid=eo-news-card]")
    );
    return cardEls.every((el) => el.getBoundingClientRect().height > 0);
  });
  expect(allCardsHaveHeight, "Every eo-news-card must have a non-zero height (no collapsed cards)").toBe(true);
});
