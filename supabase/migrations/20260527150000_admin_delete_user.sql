-- Allow admins to fully delete a client account (auth + profile via CASCADE)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.check_is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing user id');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_user_id AND is_admin = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete admin account');
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

-- Free email after admin soft-delete so the client can register again
CREATE OR REPLACE FUNCTION public.reclaim_deleted_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid uuid;
  norm text := lower(trim(p_email));
BEGIN
  IF norm IS NULL OR norm = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing email');
  END IF;

  SELECT id INTO uid
  FROM public.profiles
  WHERE email LIKE '__deleted__%'
    AND rejection_reason LIKE '%original_email:' || norm || '%'
  ORDER BY created_at DESC
  LIMIT 1;

  IF uid IS NULL THEN
    SELECT au.id INTO uid
    FROM auth.users au
    INNER JOIN public.profiles p ON p.id = au.id
    WHERE lower(au.email) = norm
      AND p.email LIKE '__deleted__%'
    LIMIT 1;
  END IF;

  IF uid IS NULL THEN
    SELECT id INTO uid
    FROM public.profiles
    WHERE lower(email) = norm
      AND rejection_reason LIKE 'Account deleted by administrator%'
    LIMIT 1;
  END IF;

  IF uid IS NULL THEN
    SELECT au.id INTO uid
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.id = au.id
    WHERE lower(au.email) = norm
      AND p.id IS NULL
    LIMIT 1;
  END IF;

  IF uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_deleted');
  END IF;

  DELETE FROM auth.users WHERE id = uid;
  DELETE FROM public.profiles WHERE id = uid;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reclaim_deleted_email(text) TO anon, authenticated;
