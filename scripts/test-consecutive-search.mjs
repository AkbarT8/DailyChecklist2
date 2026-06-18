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

const pg = await import('pg');
const client = new pg.default.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const uid = 'b5a8b4a9-6568-4b1b-bd1b-0f237f9548a2';

// Test synthetic row via SQL
const t = await client.query(
  `SELECT part_row_matches_search('12345', 'BRAND12', 'desc', 'cat', 'ae', '{"Item Code":"12345","OEM":"99-12"}'::jsonb, $1) AS m`,
  ['12'],
);
console.log('12345 + query 12:', t.rows[0].m);

const t2 = await client.query(
  `SELECT part_row_matches_search('12345', 'BRAND', 'desc', 'cat', 'ae', '{}'::jsonb, $1) AS m`,
  ['123'],
);
console.log('12345 + query 123:', t2.rows[0].m);

const t3 = await client.query(
  `SELECT part_row_matches_search('IGC-105F', 'FLAMMA', 'coil', '', '', '{"OEM":"90919-02237"}'::jsonb, $1) AS m`,
  ['kslf'],
);
console.log('IGC + kslf:', t3.rows[0].m);

for (const term of ['12', '123', 'igc', 'kslf']) {
  const r = await client.query(
    'SELECT count(*)::int AS n FROM search_parts_catalog($1, 100, $2::uuid)',
    [term, uid],
  );
  console.log('client catalog', term, '->', r.rows[0].n);
}

await client.end();
