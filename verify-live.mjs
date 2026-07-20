import { chromium } from 'playwright';
import fs from 'fs';

const BASE_URL = 'https://gcr-unified.vercel.app';
const SCREENSHOTS_DIR = '/tmp/gcr-screenshots';

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function verify() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('📱 Testing GCR Unified Live Site...\n');

    // Step 1: Home page
    console.log('1️⃣  Loading home page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-home.png` });
    const homeTitle = await page.title();
    console.log(`   ✅ Home loaded - Title: ${homeTitle}`);

    // Step 2: Restaurants
    console.log('\n2️⃣  Restaurants listing...');
    await page.goto(`${BASE_URL}/category/restaurants`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-restaurants.png` });
    const restaurantCards = await page.locator('[class*="Card"]').count();
    console.log(`   ✅ Found ${restaurantCards} restaurant cards`);

    // Step 3: Business detail
    console.log('\n3️⃣  Business profile...');
    const firstCardHref = await page.locator('a[href*="/entity/"]').first().getAttribute('href');
    if (firstCardHref) {
      await page.goto(`${BASE_URL}${firstCardHref}`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-business-detail.png` });
      const businessName = await page.locator('h1, h2').first().textContent();
      console.log(`   ✅ Loaded: ${businessName?.trim()}`);
    }

    // Step 4: Coffee
    console.log('\n4️⃣  Coffee & Sweets...');
    await page.goto(`${BASE_URL}/category/coffee-sweets`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-coffee.png` });
    const coffeeCards = await page.locator('[class*="Card"]').count();
    console.log(`   ✅ Found ${coffeeCards} businesses`);

    // Step 5: Things To Do
    console.log('\n5️⃣  Things To Do...');
    await page.goto(`${BASE_URL}/category/things-to-do`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-things-to-do.png` });
    const thingsCards = await page.locator('[class*="Card"]').count();
    console.log(`   ✅ Found ${thingsCards} businesses`);

    console.log('\n✅ Verification complete!');
    console.log(`📸 Screenshots: ${SCREENSHOTS_DIR}/`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verify().catch(console.error);
