import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.stack || err.message}`);
  });

  await page.goto('http://localhost:8080/login');
  await page.waitForTimeout(1000);
  await page.fill('input[type="email"]', 'ayush.sahare@vit.edu');
  await page.fill('input[placeholder="••••••••"]', 'ayush@123');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);
  console.log('Current URL:', page.url());

  const html = await page.innerHTML('main').catch(() => 'no main found');
  console.log('--- MAIN HTML (first 1000 chars) ---');
  console.log(html.slice(0, 1000));

  const text = await page.innerText('main').catch(() => 'no main found');
  console.log('--- MAIN TEXT (first 1000 chars) ---');
  console.log(text.slice(0, 1000));

  // Now test /m/billing
  console.log('\n--- TESTING /m/billing ---');
  await page.goto('http://localhost:8080/m/billing');
  await page.waitForTimeout(3000);
  const billingText = await page.innerText('main').catch(() => 'no main found');
  console.log('Billing text length:', billingText.length);
  console.log('Billing text preview:', billingText.slice(0, 300));

  // Now test /m/accounting
  console.log('\n--- TESTING /m/accounting ---');
  await page.goto('http://localhost:8080/m/accounting');
  await page.waitForTimeout(3000);
  const acctText = await page.innerText('main').catch(() => 'no main found');
  console.log('Accounting text length:', acctText.length);
  console.log('Accounting text preview:', acctText.slice(0, 300));

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
