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

  console.log('Navigating to http://localhost:8080/login ...');
  await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Sign in
  await page.fill('input[type="email"]', 'ayush.sahare@vit.edu');
  await page.fill('input[placeholder="••••••••"]', 'ayush@123');
  // Click sign in button
  await page.click('button:has-text("Sign In")');

  console.log('Waiting for URL change from /login...');
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15000 });
  console.log('Logged in! URL:', page.url());

  // Test routes
  const modulesToTest = [
    '', // home
    'm/billing',
    'm/accounting',
    'm/inventory',
    'm/crm',
    'm/appointments',
    'm/boarding',
    'm/laboratory',
    'm/pharmacy',
    'm/reports',
    'm/identity'
  ];

  for (const mod of modulesToTest) {
    console.log(`\n================ Testing /${mod} ================`);
    const routeErrors = [];
    const onErr = err => routeErrors.push(err.stack || err.message);
    page.on('pageerror', onErr);

    try {
      await page.goto(`http://localhost:8080/${mod}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);

      const url = page.url();
      const mainText = await page.innerText('body');
      console.log(`Route /${mod} -> URL: ${url}, Body text length: ${mainText.length}`);

      if (mainText.includes("This page didn't load")) {
        console.error(`CRASH on /${mod}: "This page didn't load" detected!`);
      }
      if (mainText.includes("404")) {
        console.error(`404 on /${mod}: 404 detected!`);
      }
      if (mainText.includes("size-8 animate-spin")) {
        console.error(`INFINITE LOADING on /${mod}: Spinner detected!`);
      }
      // Check for presence of key elements
      const hasSpinner = await page.$('.animate-spin');
      if (hasSpinner) {
        console.log(`Note: Page contains a spinner on /${mod}`);
      }
    } catch (e) {
      console.error(`Exception on /${mod}:`, e.message);
    }

    if (routeErrors.length > 0) {
      console.error(`ERRORS on /${mod}:`, routeErrors);
    }
    page.off('pageerror', onErr);
  }

  console.log('\n=== ALL CONSOLE LOGS ===');
  console.log(logs.filter(l => l.includes('[error]') || l.includes('[warning]')).join('\n'));

  await browser.close();
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
