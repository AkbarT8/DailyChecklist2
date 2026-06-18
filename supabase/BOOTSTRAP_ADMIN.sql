-- Bootstrap admin account for project owner
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_id uuid;
  admin_email text := 'papcorasul@gmail.com';
  admin_password text := 'Soft@2024';
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE lower(email) = admin_email LIMIT 1;

  IF admin_id IS NULL THEN
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      phone_change,
      phone_change_token,
      reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      admin_email,
      crypt(admin_password, gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'full_name', 'Administrator',
        'sub', admin_id::text,
        'email', admin_email,
        'email_verified', true,
        'phone_verified', false
      ),
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at,
      id
    ) VALUES (
      admin_id::text,
      admin_id,
      jsonb_build_object('sub', admin_id::text, 'email', admin_email, 'email_verified', true, 'phone_verified', false),
      'email',
      now(),
      now(),
      now(),
      gen_random_uuid()
    );
  END IF;

  INSERT INTO public.profiles (
    id, full_name, company_name, phone, country, city, address, email,
    is_admin, registration_status
  ) VALUES (
    admin_id, 'Administrator', 'PAPCO', '+971547713447', 'UAE', 'Dubai', '',
    admin_email, true, 'approved'
  )
  ON CONFLICT (id) DO UPDATE SET
    is_admin = true,
    registration_status = 'approved',
    email = admin_email,
    full_name = 'Administrator';

  UPDATE public.profiles
  SET is_admin = false
  WHERE lower(email) <> admin_email AND is_admin = true;
END $$;

NOTIFY pgrst, 'reload schema';
