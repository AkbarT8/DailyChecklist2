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
