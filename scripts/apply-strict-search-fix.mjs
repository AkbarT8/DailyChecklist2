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

const sql = readFileSync(resolve(root, 'supabase', 'CATALOG_STRICT_SEARCH_FIX.sql'), 'utf8');
const pg = await import('pg');
const client = new pg.default.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log('Strict search SQL applied.');
  const uid = 'b5a8b4a9-6568-4b1b-bd1b-0f237f9548a2';
  const r1 = await client.query('SELECT count(*)::int AS n FROM search_parts_catalog($1, 50, $2::uuid)', ['1', uid]);
  const r2 = await client.query('SELECT count(*)::int AS n FROM search_parts_catalog($1, 50, $2::uuid)', ['igc', uid]);
  const r3 = await client.query('SELECT count(*)::int AS n FROM search_parts_catalog($1, 50, $2::uuid)', ['kslf', uid]);
  console.log('search "1":', r1.rows[0].n, 'search "igc":', r2.rows[0].n, 'search "kslf":', r3.rows[0].n);
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
