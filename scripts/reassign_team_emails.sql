-- Reassign existing team@solvit.co.ke emails to the correct account manager
-- based on sender email domain. Run AFTER deploying the code fix.
-- This brings historical emails in line with the new assignment rules.

-- Step 1: Preview — see what WOULD be reassigned (run this first!)
SELECT 
    from_email,
    subject,
    responsible_employee_email AS currently_assigned,
    CASE
        -- Irene Odago
        WHEN from_email ILIKE '%apainsurance%' OR from_email ILIKE '%apalife%' THEN 'iodago@solvit.co.ke'
        WHEN from_email ILIKE '%fidelityshield%' THEN 'iodago@solvit.co.ke'
        WHEN from_email ILIKE '%ga-insurance%' OR from_email ILIKE '%gakenya%' OR from_email ILIKE '%gainsurance%' THEN 'iodago@solvit.co.ke'
        WHEN from_email ILIKE '%madison.co%' THEN 'iodago@solvit.co.ke'
        WHEN from_email ILIKE '%pioneerassurance%' OR from_email ILIKE '%pioneerinsurance%' THEN 'iodago@solvit.co.ke'
        WHEN from_email ILIKE '%icealion%' THEN 'iodago@solvit.co.ke'
        WHEN from_email ILIKE '%directline.co%' THEN 'iodago@solvit.co.ke'
        WHEN from_email ILIKE '%dtbafrica%' THEN 'iodago@solvit.co.ke'
        WHEN from_email ILIKE '%ncbagroup%' OR from_email ILIKE '%ncbainsurance%' THEN 'iodago@solvit.co.ke'
        -- Joyce Mungasi
        WHEN from_email ILIKE '%oldmutual%' THEN 'jmungasi@solvit.co.ke'
        WHEN from_email ILIKE '%heritage.co%' OR from_email ILIKE '%heritageinsurance%' THEN 'jmungasi@solvit.co.ke'
        WHEN from_email ILIKE '%cannon.co%' THEN 'jmungasi@solvit.co.ke'
        WHEN from_email ILIKE '%corporatekenya%' OR from_email ILIKE '%cickenya%' THEN 'jmungasi@solvit.co.ke'
        WHEN from_email ILIKE '%definite%' THEN 'jmungasi@solvit.co.ke'
        WHEN from_email ILIKE '%monarchinsurance%' OR from_email ILIKE '%monarch.co%' THEN 'jmungasi@solvit.co.ke'
        WHEN from_email ILIKE '%stima-sacco%' OR from_email ILIKE '%stimasacco%' THEN 'jmungasi@solvit.co.ke'
        -- Virginia Musyoka
        WHEN from_email ILIKE '%takaful%' THEN 'vmusyoka@solvit.co.ke'
        WHEN from_email ILIKE '%mayfair.co%' THEN 'vmusyoka@solvit.co.ke'
        WHEN from_email ILIKE '%cic.co%' OR from_email ILIKE '%cicinsurance%' THEN 'vmusyoka@solvit.co.ke'
        WHEN from_email ILIKE '%occidental-ins%' OR from_email ILIKE '%occidental.co%' THEN 'vmusyoka@solvit.co.ke'
        WHEN from_email ILIKE '%kenindia%' THEN 'vmusyoka@solvit.co.ke'
        WHEN from_email ILIKE '%sanlam%' OR from_email ILIKE '%sanlamallianz%' THEN 'vmusyoka@solvit.co.ke'
        WHEN from_email ILIKE '%jubilee%' THEN 'vmusyoka@solvit.co.ke'
        WHEN from_email ILIKE '%allianz%' THEN 'vmusyoka@solvit.co.ke'
        -- Belinda Achieng
        WHEN from_email ILIKE '%firstassurance%' THEN 'bachieng@solvit.co.ke'
        WHEN from_email ILIKE '%pacis%' THEN 'bachieng@solvit.co.ke'
        WHEN from_email ILIKE '%britam%' THEN 'bachieng@solvit.co.ke'
        WHEN from_email ILIKE '%amaco%' THEN 'bachieng@solvit.co.ke'
        WHEN from_email ILIKE '%geminia%' THEN 'bachieng@solvit.co.ke'
        WHEN from_email ILIKE '%mua.co%' THEN 'bachieng@solvit.co.ke'
        WHEN from_email ILIKE '%realpeople%' THEN 'bachieng@solvit.co.ke'
        -- Mercy Odondi
        WHEN from_email ILIKE '%intrafrica%' OR from_email ILIKE '%intraafrica%' THEN 'modondi@solvit.co.ke'
        WHEN from_email ILIKE '%aar.co%' OR from_email ILIKE '%aar-insurance%' THEN 'modondi@solvit.co.ke'
        WHEN from_email ILIKE '%starinsurance%' OR from_email ILIKE '%stardiscovery%' OR from_email ILIKE '%starlifekenya%' THEN 'modondi@solvit.co.ke'
        WHEN from_email ILIKE '%jiajiri%' THEN 'modondi@solvit.co.ke'
        ELSE 'NO MATCH'
    END AS should_be_assigned_to
FROM tracked_emails
WHERE responsible_employee_email = 'team@solvit.co.ke'
  AND from_email IS NOT NULL
ORDER BY from_email;


-- Step 2: Perform the actual reassignment (UNCOMMENT when ready)
/*

-- Irene Odago
UPDATE tracked_emails SET responsible_employee_email = 'iodago@solvit.co.ke'
WHERE responsible_employee_email = 'team@solvit.co.ke'
  AND (from_email ILIKE '%apainsurance%' OR from_email ILIKE '%apalife%'
    OR from_email ILIKE '%fidelityshield%'
    OR from_email ILIKE '%ga-insurance%' OR from_email ILIKE '%gakenya%' OR from_email ILIKE '%gainsurance%'
    OR from_email ILIKE '%madison.co%'
    OR from_email ILIKE '%pioneerassurance%' OR from_email ILIKE '%pioneerinsurance%'
    OR from_email ILIKE '%icealion%'
    OR from_email ILIKE '%directline.co%'
    OR from_email ILIKE '%dtbafrica%'
    OR from_email ILIKE '%ncbagroup%' OR from_email ILIKE '%ncbainsurance%');

-- Joyce Mungasi
UPDATE tracked_emails SET responsible_employee_email = 'jmungasi@solvit.co.ke'
WHERE responsible_employee_email = 'team@solvit.co.ke'
  AND (from_email ILIKE '%oldmutual%'
    OR from_email ILIKE '%heritage.co%' OR from_email ILIKE '%heritageinsurance%'
    OR from_email ILIKE '%cannon.co%'
    OR from_email ILIKE '%corporatekenya%' OR from_email ILIKE '%cickenya%'
    OR from_email ILIKE '%definite%'
    OR from_email ILIKE '%monarchinsurance%' OR from_email ILIKE '%monarch.co%'
    OR from_email ILIKE '%stima-sacco%' OR from_email ILIKE '%stimasacco%');

-- Virginia Musyoka
UPDATE tracked_emails SET responsible_employee_email = 'vmusyoka@solvit.co.ke'
WHERE responsible_employee_email = 'team@solvit.co.ke'
  AND (from_email ILIKE '%takaful%'
    OR from_email ILIKE '%mayfair.co%'
    OR from_email ILIKE '%cic.co%' OR from_email ILIKE '%cicinsurance%'
    OR from_email ILIKE '%occidental-ins%' OR from_email ILIKE '%occidental.co%'
    OR from_email ILIKE '%kenindia%'
    OR from_email ILIKE '%sanlam%' OR from_email ILIKE '%sanlamallianz%'
    OR from_email ILIKE '%jubilee%'
    OR from_email ILIKE '%allianz%');

-- Belinda Achieng
UPDATE tracked_emails SET responsible_employee_email = 'bachieng@solvit.co.ke'
WHERE responsible_employee_email = 'team@solvit.co.ke'
  AND (from_email ILIKE '%firstassurance%'
    OR from_email ILIKE '%pacis%'
    OR from_email ILIKE '%britam%'
    OR from_email ILIKE '%amaco%'
    OR from_email ILIKE '%geminia%'
    OR from_email ILIKE '%mua.co%'
    OR from_email ILIKE '%realpeople%');

-- Mercy Odondi
UPDATE tracked_emails SET responsible_employee_email = 'modondi@solvit.co.ke'
WHERE responsible_employee_email = 'team@solvit.co.ke'
  AND (from_email ILIKE '%intrafrica%' OR from_email ILIKE '%intraafrica%'
    OR from_email ILIKE '%aar.co%' OR from_email ILIKE '%aar-insurance%'
    OR from_email ILIKE '%starinsurance%' OR from_email ILIKE '%stardiscovery%' OR from_email ILIKE '%starlifekenya%'
    OR from_email ILIKE '%jiajiri%');

*/


-- Step 3: Verify — check what's still assigned to team@ after reassignment
SELECT 
    responsible_employee_email,
    COUNT(*) as email_count
FROM tracked_emails
WHERE responsible_employee_email IN (
    'team@solvit.co.ke', 
    'iodago@solvit.co.ke', 'jmungasi@solvit.co.ke', 
    'vmusyoka@solvit.co.ke', 'bachieng@solvit.co.ke', 
    'modondi@solvit.co.ke'
)
GROUP BY responsible_employee_email
ORDER BY email_count DESC;
