import pg from 'pg';
import { readFileSync } from 'fs';

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const schemas = await c.query(
  `SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('vault','private','extensions')`,
);
console.log('schemas', schemas.rows);

for (const table of ['vault.secrets', 'vault.decrypted_secrets']) {
  try {
    const r = await c.query(`SELECT * FROM ${table} LIMIT 5`);
    console.log(table, r.rows.map((row) => ({ ...row, secret: row.secret ? '[redacted]' : undefined })));
  } catch (e) {
    console.log(table, 'err', e.message);
  }
}

await c.end();
