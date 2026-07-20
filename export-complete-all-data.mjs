import pg from 'pg'
import fs from 'fs'

const { Client } = pg
const client = new Client({
  connectionString: 'postgresql://postgres:Dont4getthiscybercheck%24@db.mkepugvdlktfsossumox.supabase.co:5432/postgres'
})

async function exportComplete() {
  try {
    console.log('🔄 Connecting...')
    await client.connect()
    console.log('✅ Connected\n')

    // Get ALL entities
    console.log('📍 Fetching ALL entities...')
    const { rows: entities } = await client.query('SELECT * FROM public.entity ORDER BY name')
    console.log(`✅ Found ${entities.length} entities\n`)

    const result = []

    // For EACH entity, get ALL related data
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i]
      process.stdout.write(`Processing ${i + 1}/${entities.length}: ${entity.name}... `)

      // Get all related data for this entity
      const menuItems = await client.query(
        'SELECT * FROM public.menu_items WHERE entity_slug = $1',
        [entity.slug]
      )
      const menuSections = await client.query(
        'SELECT * FROM public.menu_sections WHERE entity_slug = $1',
        [entity.slug]
      )
      const photos = await client.query(
        'SELECT * FROM public.entity_photos WHERE entity_slug = $1',
        [entity.slug]
      )
      const hours = await client.query(
        'SELECT * FROM public.entity_hours WHERE entity_slug = $1',
        [entity.slug]
      )
      const events = await client.query(
        'SELECT * FROM public.entity_events WHERE entity_slug = $1',
        [entity.slug]
      )
      const pricing = await client.query(
        'SELECT * FROM public.pricing_items WHERE entity_slug = $1',
        [entity.slug]
      )
      const happyHour = await client.query(
        'SELECT * FROM public.happy_hour_items WHERE entity_slug = $1',
        [entity.slug]
      )
      const drinkItems = await client.query(
        'SELECT * FROM public.drink_items WHERE entity_slug = $1',
        [entity.slug]
      )

      result.push({
        ...entity,
        menu_items: menuItems.rows,
        menu_sections: menuSections.rows,
        photos: photos.rows,
        hours: hours.rows,
        events: events.rows,
        pricing: pricing.rows,
        happy_hour_items: happyHour.rows,
        drink_items: drinkItems.rows
      })

      console.log(`✅ (${menuItems.rows.length} menu items)`)
    }

    // Save
    const filename = `GCR_COMPLETE_ALL_DATA_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`
    fs.writeFileSync(filename, JSON.stringify(result, null, 2))

    console.log(`\n✅ COMPLETE EXPORT DONE`)
    console.log(`📁 File: ${filename}`)
    console.log(`📊 Total entities: ${result.length}`)
    console.log(`\nData Summary:`)
    let totalMenuItems = 0
    let totalPhotos = 0
    let totalEvents = 0
    result.forEach(e => {
      totalMenuItems += e.menu_items.length
      totalPhotos += e.photos.length
      totalEvents += e.events.length
    })
    console.log(`  Menu items: ${totalMenuItems}`)
    console.log(`  Photos: ${totalPhotos}`)
    console.log(`  Events: ${totalEvents}`)

    await client.end()

  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

exportComplete()
