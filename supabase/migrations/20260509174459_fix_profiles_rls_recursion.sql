/*
  # Fix infinite recursion in profiles RLS policies

  The admin policies were querying the profiles table from within
  a policy ON the profiles table, causing infinite recursion.

  Fix: replace the self-referencing subquery with a direct auth.uid() check
  using a security-definer function that bypasses RLS.
*/

-- Drop the broken recursive policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Create a security-definer helper that reads is_admin without triggering RLS
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- Re-create admin policies using the helper function (no recursion)
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin_user());

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());
