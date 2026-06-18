/*
  # Create user_requests table

  1. New Tables
    - `user_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `type` (text) - 'catalog_search' | 'catalog_request' | 'excel_request' | 'pricelist_request'
      - `query` (text) - search query or description
      - `file_url` (text, nullable) - uploaded file URL for excel requests
      - `status` (text) - 'pending' | 'processed'
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `user_requests` table
    - Authenticated users can insert and view their own requests
*/

CREATE TABLE IF NOT EXISTS user_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'catalog_search',
  query text NOT NULL DEFAULT '',
  file_url text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON user_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own requests"
  ON user_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
