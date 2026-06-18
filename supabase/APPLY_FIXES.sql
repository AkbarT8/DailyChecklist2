-- Paste this entire file into Supabase Dashboard → SQL Editor → Run
-- https://supabase.com/dashboard/project/gzlbvdvocfgmnzzkvksd/sql/new

ALTER TABLE unavailable_searches
  ADD COLUMN IF NOT EXISTS client_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_status text DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'not_found',
  ADD COLUMN IF NOT EXISTS searched_code text;

UPDATE unavailable_searches
SET searched_code = search_query
WHERE searched_code IS NULL OR btrim(searched_code) = '';

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

UPDATE parts_catalog SET updated_at = now();

CREATE INDEX IF NOT EXISTS idx_parts_catalog_search_text_trgm
  ON parts_catalog USING gin (search_text gin_trgm_ops);

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

-- Client download: admin-files linked in file_attachments
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

NOTIFY pgrst, 'reload schema';

-- Admin: fully delete client account (auth.users + cascaded profile data)
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

-- Admin can create delivery rows when sending files to clients
DROP POLICY IF EXISTS "Admins can insert requests for clients" ON user_requests;
CREATE POLICY "Admins can insert requests for clients"
  ON user_requests FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

NOTIFY pgrst, 'reload schema';
