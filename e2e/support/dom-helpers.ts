import type { Locator, Page } from '@playwright/test';

/**
 * TanStack Start server-renders the page, then hydrates on the client. A click/fill
 * that lands before hydration attaches React's event listeners falls through to the
 * browser's native (unhandled) form behavior — e.g. a plain GET reload of the same
 * URL instead of the SPA's onSubmit handler. Give hydration a moment after any full
 * page load (goto/reload) before interacting.
 */
export async function gotoReady(page: Page, path: string) {
  // waitUntil: 'domcontentloaded' — the default 'load' can hang indefinitely against the
  // Vite dev server (its HMR websocket/dev-client keeps the network "busy"), even though
  // the DOM (and hydration target) is long since ready.
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
}

export async function reloadReady(page: Page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
}

/**
 * Vite dev-server hydration can lag behind Playwright's fill(), so a value typed
 * before React attaches gets wiped when hydration resets the controlled input.
 * Retries the fill until the DOM value actually sticks.
 */
export async function fillStable(locator: Locator, value: string) {
  await locator.waitFor({ state: 'visible', timeout: 15000 });
  for (let attempt = 0; attempt < 6; attempt++) {
    await locator.fill(value);
    if ((await locator.inputValue()) === value) return;
    await locator.page().waitForTimeout(250);
  }
  throw new Error(`fillStable: value "${value}" did not stick on ${locator}`);
}
