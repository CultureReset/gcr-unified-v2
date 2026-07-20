import pg from 'pg'
import fs from 'fs'

const { Client } = pg
const client = new Client({
  connectionString: 'postgresql://postgres:Dont4getthiscybercheck%24@db.mkepugvdlktfsossumox.supabase.co:5432/postgres'
})

async function convertToJson() {
  try {
    console.log('🔄 Connecting to database...')
    await client.connect()
    console.log('✅ Connected\n')

    // Increase timeout
    await client.query('SET statement_timeout = 600000')

    // Get ALL entities sorted by name
    console.log('📍 Fetching ALL entities...')
    const { rows: entities } = await client.query('SELECT id, slug, name FROM public.entity ORDER BY name')
    console.log(`✅ Found ${entities.length} entities\n`)

    const result = []
    let processed = 0

    // For EACH entity, get ALL related data
    for (const entity of entities) {
      processed++
      process.stdout.write(`\r[${processed}/${entities.length}] Processing: ${entity.name.substring(0, 40)}...`)

      // Fetch ALL related data in parallel
      const [menuItems, menuSections, photos, hours, events, pricing, happyHour, drinkItems, tags, features, sections, activityData, requirementsData] = await Promise.all([
        client.query('SELECT * FROM public.menu_items WHERE entity_slug = $1', [entity.slug]),
        client.query('SELECT * FROM public.menu_sections WHERE entity_slug = $1', [entity.slug]),
        client.query('SELECT * FROM public.entity_photos WHERE entity_slug = $1', [entity.slug]),
        client.query('SELECT * FROM public.entity_hours WHERE entity_slug = $1', [entity.slug]),
        client.query('SELECT * FROM public.entity_events WHERE entity_slug = $1', [entity.slug]),
        client.query('SELECT * FROM public.pricing_items WHERE entity_slug = $1', [entity.slug]),
        client.query('SELECT * FROM public.happy_hour_items WHERE entity_slug = $1', [entity.slug]),
        client.query('SELECT * FROM public.drink_items WHERE entity_slug = $1', [entity.slug]),
        client.query('SELECT * FROM public.entity_tags WHERE entity_slug = $1', [entity.slug]),
        client.query('SELECT * FROM public.entity_features WHERE entity_slug = $1', [entity.slug]),
        client.query('SELECT * FROM public.entity_sections WHERE entity_slug = $1', [entity.slug]),
        client.query('SELECT * FROM public.activities WHERE entity_slug = $1', [entity.slug]).catch(() => ({rows: []})),
        client.query('SELECT * FROM public.requirements WHERE entity_slug = $1', [entity.slug]).catch(() => ({rows: []}))
      ])

      result.push({
        ...entity,
        menu_items: menuItems.rows,
        menu_sections: menuSections.rows,
        photos: photos.rows,
        hours: hours.rows,
        events: events.rows,
        pricing: pricing.rows,
        happy_hour_items: happyHour.rows,
        drink_items: drinkItems.rows,
        tags: tags.rows,
        features: features.rows,
        sections: sections.rows,
        activities: activityData.rows,
        requirements: requirementsData.rows
      })
    }

    console.log(`\n\n✅ ALL ${result.length} ENTITIES PROCESSED\n`)

    // Save to JSON
    const filename = `GCR_COMPLETE_JSON_ALL_DATA_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`
    fs.writeFileSync(filename, JSON.stringify(result, null, 2))

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`✅ COMPLETE JSON CREATED`)
    console.log(`📁 File: ${filename}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

    // Summary
    let totalMenuItems = 0, totalPhotos = 0, totalEvents = 0, totalPricing = 0
    result.forEach(e => {
      totalMenuItems += e.menu_items?.length || 0
      totalPhotos += e.photos?.length || 0
      totalEvents += e.events?.length || 0
      totalPricing += e.pricing?.length || 0
    })

    console.log('📊 Data Summary:')
    console.log(`  Total Businesses: ${result.length}`)
    console.log(`  Menu Items: ${totalMenuItems}`)
    console.log(`  Photos: ${totalPhotos}`)
    console.log(`  Events: ${totalEvents}`)
    console.log(`  Pricing: ${totalPricing}`)

    await client.end()

  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

convertToJson()
