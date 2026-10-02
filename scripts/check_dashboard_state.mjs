import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[PAGE_ERROR] ${err.stack || err.message}`));
  page.on('requestfailed', req => logs.push(`[REQ_FAILED] ${req.url()} : ${req.failure()?.errorText}`));

  console.log('Navigating to login...');
  await page.goto('http://localhost:8080/login');
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"]', 'ayush.sahare@vit.edu');
  await page.fill('input[type="password"]', 'ayush@123');
  await page.click('button[type="submit"]');
  await page.waitForURL('http://localhost:8080/', { timeout: 10000 });
  console.log('Logged in, waiting 6 seconds on dashboard...');
  await page.waitForTimeout(6000);

  console.log('Dashboard title:', await page.title());
  const bodyText = await page.innerText('body');
  console.log('Dashboard text length:', bodyText.length);
  console.log('Dashboard text preview:\n', bodyText.slice(0, 1500));
  
  await page.screenshot({ path: 'dashboard_screenshot.png' });
  console.log('Screenshot saved to dashboard_screenshot.png');
  console.log('Logs on dashboard:', logs.filter(l => !l.includes('[debug]')));

  // Now test navigating to all routes via clicking sidebar or URL
  const routes = [
    '/m/crm',
    '/m/crm-pets',
    '/m/billing',
    '/m/accounting',
    '/m/inventory',
    '/m/appointments',
    '/m/laboratory',
    '/m/pharmacy',
    '/m/reports'
  ];

  for (const route of routes) {
    console.log(`\nNavigating to ${route}...`);
    try {
      await page.goto(`http://localhost:8080${route}`, { waitUntil: 'load', timeout: 10000 });
      await page.waitForTimeout(3000);
      const text = await page.innerText('body');
      const hasError = text.includes("This page didn't load") || text.includes('Error') || text.includes('404');
      console.log(`Route ${route}: textLength=${text.length}, URL=${page.url()}, hasErrorText=${hasError}`);
      if (text.length < 200 || hasError) {
        console.log(`Preview of ${route}:`, text.slice(0, 400));
      }
    } catch (e) {
      console.error(`Route ${route} FAILED:`, e.message);
    }
  }

  await browser.close();
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
