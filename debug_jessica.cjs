
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJessicaData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = '2026-03-27T00:00:00Z'; // Hardcode for today to be sure

    console.log(`Checking data for Jessica Mining (jessica@solvit.co.ke) for ${todayStr}`);

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
        console.log('No emails found for Jessica today.');
        
        // Check ALL emails today to see what's there
        const { data: allToday } = await supabase
            .from('tracked_emails')
            .select('subject, responsible_employee_email, first_responder_email, scenario')
            .gte('received_at', todayStr)
            .limit(10);
            
        console.log('Total emails today found in DB:', allToday?.length || 0);
        if (allToday && allToday.length > 0) {
            console.log('Sample emails from today:');
            allToday.forEach(e => {
                console.log(`- ${e.subject} | Resp: ${e.responsible_employee_email} | First: ${e.first_responder_email} | Scen: ${e.scenario}`);
            });
        }
    } else {
        console.log(`Found ${emails.length} emails for Jessica:`);
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
