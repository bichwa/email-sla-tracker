-- RESTORE PUBLIC READ ACCESS
-- Since the application uses MSAL for authentication but does NOT sync with Supabase Auth,
-- all database requests are made as "Anon".
-- The previous RLS policies relying on 'auth.email()' or 'auth.jwt()' were blocking access.
-- This script restores public read access to allow the dashboard to function.

-- 1. Drop the restrictive policies on 'employees'
DROP POLICY IF EXISTS "Employees can view all employees" ON employees;
DROP POLICY IF EXISTS "Admins can view all employees" ON employees;
-- (And any others that might exist)

-- 2. Allow public read access to 'employees'
CREATE POLICY "Public Read Access"
ON employees
FOR SELECT
TO anon, authenticated
USING (true);

-- 3. Drop the restrictive policies on 'tracked_emails'
DROP POLICY IF EXISTS "Admins can view all tracked emails" ON tracked_emails;
DROP POLICY IF EXISTS "Employees can view their tracked emails" ON tracked_emails;

-- 4. Allow public read access to 'tracked_emails'
CREATE POLICY "Public Read Access"
ON tracked_emails
FOR SELECT
TO anon, authenticated
USING (true);
