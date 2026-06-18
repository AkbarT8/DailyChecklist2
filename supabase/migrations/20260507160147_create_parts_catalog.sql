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
