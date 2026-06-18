import pg from 'pg';

const urls = [
  'postgresql://postgres.gzlbvdvocfgmnzzkvksd:NHAW0rbAMx9rncY4@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres.gzlbvdvocfgmnzzkvksd:NHAW0rbAMx9rncY4@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
];

for (const connectionString of urls) {
  const c = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    const r = await c.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%secret%' OR table_name ILIKE '%config%' OR table_name ILIKE '%setting%'`,
    );
    console.log('OK', connectionString.split('@')[1], r.rows);
    await c.end();
    break;
  } catch (e) {
    console.log('FAIL', connectionString.split('@')[1], e.message);
    try { await c.end(); } catch {}
  }
}
