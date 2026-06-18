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

const cols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema = 'auth' AND table_name = 'users'
  ORDER BY ordinal_position
`);
console.log('columns', cols.rows.map(r => r.column_name).join(', '));

const users = await client.query(`
  SELECT * FROM auth.users ORDER BY created_at DESC LIMIT 3
`);
for (const u of users.rows) {
  const { encrypted_password, ...rest } = u;
  console.log('\n---', u.email, '---');
  console.log(JSON.stringify({ ...rest, pw_prefix: encrypted_password?.slice(0, 20) }, null, 2));
}

await client.end();
