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

const emails = ['trwt8@gmail.com', 'papcorasul@gmail.com'];
for (const e of emails) {
  const u = await client.query('SELECT id, email FROM auth.users WHERE lower(email)=$1', [e]);
  const p = await client.query('SELECT id, email, is_admin, registration_status FROM profiles WHERE lower(email)=$1 OR id IN (SELECT id FROM auth.users WHERE lower(email)=$1)', [e]);
  console.log(e, { auth: u.rows[0] || null, profile: p.rows[0] || null });
}

await client.end();
