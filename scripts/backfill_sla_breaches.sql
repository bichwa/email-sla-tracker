-- BACKFILL SLA BREACH STATUS
-- The current data has sla_breached = false for all emails, even those past deadline.
-- This script calculates and updates the status for historical data.

-- 1. Mark UNANSWERED emails as breached if they are past their deadline
UPDATE tracked_emails
SET sla_breached = true
WHERE has_response = false
  AND is_incoming = true
  AND is_client_email = true
  AND is_system_generated = false
  AND now() > sla_deadline;

-- 2. Mark ANSWERED emails as breached if they took longer than 15 minutes
-- (Assuming response_time_minutes is populated. If not, we rely on 1.)
UPDATE tracked_emails
SET sla_breached = true
WHERE has_response = true
  AND is_incoming = true
  AND is_client_email = true
  AND is_system_generated = false
  AND response_time_minutes > 15;

-- 3. Validation: Count how many are now breached
-- SELECT count(*) FROM tracked_emails WHERE sla_breached = true;
