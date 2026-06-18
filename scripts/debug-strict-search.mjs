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

const uid = process.argv[2] || 'b5a8b4a9-6568-4b1b-bd1b-0f237f9548a2';
const term = process.argv[3] || 'kslf';

const pg = await import('pg');
const client = new pg.default.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const sample = await client.query(
  `SELECT part_number, brand, description, extra FROM parts_catalog
   WHERE source_file LIKE $1 LIMIT 1`,
  [`client:${uid}%`],
);
const row = sample.rows[0];
console.log('sample part', row.part_number, row.extra);

for (const q of ['kslf', '1', 'igc-105', '02237']) {
  const r = await client.query(
    'SELECT part_row_matches_search($1,$2,$3,$4,$5) AS m',
    [row.part_number, row.brand, row.description, row.extra, q],
  );
  console.log('match', q, r.rows[0].m);
}

const cnt = await client.query(
  `SELECT count(*)::int AS n FROM parts_catalog pc
   WHERE source_file LIKE $1
     AND part_row_matches_search(pc.part_number, pc.brand, pc.description, pc.extra, $2)`,
  [`client:${uid}%`, term],
);
console.log('direct matches for', term, cnt.rows[0].n);

const rpc = await client.query(
  'SELECT part_number FROM search_parts_catalog($1, 50, $2::uuid)',
  [term, uid],
);
console.log('rpc rows for', term, rpc.rows.length);

await client.end();
