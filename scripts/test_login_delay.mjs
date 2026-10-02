import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err);
  });

  console.log('Navigating to /login...');
  await page.goto('http://localhost:8080/login');
  
  // Wait until React Devtools log appears or wait 3s
  await page.waitForTimeout(3000);

  // Check if button has event listeners or test if button click triggers onSubmit
  console.log('Filling email & password...');
  await page.fill('input[type="email"]', 'ayush.sahare@vit.edu');
  await page.fill('input[type="password"]', 'ayush@123');

  // Let's add a listener on page for navigation
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log('Frame navigated to:', frame.url());
    }
  });

  console.log('Now clicking submit button...');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);
  console.log('Final URL:', page.url());

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
