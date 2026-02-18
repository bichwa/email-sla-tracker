-- FIX TRACKED_EMAILS ADMIN POLICY
-- The policy "Admins can view all tracked emails" is causing potential recursion.

-- 1. Drop the problematic Admin policy
DROP POLICY IF EXISTS "Admins can view all tracked emails" ON tracked_emails;

-- 2. Create the new Admin policy using the secure function
-- This uses the previously created 'is_admin_email' function.
CREATE POLICY "Admins can view all tracked emails"
ON tracked_emails
FOR SELECT
TO authenticated
USING (
  is_admin_email(auth.jwt() ->> 'email')
);
