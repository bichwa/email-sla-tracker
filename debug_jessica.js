
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kglwjwgdawyufmmlfjos.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbHdqd2dkYXd5dWZtbWxmam9zIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAxNjc1MywiZXhwIjoyMDg0NTkyNzUzfQ.1XWT3MO5eoP_pVAvlQrrTWuoCfnQabGw7xdStKvTWEw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJessicaData() {
    const todayStr = '2026-03-27T00:00:00Z'; 

    console.log(`--- Diagnostic for Jessica Mining (jessica@solvit.co.ke) ---`);

    const { data: emails, error } = await supabase
        .from('tracked_emails')
        .select('id, subject, responsible_employee_email, first_responder_email, has_response, received_at, scenario')
        .or(`responsible_employee_email.eq.jessica@solvit.co.ke,first_responder_email.eq.jessica@solvit.co.ke`)
        .gte('received_at', todayStr)
        .order('received_at', { ascending: false });

    if (error) {
        console.error('Error fetching data:', error);
        return;
    }

    if (!emails || emails.length === 0) {
        console.log('No emails found for Jessica today directly in DB.');
        
        const { data: allToday } = await supabase
            .from('tracked_emails')
            .select('subject, responsible_employee_email, first_responder_email, scenario, received_at')
            .gte('received_at', todayStr)
            .order('received_at', { ascending: false })
            .limit(10);
            
        console.log('Total tracked_emails found from today:', allToday?.length || 0);
        if (allToday && allToday.length > 0) {
            console.log('Last 10 emails from today:');
            allToday.forEach(e => {
                console.log(`- ${e.subject}`);
                console.log(`  Resp: ${e.responsible_employee_email} | First: ${e.first_responder_email} | Scen: ${e.scenario} | At: ${e.received_at}`);
            });
        }
    } else {
        console.log(`Found ${emails.length} emails for Jessica today:`);
        emails.forEach(e => {
            console.log(`- [${e.scenario}] ${e.subject}`);
            console.log(`  Responsible: ${e.responsible_employee_email}`);
            console.log(`  First Responder: ${e.first_responder_email}`);
            console.log(`  Has Response: ${e.has_response}`);
            console.log(`  Received At: ${e.received_at}`);
        });
    }
}

checkJessicaData();
