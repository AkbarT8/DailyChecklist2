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

const email = (process.argv[2] || '').toLowerCase().trim();
if (!email) {
  console.log('usage: node scripts/lookup-email.mjs email');
  process.exit(1);
}

const pg = await import('pg');
const client = new pg.default.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const au = await client.query(
  'SELECT id, email, deleted_at FROM auth.users WHERE lower(email) = $1',
  [email],
);
const pr = await client.query(
  `SELECT id, email, registration_status, rejection_reason
   FROM public.profiles
   WHERE lower(email) = $1 OR rejection_reason ILIKE $2`,
  [email, `%${email}%`],
);

console.log('auth.users', au.rows);
console.log('profiles', pr.rows);

await client.end();
