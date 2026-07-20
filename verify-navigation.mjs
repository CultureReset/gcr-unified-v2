import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Load the homepage
    await page.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
    console.log('✓ Homepage loaded');
    
    // Click "Browse Everything" button
    await page.click('button:has-text("Browse Everything")');
    await page.waitForTimeout(1000);
    console.log('✓ "Browse Everything" button clicked');
    
    // Take screenshot of browse page
    await page.screenshot({ path: '/tmp/gcr-unified-browse.png', fullPage: true });
    console.log('✓ Browse page screenshot taken');
    
    // Navigate back
    await page.click('button, a', { timeout: 5000 }).catch(() => {});
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
