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

const r = await client.query(`
  SELECT pg_get_functiondef(oid) AS def
  FROM pg_proc
  WHERE proname = 'search_parts_catalog'
  ORDER BY oid DESC
  LIMIT 3
`);
for (const [i, row] of r.rows.entries()) {
  console.log('--- overload', i, '---');
  console.log(row.def.includes('part_row_matches_search') ? 'HAS strict' : 'OLD loose');
  console.log(row.def.slice(0, 500));
}

await client.end();
