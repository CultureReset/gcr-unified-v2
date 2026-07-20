import fs from 'fs'

const API_BASE = 'https://gcr-api-clean.vercel.app'
const GCR_API = `${API_BASE}/api/gcr`

async function extractAllBusinesses() {
  console.log('Fetching all businesses...')

  try {
    // Fetch all businesses with high limit
    const r = await fetch(`${GCR_API}/entities?limit=1000`)
    if (!r.ok) {
      throw new Error(`Failed to load businesses (HTTP ${r.status})`)
    }

    const d = await r.json()
    const entities = d.entities || d.businesses || []
    console.log(`Found ${entities.length} total businesses`)

    // Filter out test entities
    const isTestEntity = (b) => {
      const s = (b.slug || b.subdomain || '').toLowerCase()
      const n = (b.name || '').toLowerCase()
      const a = (b.address_line_1 || b.address || '').toLowerCase()
      return s.startsWith('gcr-upload-test') || s.startsWith('888') ||
             n.includes('upload test') || n.startsWith('888') ||
             a.includes('test lane')
    }

    const clean = entities.filter(e => e && e.id && e.name && !isTestEntity(e))
    console.log(`After filtering: ${clean.length} valid businesses`)

    // Fetch detailed data for each business
    const allBusinesses = []
    for (let i = 0; i < clean.length; i++) {
      const entity = clean[i]
      process.stdout.write(`\rFetching details: ${i + 1}/${clean.length}`)

      try {
        const detailR = await fetch(`${GCR_API}/entity/${encodeURIComponent(entity.slug)}`)
        if (detailR.ok) {
          const detail = await detailR.json()
          allBusinesses.push({
            ...entity,
            ...detail,
          })
        } else {
          allBusinesses.push(entity)
        }
      } catch (err) {
        console.error(`\nFailed to fetch ${entity.slug}: ${err.message}`)
        allBusinesses.push(entity)
      }
    }

    console.log(`\n\nSuccessfully extracted ${allBusinesses.length} businesses`)

    // Save to file
    const filename = `businesses-export-${new Date().toISOString().slice(0, 10)}.json`
    fs.writeFileSync(filename, JSON.stringify(allBusinesses, null, 2))
    console.log(`\nExported to: ${filename}`)

    // Print summary
    const byCategory = {}
    allBusinesses.forEach(b => {
      const type = b.entity_type || 'unknown'
      byCategory[type] = (byCategory[type] || 0) + 1
    })

    console.log('\nBreakdown by type:')
    Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`)
      })

  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  }
}

extractAllBusinesses()
