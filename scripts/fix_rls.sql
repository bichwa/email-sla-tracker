-- FIX for "infinite recursion detected in policy for relation employees"

-- Problem: 
-- The RLS policies on 'employees' (and likely 'tracked_emails') are querying the 'employees' table to check permissions.
-- Querying 'employees' triggers the policy check again, creating an infinite loop.

-- Solution:
-- We use a "SECURITY DEFINER" function. This function runs with the privileges of the creator (postgres/admin),
-- bypassing RLS on the table it queries. This breaks the loop.

-- 1. Create a secure function to check if an email belongs to an employee
CREATE OR REPLACE FUNCTION public.is_employee_email(check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Critical: Bypasses RLS
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees 
    WHERE email = check_email
  );
END;
$$;

-- 2. Create a secure function to check if an email belongs to an ADMIN
CREATE OR REPLACE FUNCTION public.is_admin_email(check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Critical: Bypasses RLS
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees 
    WHERE email = check_email AND is_admin = true
  );
END;
$$;

-- 3. INSTRUCTIONS FOR UPDATING POLICIES:
-- Go to Supabase Dashboard -> Authentication -> Policies.
-- Find the policies for 'employees' table.
-- Change any condition that looks like "auth.email() IN (SELECT email FROM employees...)" 
-- to use the new function: "is_employee_email(auth.jwt() ->> 'email')"

-- Example Policy Updates (You might need to adjust names to match yours):

-- POLICY: "Allow employees to view all employees"
-- OLD: auth.email() IN (SELECT email FROM employees)
-- NEW: is_employee_email(auth.jwt() ->> 'email')

-- POLICY: "Allow admins to update employees"
-- OLD: auth.email() IN (SELECT email FROM employees WHERE is_admin = true)
-- NEW: is_admin_email(auth.jwt() ->> 'email')

-- Please run this script in the Supabase SQL Editor.
