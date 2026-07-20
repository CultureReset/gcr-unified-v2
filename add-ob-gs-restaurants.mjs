import fs from 'fs';

// Load the restaurants JSON
const data = JSON.parse(fs.readFileSync('/Users/owner/IMPORT-RESTAURANTS.json', 'utf8'));
const allRestaurants = data.data;

// Filter for Orange Beach (OB) and Gulf Shores (GS)
const obgsRestaurants = allRestaurants.filter(r => {
  const tags = (r.tags || []).map(t => t.toLowerCase());
  const city = r.city?.toLowerCase() || '';
  return tags.includes('orange beach') || tags.includes('gulf shores') || 
         city.includes('orange beach') || city.includes('gulf shores');
});

console.log(`Found ${obgsRestaurants.length} Orange Beach & Gulf Shores restaurants\n`);

// Show them
obgsRestaurants.forEach((r, i) => {
  console.log(`${i + 1}. ${r.name}`);
  console.log(`   City: ${r.city || 'N/A'}`);
  console.log(`   Rating: ${r.rating || 'N/A'}`);
  console.log(`   Menu items: ${r.menu?.categories?.reduce((sum, cat) => sum + (cat.items?.length || 0), 0) || 0}`);
  console.log();
});

// Save filtered list
fs.writeFileSync('/Users/owner/OB-GS-RESTAURANTS.json', JSON.stringify(obgsRestaurants, null, 2));
console.log(`✅ Saved ${obgsRestaurants.length} restaurants to OB-GS-RESTAURANTS.json`);
