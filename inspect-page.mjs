import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
    
    // Get all buttons
    const buttons = await page.locator('button').all();
    console.log(`\nFound ${buttons.length} buttons:`);
    for (let i = 0; i < buttons.length; i++) {
      const text = await buttons[i].textContent();
      console.log(`  ${i+1}. "${text?.trim()}"`);
    }
    
    // Get all clickable links
    const links = await page.locator('a[href], button, [role="button"]').all();
    console.log(`\nFound ${links.length} clickable elements`);
    
    // Check for navigation structure
    const nav = await page.locator('nav, [role="navigation"]').all();
    console.log(`Navigation elements: ${nav.length}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
