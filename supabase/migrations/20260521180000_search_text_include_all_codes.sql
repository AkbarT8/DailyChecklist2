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
