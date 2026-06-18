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
