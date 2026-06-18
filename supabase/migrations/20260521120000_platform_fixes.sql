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
