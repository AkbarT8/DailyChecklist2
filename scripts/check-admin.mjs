import pg from 'pg';
const c = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const u = await c.query("SELECT id, email FROM auth.users WHERE lower(email)='papcorasul@gmail.com'");
console.log('users', u.rows);
const p = await c.query("SELECT id, email, is_admin, registration_status FROM profiles WHERE lower(email)='papcorasul@gmail.com'");
console.log('profiles', p.rows);
const i = await c.query("SELECT provider, user_id FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE lower(email)='papcorasul@gmail.com')");
console.log('identities', i.rows);
await c.end();
