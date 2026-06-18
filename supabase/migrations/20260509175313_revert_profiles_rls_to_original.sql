/*
  # Revert profiles RLS to original state

  Removes the is_admin_user() function and restores the original
  admin policies that existed before the recursion fix attempt.
*/

-- Drop the new policies added by the previous migration
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

-- Drop the helper function
DROP FUNCTION IF EXISTS public.is_admin_user();

-- Restore original admin policies
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p2
    WHERE p2.id = auth.uid() AND p2.is_admin = true
  ));

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p2
    WHERE p2.id = auth.uid() AND p2.is_admin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p2
    WHERE p2.id = auth.uid() AND p2.is_admin = true
  ));
