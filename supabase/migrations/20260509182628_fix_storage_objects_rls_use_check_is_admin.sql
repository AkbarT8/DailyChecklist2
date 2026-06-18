/*
  # Fix storage.objects admin RLS policies — remove recursive profiles subquery

  Replace all EXISTS (SELECT FROM profiles ...) in storage.objects policies
  with public.check_is_admin() to avoid infinite recursion.
*/

-- catalog-files bucket
DROP POLICY IF EXISTS "Admins can read catalog files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete catalog files" ON storage.objects;

CREATE POLICY "Admins can read catalog files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'catalog-files' AND public.check_is_admin());

CREATE POLICY "Admins can delete catalog files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catalog-files' AND public.check_is_admin());

-- admin-files bucket
DROP POLICY IF EXISTS "Admins can view files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete files" ON storage.objects;

CREATE POLICY "Admins can view files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'admin-files' AND public.check_is_admin());

CREATE POLICY "Admins can delete files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'admin-files' AND public.check_is_admin());

-- user-requests bucket
DROP POLICY IF EXISTS "Admins can read all excel requests" ON storage.objects;

CREATE POLICY "Admins can read all excel requests"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'user-requests' AND public.check_is_admin());
