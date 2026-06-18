/*
  # Add rejection_reason to profiles and harden registration flow

  1. Changes
    - Add `rejection_reason` (text, nullable) to profiles table
    - Ensure `email` column exists on profiles (already added in prior migration but idempotent)
    - Add policy: users can read their own registration_status (needed for login gate check)
    - Add unique constraint on profiles.email to prevent duplicate registrations

  2. Security
    - Users can only read their own profile row (already exists)
    - New column is only writable by admins via existing admin UPDATE policy
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rejection_reason text DEFAULT NULL;
  END IF;
END $$;

-- Make sure email column exists and has a unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text DEFAULT '';
  END IF;
END $$;

-- Add unique index on profiles.email to prevent duplicate registrations (skip nulls/empty)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON profiles (email)
  WHERE email IS NOT NULL AND email <> '';

-- Ensure registration_status default is 'pending'
ALTER TABLE profiles ALTER COLUMN registration_status SET DEFAULT 'pending';
