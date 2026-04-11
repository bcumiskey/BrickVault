// Database migration — creates tables if they don't exist
// Run via: GET /api/migrate
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './db';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const sql = getDb();

    // Users table (for future auth — single default user for now)
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Ensure default user exists
    await sql`
      INSERT INTO users (id, email, name)
      VALUES (1, 'default@brickvault.app', 'Default User')
      ON CONFLICT (id) DO NOTHING
    `;

    // Collection sets — stores full CollectionSet as JSONB
    await sql`
      CREATE TABLE IF NOT EXISTS collection_sets (
        id TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) DEFAULT 1,
        set_num TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_collection_sets_user ON collection_sets(user_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_collection_sets_set_num ON collection_sets(set_num)
    `;

    // Collection minifigures
    await sql`
      CREATE TABLE IF NOT EXISTS collection_minifigures (
        id TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) DEFAULT 1,
        fig_num TEXT NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_collection_minifigs_user ON collection_minifigures(user_id)
    `;

    // API keys storage (so keys persist across browsers)
    await sql`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER REFERENCES users(id) DEFAULT 1,
        key TEXT NOT NULL,
        value TEXT,
        PRIMARY KEY (user_id, key)
      )
    `;

    res.status(200).json({ success: true, message: 'Migration complete' });
  } catch (err: unknown) {
    console.error('Migration failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    // Check for common issues
    if (message.includes('connection') || message.includes('DATABASE_URL')) {
      res.status(500).json({
        error: 'Database connection failed',
        detail: message,
        hint: 'Check that DATABASE_URL or POSTGRES_URL is set in Vercel environment variables',
        available_vars: {
          DATABASE_URL: !!process.env.DATABASE_URL,
          POSTGRES_URL: !!process.env.POSTGRES_URL,
          POSTGRES_URL_NON_POOLING: !!process.env.POSTGRES_URL_NON_POOLING,
        },
      });
    } else {
      res.status(500).json({ error: 'Migration failed', detail: message });
    }
  }
}
