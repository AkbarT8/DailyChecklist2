/**
 * Apply full schema to papco Supabase via direct Postgres connection.
 * Requires SUPABASE_DB_URL in .env
 */
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

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Missing SUPABASE_DB_URL in .env');
  process.exit(1);
}

const sqlPath = resolve(root, 'supabase', 'BOOTSTRAP_PAPCO.sql');
const adminSqlPath = resolve(root, 'supabase', 'BOOTSTRAP_ADMIN.sql');
const sql = readFileSync(sqlPath, 'utf8');
const adminSql = existsSync(adminSqlPath) ? readFileSync(adminSqlPath, 'utf8') : '';

const pg = await import('pg');
const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('Applying full schema...');
  await client.query(sql);
  console.log('Schema applied.');
  if (adminSql) {
    console.log('Creating admin user...');
    await client.query(adminSql);
    console.log('Admin ready.');
  }
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
