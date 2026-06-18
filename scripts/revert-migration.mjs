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

const sql = readFileSync(resolve(root, 'supabase', 'REVERT_MIGRATION.sql'), 'utf8');
const pg = await import('pg');
const client = new pg.default.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query(sql);
const counts = await client.query(`
  SELECT
    (SELECT count(*) FROM profiles) AS profiles,
    (SELECT count(*) FROM parts_catalog) AS catalog,
    (SELECT count(*) FROM file_attachments) AS files,
    (SELECT count(*) FROM auth.users) AS users
`);
console.log('reverted', counts.rows[0]);
await client.end();
