
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables manually without dotenv
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

let envConfig = {};
try {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) return;

        const match = trimmedLine.match(/^([^=]+)=(.*)$/);
        if (match) {
            envConfig[match[1].trim()] = match[2].trim();
        }
    });
} catch (e) {
    console.error('Could not read .env file', e);
}

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
// Use ANON_KEY if SERVICE_KEY is missing (assuming RLS allows it, consistent with the app)
const supabaseKey = envConfig.SUPABASE_SERVICE_KEY || envConfig.VITE_SUPABASE_ANON_KEY;

console.log('Env Path:', envPath);
console.log('Parsed Keys:', Object.keys(envConfig));


if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SYSTEM_KEYWORDS = [
    'client not picking',
    'not ready',
    'unreachable',
    'undeliverable',
    'automatic reply',
    'out of office',
    'ticket',
    'update on',
    'status of'
];

async function cleanup() {
    console.log('Starting cleanup...');

    try {
        // 1. Fetch all emails ensuring we processed them
        // We only care about emails that might be misclassified (is_system_generated = false or null)
        // Or emails that are part of the 'team' group but not assigned to team@solvit.co.ke
        const { data: emails, error } = await supabase
            .from('tracked_emails')
            .select('id, subject, body_preview, to_email, cc_emails, responsible_employee_email')
            .or('is_system_generated.eq.false,is_system_generated.is.null');

        if (error) throw error;

        console.log(`Found ${emails.length} emails to check.`);

        let systemCount = 0;
        let teamCount = 0;

        for (const email of emails) {
            let needsUpdate = false;
            const updates = {};

            // Check 1: System Generated
            const subject = (email.subject || '').toLowerCase();
            const body = (email.body_preview || '').toLowerCase();

            const isSystem = SYSTEM_KEYWORDS.some(kw => subject.includes(kw) || body.includes(kw));

            if (isSystem) {
                updates.is_system_generated = true;
                systemCount++;
                needsUpdate = true;
            }

            // Check 2: Team Email Assignment
            // If any recipient is team@solvit.co.ke, ensure responsible is team@solvit.co.ke
            const recipients = [email.to_email, ...(email.cc_emails || [])].map(e => (e || '').toLowerCase());
            const isTeamEmail = recipients.some(r => r.includes('team@solvit.co.ke'));

            if (isTeamEmail && email.responsible_employee_email !== 'team@solvit.co.ke') {
                updates.responsible_employee_email = 'team@solvit.co.ke';
                updates.scenario = 'team_email';
                teamCount++;
                needsUpdate = true;
            }

            if (needsUpdate) {
                const { error: updateError } = await supabase
                    .from('tracked_emails')
                    .update(updates)
                    .eq('id', email.id);

                if (updateError) console.error(`Failed to update ${email.id}:`, updateError);
            }
        }

        console.log(`Cleanup complete.`);
        console.log(`- Marked ${systemCount} emails as System Generated.`);
        console.log(`- Assigned ${teamCount} emails to team@solvit.co.ke.`);

    } catch (err) {
        console.error('Cleanup failed:', err);
    }
}

cleanup();
