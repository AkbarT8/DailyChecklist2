/*
  # Add user DELETE policies for user_requests and file_attachments

  1. Problems fixed
    - user_requests had no DELETE policy — client deletes were silently blocked by RLS,
      causing requests to reappear after re-login (only UI state was cleared, not DB rows)
    - file_attachments had no DELETE policy for the owning user — clients couldn't
      remove admin-sent files from their own My Requests view

  2. New policies
    - "Users can delete own requests" on user_requests FOR DELETE
    - "Users can delete own file attachments" on file_attachments FOR DELETE
*/

-- Allow users to delete their own requests
CREATE POLICY "Users can delete own requests"
  ON user_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to delete their own file_attachments records
-- (this only removes the DB record; storage object stays — admin can clean up)
CREATE POLICY "Users can delete own file attachments"
  ON file_attachments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
