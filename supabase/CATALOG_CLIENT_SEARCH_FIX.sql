-- Client catalog search scope + clients can read own unavailable searches

DROP FUNCTION IF EXISTS search_parts_catalog(text, integer);

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
    part_row_matches_search(pc.part_number, pc.brand, pc.description, pc.extra, q)
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

DROP POLICY IF EXISTS "Users can read own unavailable searches" ON unavailable_searches;
CREATE POLICY "Users can read own unavailable searches"
  ON unavailable_searches FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
