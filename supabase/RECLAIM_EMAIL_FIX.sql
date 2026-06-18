-- Let deleted / removed users register again with the same email

CREATE OR REPLACE FUNCTION public.email_blocks_registration(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm text := lower(trim(p_email));
BEGIN
  IF norm IS NULL OR norm = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE lower(p.email) = norm
      AND NOT (
        p.email LIKE '__deleted__%'
        OR COALESCE(p.rejection_reason, '') LIKE 'Account deleted by administrator%'
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.email_blocks_registration(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.force_delete_auth_user(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
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

REVOKE ALL ON FUNCTION public.force_delete_auth_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.force_delete_auth_user(uuid) TO service_role;

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

  -- Auth on this email where profile is missing or marked removed by admin
  SELECT au.id INTO uid
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE lower(trim(au.email)) = norm
    AND (
      p.id IS NULL
      OR p.email LIKE '__deleted__%'
      OR COALESCE(p.rejection_reason, '') LIKE 'Account deleted by administrator%'
      OR COALESCE(p.rejection_reason, '') LIKE '%original_email:' || norm || '%'
    )
  ORDER BY au.created_at DESC
  LIMIT 1;

  -- Soft-deleted profile while auth email was already cleared/changed
  IF uid IS NULL THEN
    SELECT id INTO uid
    FROM public.profiles
    WHERE email LIKE '__deleted__%'
      AND COALESCE(rejection_reason, '') LIKE '%original_email:' || norm || '%'
    ORDER BY created_at DESC
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

NOTIFY pgrst, 'reload schema';
