import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Load the homepage
    await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
    
    // Take a screenshot
    await page.screenshot({ path: '/tmp/gcr-unified-home.png', fullPage: true });
    
    // Log page title and check for key elements
    const title = await page.title();
    const bodyText = await page.textContent('body');
    
    console.log(`✓ Page title: ${title}`);
    console.log(`✓ Page loaded successfully`);
    
    // Check for header
    const headerVisible = await page.locator('header, nav, [role="banner"]').first().isVisible().catch(() => false);
    console.log(`✓ Header found: ${headerVisible}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
