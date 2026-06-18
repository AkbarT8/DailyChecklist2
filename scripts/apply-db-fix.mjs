/**
 * Apply database fixes without Supabase CLI login.
 * Requires SUPABASE_DB_URL in .env (Dashboard → Settings → Database → URI)
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

loadEnv();

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error(`
Missing SUPABASE_DB_URL in .env

1. Open https://supabase.com/dashboard/project/gzlbvdvocfgmnzzkvksd/settings/database
2. Copy "Connection string" → URI (mode: Session or Direct)
3. Add to .env:
   SUPABASE_DB_URL=postgresql://postgres.[ref]:[YOUR-PASSWORD]@...

Then run: npm run db:apply
`);
  process.exit(1);
}

const sqlPath = resolve(root, 'supabase', 'APPLY_FIXES.sql');
const sql = readFileSync(sqlPath, 'utf8');

let pg;
try {
  pg = await import('pg');
} catch {
  console.error('Install pg: npm install --save-dev pg');
  process.exit(1);
}

const client = new pg.default.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log('Connected. Applying fixes...');
  await client.query(sql);
  console.log('Done. Database fixes applied.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
