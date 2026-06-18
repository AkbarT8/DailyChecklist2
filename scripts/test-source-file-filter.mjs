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
const uid = process.argv[2] || 'b5a8b4a9-6568-4b1b-bd1b-0f237f9548a2';
const pattern = `client:${uid}%`;

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function tryUrl(label, path) {
  const res = await fetch(`${url}/rest/v1/parts_catalog?${path}`, { headers });
  const text = await res.text();
  console.log(label, res.status, text.slice(0, 200));
}

await tryUrl('like', `select=id&source_file=like.${encodeURIComponent(pattern)}&limit=2`);
await tryUrl('ilike filter', `select=id&source_file=ilike.${encodeURIComponent(pattern)}&limit=2`);
await tryUrl('rpc', '', 'POST');
const rpcRes = await fetch(`${url}/rest/v1/rpc/search_parts_catalog`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
  body: JSON.stringify({ p_query: 'igc', p_limit: 3, p_client_user_id: uid }),
});
console.log('rpc search', rpcRes.status, (await rpcRes.text()).slice(0, 300));
