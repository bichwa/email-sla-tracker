import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kglwjwgdawyufmmlfjos.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbHdqd2dkYXd5dWZtbWxmam9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTY3NTMsImV4cCI6MjA4NDU5Mjc1M30.lz34nCS6o5bUlet7xPKl-ZY6Y9oKrJcjOx-uTOUB1F0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function verify() {
    console.log('Verifying Unanswered Client Emails View...')

    try {
        const { data, error } = await supabase
            .from('unanswered_client_emails')
            .select('*')
            .limit(5)

        if (error) {
            console.error('Error fetching view:', error.message)
        } else {
            console.log(`Success! Fetched ${data.length} rows from view.`)
            if (data.length > 0) {
                console.log('Sample row:', data[0])
                console.log('Available scenarios:', data.map(d => d.scenario))
            } else {
                console.log('View is accessible but empty.')
            }
        }
    } catch (e) {
        console.error('Exception:', e)
    }

    try {
        // Also check if team@solvit.co.ke exists in 'tracked_emails' to verify previous data fixes
        const { count, error } = await supabase
            .from('tracked_emails')
            .select('*', { count: 'exact', head: true })
            .eq('scenario', 'team_email')

        if (error) console.error('Error counting team emails:', error.message)
        else console.log(`Found ${count} tracked_emails with scenario='team_email'`)

    } catch (e) { console.error(e) }
}

verify()
