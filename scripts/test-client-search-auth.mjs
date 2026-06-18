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
const email = process.argv[2] || 'papcorasul@gmail.com';
const password = process.argv[3] || 'Soft@2024';
const clientUid = process.argv[4] || 'b5a8b4a9-6568-4b1b-bd1b-0f237f9548a2';

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

const headers = { apikey: key, Authorization: `Bearer ${auth.access_token}` };
const pattern = `client:${clientUid}%`;

const countLike = await fetch(
  `${url}/rest/v1/parts_catalog?select=id&source_file=like.${encodeURIComponent(pattern)}&limit=1`,
  { headers, method: 'HEAD', Prefer: 'count=exact' },
);
console.log('count like', countLike.headers.get('content-range'));

const filterIlike = await fetch(
  `${url}/rest/v1/parts_catalog?select=id,part_number&source_file=ilike.${encodeURIComponent(pattern)}&limit=2`,
  { headers },
);
console.log('ilike', filterIlike.status, await filterIlike.json());

const rpc = await fetch(`${url}/rest/v1/rpc/search_parts_catalog`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_query: 'igc', p_limit: 3, p_client_user_id: clientUid }),
});
console.log('rpc client', rpc.status, await rpc.json());

const rpcGeneral = await fetch(`${url}/rest/v1/rpc/search_parts_catalog`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_query: 'igc', p_limit: 3, p_client_user_id: null }),
});
console.log('rpc general count', (await rpcGeneral.json()).length);
