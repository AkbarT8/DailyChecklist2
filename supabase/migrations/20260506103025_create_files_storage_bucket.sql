/*
  # Create storage bucket for admin file uploads

  1. Creates a private 'admin-files' bucket in Supabase Storage
  2. Adds RLS policies so only admins can upload/read/delete
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-files', 'admin-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'admin-files' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can view files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'admin-files' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'admin-files' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
