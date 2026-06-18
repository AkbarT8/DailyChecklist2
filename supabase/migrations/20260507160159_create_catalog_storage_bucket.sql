/*
  # Create catalog-files storage bucket

  Admins upload Excel files here for catalog import.
  Files are private — only admins can access them.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-files',
  'catalog-files',
  false,
  52428800,  -- 50 MB limit
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Admins can upload
CREATE POLICY "Admins can upload catalog files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'catalog-files'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can read
CREATE POLICY "Admins can read catalog files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'catalog-files'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can delete
CREATE POLICY "Admins can delete catalog files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'catalog-files'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
