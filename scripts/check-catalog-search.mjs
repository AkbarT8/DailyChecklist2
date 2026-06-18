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

const sources = await client.query(`
  SELECT source_file, count(*)::int AS n
  FROM parts_catalog
  WHERE source_file LIKE 'client:%'
  GROUP BY source_file
  ORDER BY n DESC
  LIMIT 8
`);
console.log('client catalog sources:', sources.rows);

const sample = await client.query(`
  SELECT part_number, source_file, search_text
  FROM parts_catalog
  WHERE source_file LIKE 'client:%'
  LIMIT 3
`);
console.log('sample parts:', sample.rows);

const rpc = await client.query(
  "SELECT proname FROM pg_proc WHERE proname = 'log_unavailable_search'",
);
console.log('log_unavailable_search:', rpc.rows.length > 0);

const unav = await client.query('SELECT count(*)::int AS n FROM unavailable_searches');
console.log('unavailable_searches rows:', unav.rows[0].n);

await client.end();
