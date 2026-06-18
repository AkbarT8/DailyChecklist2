/*
  # Create user-requests storage bucket

  Users upload Excel files here when submitting parts list requests.
  Users can upload to their own folder; admins can read everything.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-requests',
  'user-requests',
  false,
  10485760,  -- 10 MB limit per file
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to their own folder
CREATE POLICY "Users can upload excel requests"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-requests'
    AND (storage.foldername(name))[1] = 'excel-requests'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Users can read their own uploads
CREATE POLICY "Users can read own excel requests"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-requests'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Admins can read all user uploads
CREATE POLICY "Admins can read all excel requests"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-requests'
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
