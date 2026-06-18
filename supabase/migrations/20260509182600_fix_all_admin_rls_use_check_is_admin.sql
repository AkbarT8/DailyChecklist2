/*
  # Fix all admin RLS policies — replace recursive profiles subquery with check_is_admin()

  Every "Admins can ..." policy across all tables queries profiles table
  inside a RLS policy, which can cause infinite recursion when profiles
  itself is being evaluated. Replace all of them with the SECURITY DEFINER
  function check_is_admin() that bypasses RLS.

  Affected tables: catalog_uploads, parts_catalog, admin_logs,
  file_attachments, user_requests, salesman_profiles, unavailable_searches
*/

-- ── catalog_uploads ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read catalog uploads" ON catalog_uploads;
DROP POLICY IF EXISTS "Admins can insert catalog uploads" ON catalog_uploads;
DROP POLICY IF EXISTS "Admins can update catalog uploads" ON catalog_uploads;
DROP POLICY IF EXISTS "Admins can delete catalog uploads" ON catalog_uploads;

CREATE POLICY "Admins can read catalog uploads"
  ON catalog_uploads FOR SELECT TO authenticated
  USING (public.check_is_admin());

CREATE POLICY "Admins can insert catalog uploads"
  ON catalog_uploads FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can update catalog uploads"
  ON catalog_uploads FOR UPDATE TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can delete catalog uploads"
  ON catalog_uploads FOR DELETE TO authenticated
  USING (public.check_is_admin());

-- ── parts_catalog ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can insert catalog" ON parts_catalog;
DROP POLICY IF EXISTS "Admins can update catalog" ON parts_catalog;
DROP POLICY IF EXISTS "Admins can delete catalog" ON parts_catalog;

CREATE POLICY "Admins can insert catalog"
  ON parts_catalog FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can update catalog"
  ON parts_catalog FOR UPDATE TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can delete catalog"
  ON parts_catalog FOR DELETE TO authenticated
  USING (public.check_is_admin());

-- ── admin_logs ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view logs" ON admin_logs;
DROP POLICY IF EXISTS "Admins can insert logs" ON admin_logs;

CREATE POLICY "Admins can view logs"
  ON admin_logs FOR SELECT TO authenticated
  USING (public.check_is_admin());

CREATE POLICY "Admins can insert logs"
  ON admin_logs FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

-- ── file_attachments ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all attachments" ON file_attachments;
DROP POLICY IF EXISTS "Admins can delete attachments" ON file_attachments;

CREATE POLICY "Admins can view all attachments"
  ON file_attachments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.check_is_admin());

CREATE POLICY "Admins can delete attachments"
  ON file_attachments FOR DELETE TO authenticated
  USING (public.check_is_admin());

-- ── user_requests ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all requests" ON user_requests;
DROP POLICY IF EXISTS "Admins can update all requests" ON user_requests;

CREATE POLICY "Admins can view all requests"
  ON user_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.check_is_admin());

CREATE POLICY "Admins can update all requests"
  ON user_requests FOR UPDATE TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());

-- ── salesman_profiles ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read salesman profiles" ON salesman_profiles;
DROP POLICY IF EXISTS "Admins can update salesman profiles" ON salesman_profiles;
DROP POLICY IF EXISTS "Admins can delete salesman profiles" ON salesman_profiles;
DROP POLICY IF EXISTS "Admins can insert salesman profiles" ON salesman_profiles;

CREATE POLICY "Admins can read salesman profiles"
  ON salesman_profiles FOR SELECT TO authenticated
  USING (public.check_is_admin());

CREATE POLICY "Admins can insert salesman profiles"
  ON salesman_profiles FOR INSERT TO authenticated
  WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can update salesman profiles"
  ON salesman_profiles FOR UPDATE TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());

CREATE POLICY "Admins can delete salesman profiles"
  ON salesman_profiles FOR DELETE TO authenticated
  USING (public.check_is_admin());

-- ── unavailable_searches ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read unavailable searches" ON unavailable_searches;
DROP POLICY IF EXISTS "Admins can delete unavailable searches" ON unavailable_searches;

CREATE POLICY "Admins can read unavailable searches"
  ON unavailable_searches FOR SELECT TO authenticated
  USING (public.check_is_admin());

CREATE POLICY "Admins can delete unavailable searches"
  ON unavailable_searches FOR DELETE TO authenticated
  USING (public.check_is_admin());
