import { sql } from './lib/postgres'

async function setup() {
  await sql`
    CREATE TABLE IF NOT EXISTS links (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE,
      url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `

  await sql.end()

  console.log('Setup done successfully!')
}

setup()
