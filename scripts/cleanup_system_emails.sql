-- DATA CLEANUP & VIEW UPDATE

-- 1. Tag existing emails as system generated based on keywords
UPDATE tracked_emails
SET is_system_generated = true,
    is_client_email = false 
WHERE
   (subject ILIKE '%client not picking%' OR body_preview ILIKE '%client not picking%') OR
   (subject ILIKE '%not ready%' OR body_preview ILIKE '%not ready%') OR
   (subject ILIKE '%unreachable%' OR body_preview ILIKE '%unreachable%') OR
   (subject ILIKE '%undeliverable%') OR
   (subject ILIKE '%automatic reply%') OR
   (subject ILIKE '%out of office%') OR
   (subject ILIKE '%ticket%') OR 
   (subject ILIKE '%status of%');

-- 2. Redefine the view to EXCLUDE system emails explicitly
-- This ensures they don't appear in the dashboard "Unanswered" counts
DROP VIEW IF EXISTS unanswered_client_emails;

CREATE VIEW unanswered_client_emails AS
SELECT *
FROM tracked_emails
WHERE is_incoming = true
  AND has_response = false
  AND is_client_email = true
  AND is_system_generated = false;

-- 3. Grant access to the new view (since we dropped and recreated it)
GRANT SELECT ON unanswered_client_emails TO anon, authenticated;
