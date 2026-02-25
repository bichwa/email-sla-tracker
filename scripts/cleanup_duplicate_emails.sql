-- ============================================================
-- Cleanup duplicate emails in tracked_emails table
-- Duplicates caused by same email being fetched from multiple 
-- employee mailboxes (Graph API 'id' differs per mailbox)
-- ============================================================

-- Step 1: Preview duplicates (run this first to see what will be deleted)
-- Shows groups of emails sharing the same internet_message_id
SELECT 
    internet_message_id,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY created_at) as row_ids,
    ARRAY_AGG(responsible_employee_email) as assigned_to,
    MIN(subject) as subject
FROM tracked_emails
WHERE internet_message_id IS NOT NULL
GROUP BY internet_message_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 2: Delete duplicates, keeping the EARLIEST inserted row per internet_message_id
-- UNCOMMENT the DELETE below when ready to run
/*
DELETE FROM tracked_emails
WHERE id IN (
    SELECT id FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY internet_message_id 
                ORDER BY created_at ASC
            ) as rn
        FROM tracked_emails
        WHERE internet_message_id IS NOT NULL
    ) ranked
    WHERE rn > 1
);
*/

-- Step 3: Verify no duplicates remain
SELECT 
    COUNT(*) as remaining_duplicates
FROM (
    SELECT internet_message_id
    FROM tracked_emails
    WHERE internet_message_id IS NOT NULL
    GROUP BY internet_message_id
    HAVING COUNT(*) > 1
) dupes;
