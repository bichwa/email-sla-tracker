-- Investigate and fix duplicate/empty employee entries

-- Step 1: Show all employees with their details (including inactive)
SELECT id, name, email, is_active, is_client_facing, created_at
FROM employees
ORDER BY name, created_at;

-- Step 2: Find duplicate names
SELECT name, COUNT(*) as cnt, 
       ARRAY_AGG(id) as ids, 
       ARRAY_AGG(email) as emails,
       ARRAY_AGG(is_active) as active_statuses
FROM employees
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY name;

-- Step 3: Find employees with empty/null names  
SELECT id, name, email, is_active, is_client_facing
FROM employees
WHERE name IS NULL OR name = '' OR TRIM(name) = '';

-- Step 4: Check if account managers exist in employees table
SELECT email, name, is_active, is_client_facing 
FROM employees 
WHERE email IN (
    'iodago@solvit.co.ke', 'jmungasi@solvit.co.ke',
    'vmusyoka@solvit.co.ke', 'bachieng@solvit.co.ke', 
    'modondi@solvit.co.ke'
);
