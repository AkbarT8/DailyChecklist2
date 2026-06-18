import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

loadEnvFile('.env');
loadEnvFile('.env.secrets');

const callmebot = process.env.CALLMEBOT_API_KEY || process.env.VITE_CALLMEBOT_API_KEY;
const resend = process.env.RESEND_API_KEY;

if (!process.env.SUPABASE_DB_URL) {
  console.error('SUPABASE_DB_URL missing in .env');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS public.integration_secrets (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.integration_secrets FROM anon, authenticated;
`);

const upsert = async (key, value) => {
  if (!value) return false;
  await client.query(
    `INSERT INTO public.integration_secrets (key, value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value],
  );
  return true;
};

const savedCallMeBot = await upsert('callmebot_api_key', callmebot);
const savedResend = await upsert('resend_api_key', resend);
await client.end();

console.log('DB secrets:', {
  callmebot_api_key: savedCallMeBot ? 'saved' : 'missing',
  resend_api_key: savedResend ? 'saved' : 'missing',
});

const secretArgs = [];
if (callmebot) secretArgs.push(`CALLMEBOT_API_KEY=${callmebot}`);
if (resend) secretArgs.push(`RESEND_API_KEY=${resend}`);

if (secretArgs.length > 0) {
  const result = spawnSync(
    'npx',
    ['supabase', 'secrets', 'set', ...secretArgs, '--project-ref', 'aekmyfntqdoykuvcocfe'],
    { stdio: 'inherit', shell: true },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log('Supabase edge secrets updated.');
} else {
  console.warn('No CALLMEBOT_API_KEY / RESEND_API_KEY found in .env or .env.secrets');
}
