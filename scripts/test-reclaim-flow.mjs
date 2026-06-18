/**
 * End-to-end test: signup -> soft delete -> reclaim -> re-register
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

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const testEmail = `reclaim-test-${Date.now()}@gmail.com`;
const password = 'TestReclaim2026!';

async function auth(path, body) {
  const res = await fetch(`${url}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function rpc(name, args) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

console.log('1. signup', testEmail);
const signup = await auth('signup', { email: testEmail, password });
console.log('   status', signup.status, signup.data.user?.id ? 'ok' : signup.data);

const userId = signup.data.user?.id;
if (!userId) process.exit(1);

const pg = await import('pg');
const client = new pg.default.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

console.log('1b. insert profile (like RegisterSection)');
await client.query(
  `INSERT INTO public.profiles (id, full_name, company_name, phone, country, city, address, email, registration_status)
   VALUES ($1, 'Test', 'Co', '+1', 'UAE', 'Dubai', '', $2, 'pending')
   ON CONFLICT (id) DO NOTHING`,
  [userId, testEmail]
);

console.log('2. soft delete profile (same as deleteUserDirect)');
await client.query(
  `UPDATE public.profiles SET
     registration_status = 'rejected',
     rejection_reason = $2,
     full_name = '[Deleted user]',
     email = $3
   WHERE id = $1`,
  [
    userId,
    `Account deleted by administrator|original_email:${testEmail}`,
    `__deleted__${userId}@removed.local`,
  ]
);

console.log('3. reclaim_deleted_email');
const reclaim = await rpc('reclaim_deleted_email', { p_email: testEmail });
console.log('   status', reclaim.status, reclaim.data);

console.log('4. re-signup same email');
const signup2 = await auth('signup', { email: testEmail, password: 'TestReclaim2026B!' });
console.log('   status', signup2.status, signup2.data.user?.id ? 'ok' : signup2.data.msg || signup2.data.error_description || signup2.data);

await client.end();
console.log('done');
