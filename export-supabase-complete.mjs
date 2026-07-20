import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const SUPABASE_URL = 'https://mkepugvdlktfsossumox.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZXB1Z3ZkbGt0ZnNvc3N1bW94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQyMjQwMSwiZXhwIjoyMDk0OTk4NDAxfQ.uWxvQQKDxbaAz0FgcfwOhH3mtq92uXPOc4luQnw48DI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function exportDatabase() {
  try {
    console.log('🔄 Connecting to Supabase...')

    // Fetch all entities
    console.log('📍 Fetching entities...')
    const { data: entities, error: entErr } = await supabase
      .from('entities')
      .select('*')

    if (entErr) throw new Error(`Failed to fetch entities: ${entErr.message}`)
    console.log(`✅ Found ${entities.length} entities`)

    // Build map of all related data
    const businessMap = {}

    for (const entity of entities) {
      businessMap[entity.id] = {
        ...entity,
        photos: [],
        events: [],
        menu: { sections: [], sub_sections: [], items: [] },
        drinks: { sections: [], items: [] },
        happy_hour: { sections: [], items: [] },
        activities: [],
        pricing: [],
        whats_included: [],
        requirements: [],
        addons: [],
        features: [],
        perfect_for: [],
        specials: [],
        booking_slots: [],
        tags: [],
        hours: [],
        sections: [],
        about_bullets: [],
        qna: [],
        shopping: { sections: [], sub_sections: [], items: [] },
        policies: [],
        meeting_points: [],
        fleet: [],
      }
    }

    // Fetch photos
    console.log('📸 Fetching photos...')
    const { data: photos } = await supabase.from('entity_photos').select('*')
    if (photos) {
      photos.forEach(p => {
        if (businessMap[p.entity_id]) {
          businessMap[p.entity_id].photos.push(p)
        }
      })
    }
    console.log(`✅ Fetched ${photos?.length || 0} photos`)

    // Fetch events
    console.log('🎉 Fetching events...')
    const { data: events } = await supabase.from('entity_events').select('*')
    if (events) {
      events.forEach(e => {
        if (businessMap[e.entity_id]) {
          businessMap[e.entity_id].events.push(e)
        }
      })
    }
    console.log(`✅ Fetched ${events?.length || 0} events`)

    // Fetch menu items
    console.log('🍽️ Fetching menu items...')
    const { data: menu } = await supabase.from('entity_menu_items').select('*')
    if (menu) {
      menu.forEach(m => {
        if (businessMap[m.entity_id]) {
          businessMap[m.entity_id].menu.items.push(m)
        }
      })
    }
    console.log(`✅ Fetched ${menu?.length || 0} menu items`)

    // Fetch menu sections
    console.log('📑 Fetching menu sections...')
    const { data: menuSections } = await supabase.from('entity_menu_sections').select('*')
    if (menuSections) {
      menuSections.forEach(s => {
        if (businessMap[s.entity_id]) {
          businessMap[s.entity_id].menu.sections.push(s)
        }
      })
    }
    console.log(`✅ Fetched ${menuSections?.length || 0} menu sections`)

    // Fetch happy hour items
    console.log('🍹 Fetching happy hour items...')
    const { data: happyHour } = await supabase.from('entity_happy_hour_items').select('*')
    if (happyHour) {
      happyHour.forEach(h => {
        if (businessMap[h.entity_id]) {
          businessMap[h.entity_id].happy_hour.items.push(h)
        }
      })
    }
    console.log(`✅ Fetched ${happyHour?.length || 0} happy hour items`)

    // Fetch activities
    console.log('🎯 Fetching activities...')
    const { data: activities } = await supabase.from('entity_activities').select('*')
    if (activities) {
      activities.forEach(a => {
        if (businessMap[a.entity_id]) {
          businessMap[a.entity_id].activities.push(a)
        }
      })
    }
    console.log(`✅ Fetched ${activities?.length || 0} activities`)

    // Fetch pricing
    console.log('💰 Fetching pricing...')
    const { data: pricing } = await supabase.from('entity_pricing').select('*')
    if (pricing) {
      pricing.forEach(p => {
        if (businessMap[p.entity_id]) {
          businessMap[p.entity_id].pricing.push(p)
        }
      })
    }
    console.log(`✅ Fetched ${pricing?.length || 0} pricing records`)

    // Fetch features
    console.log('✨ Fetching features...')
    const { data: features } = await supabase.from('entity_features').select('*')
    if (features) {
      features.forEach(f => {
        if (businessMap[f.entity_id]) {
          businessMap[f.entity_id].features.push(f)
        }
      })
    }
    console.log(`✅ Fetched ${features?.length || 0} features`)

    // Fetch tags
    console.log('🏷️ Fetching tags...')
    const { data: tags } = await supabase.from('entity_tags').select('*')
    if (tags) {
      tags.forEach(t => {
        if (businessMap[t.entity_id]) {
          businessMap[t.entity_id].tags.push(t)
        }
      })
    }
    console.log(`✅ Fetched ${tags?.length || 0} tags`)

    // Fetch hours
    console.log('⏰ Fetching hours...')
    const { data: hours } = await supabase.from('entity_hours').select('*')
    if (hours) {
      hours.forEach(h => {
        if (businessMap[h.entity_id]) {
          businessMap[h.entity_id].hours.push(h)
        }
      })
    }
    console.log(`✅ Fetched ${hours?.length || 0} hours`)

    // Fetch specials
    console.log('🎁 Fetching specials...')
    const { data: specials } = await supabase.from('entity_specials').select('*')
    if (specials) {
      specials.forEach(s => {
        if (businessMap[s.entity_id]) {
          businessMap[s.entity_id].specials.push(s)
        }
      })
    }
    console.log(`✅ Fetched ${specials?.length || 0} specials`)

    // Fetch booking slots
    console.log('🎫 Fetching booking slots...')
    const { data: bookingSlots } = await supabase.from('entity_booking_slots').select('*')
    if (bookingSlots) {
      bookingSlots.forEach(b => {
        if (businessMap[b.entity_id]) {
          businessMap[b.entity_id].booking_slots.push(b)
        }
      })
    }
    console.log(`✅ Fetched ${bookingSlots?.length || 0} booking slots`)

    // Convert map to array
    const allData = Object.values(businessMap)

    // Save to file
    const filename = `GCR_COMPLETE_DB_EXPORT_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`
    fs.writeFileSync(filename, JSON.stringify(allData, null, 2))
    console.log(`\n✅ Export complete!`)
    console.log(`📁 Saved to: ${filename}`)
    console.log(`📊 Total businesses: ${allData.length}`)

    // Summary
    const summary = {
      total_entities: entities.length,
      total_photos: photos?.length || 0,
      total_events: events?.length || 0,
      total_menu_items: menu?.length || 0,
      total_happy_hour_items: happyHour?.length || 0,
      total_activities: activities?.length || 0,
      total_pricing: pricing?.length || 0,
      total_features: features?.length || 0,
      total_tags: tags?.length || 0,
      total_hours: hours?.length || 0,
      total_specials: specials?.length || 0,
      total_booking_slots: bookingSlots?.length || 0,
    }

    console.log('\n📈 Summary:')
    Object.entries(summary).forEach(([key, val]) => {
      console.log(`  ${key}: ${val}`)
    })

  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

exportDatabase()
