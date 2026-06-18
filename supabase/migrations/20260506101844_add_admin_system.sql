/*
  # Admin System Setup

  1. Changes to existing tables
    - `profiles`: add `is_admin` boolean, `registration_status` (pending/approved/rejected), `email` column

  2. New Tables
    - `file_attachments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, uploader)
      - `request_id` (uuid, nullable, linked request)
      - `filename` (text)
      - `file_path` (text) - storage path
      - `file_size` (integer)
      - `uploaded_at` (timestamptz)

    - `admin_logs`
      - `id` (uuid, primary key)
      - `admin_id` (uuid)
      - `action` (text)
      - `target_type` (text) - 'user' | 'request' | 'file'
      - `target_id` (text)
      - `details` (text)
      - `created_at` (timestamptz)

  3. Security
    - Admin-only RLS policies for all management operations
    - Helper function to check admin status
*/

-- Add columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'registration_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN registration_status text NOT NULL DEFAULT 'pending';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Update user_requests: add 'in_progress' status support (already text, no change needed)
-- Add admin_note column to user_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_requests' AND column_name = 'admin_note'
  ) THEN
    ALTER TABLE user_requests ADD COLUMN admin_note text;
  END IF;
END $$;

-- file_attachments table
CREATE TABLE IF NOT EXISTS file_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid REFERENCES user_requests(id) ON DELETE SET NULL,
  filename text NOT NULL DEFAULT '',
  file_path text NOT NULL DEFAULT '',
  file_size integer NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT '',
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE file_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attachments"
  ON file_attachments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attachments"
  ON file_attachments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admin policies for file_attachments
CREATE POLICY "Admins can view all attachments"
  ON file_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete attachments"
  ON file_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- admin_logs table
CREATE TABLE IF NOT EXISTS admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL DEFAULT '',
  target_type text NOT NULL DEFAULT '',
  target_id text NOT NULL DEFAULT '',
  details text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view logs"
  ON admin_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can insert logs"
  ON admin_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

-- Admin policies for profiles: admins can view and update all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.is_admin = true
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p2
      WHERE p2.id = auth.uid() AND p2.is_admin = true
    )
  );

-- Admin policies for user_requests: admins can view and update all requests
CREATE POLICY "Admins can view all requests"
  ON user_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update all requests"
  ON user_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );
