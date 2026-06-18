import pg from 'pg';
import { readFileSync } from 'fs';

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const tables = await c.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1`,
);
console.log(tables.rows.map((x) => x.table_name).join('\n'));
await c.end();
