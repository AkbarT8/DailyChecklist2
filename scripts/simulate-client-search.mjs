import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

loadEnv();

const userId = process.argv[2] || 'b5a8b4a9-6568-4b1b-bd1b-0f237f9548a2';
const term = (process.argv[3] || 'igc').toLowerCase();

const pg = await import('pg');
const client = new pg.default.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const prefix = `client:${userId}%`;

const r = await client.query(
  `SELECT id, part_number, search_text FROM parts_catalog
   WHERE source_file LIKE $1
   AND (
     lower(part_number) LIKE '%' || $2 || '%'
     OR lower(search_text) LIKE '%' || $2 || '%'
   )
   LIMIT 5`,
  [prefix, term],
);
console.log('SQL matches for', term, ':', r.rows);

const r2 = await client.query(
  `SELECT count(*)::int AS n FROM parts_catalog WHERE source_file LIKE $1`,
  [prefix],
);
console.log('total client parts', r2.rows[0].n);

await client.end();
