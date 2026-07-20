// Extract restaurants from supabase backup and insert them

const restaurants = [
  {
    slug: 'acme-oyster-house',
    name: 'Acme Oyster House',
    entity_type: 'restaurant',
    entity_subtype: 'restaurant',
    phone: '(251) 424-1783',
    website_url: 'http://acmeoyster.com/',
    city: 'Gulf Shores',
    state: 'AL',
    address_line_1: '216 E 24th Ave, Gulf Shores, AL 36542',
    rating: 4.5,
    review_count: 3351,
    hero_image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    description: 'Lively New Orleans-based chain offering oysters, po\' boys, gumbo & other Cajun-Creole classics. Located in Gulf Shores with waterfront views and fresh seafood daily.',
    price_range: '$$',
    tags: ['Oysters', 'Cajun Cuisine', 'Seafood', 'Po\' Boys', 'Gumbo']
  },
  {
    slug: 'the-gulf-restaurant',
    name: 'The Gulf Restaurant',
    entity_type: 'restaurant',
    entity_subtype: 'restaurant',
    phone: '(251) 968-7529',
    website_url: 'https://thegulfgulfshores.com',
    city: 'Gulf Shores',
    state: 'AL',
    address_line_1: '822 W Beach Blvd, Gulf Shores, AL 36542',
    rating: 4.3,
    review_count: 892,
    hero_image_url: 'https://images.unsplash.com/photo-1504674900967-77800e8e33fe?w=800&q=80',
    description: 'Upscale casual dining with fresh Gulf seafood. Features daily specials and a full bar with craft cocktails. Beautiful sunset views over the beach.',
    price_range: '$$$',
    tags: ['Gulf Seafood', 'Fine Dining', 'Sunset Views', 'Happy Hour', 'Craft Cocktails']
  },
  {
    slug: 'steelies-taproom',
    name: 'Steelies Taproom',
    entity_type: 'restaurant',
    entity_subtype: 'bar',
    phone: '(251) 968-7778',
    website_url: 'https://steelies-gulf-shores.com',
    city: 'Gulf Shores',
    state: 'AL',
    address_line_1: '26 E 23rd Ave, Gulf Shores, AL 36542',
    rating: 4.6,
    review_count: 1243,
    hero_image_url: 'https://images.unsplash.com/photo-1514432324607-2e467f4af445?w=800&q=80',
    description: 'Sports bar with 200+ craft beers on tap. Full kitchen menu with wings, burgers, and seafood. Known for lively atmosphere and local vibe.',
    hh_days: 'Mon-Fri',
    hh_start: '14:00',
    hh_end: '18:00',
    price_range: '$$',
    tags: ['Craft Beer', 'Sports Bar', 'Wings', 'Happy Hour', 'Local Favorite']
  },
  {
    slug: 'zeke-lous-coffee',
    name: 'Zeke & Lou\'s Coffee Roastery',
    entity_type: 'restaurant',
    entity_subtype: 'cafe',
    phone: '(251) 968-7634',
    website_url: 'https://zekeandlous.com',
    city: 'Orange Beach',
    state: 'AL',
    address_line_1: '27244 Perdido Beach Blvd, Orange Beach, AL 36561',
    rating: 4.8,
    review_count: 567,
    hero_image_url: 'https://images.unsplash.com/photo-1511537190424-bbbab87ac5d0?w=800&q=80',
    description: 'Artisan coffee roastery with single-origin beans roasted fresh daily. Pastries from local bakeries. Cozy atmosphere perfect for working or meetings.',
    price_range: '$',
    tags: ['Specialty Coffee', 'Espresso', 'Pastries', 'WiFi', 'Local Roaster']
  }
];

async function insertRestaurants() {
  console.log(`Inserting ${restaurants.length} restaurants from backup...\n`);
  
  let success = 0;
  for (const r of restaurants) {
    try {
      const res = await fetch('http://localhost:3000/api/gcr/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r)
      });
      
      if (res.ok) {
        console.log(`✅ ${r.name}`);
        success++;
      } else {
        const text = await res.text();
        console.log(`❌ ${r.name}: ${res.status}`);
      }
    } catch (err) {
      console.log(`❌ ${r.name}: ${err.message}`);
    }
  }
  
  console.log(`\n✅ Successfully inserted ${success}/${restaurants.length} restaurants`);
}

insertRestaurants().catch(console.error);
