
// Check for system generated emails
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kglwjwgdawyufmmlfjos.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbHdqd2dkYXd5dWZtbWxmam9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTY3NTMsImV4cCI6MjA4NDU5Mjc1M30.lz34nCS6o5bUlet7xPKl-ZY6Y9oKrJcjOx-uTOUB1F0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function verify() {
    console.log('Verifying System Email Tags...')

    try {
        const { count, error } = await supabase
            .from('tracked_emails')
            .select('*', { count: 'exact', head: true })
            .eq('is_system_generated', true)

        if (error) console.error('Error counting system emails:', error.message)
        else console.log(`Found ${count} emails tagged as 'is_system_generated'.`)

        if (count === 0) {
            console.log("WARNING: No emails were tagged! The SQL script might not have matched anything or wasn't run.")
        } else {
            console.log("SUCCESS: System emails are tagged.")
        }

    } catch (e) { console.error(e) }
}

verify()
