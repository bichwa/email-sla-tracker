-- FIX ADMIN RLS POLICY
-- The policy "Admins can view all employees" is causing infinite recursion because it queries the 'employees' table.

-- 1. Create a secure function to check if an email belongs to an ADMIN
-- This function runs with elevated privileges (SECURITY DEFINER) to bypass RLS.
CREATE OR REPLACE FUNCTION public.is_admin_email(check_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees 
    WHERE email = check_email AND is_admin = true
  );
END;
$$;

-- 2. Drop the problematic Admin policy
DROP POLICY IF EXISTS "Admins can view all employees" ON employees;

-- 3. Create the new Admin policy using the secure function
-- This allows admins to view all rows, without triggering the recursion loop.
CREATE POLICY "Admins can view all employees"
ON employees
FOR SELECT
TO authenticated
USING (
  is_admin_email(auth.jwt() ->> 'email')
);
