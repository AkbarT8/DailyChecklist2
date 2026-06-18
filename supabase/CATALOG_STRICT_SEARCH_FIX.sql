-- Consecutive substring search: "12" and "123" match "12345" in code, brand, item, description, etc.

CREATE OR REPLACE FUNCTION normalize_part_code(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(coalesce(t, ''), '[\s_\-\./\\]', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION field_contains_query(p_field text, p_query text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    coalesce(btrim(p_field), '') <> ''
    AND coalesce(btrim(p_query), '') <> ''
    AND (
      lower(p_field) LIKE '%' || lower(btrim(p_query)) || '%'
      OR normalize_part_code(p_field) LIKE '%' || normalize_part_code(p_query) || '%'
    );
$$;

CREATE OR REPLACE FUNCTION part_row_matches_search(
  p_part_number text,
  p_brand text,
  p_description text,
  p_category text,
  p_coo text,
  p_extra jsonb,
  p_query text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  e record;
  val text;
BEGIN
  IF coalesce(btrim(p_query), '') = '' THEN
    RETURN false;
  END IF;

  IF field_contains_query(p_part_number, p_query) THEN RETURN true; END IF;
  IF field_contains_query(p_brand, p_query) THEN RETURN true; END IF;
  IF field_contains_query(p_description, p_query) THEN RETURN true; END IF;
  IF field_contains_query(p_category, p_query) THEN RETURN true; END IF;
  IF field_contains_query(p_coo, p_query) THEN RETURN true; END IF;

  FOR e IN SELECT * FROM jsonb_each_text(coalesce(p_extra, '{}'::jsonb))
  LOOP
    val := btrim(coalesce(e.value, ''));
    IF val = '' OR length(val) > 120 THEN
      CONTINUE;
    END IF;
    IF field_contains_query(val, p_query) THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

DROP FUNCTION IF EXISTS search_parts_catalog(text, integer);
DROP FUNCTION IF EXISTS search_parts_catalog(text, integer, uuid);
DROP FUNCTION IF EXISTS part_row_matches_search(text, text, text, jsonb, text);

CREATE OR REPLACE FUNCTION search_parts_catalog(
  p_query text,
  p_limit integer DEFAULT 100,
  p_client_user_id uuid DEFAULT NULL
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
  IF q = '' OR length(q) < 1 THEN
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
    part_row_matches_search(
      pc.part_number,
      pc.brand,
      pc.description,
      pc.category,
      pc.coo,
      pc.extra,
      q
    )
    AND (
      (
        p_client_user_id IS NOT NULL
        AND pc.source_file LIKE 'client:' || p_client_user_id::text || '%'
      )
      OR (
        p_client_user_id IS NULL
        AND (pc.source_file IS NULL OR pc.source_file NOT LIKE 'client:%')
      )
    )
  ORDER BY pc.part_number
  LIMIT lim;
END;
$$;

GRANT EXECUTE ON FUNCTION search_parts_catalog(text, integer, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
