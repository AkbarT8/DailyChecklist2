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
