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
