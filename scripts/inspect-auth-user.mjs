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

const user = await client.query(`
  SELECT id, instance_id, aud, role, email, encrypted_password,
         email_confirmed_at, invited_at, confirmation_token, recovery_token,
         email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data,
         is_super_admin, created_at, updated_at, phone, phone_confirmed_at,
         confirmation_sent_at, banned_until, reauthentication_token, is_sso_user, deleted_at
  FROM auth.users WHERE lower(email) = 'papcorasul@gmail.com'
`);
console.log('user', JSON.stringify(user.rows[0], null, 2));

const ident = await client.query(`SELECT * FROM auth.identities WHERE user_id = $1`, [user.rows[0]?.id]);
console.log('identity', JSON.stringify(ident.rows[0], null, 2));

const inst = await client.query(`SELECT id, uuid, raw_base_config FROM auth.instances LIMIT 1`);
console.log('instance', JSON.stringify(inst.rows[0], null, 2));

await client.end();
