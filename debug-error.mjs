import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    await page.goto('http://localhost:5173/restaurants', { waitUntil: 'domcontentloaded', timeout: 5000 });
    await page.waitForTimeout(2000);
    
    console.log('Console errors:');
    errors.forEach(e => console.log(`  ❌ ${e}`));
    
    if (errors.length === 0) {
      console.log('  (no errors)');
    }
    
    const html = await page.locator('body').innerHTML();
    console.log('\nPage structure:');
    console.log(html.substring(0, 300));
    
  } finally {
    await browser.close();
  }
})();
