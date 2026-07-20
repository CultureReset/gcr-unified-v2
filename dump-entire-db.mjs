import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const SUPABASE_URL = 'https://mkepugvdlktfsossumox.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZXB1Z3ZkbGt0ZnNvc3N1bW94Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQyMjQwMSwiZXhwIjoyMDk0OTk4NDAxfQ.uWxvQQKDxbaAz0FgcfwOhH3mtq92uXPOc4luQnw48DI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function fetchAllFrom(tableName) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')

    if (error && error.code === 'PGRST116') return null
    if (error) return null
    return data || []
  } catch {
    return null
  }
}

async function dumpEntireDatabase() {
  try {
    console.log('🔄 Connecting to Supabase and fetching ALL data...\n')

    // Fetch all entities first
    console.log('📍 Fetching all entities...')
    const entities = await fetchAllFrom('entities')
    if (!entities) {
      console.error('❌ Failed to fetch entities')
      process.exit(1)
    }
    console.log(`✅ Found ${entities.length} entities\n`)

    // Build map of all data organized by entity
    const businessMap = {}
    entities.forEach(e => {
      businessMap[e.id] = { ...e }
    })

    // List of related tables to fetch and attach
    const relatedTables = [
      { name: 'entity_photos', key: 'photos', foreignKey: 'entity_id' },
      { name: 'entity_events', key: 'events', foreignKey: 'entity_id' },
      { name: 'entity_menu_items', key: 'menu_items', foreignKey: 'entity_id' },
      { name: 'entity_menu_sections', key: 'menu_sections', foreignKey: 'entity_id' },
      { name: 'entity_menu_subsections', key: 'menu_subsections', foreignKey: 'entity_id' },
      { name: 'entity_happy_hour_items', key: 'happy_hour_items', foreignKey: 'entity_id' },
      { name: 'entity_activities', key: 'activities', foreignKey: 'entity_id' },
      { name: 'entity_pricing', key: 'pricing', foreignKey: 'entity_id' },
      { name: 'entity_features', key: 'features', foreignKey: 'entity_id' },
      { name: 'entity_tags', key: 'tags', foreignKey: 'entity_id' },
      { name: 'entity_hours', key: 'hours', foreignKey: 'entity_id' },
      { name: 'entity_specials', key: 'specials', foreignKey: 'entity_id' },
      { name: 'entity_booking_slots', key: 'booking_slots', foreignKey: 'entity_id' },
      { name: 'entity_about_bullets', key: 'about_bullets', foreignKey: 'entity_id' },
      { name: 'entity_sections', key: 'sections', foreignKey: 'entity_id' },
      { name: 'entity_perfect_for', key: 'perfect_for', foreignKey: 'entity_id' },
      { name: 'entity_whats_included', key: 'whats_included', foreignKey: 'entity_id' },
      { name: 'entity_requirements', key: 'requirements', foreignKey: 'entity_id' },
      { name: 'entity_addons', key: 'addons', foreignKey: 'entity_id' },
      { name: 'entity_qna', key: 'qna', foreignKey: 'entity_id' },
      { name: 'entity_shopping_items', key: 'shopping_items', foreignKey: 'entity_id' },
      { name: 'entity_shopping_sections', key: 'shopping_sections', foreignKey: 'entity_id' },
      { name: 'entity_shopping_subsections', key: 'shopping_subsections', foreignKey: 'entity_id' },
      { name: 'entity_drinks_items', key: 'drinks_items', foreignKey: 'entity_id' },
      { name: 'entity_drinks_sections', key: 'drinks_sections', foreignKey: 'entity_id' },
      { name: 'entity_policies', key: 'policies', foreignKey: 'entity_id' },
      { name: 'entity_meeting_points', key: 'meeting_points', foreignKey: 'entity_id' },
      { name: 'entity_fleet', key: 'fleet', foreignKey: 'entity_id' },
    ]

    // Fetch and attach related data to each business
    for (const table of relatedTables) {
      process.stdout.write(`Fetching ${table.name}... `)
      const data = await fetchAllFrom(table.name)

      if (!data) {
        console.log('⊘ (table not found)')
        continue
      }

      console.log(`✅ (${data.length} rows)`)

      // Attach to businesses by entity_id
      data.forEach(row => {
        const entityId = row[table.foreignKey]
        if (businessMap[entityId]) {
          if (!businessMap[entityId][table.key]) {
            businessMap[entityId][table.key] = []
          }
          businessMap[entityId][table.key].push(row)
        }
      })
    }

    // Convert to array and sort by name
    const allBusinesses = Object.values(businessMap).sort((a, b) => {
      return (a.name || '').localeCompare(b.name || '')
    })

    // Save to file
    const filename = `GCR_COMPLETE_ORGANIZED_DB_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`
    fs.writeFileSync(filename, JSON.stringify(allBusinesses, null, 2))

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`✅ Complete organized database dump saved!`)
    console.log(`📁 File: ${filename}`)
    console.log(`📊 Total businesses: ${allBusinesses.length}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  } catch (err) {
    console.error('❌ Fatal error:', err.message)
    process.exit(1)
  }
}

dumpEntireDatabase()
