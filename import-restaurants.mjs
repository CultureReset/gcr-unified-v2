import Database from 'better-sqlite3';
import * as fs from 'fs';

// The backup contains tab-separated data - let's create a quick parser
const backupFile = '/Users/owner/supabase_backup_20260525_194734/data.sql';
const content = fs.readFileSync(backupFile, 'utf8');

// Extract the entity table data section
const entityMatch = content.match(/^COPY "public"."entity"[^(]*\([^)]+\) FROM stdin;([\s\S]*?)^\\\.$/m);
if (!entityMatch) {
  console.log('Could not find entity table data');
  process.exit(1);
}

const entityData = entityMatch[1];
const lines = entityData.split('\n').filter(l => l.trim());

console.log(`Found ${lines.length} entity records in backup`);

// Parse each line (tab-separated values)
const entities = [];
for (const line of lines) {
  const parts = line.split('\t');
  
  // The entity table has many columns - we need the right indices
  // Based on the COPY statement: id, place_id, google_maps_uri, slug, name, subtitle, entity_type, entity_subtype, ...
  // Let's extract: id(0), slug(3), name(4), entity_type(6), entity_subtype(7), phone(11), website_url(12), 
  //                address_line_1(18), city(20), state(21), rating(27), review_count(28), description(32),
  //                hero_image_url(33), hh_start(61), hh_end(62), hh_description(63)
  
  if (parts.length < 20) continue;
  
  const entity = {
    id: parts[0]?.replace(/\\N/g, '') || undefined,
    slug: parts[3]?.replace(/\\N/g, '') || undefined,
    name: parts[4]?.replace(/\\N/g, '') || undefined,
    entity_type: parts[6]?.replace(/\\N/g, '') || undefined,
    entity_subtype: parts[7]?.replace(/\\N/g, '') || undefined,
    phone: parts[11]?.replace(/\\N/g, '') || null,
    website_url: parts[12]?.replace(/\\N/g, '') || null,
    address_line_1: parts[18]?.replace(/\\N/g, '') || null,
    city: parts[20]?.replace(/\\N/g, '') || 'Orange Beach',
    state: parts[21]?.replace(/\\N/g, '') || 'AL',
    rating: parts[27]?.replace(/\\N/g, '') ? parseFloat(parts[27]) : null,
    review_count: parts[28]?.replace(/\\N/g, '') ? parseInt(parts[28]) : null,
    description: parts[32]?.replace(/\\N/g, '') || null,
    hero_image_url: parts[33]?.replace(/\\N/g, '') || null,
  };
  
  // Only include restaurants, bars, and cafes
  if (['restaurant', 'bar', 'cafe'].includes(entity.entity_subtype)) {
    entities.push(entity);
  }
}

console.log(`\nFiltered to ${entities.length} restaurants/bars/cafes`);

if (entities.length > 0) {
  // Show sample
  console.log('\nSample entities:');
  entities.slice(0, 3).forEach(e => {
    console.log(`  - ${e.name} (${e.entity_subtype})`);
  });
}

console.log('\n✅ Parse complete. Entities ready for import.');
console.log(`Total: ${entities.length} establishments`);
