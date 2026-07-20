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

    // Get all table names from the public schema
    console.log('📋 Fetching all table names...')
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)
    const tables = tablesRes.rows.map(r => r.table_name)
    console.log(`✅ Found ${tables.length} tables\n`)
    console.log('Tables:')
    tables.forEach(t => console.log(`  - ${t}`))
    console.log('')

    // Fetch all data from all tables
    const allData = {}

    for (const tableName of tables) {
      process.stdout.write(`Fetching ${tableName}... `)
      try {
        const res = await client.query(`SELECT * FROM public."${tableName}"`)
        allData[tableName] = res.rows
        console.log(`✅ (${res.rows.length} rows)`)
      } catch (err) {
        console.log(`⚠️ (${err.message})`)
      }
    }

    // Save everything
    const filename = `GCR_COMPLETE_ORGANIZED_DATA_${new Date().toISOString().slice(0, 10)}_${Date.now()}.json`
    fs.writeFileSync(filename, JSON.stringify(allData, null, 2))

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`✅ Complete database export saved!`)
    console.log(`📁 File: ${filename}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

    // Summary
    console.log('📊 Data Summary:')
    Object.entries(allData)
      .filter(([_, data]) => data.length > 0)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([table, data]) => {
        console.log(`  ${table}: ${data.length} rows`)
      })

    await client.end()

  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

convertToJson()
