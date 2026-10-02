import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const logs = [];
  const errors = [];
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    errors.push(err.stack || err.message);
  });

  console.log('Navigating to /login...');
  await page.goto('http://localhost:8080/login');
  await page.waitForTimeout(2500);

  await page.fill('input[type="email"]', 'ayush.sahare@vit.edu');
  await page.fill('input[type="password"]', 'ayush@123');
  await page.click('button[type="submit"]');

  await page.waitForURL('http://localhost:8080/', { timeout: 10000 });
  console.log('Logged in to dashboard!');
  await page.waitForTimeout(3000);

  // Take screenshot of dashboard to verify visual render
  await page.screenshot({ path: 'scripts/dash_screenshot.png' });
  console.log('Dashboard screenshot captured');

  // Let's test navigating via sidebar links
  const links = await page.locator('aside nav a').all();
  console.log(`Found ${links.length} sidebar navigation links:`);

  for (const link of links) {
    const text = (await link.innerText()).trim();
    const href = await link.getAttribute('href');
    console.log(`\nNavigating via link: "${text}" (${href})...`);

    const routeErrors = [];
    const onErr = err => routeErrors.push(err.stack || err.message);
    page.on('pageerror', onErr);

    try {
      await link.click();
      await page.waitForTimeout(2500);

      const currentUrl = page.url();
      const bodyText = await page.innerText('body');
      console.log(` -> URL: ${currentUrl}, Content length: ${bodyText.length}`);

      if (bodyText.includes("This page didn't load")) {
        console.error(` -> CRASH ERROR: "This page didn't load" on ${href}`);
      } else if (bodyText.includes("404")) {
        console.error(` -> 404 ERROR on ${href}`);
      } else {
        console.log(` -> SUCCESS! Preview: ${bodyText.slice(0, 100).replace(/\n/g, ' ')}`);
      }
    } catch (e) {
      console.error(` -> Click/Navigation exception on ${href}:`, e.message);
    }

    if (routeErrors.length > 0) {
      console.error(` -> PAGE ERRORS on ${href}:`, routeErrors);
    }
    page.off('pageerror', onErr);
  }

  console.log('\n=== CRITICAL ERRORS LOGGED ===');
  const criticalLogs = logs.filter(l => l.includes('[error]'));
  console.log(criticalLogs.length ? criticalLogs.join('\n') : 'Zero console errors!');

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
