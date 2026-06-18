-- Revert papco to pre-migration state (admin only, empty catalog)
DELETE FROM file_attachments;
DELETE FROM parts_catalog;
DELETE FROM user_requests;
DELETE FROM unavailable_searches;
DELETE FROM admin_logs;
DELETE FROM catalog_uploads;
DELETE FROM public.profiles WHERE lower(email) NOT IN ('papcorasul@gmail.com');
DELETE FROM auth.identities WHERE user_id NOT IN (SELECT id FROM auth.users WHERE lower(email) = 'papcorasul@gmail.com');
DELETE FROM auth.users WHERE lower(email) <> 'papcorasul@gmail.com';

UPDATE public.profiles SET
  full_name = 'Administrator',
  company_name = 'PAPCO',
  phone = '+971547713447',
  country = 'UAE',
  city = 'Dubai',
  address = '',
  email = 'papcorasul@gmail.com',
  is_admin = true,
  registration_status = 'approved',
  rejection_reason = NULL
WHERE lower(email) = 'papcorasul@gmail.com';

NOTIFY pgrst, 'reload schema';
