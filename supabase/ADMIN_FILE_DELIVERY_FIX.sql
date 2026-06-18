-- Admin can create processed "admin_file" requests when sending files to clients
DROP POLICY IF EXISTS "Admins can insert requests for clients" ON user_requests;
CREATE POLICY "Admins can insert requests for clients"
  ON user_requests FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

NOTIFY pgrst, 'reload schema';
