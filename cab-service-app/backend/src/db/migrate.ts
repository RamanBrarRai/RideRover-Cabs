import fs from 'fs';
import path from 'path';
import { pool } from './pool';

const DIR = path.resolve(__dirname, '../../../database/migrations');

export async function migrate(log = true) {
  const c = await pool.connect();
  try {
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await c.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = fs.readFileSync(path.join(DIR, f), 'utf8');
      try {
        await c.query('BEGIN');
        await c.query(sql);
        await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]);
        await c.query('COMMIT');
        if (log) console.log(`applied ${f}`);
      } catch (e) {
        await c.query('ROLLBACK');
        throw new Error(`Migration ${f} failed: ${(e as Error).message}`);
      }
    }
    if (log) console.log('Database is up to date.');
  } finally {
    c.release();
  }
}

if (require.main === module) {
  migrate().then(() => pool.end()).catch((e) => { console.error(e.message); process.exit(1); });
}
