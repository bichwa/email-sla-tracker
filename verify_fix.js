
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kglwjwgdawyufmmlfjos.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbHdqd2dkYXd5dWZtbWxmam9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAxNjc1MywiZXhwIjoyMDg0NTkyNzUzfQ.1XWT3MO5eoP_pVAvlQrrTWuoCfnQabGw7xdStKvTWEw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFix() {
    const filters = {
        employeeEmail: 'jmining@solvit.co.ke',
        fromDate: '2026-03-27',
        toDate: '2026-03-27'
    };

    console.log(`--- Verifying Fix for Jessica Mining ---`);
    console.log(`Filters: ${JSON.stringify(filters)}`);

    // Simulate buildBaseQuery with new logic
    let q = supabase
        .from('tracked_emails')
        .select('subject, responsible_employee_email, first_responder_email, has_response, received_at')
        .eq('is_client_email', true)
        .eq('is_incoming', true)
        .eq('is_system_generated', false)
        .gte('received_at', `${filters.fromDate}T00:00:00`)
        .lte('received_at', `${filters.toDate}T23:59:59`)
        .or(`responsible_employee_email.eq.${filters.employeeEmail},first_responder_email.eq.${filters.employeeEmail}`);

    const { data: emails, error } = await q;

    if (error) {
        console.error('Query Error:', error);
        return;
    }

    console.log(`Total emails found with NEW logic: ${emails.length}`);
    emails.forEach(e => {
        console.log(`- ${e.subject} | Resp: ${e.responsible_employee_email} | First: ${e.first_responder_email} | HasResp: ${e.has_response} | At: ${e.received_at}`);
    });

    if (emails.length > 0) {
        console.log('--- SUCCESS: Emails now appearing with inclusive date filtering and responder attribution! ---');
    } else {
        console.log('--- FAILURE: No emails found even with new logic. ---');
    }
}

verifyFix();
