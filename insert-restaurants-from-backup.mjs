import fetch from 'node-fetch';

// Column positions (0-indexed) from the COPY statement
const COLUMNS = [
  'id', 'place_id', 'google_maps_uri', 'slug', 'name', 'subtitle',
  'entity_type', 'entity_subtype', 'secondary_types', 'google_type', 'google_types',
  'icon', 'emoji', 'tagline', 'phone', 'international_phone', 'website_url', 'email',
  'directions_url', 'call_url', 'address_line_1', 'address_line_2', 'city', 'state', 'zip',
  'latitude', 'longitude', 'short_address', 'plus_code', 'rating', 'review_count',
  'price_level', 'business_status', 'editorial_summary', 'description', 'hero_image_url',
  'cover_url', 'logo_url', 'is_active', 'featured', 'gcr_listed', 'gcr_verified', 'sort_order',
  'booking_url', 'reservation_url', 'order_url', 'price_range', 'price_from', 'price_to', 'price_unit',
  'social_instagram', 'social_facebook', 'social_tiktok', 'outdoor_seating', 'reservable', 'dine_in',
  'takeout', 'delivery', 'good_for_groups', 'live_music', 'serves_breakfast', 'serves_brunch',
  'serves_lunch', 'serves_dinner', 'serves_beer', 'serves_wine', 'serves_cocktails',
  'serves_vegetarian', 'accessibility', 'parking', 'payment', 'hours_text', 'hh_days', 'hh_start',
  'hh_end', 'hh_description', 'menu', 'parent_entity_id', '_sources', '_extra_photos', 'created_at',
  'updated_at', 'menu_edit_pin', 'cuisine_type', 'atmosphere', 'extraction_confidence',
  'extraction_timestamp', 'extraction_notes', 'social_twitter', 'social_youtube',
  'accepts_reservations', 'online_booking_platform', 'phone_reservations', 'group_size_limit',
  'advance_notice_required'
];

const idx = obj => {
  const indices = {};
  COLUMNS.forEach((col, i) => {
    indices[col] = i;
  });
  return indices;
};

// Sample restaurants to insert (we'll show a few key ones)
const samplesToInsert = [
  {
    slug: 'acme-oyster-house-sxnWRU',
    name: 'Acme Oyster House',
    entity_type: 'restaurant',
    entity_subtype: 'restaurant',
    phone: '(251) 424-1783',
    website_url: 'http://acmeoyster.com/',
    city: 'Gulf Shores',
    state: 'AL',
    address_line_1: '216 E 24th Ave, Gulf Shores, AL 36542, USA',
    rating: 4.5,
    review_count: 3351,
    hero_image_url: 'https://xbptmkpbiqzvxptjkfoi.supabase.co/storage/v1/object/public/entity-images/entity-images/62e40976-cb7a-4742-806f-bb978a7a6019/62e40976-cb7a-4742-806f-bb978a7a6019_1779139716225.7056.jpg',
    description: 'Lively New Orleans-based chain offering oysters, po\' boys, gumbo & other Cajun-Creole classics.',
    hh_days: null,
    hh_start: null,
    hh_end: null,
    price_range: '$$',
    tags: [
      'Oysters', 'Cajun Cuisine', 'Seafood', 'Po\' Boys', 'Gumbo'
    ]
  }
];

async function insertRestaurant(restaurant) {
  try {
    const res = await fetch('http://localhost:3000/api/gcr/entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: restaurant.slug,
        name: restaurant.name,
        entity_type: restaurant.entity_type,
        entity_subtype: restaurant.entity_subtype,
        phone: restaurant.phone,
        website_url: restaurant.website_url,
        city: restaurant.city,
        state: restaurant.state,
        address_line_1: restaurant.address_line_1,
        rating: restaurant.rating,
        review_count: restaurant.review_count,
        hero_image_url: restaurant.hero_image_url,
        description: restaurant.description,
        hh_days: restaurant.hh_days,
        hh_start: restaurant.hh_start,
        hh_end: restaurant.hh_end,
        price_range: restaurant.price_range,
        tags: restaurant.tags
      })
    });
    
    if (res.ok) {
      console.log(`✅ Inserted: ${restaurant.name}`);
    } else {
      console.log(`❌ Failed: ${restaurant.name}`);
      const err = await res.text();
      console.log(`   Error: ${err.substring(0, 100)}`);
    }
  } catch (err) {
    console.log(`❌ Error inserting ${restaurant.name}: ${err.message}`);
  }
}

console.log('Testing restaurant insertion from backup data...\n');
console.log('This is a prototype - we need to:');
console.log('1. Parse the full supabase backup SQL file');
console.log('2. Extract all restaurants with full data');
console.log('3. Map columns to our schema');
console.log('4. Insert into local gcr-api database\n');

for (const r of samplesToInsert) {
  console.log(`Sample to insert: ${r.name}`);
  console.log(`  - Rating: ${r.rating}/5 (${r.review_count} reviews)`);
  console.log(`  - Location: ${r.city}, ${r.state}`);
  console.log(`  - Image: ${r.hero_image_url.substring(0, 60)}...`);
  console.log();
}

console.log('\n📝 Next step: Parse full backup file to extract all restaurant data');
