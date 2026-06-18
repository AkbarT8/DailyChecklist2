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

const email = process.argv[2];
if (!email) {
  console.log('usage: node scripts/debug-reclaim.mjs email');
  process.exit(1);
}

const norm = email.toLowerCase().trim();
const q1 = await client.query(`
  SELECT id, email, rejection_reason, registration_status
  FROM public.profiles
  WHERE email LIKE '__deleted__%'
    AND rejection_reason LIKE '%original_email:' || $1 || '%'
`, [norm]);
console.log('match1', q1.rows);

const q2 = await client.query(`
  SELECT au.id, au.email, p.email as profile_email, p.rejection_reason
  FROM auth.users au
  INNER JOIN public.profiles p ON p.id = au.id
  WHERE lower(au.email) = $1 AND p.email LIKE '__deleted__%'
`, [norm]);
console.log('match2', q2.rows);

await client.end();
