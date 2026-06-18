/*
  Unavailable parts logging + file access fixes
*/

-- Denormalized client info on unavailable searches (works without profiles join)
ALTER TABLE unavailable_searches
  ADD COLUMN IF NOT EXISTS client_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_status text DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'not_found';

-- Users can log their own failed searches (required)
DROP POLICY IF EXISTS "Authenticated users can insert unavailable searches" ON unavailable_searches;
CREATE POLICY "Authenticated users can insert unavailable searches"
  ON unavailable_searches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins read all
DROP POLICY IF EXISTS "Admins can read unavailable searches" ON unavailable_searches;
CREATE POLICY "Admins can read unavailable searches"
  ON unavailable_searches FOR SELECT TO authenticated
  USING (public.check_is_admin());

-- Admins delete all
DROP POLICY IF EXISTS "Admins can delete unavailable searches" ON unavailable_searches;
CREATE POLICY "Admins can delete unavailable searches"
  ON unavailable_searches FOR DELETE TO authenticated
  USING (public.check_is_admin());

-- Storage: clients read files linked in file_attachments
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

-- Admins insert file_attachments for any client
DROP POLICY IF EXISTS "Admins can insert attachments for clients" ON file_attachments;
CREATE POLICY "Admins can insert attachments for clients"
  ON file_attachments FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());
