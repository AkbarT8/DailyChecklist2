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
const email = process.argv[2] || 'trwt8@gmail.com';
const password = process.argv[3] || '12345678';
const term = process.argv[4] || 'igc';

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: key, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const auth = await login.json();
if (!auth.access_token) {
  console.log('login failed', auth);
  process.exit(1);
}

const uid = auth.user.id;
const prefix = `client:${uid}%`;
const headers = { apikey: key, Authorization: `Bearer ${auth.access_token}` };

const countRes = await fetch(
  `${url}/rest/v1/parts_catalog?select=id&source_file=like.${encodeURIComponent(prefix)}&limit=1`,
  { headers, method: 'HEAD', Prefer: 'count=exact' },
);
console.log('client parts count header', countRes.headers.get('content-range'));

const orFilter = [
  `part_number.ilike.%${term}%`,
  `search_text.ilike.%${term}%`,
].join(',');

const searchRes = await fetch(
  `${url}/rest/v1/parts_catalog?select=id,part_number,source_file&source_file=like.${encodeURIComponent(prefix)}&or=(${encodeURIComponent(orFilter)})&limit=5`,
  { headers },
);
console.log('search status', searchRes.status);
console.log('search body', await searchRes.json());

const rpcRes = await fetch(`${url}/rest/v1/rpc/log_unavailable_search`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_search_query: `test-${Date.now()}`, p_client_name: 'Test Client' }),
});
console.log('log_unavailable', rpcRes.status, await rpcRes.json());
