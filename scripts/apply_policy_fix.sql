-- FIX RLS POLICIES
-- This script drops the problematic policy and replaces it with one using the secure function.

-- 1. Drop the old policy causing the infinite recursion
-- Note: You might need to adjust the policy name if yours is different.
-- Common names are "Enable read access for all users", "Public profiles are viewable by everyone.", "Employees can view all employees"
DROP POLICY IF EXISTS "Enable read access for all users" ON employees;
DROP POLICY IF EXISTS "Employees can view all employees" ON employees;
DROP POLICY IF EXISTS "Allow authenticated read access" ON employees;

-- 2. Create the new policy using the security definer function
-- This avoids the infinite loop because 'is_employee_email' bypasses RLS.
CREATE POLICY "Employees can view all employees"
ON employees
FOR SELECT
TO authenticated
USING (
  is_employee_email(auth.jwt() ->> 'email')
);

-- 3. Also fix 'tracked_emails' if it has a similar issue
-- (Assuming it also checks against employees table for access)
-- Note: If tracked_emails checks 'employees', fixing 'employees' RLS above might be enough. 
-- But it's safer to use the function here too if possible.

-- Example for tracked_emails:
-- DROP POLICY IF EXISTS "Employees can view tracked emails" ON tracked_emails;
-- CREATE POLICY "Employees can view tracked emails"
-- ON tracked_emails FOR SELECT TO authenticated
-- USING ( is_employee_email(auth.jwt() ->> 'email') );
