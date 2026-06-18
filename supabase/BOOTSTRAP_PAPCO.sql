-- PAPCO full bootstrap for papco project

-- ===== 20260504123305_create_users_profiles.sql =====
/*
  # Create user profiles table

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `full_name` (text) - ФИО
      - `company_name` (text) - Название компании
      - `phone` (text) - Номер телефона
      - `country` (text) - Страна
      - `city` (text) - Город
      - `address` (text) - Адрес
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `profiles` table
    - Users can read and update their own profile
    - Users can insert their own profile on registration
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  company_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ===== 20260506095807_create_user_requests.sql =====
/*
  # Create user_requests table

  1. New Tables
    - `user_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `type` (text) - 'catalog_search' | 'catalog_request' | 'excel_request' | 'pricelist_request'
      - `query` (text) - search query or description
      - `file_url` (text, nullable) - uploaded file URL for excel requests
      - `status` (text) - 'pending' | 'processed'
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `user_requests` table
    - Authenticated users can insert and view their own requests
*/

CREATE TABLE IF NOT EXISTS user_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'catalog_search',
  query text NOT NULL DEFAULT '',
  file_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON user_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own requests"
  ON user_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ===== 20260506101844_add_admin_system.sql =====
/*
  # Admin System Setup

  1. Changes to existing tables
    - `profiles`: add `is_admin` boolean, `registration_status` (pending/approved/rejected), `email` column

  2. New Tables
    - `file_attachments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, uploader)
      - `request_id` (uuid, nullable, linked request)
      - `filename` (text)
      - `file_path` (text) - storage path
      - `file_size` (integer)
      - `uploaded_at` (timestamptz)

    - `admin_logs`
      - `id` (uuid, primary key)
      - `admin_id` (uuid)
      - `action` (text)
      - `target_type` (text) - 'user' | 'request' | 'file'
      - `target_id` (text)
      - `details` (text)
      - `created_at` (timestamptz)

  3. Security
    - Admin-only RLS policies for all management operations
    - Helper function to check admin status
*/

-- Add columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'registration_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN registration_status text NOT NULL DEFAULT 'pending';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Update user_requests: add 'in_progress' status support (already text, no change needed)
-- Add admin_note column to user_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_requests' AND column_name = 'admin_note'
  ) THEN
    ALTER TABLE user_requests ADD COLUMN admin_note text;
  END IF;
END $$;

-- file_attachments table
CREATE TABLE IF NOT EXISTS file_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid REFERENCES user_requests(id) ON DELETE SET NULL,
  filename text NOT NULL DEFAULT '',
  file_path text NOT NULL DEFAULT '',
  file_size integer NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attachments"
  ON file_attachments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attachments"
  ON file_attachments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin policies for file_attachments
CREATE POLICY "Admins can view all attachments"
  ON file_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete attachments"
  ON file_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- admin_logs table
CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT '',
  target_type text NOT NULL DEFAULT '',
  target_id text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view logs"
  ON admin_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert logs"
  ON admin_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Admin policies for profiles: admins can view and update all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.is_admin = true
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.is_admin = true
    )
  );

-- Admin policies for user_requests: admins can view and update all requests
CREATE POLICY "Admins can view all requests"
  ON user_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update all requests"
  ON user_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );


-- ===== 20260506103025_create_files_storage_bucket.sql =====
/*
  # Create storage bucket for admin file uploads

  1. Creates a private 'admin-files' bucket in Supabase Storage
  2. Adds RLS policies so only admins can upload/read/delete
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-files', 'admin-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'admin-files' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can view files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'admin-files' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'admin-files' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );


-- ===== 20260506110019_add_rejection_reason_and_fix_profiles.sql =====
/*
  # Add rejection_reason to profiles and harden registration flow

  1. Changes
    - Add `rejection_reason` (text, nullable) to profiles table
    - Ensure `email` column exists on profiles (already added in prior migration but idempotent)
    - Add policy: users can read their own registration_status (needed for login gate check)
    - Add unique constraint on profiles.email to prevent duplicate registrations

  2. Security
    - Users can only read their own profile row (already exists)
    - New column is only writable by admins via existing admin UPDATE policy
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rejection_reason text DEFAULT NULL;
  END IF;
END $$;

-- Make sure email column exists and has a unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text DEFAULT '';
  END IF;
END $$;

-- Add unique index on profiles.email to prevent duplicate registrations (skip nulls/empty)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON profiles (email)
  WHERE email IS NOT NULL AND email <> '';

-- Ensure registration_status default is 'pending'
ALTER TABLE profiles ALTER COLUMN registration_status SET DEFAULT 'pending';


-- ===== 20260507160147_create_parts_catalog.sql =====
/*
  # Create Parts Catalog System

  1. New Tables
    - `parts_catalog` — stores auto parts data imported from Excel
      - `id` (uuid, primary key)
      - `part_number` (text) — the searchable part code
      - `brand` (text) — brand name
      - `description` (text) — part description
      - `category` (text) — part category
      - `extra` (jsonb) — any additional columns from Excel
      - `source_file` (text) — filename it was imported from
      - `created_at`, `updated_at` timestamps

    - `catalog_uploads` — tracks admin Excel uploads and import status

  2. Indexes — fast case-insensitive prefix and substring search
  3. Security — RLS: authenticated users read, admins write
*/

-- Enable trigram extension first
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS parts_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number text NOT NULL,
  brand text DEFAULT '',
  description text DEFAULT '',
  category text DEFAULT '',
  extra jsonb DEFAULT '{}',
  source_file text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for fast search
CREATE INDEX IF NOT EXISTS parts_catalog_part_number_trgm_idx
  ON parts_catalog USING gin (part_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS parts_catalog_part_number_lower_idx
  ON parts_catalog (lower(part_number));
CREATE INDEX IF NOT EXISTS parts_catalog_brand_lower_idx
  ON parts_catalog (lower(brand));
CREATE INDEX IF NOT EXISTS parts_catalog_source_file_idx
  ON parts_catalog (source_file);

-- Enable RLS
ALTER TABLE parts_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read catalog"
  ON parts_catalog FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert catalog"
  ON parts_catalog FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update catalog"
  ON parts_catalog FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can delete catalog"
  ON parts_catalog FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Catalog uploads tracking table
CREATE TABLE IF NOT EXISTS catalog_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  filename text NOT NULL,
  file_path text DEFAULT '',
  row_count integer DEFAULT 0,
  status text DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE catalog_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read catalog uploads"
  ON catalog_uploads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can insert catalog uploads"
  ON catalog_uploads FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can update catalog uploads"
  ON catalog_uploads FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admins can delete catalog uploads"
  ON catalog_uploads FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));


-- ===== 20260507160159_create_catalog_storage_bucket.sql =====
/*
  # Create catalog-files storage bucket

  Admins upload Excel files here for catalog import.
  Files are private — only admins can access them.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-files',
  'catalog-files',
  false,
  52428800,  -- 50 MB limit
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Admins can upload
CREATE POLICY "Admins can upload catalog files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'catalog-files'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can read
CREATE POLICY "Admins can read catalog files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'catalog-files'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can delete
CREATE POLICY "Admins can delete catalog files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'catalog-files'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );


-- ===== 20260507160748_create_user_requests_storage_bucket.sql =====
/*
  # Create user-requests storage bucket

  Users upload Excel files here when submitting parts list requests.
  Users can upload to their own folder; admins can read everything.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-requests',
  'user-requests',
  false,
  10485760,  -- 10 MB limit per file
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload excel requests"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-requests'
    AND (storage.foldername(name))[1] = 'excel-requests'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Users can read their own uploads
CREATE POLICY "Users can read own excel requests"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-requests'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Admins can read all user uploads
CREATE POLICY "Admins can read all excel requests"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-requests'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );


-- ===== 20260508160803_make_user_requests_bucket_public.sql =====
/*
  # Make user-requests storage bucket public

  Excel files uploaded by users for processing need to be downloadable
  by the admin via a permanent link sent through WhatsApp.
  Making the bucket public gives us stable, permanent URLs with no expiry.
*/

UPDATE storage.buckets
SET public = true
WHERE id = 'user-requests';


-- ===== 20260509160607_add_price_to_catalog_and_unavailable_searches.sql =====
/*
  # Catalog enhancements: price column + unavailable searches log

  1. Changes to parts_catalog
     - Add `price` column (numeric, nullable) — stores price in AED

  2. New table: unavailable_searches
     - Logs every search that returned zero results
     - Columns: id, user_id, search_query, searched_at
     - RLS: authenticated users can insert; only admins can select

  3. New table: salesman_profiles
     - Stores the 10 salesman accounts linked to auth.users
     - Columns: id (auth.users FK), full_name, email, is_active, created_at
     - RLS: admins can manage; salesmen can read own row
*/

-- Add price column to parts_catalog
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parts_catalog' AND column_name = 'price'
  ) THEN
    ALTER TABLE parts_catalog ADD COLUMN price numeric DEFAULT NULL;
  END IF;
END $$;

-- Unavailable searches log
CREATE TABLE IF NOT EXISTS unavailable_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  search_query text NOT NULL,
  searched_at timestamptz DEFAULT now()
);

ALTER TABLE unavailable_searches ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can log a failed search
CREATE POLICY "Authenticated users can insert unavailable searches"
  ON unavailable_searches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Only admins can read the log
CREATE POLICY "Admins can read unavailable searches"
  ON unavailable_searches FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can delete entries
CREATE POLICY "Admins can delete unavailable searches"
  ON unavailable_searches FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Index for fast admin queries
CREATE INDEX IF NOT EXISTS unavailable_searches_searched_at_idx
  ON unavailable_searches (searched_at DESC);

-- Salesman profiles table
CREATE TABLE IF NOT EXISTS salesman_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  is_active boolean DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE salesman_profiles ENABLE ROW LEVEL SECURITY;

-- Admins can read all salesman profiles
CREATE POLICY "Admins can read salesman profiles"
  ON salesman_profiles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can insert salesman profiles
CREATE POLICY "Admins can insert salesman profiles"
  ON salesman_profiles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can update salesman profiles
CREATE POLICY "Admins can update salesman profiles"
  ON salesman_profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Admins can delete salesman profiles
CREATE POLICY "Admins can delete salesman profiles"
  ON salesman_profiles FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Salesmen can read their own profile
CREATE POLICY "Salesmen can read own profile"
  ON salesman_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);


-- ===== 20260509174459_fix_profiles_rls_recursion.sql =====
/*
  # Fix infinite recursion in profiles RLS policies

  The admin policies were querying the profiles table from within
  a policy ON the profiles table, causing infinite recursion.

  Fix: replace the self-referencing subquery with a direct auth.uid() check
  using a security-definer function that bypasses RLS.
*/

-- Drop the broken recursive policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Create a security-definer helper that reads is_admin without triggering RLS
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- Re-create admin policies using the helper function (no recursion)
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin_user());

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());


-- ===== 20260509175313_revert_profiles_rls_to_original.sql =====
/*
  # Revert profiles RLS to original state

  Removes the is_admin_user() function and restores the original
  admin policies that existed before the recursion fix attempt.
*/

-- Drop the new policies added by the previous migration
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Drop the helper function
DROP FUNCTION IF EXISTS public.is_admin_user();

-- Restore original admin policies
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p2
    WHERE p2.id = auth.uid() AND p2.is_admin = true
  ));

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p2
    WHERE p2.id = auth.uid() AND p2.is_admin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p2
    WHERE p2.id = auth.uid() AND p2.is_admin = true
  ));


-- ===== 20260509175956_fix_profiles_rls_final.sql =====
/*
  # Fix infinite recursion in profiles RLS — final

  The "Admins can view/update all profiles" policies use
  EXISTS (SELECT 1 FROM profiles p2 ...) which causes infinite
  recursion because the SELECT itself triggers the same policy.

  Solution: use a SECURITY DEFINER function with an explicit
  SET search_path and RESET search_path to read profiles
  without triggering RLS, breaking the recursive loop.
*/

-- Drop broken recursive admin policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Helper: check admin status bypassing RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Re-create admin SELECT policy — no recursion
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.check_is_admin());

-- Re-create admin UPDATE policy — no recursion
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());


-- ===== 20260509182600_fix_all_admin_rls_use_check_is_admin.sql =====
/*
  # Fix all admin RLS policies — replace recursive profiles subquery with check_is_admin()

  Every "Admins can ..." policy across all tables queries profiles table
  inside a RLS policy, which can cause infinite recursion when profiles
  itself is being evaluated. Replace all of them with the SECURITY DEFINER
  function check_is_admin() that bypasses RLS.

  Affected tables: catalog_uploads, parts_catalog, admin_logs,
  file_attachments, user_requests, salesman_profiles, unavailable_searches
*/

-- ── catalog_uploads ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read catalog uploads" ON catalog_uploads;
DROP POLICY IF EXISTS "Admins can insert catalog uploads" ON catalog_uploads;
DROP POLICY IF EXISTS "Admins can update catalog uploads" ON catalog_uploads;
DROP POLICY IF EXISTS "Admins can delete catalog uploads" ON catalog_uploads;

CREATE POLICY "Admins can read catalog uploads"
  ON catalog_uploads FOR SELECT TO authenticated
  USING (public.check_is_admin());

CREATE POLICY "Admins can insert catalog uploads"
  ON catalog_uploads FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can update catalog uploads"
  ON catalog_uploads FOR UPDATE TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can delete catalog uploads"
  ON catalog_uploads FOR DELETE TO authenticated
  USING (public.check_is_admin());

-- ── parts_catalog ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert catalog" ON parts_catalog;
DROP POLICY IF EXISTS "Admins can update catalog" ON parts_catalog;
DROP POLICY IF EXISTS "Admins can delete catalog" ON parts_catalog;

CREATE POLICY "Admins can insert catalog"
  ON parts_catalog FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can update catalog"
  ON parts_catalog FOR UPDATE TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can delete catalog"
  ON parts_catalog FOR DELETE TO authenticated
  USING (public.check_is_admin());

-- ── admin_logs ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view logs" ON admin_logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON admin_logs;

CREATE POLICY "Admins can view logs"
  ON admin_logs FOR SELECT TO authenticated
  USING (public.check_is_admin());

CREATE POLICY "Admins can insert logs"
  ON admin_logs FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

-- ── file_attachments ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all attachments" ON file_attachments;
DROP POLICY IF EXISTS "Admins can delete attachments" ON file_attachments;

CREATE POLICY "Admins can view all attachments"
  ON file_attachments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.check_is_admin());

CREATE POLICY "Admins can delete attachments"
  ON file_attachments FOR DELETE TO authenticated
  USING (public.check_is_admin());

-- ── user_requests ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all requests" ON user_requests;
DROP POLICY IF EXISTS "Admins can update all requests" ON user_requests;

CREATE POLICY "Admins can view all requests"
  ON user_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.check_is_admin());

CREATE POLICY "Admins can update all requests"
  ON user_requests FOR UPDATE TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());

-- ── salesman_profiles ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read salesman profiles" ON salesman_profiles;
DROP POLICY IF EXISTS "Admins can update salesman profiles" ON salesman_profiles;
DROP POLICY IF EXISTS "Admins can delete salesman profiles" ON salesman_profiles;
DROP POLICY IF EXISTS "Admins can insert salesman profiles" ON salesman_profiles;

CREATE POLICY "Admins can read salesman profiles"
  ON salesman_profiles FOR SELECT TO authenticated
  USING (public.check_is_admin());

CREATE POLICY "Admins can insert salesman profiles"
  ON salesman_profiles FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can update salesman profiles"
  ON salesman_profiles FOR UPDATE TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can delete salesman profiles"
  ON salesman_profiles FOR DELETE TO authenticated
  USING (public.check_is_admin());

-- ── unavailable_searches ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read unavailable searches" ON unavailable_searches;
DROP POLICY IF EXISTS "Admins can delete unavailable searches" ON unavailable_searches;

CREATE POLICY "Admins can read unavailable searches"
  ON unavailable_searches FOR SELECT TO authenticated
  USING (public.check_is_admin());

CREATE POLICY "Admins can delete unavailable searches"
  ON unavailable_searches FOR DELETE TO authenticated
  USING (public.check_is_admin());


-- ===== 20260509182628_fix_storage_objects_rls_use_check_is_admin.sql =====
/*
  # Fix storage.objects admin RLS policies — remove recursive profiles subquery

  Replace all EXISTS (SELECT FROM profiles ...) in storage.objects policies
  with public.check_is_admin() to avoid infinite recursion.
*/

-- catalog-files bucket
DROP POLICY IF EXISTS "Admins can read catalog files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete catalog files" ON storage.objects;

CREATE POLICY "Admins can read catalog files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'catalog-files' AND public.check_is_admin());

CREATE POLICY "Admins can delete catalog files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catalog-files' AND public.check_is_admin());

-- admin-files bucket
DROP POLICY IF EXISTS "Admins can view files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete files" ON storage.objects;

CREATE POLICY "Admins can view files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'admin-files' AND public.check_is_admin());

CREATE POLICY "Admins can delete files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'admin-files' AND public.check_is_admin());

-- user-requests bucket
DROP POLICY IF EXISTS "Admins can read all excel requests" ON storage.objects;

CREATE POLICY "Admins can read all excel requests"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'user-requests' AND public.check_is_admin());


-- ===== 20260516222815_add_stock_coo_to_parts_catalog.sql =====
/*
  # Add stock and COO fields to parts_catalog

  1. Changes
    - Add `stock` column (integer, nullable) to `parts_catalog` for availability tracking
    - Add `coo` column (text, nullable) to `parts_catalog` for Country of Origin
    - These fields will be populated automatically when Excel files are uploaded with matching column headers

  2. Notes
    - Both columns are nullable so existing data is unaffected
    - The process-excel edge function will detect these columns automatically
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parts_catalog' AND column_name = 'stock'
  ) THEN
    ALTER TABLE parts_catalog ADD COLUMN stock integer DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parts_catalog' AND column_name = 'coo'
  ) THEN
    ALTER TABLE parts_catalog ADD COLUMN coo text DEFAULT NULL;
  END IF;
END $$;


-- ===== 20260517115540_add_search_text_to_parts_catalog.sql =====
/*
  # Add search_text column to parts_catalog for full-text search

  1. Changes
    - Adds `search_text` generated column that concatenates part_number, brand,
      description, category, coo and the text representation of the extra JSONB column
    - This allows reliable ILIKE search across all fields including extra data
    - Adds a GIN trigram index for fast partial-match search

  2. Notes
    - The column is automatically maintained by Postgres (GENERATED ALWAYS AS)
    - The extra::text cast converts the entire JSONB to a searchable string
    - No data migration needed — generated columns are computed on read
*/

-- Enable pg_trgm extension for efficient ILIKE/trigram search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add generated search_text column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parts_catalog' AND column_name = 'search_text'
  ) THEN
    ALTER TABLE parts_catalog
      ADD COLUMN search_text text GENERATED ALWAYS AS (
        lower(
          coalesce(part_number, '') || ' ' ||
          coalesce(brand, '') || ' ' ||
          coalesce(description, '') || ' ' ||
          coalesce(category, '') || ' ' ||
          coalesce(coo, '') || ' ' ||
          coalesce(extra::text, '')
        )
      ) STORED;
  END IF;
END $$;

-- GIN trigram index for fast partial ILIKE matching on search_text
CREATE INDEX IF NOT EXISTS idx_parts_catalog_search_text_trgm
  ON parts_catalog USING gin (search_text gin_trgm_ops);

-- Also ensure indexes on the primary search fields individually
CREATE INDEX IF NOT EXISTS idx_parts_catalog_part_number_trgm
  ON parts_catalog USING gin (lower(part_number) gin_trgm_ops);


-- ===== 20260517125223_fix_file_attachments_admin_insert_and_search_text.sql =====
/*
  # Fix file_attachments admin insert + search_text price exclusion

  1. file_attachments INSERT policy
    - Current policy "Users can insert own attachments" uses `auth.uid() = user_id`
    - This fails when admin uploads with user_id = NULL (no linked client)
    - Fix: allow authenticated users who are admin to insert regardless of user_id,
      OR allow insert when user_id matches auth.uid()

  2. search_text generated column
    - Current definition includes `extra::text` which may contain price values
    - Replace with version that excludes the price column from search text
    - Drop and recreate the column and its index
*/

-- Fix file_attachments INSERT policy to allow admin uploads with null user_id
DROP POLICY IF EXISTS "Users can insert own attachments" ON file_attachments;

CREATE POLICY "Users or admins can insert attachments"
  ON file_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user_id) OR check_is_admin()
  );

-- Fix search_text generated column to exclude price (prevents searching by price number)
ALTER TABLE parts_catalog DROP COLUMN IF EXISTS search_text;

ALTER TABLE parts_catalog
  ADD COLUMN search_text text GENERATED ALWAYS AS (
    lower(
      coalesce(part_number, '') || ' ' ||
      coalesce(brand, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(coo, '')
    )
  ) STORED;

-- Recreate GIN trigram index on search_text
DROP INDEX IF EXISTS idx_parts_catalog_search_text_trgm;
CREATE INDEX idx_parts_catalog_search_text_trgm
  ON parts_catalog USING gin (search_text gin_trgm_ops);


-- ===== 20260517144001_add_user_delete_policies_and_file_attachments_delete.sql =====
/*
  # Add user DELETE policies for user_requests and file_attachments

  1. Problems fixed
    - user_requests had no DELETE policy — client deletes were silently blocked by RLS,
      causing requests to reappear after re-login (only UI state was cleared, not DB rows)
    - file_attachments had no DELETE policy for the owning user — clients couldn't
      remove admin-sent files from their own My Requests view

  2. New policies
    - "Users can delete own requests" on user_requests FOR DELETE
    - "Users can delete own file attachments" on file_attachments FOR DELETE
*/

-- Allow users to delete their own requests
CREATE POLICY "Users can delete own requests"
  ON user_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to delete their own file_attachments records
-- (this only removes the DB record; storage object stays — admin can clean up)
CREATE POLICY "Users can delete own file attachments"
  ON file_attachments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ===== 20260521120000_platform_fixes.sql =====
/*
  Platform fixes: client file downloads, search_text with extra fields,
  admin delete policies, unavailable search status
*/

-- ── search_text: include extra columns (exclude price-like keys) ──────────────
DROP INDEX IF EXISTS idx_parts_catalog_search_text_trgm;
ALTER TABLE parts_catalog DROP COLUMN IF EXISTS search_text;
ALTER TABLE parts_catalog ADD COLUMN search_text text;

CREATE OR REPLACE FUNCTION refresh_parts_catalog_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  extra_text text := '';
  k text;
  v text;
BEGIN
  FOR k, v IN SELECT key, value FROM jsonb_each_text(COALESCE(NEW.extra, '{}'::jsonb))
  LOOP
    IF k !~* '(price|cost|amount|sum|total|unitprice|unit_price|salesprice|listprice|retail|цена|стоимость|прайс)'
       AND v IS NOT NULL AND btrim(v) <> '' THEN
      extra_text := extra_text || ' ' || lower(v);
    END IF;
  END LOOP;

  NEW.search_text := lower(
    coalesce(NEW.part_number, '') || ' ' ||
    coalesce(NEW.brand, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.category, '') || ' ' ||
    coalesce(NEW.coo, '') || extra_text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parts_catalog_search_text_trigger ON parts_catalog;
CREATE TRIGGER parts_catalog_search_text_trigger
  BEFORE INSERT OR UPDATE ON parts_catalog
  FOR EACH ROW
  EXECUTE FUNCTION refresh_parts_catalog_search_text();

UPDATE parts_catalog SET part_number = part_number WHERE part_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parts_catalog_search_text_trgm
  ON parts_catalog USING gin (search_text gin_trgm_ops);

-- ── unavailable_searches: status + admin insert policy ─────────────────────
ALTER TABLE unavailable_searches
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'not_found';

DROP POLICY IF EXISTS "Admins can insert unavailable searches" ON unavailable_searches;
CREATE POLICY "Admins can insert unavailable searches"
  ON unavailable_searches FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

-- ── user_requests: admin delete ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can delete requests" ON user_requests;
CREATE POLICY "Admins can delete requests"
  ON user_requests FOR DELETE TO authenticated
  USING (public.check_is_admin());

-- ── file_attachments: admin insert for clients ──────────────────────────────
DROP POLICY IF EXISTS "Admins can insert attachments for clients" ON file_attachments;
CREATE POLICY "Admins can insert attachments for clients"
  ON file_attachments FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

-- ── storage: clients can download their admin-files ─────────────────────────
DROP POLICY IF EXISTS "Clients can read own admin-files" ON storage.objects;
CREATE POLICY "Clients can read own admin-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'admin-files'
    AND EXISTS (
      SELECT 1 FROM file_attachments fa
      WHERE fa.user_id = auth.uid()
        AND fa.file_path = name
    )
  );


-- ===== 20260521140000_unavailable_and_files_fix.sql =====
/*
  Unavailable parts logging + file access fixes
*/

-- Denormalized client info on unavailable searches (works without profiles join)
ALTER TABLE unavailable_searches
  ADD COLUMN IF NOT EXISTS client_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_status text DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'not_found';

-- Users can log their own failed searches (required)
DROP POLICY IF EXISTS "Authenticated users can insert unavailable searches" ON unavailable_searches;
CREATE POLICY "Authenticated users can insert unavailable searches"
  ON unavailable_searches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins read all
DROP POLICY IF EXISTS "Admins can read unavailable searches" ON unavailable_searches;
CREATE POLICY "Admins can read unavailable searches"
  ON unavailable_searches FOR SELECT TO authenticated
  USING (public.check_is_admin());

-- Admins delete all
DROP POLICY IF EXISTS "Admins can delete unavailable searches" ON unavailable_searches;
CREATE POLICY "Admins can delete unavailable searches"
  ON unavailable_searches FOR DELETE TO authenticated
  USING (public.check_is_admin());

-- Storage: clients read files linked in file_attachments
DROP POLICY IF EXISTS "Clients can read own admin-files" ON storage.objects;
CREATE POLICY "Clients can read own admin-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'admin-files'
    AND EXISTS (
      SELECT 1 FROM file_attachments fa
      WHERE fa.user_id = auth.uid()
        AND fa.file_path = storage.objects.name
    )
  );

-- Admins insert file_attachments for any client
DROP POLICY IF EXISTS "Admins can insert attachments for clients" ON file_attachments;
CREATE POLICY "Admins can insert attachments for clients"
  ON file_attachments FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());


-- ===== 20260521180000_search_text_include_all_codes.sql =====
/*
  search_text: include all part/code values from part_number + extra (Item Code, etc.)
*/

CREATE OR REPLACE FUNCTION refresh_parts_catalog_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  extra_text text := '';
  k text;
  v text;
  nk text;
BEGIN
  FOR k, v IN SELECT key, value FROM jsonb_each_text(COALESCE(NEW.extra, '{}'::jsonb))
  LOOP
    nk := lower(replace(replace(k, '_', ''), ' ', ''));
    IF k !~* '(price|cost|amount|sum|total|unitprice|unit_price|salesprice|listprice|retail|цена|стоимость|прайс)'
       AND v IS NOT NULL AND btrim(v) <> '' THEN
      extra_text := extra_text || ' ' || lower(v);
    END IF;
  END LOOP;

  NEW.search_text := lower(
    coalesce(NEW.part_number, '') || ' ' ||
    coalesce(NEW.search_text, '') || ' ' ||
    coalesce(NEW.brand, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.category, '') || ' ' ||
    coalesce(NEW.coo, '') || extra_text
  );

  NEW.search_text := trim(regexp_replace(NEW.search_text, '\s+', ' ', 'g'));
  RETURN NEW;
END;
$$;

UPDATE parts_catalog SET updated_at = now();


-- ===== 20260522100000_catalog_search_unavailable_import_fix.sql =====
/*
  Full fix: catalog search (all code columns), unavailable_searches schema,
  RPC to bypass PostgREST schema cache issues, rebuild search_text index.
*/

-- ── unavailable_searches: ensure all columns exist ───────────────────────────
ALTER TABLE unavailable_searches
  ADD COLUMN IF NOT EXISTS client_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_status text DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'not_found',
  ADD COLUMN IF NOT EXISTS searched_code text;

-- Backfill searched_code from search_query
UPDATE unavailable_searches
SET searched_code = search_query
WHERE searched_code IS NULL OR btrim(searched_code) = '';

-- Keep searched_code in sync on future inserts via trigger
CREATE OR REPLACE FUNCTION sync_unavailable_searched_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.searched_code IS NULL OR btrim(NEW.searched_code) = '' THEN
    NEW.searched_code := NEW.search_query;
  END IF;
  IF NEW.search_query IS NULL OR btrim(NEW.search_query) = '' THEN
    NEW.search_query := NEW.searched_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS unavailable_searches_sync_code_trigger ON unavailable_searches;
CREATE TRIGGER unavailable_searches_sync_code_trigger
  BEFORE INSERT OR UPDATE ON unavailable_searches
  FOR EACH ROW
  EXECUTE FUNCTION sync_unavailable_searched_code();

-- RLS: users insert own failed searches
DROP POLICY IF EXISTS "Authenticated users can insert unavailable searches" ON unavailable_searches;
CREATE POLICY "Authenticated users can insert unavailable searches"
  ON unavailable_searches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read unavailable searches" ON unavailable_searches;
CREATE POLICY "Admins can read unavailable searches"
  ON unavailable_searches FOR SELECT TO authenticated
  USING (public.check_is_admin());

DROP POLICY IF EXISTS "Admins can delete unavailable searches" ON unavailable_searches;
CREATE POLICY "Admins can delete unavailable searches"
  ON unavailable_searches FOR DELETE TO authenticated
  USING (public.check_is_admin());

-- ── search_text: all codes from part_number + extra ──────────────────────────
CREATE OR REPLACE FUNCTION refresh_parts_catalog_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  extra_text text := '';
  k text;
  v text;
BEGIN
  FOR k, v IN SELECT key, value FROM jsonb_each_text(COALESCE(NEW.extra, '{}'::jsonb))
  LOOP
    IF k !~* '(price|cost|amount|sum|total|unitprice|unit_price|salesprice|listprice|retail|цена|стоимость|прайс)'
       AND v IS NOT NULL AND btrim(v) <> '' THEN
      extra_text := extra_text || ' ' || lower(v);
    END IF;
  END LOOP;

  NEW.search_text := lower(
    coalesce(NEW.part_number, '') || ' ' ||
    coalesce(NEW.search_text, '') || ' ' ||
    coalesce(NEW.brand, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.category, '') || ' ' ||
    coalesce(NEW.coo, '') || extra_text
  );

  NEW.search_text := trim(regexp_replace(NEW.search_text, '\s+', ' ', 'g'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS parts_catalog_search_text_trigger ON parts_catalog;
CREATE TRIGGER parts_catalog_search_text_trigger
  BEFORE INSERT OR UPDATE ON parts_catalog
  FOR EACH ROW
  EXECUTE FUNCTION refresh_parts_catalog_search_text();

-- Rebuild search_text for existing catalog rows
UPDATE parts_catalog SET updated_at = now();

CREATE INDEX IF NOT EXISTS idx_parts_catalog_search_text_trgm
  ON parts_catalog USING gin (search_text gin_trgm_ops);

-- ── RPC: search catalog (all columns + extra JSON codes) ─────────────────────
CREATE OR REPLACE FUNCTION search_parts_catalog(
  p_query text,
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  part_number text,
  brand text,
  description text,
  category text,
  price numeric,
  stock integer,
  coo text,
  extra jsonb,
  search_text text,
  source_file text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text;
  lim integer;
BEGIN
  q := lower(btrim(coalesce(p_query, '')));
  IF q = '' THEN
    RETURN;
  END IF;

  lim := greatest(1, least(coalesce(p_limit, 100), 500));

  RETURN QUERY
  SELECT
    pc.id,
    pc.part_number,
    pc.brand,
    pc.description,
    pc.category,
    pc.price,
    pc.stock,
    pc.coo,
    pc.extra,
    pc.search_text,
    pc.source_file,
    pc.created_at,
    pc.updated_at
  FROM parts_catalog pc
  WHERE
    lower(coalesce(pc.part_number, '')) LIKE '%' || q || '%'
    OR lower(coalesce(pc.brand, '')) LIKE '%' || q || '%'
    OR lower(coalesce(pc.description, '')) LIKE '%' || q || '%'
    OR lower(coalesce(pc.category, '')) LIKE '%' || q || '%'
    OR lower(coalesce(pc.coo, '')) LIKE '%' || q || '%'
    OR lower(coalesce(pc.search_text, '')) LIKE '%' || q || '%'
    OR EXISTS (
      SELECT 1
      FROM jsonb_each_text(coalesce(pc.extra, '{}'::jsonb)) AS e(key, value)
      WHERE lower(coalesce(e.value, '')) LIKE '%' || q || '%'
    )
  ORDER BY pc.part_number
  LIMIT lim;
END;
$$;

GRANT EXECUTE ON FUNCTION search_parts_catalog(text, integer) TO authenticated;

-- ── RPC: log failed search (bypasses REST schema cache on insert) ────────────
CREATE OR REPLACE FUNCTION log_unavailable_search(
  p_search_query text,
  p_client_name text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  term text;
  new_id uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  term := btrim(coalesce(p_search_query, ''));
  IF term = '' THEN
    RAISE EXCEPTION 'Empty search query';
  END IF;

  INSERT INTO unavailable_searches (
    user_id,
    search_query,
    searched_code,
    client_name,
    status,
    searched_at
  )
  VALUES (
    uid,
    term,
    term,
    coalesce(btrim(p_client_name), ''),
    'not_found',
    now()
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_unavailable_search(text, text) TO authenticated;

-- Ask PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';


-- ===== 20260522120000_client_file_download_fix.sql =====
-- Clients can download files linked to them in file_attachments (admin-files bucket)
DROP POLICY IF EXISTS "Clients can read own admin-files" ON storage.objects;
CREATE POLICY "Clients can read own admin-files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'admin-files'
    AND EXISTS (
      SELECT 1 FROM file_attachments fa
      WHERE fa.user_id = auth.uid()
        AND fa.file_path = storage.objects.name
    )
  );

DROP POLICY IF EXISTS "Admins can insert attachments for clients" ON file_attachments;
CREATE POLICY "Admins can insert attachments for clients"
  ON file_attachments FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS "Admins can upload files" ON storage.objects;
CREATE POLICY "Admins can upload files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-files' AND public.check_is_admin());

NOTIFY pgrst, 'reload schema';


-- ===== 20260527150000_admin_delete_user.sql =====
-- Allow admins to fully delete a client account (auth + profile via CASCADE)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.check_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing user id');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id AND is_admin = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete admin account');
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- Free email after admin soft-delete so the client can register again
CREATE OR REPLACE FUNCTION public.reclaim_deleted_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid;
  norm text := lower(trim(p_email));
BEGIN
  IF norm IS NULL OR norm = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing email');
  END IF;

  SELECT id INTO uid
  FROM public.profiles
  WHERE email LIKE '__deleted__%'
    AND rejection_reason LIKE '%original_email:' || norm || '%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF uid IS NULL THEN
    SELECT au.id INTO uid
    FROM auth.users au
    INNER JOIN public.profiles p ON p.id = au.id
    WHERE lower(au.email) = norm
      AND p.email LIKE '__deleted__%'
    LIMIT 1;
  END IF;

  IF uid IS NULL THEN
    SELECT id INTO uid
    FROM public.profiles
    WHERE lower(email) = norm
      AND rejection_reason LIKE 'Account deleted by administrator%'
    LIMIT 1;
  END IF;

  IF uid IS NULL THEN
    SELECT au.id INTO uid
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE lower(au.email) = norm
      AND p.id IS NULL
    LIMIT 1;
  END IF;

  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_deleted');
  END IF;

  DELETE FROM auth.users WHERE id = uid;
  DELETE FROM public.profiles WHERE id = uid;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reclaim_deleted_email(text) TO anon, authenticated;


NOTIFY pgrst, 'reload schema';
