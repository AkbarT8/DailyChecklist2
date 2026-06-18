/*
  # Fix infinite recursion in profiles RLS — final

  The "Admins can view/update all profiles" policies use
  EXISTS (SELECT 1 FROM profiles p2 ...) which causes infinite
  recursion because the SELECT itself triggers the same policy.

  Solution: use a SECURITY DEFINER function with an explicit
  SET search_path and RESET search_path to read profiles
  without triggering RLS, breaking the recursive loop.
*/

-- Drop broken recursive admin policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Helper: check admin status bypassing RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT is_admin INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Re-create admin SELECT policy — no recursion
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.check_is_admin());

-- Re-create admin UPDATE policy — no recursion
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());
