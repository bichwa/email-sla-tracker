-- 1. Mark system emails as System Generated based on keywords
UPDATE tracked_emails
SET is_system_generated = true
WHERE (
  lower(subject) LIKE '%client not picking%' OR lower(body_preview) LIKE '%client not picking%' OR
  lower(subject) LIKE '%not ready%' OR lower(body_preview) LIKE '%not ready%' OR
  lower(subject) LIKE '%unreachable%' OR lower(body_preview) LIKE '%unreachable%' OR
  lower(subject) LIKE '%undeliverable%' OR lower(body_preview) LIKE '%undeliverable%' OR
  lower(subject) LIKE '%automatic reply%' OR lower(body_preview) LIKE '%automatic reply%' OR
  lower(subject) LIKE '%out of office%' OR lower(body_preview) LIKE '%out of office%' OR
  lower(subject) LIKE '%ticket%' OR lower(body_preview) LIKE '%ticket%' OR
  lower(subject) LIKE '%update on%' OR lower(body_preview) LIKE '%update on%' OR
  lower(subject) LIKE '%status of%' OR lower(body_preview) LIKE '%status of%'
) AND (is_system_generated IS NULL OR is_system_generated = false);

-- 2. Assign team emails to 'team@solvit.co.ke'
-- Checks if 'team@solvit.co.ke' is in the TO or CC list
UPDATE tracked_emails
SET 
  responsible_employee_email = 'team@solvit.co.ke',
  scenario = 'team_email'
WHERE 
  (
    to_email ILIKE '%team@solvit.co.ke%' 
    OR 
    EXISTS (SELECT 1 FROM unnest(cc_emails) AS cc WHERE cc ILIKE '%team@solvit.co.ke%')
  )
  AND (responsible_employee_email IS DISTINCT FROM 'team@solvit.co.ke');
