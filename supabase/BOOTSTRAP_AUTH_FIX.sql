-- Fix auth settings and admin login on papco
CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE auth.users
SET
  encrypted_password = crypt('Soft@2024', gen_salt('bf', 10)),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'sub', id::text,
      'email', email,
      'email_verified', true,
      'phone_verified', false
    )
WHERE lower(email) = 'papcorasul@gmail.com';

UPDATE auth.instances
SET raw_base_config = (
  CASE
    WHEN raw_base_config IS NULL OR raw_base_config = '' THEN '{"mailer_autoconfirm": true}'
    ELSE raw_base_config::jsonb || '{"mailer_autoconfirm": true}'::jsonb
  END
)::text;
