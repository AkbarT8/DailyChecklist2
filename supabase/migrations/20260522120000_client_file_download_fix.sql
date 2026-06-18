-- Clients can download files linked to them in file_attachments (admin-files bucket)
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

DROP POLICY IF EXISTS "Admins can insert attachments for clients" ON file_attachments;
CREATE POLICY "Admins can insert attachments for clients"
  ON file_attachments FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

DROP POLICY IF EXISTS "Admins can upload files" ON storage.objects;
CREATE POLICY "Admins can upload files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-files' AND public.check_is_admin());

NOTIFY pgrst, 'reload schema';
