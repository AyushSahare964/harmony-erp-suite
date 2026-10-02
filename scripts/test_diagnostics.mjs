import { chromium } from '@playwright/test';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error(`[UNCAUGHT ERROR] ${err.message}\n${err.stack}`);
  });
  page.on('request', req => {
    if (!req.url().includes('@vite') && !req.url().includes('node_modules')) {
      console.log(`[REQ] ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', res => {
    if (!res.url().includes('@vite') && !res.url().includes('node_modules')) {
      console.log(`[RES ${res.status()}] ${res.url()}`);
    }
  });

  console.log('1. Loading /login...');
  await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  console.log('2. Filling credentials...');
  await page.fill('input[type="email"]', 'ayush.sahare@vit.edu');
  await page.fill('input[type="password"]', 'ayush@123');

  console.log('3. Clicking Sign In button...');
  // Find submit button
  const btn = page.locator('button[type="submit"]');
  console.log('Submit button text:', await btn.innerText());
  await btn.click();

  console.log('4. Waiting up to 8 seconds to see what happens...');
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(1000);
    const url = page.url();
    console.log(`Sec ${i+1}: URL = ${url}`);
    if (!url.includes('/login')) {
      console.log('Successfully navigated to:', url);
      break;
    }
  }

  // Check for any toast messages
  const toasts = await page.$$eval('[data-sonner-toast]', els => els.map(e => e.innerText));
  console.log('Visible toasts:', toasts);

  if (!page.url().includes('/login')) {
    console.log('Waiting 5s on target page...');
    await page.waitForTimeout(5000);
    console.log('Current URL:', page.url());
    console.log('Title:', await page.title());
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('Body preview:\n', bodyText.slice(0, 500));
  } else {
    console.log('Still on login page! Content:');
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(bodyText.slice(0, 500));
  }

  await browser.close();
}

run().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
