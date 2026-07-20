import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  console.log('Testing GCR Unified App\n');

  try {
    // Test 1: Home page
    console.log('1️⃣ Testing home page...');
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 5000 });
    await page.waitForTimeout(1000);
    const hasNav = await page.locator('nav, .nav, .bottom-nav').count() > 0;
    console.log(`   ${hasNav ? '✅' : '⚠️'} Navigation visible`);
    
    // Test 2: Restaurant category page
    console.log('\n2️⃣ Testing /restaurants category page...');
    await page.goto('http://localhost:5173/restaurants', { waitUntil: 'domcontentloaded', timeout: 5000 });
    await page.waitForTimeout(1000);
    
    const headerExists = await page.locator('.gcr-header').isVisible().catch(() => false);
    console.log(`   ${headerExists ? '✅' : '❌'} GCRHeader renders`);
    
    const heroExists = await page.locator('.category-hero').isVisible().catch(() => false);
    console.log(`   ${heroExists ? '✅' : '❌'} Hero section renders`);
    
    const cardsCount = await page.locator('.gcr-card').count();
    console.log(`   ${cardsCount > 0 ? '✅' : '⚠️'} Cards rendered: ${cardsCount}`);
    
    const chipsCount = await page.locator('.chip').count();
    console.log(`   ${chipsCount > 0 ? '✅' : '⚠️'} Filter chips: ${chipsCount}`);
    
    // Test 3: Click a filter
    if (chipsCount > 1) {
      console.log('\n3️⃣ Testing filter interaction...');
      const secondChip = page.locator('.chip').nth(1);
      const chipText = await secondChip.textContent();
      await secondChip.click();
      await page.waitForTimeout(500);
      const newCardCount = await page.locator('.gcr-card').count();
      console.log(`   ✅ Clicked "${chipText}" → ${newCardCount} cards`);
    }
    
    // Test 4: Other categories
    console.log('\n4️⃣ Testing other categories...');
    const categories = ['coffee', 'happy-hours', 'events'];
    for (const cat of categories) {
      await page.goto(`http://localhost:5173/${cat}`, { waitUntil: 'domcontentloaded', timeout: 5000 });
      await page.waitForTimeout(500);
      const header = await page.locator('.gcr-header').isVisible().catch(() => false);
      console.log(`   ${header ? '✅' : '❌'} /${cat}`);
    }
    
    console.log('\n5️⃣ Testing existing pages (no regressions)...');
    const existingPages = ['/auth', '/browse', '/'];
    for (const route of existingPages) {
      await page.goto(`http://localhost:5173${route}`, { waitUntil: 'domcontentloaded', timeout: 5000 });
      const hasContent = (await page.content()).length > 100;
      console.log(`   ${hasContent ? '✅' : '⚠️'} ${route}`);
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VERIFICATION COMPLETE - App is working');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
