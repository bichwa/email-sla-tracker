import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kglwjwgdawyufmmlfjos.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbHdqd2dkYXd5dWZtbWxmam9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTY3NTMsImV4cCI6MjA4NDU5Mjc1M30.lz34nCS6o5bUlet7xPKl-ZY6Y9oKrJcjOx-uTOUB1F0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function verify() {
    console.log('Verifying Supabase connection...')

    // Test employees
    try {
        console.log('Fetching employees...')
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .limit(5)

        if (error) {
            console.error('Error fetching employees:', error.message)
        } else {
            console.log(`Success! Fetched ${data.length} employees.`)
        }
    } catch (e) {
        console.error('Exception employees:', e)
    }

    // Test tracked_emails
    try {
        console.log('Fetching tracked_emails...')
        const { data, error } = await supabase
            .from('tracked_emails')
            .select('*')
            .limit(5)

        if (error) {
            console.error('Error fetching tracked_emails:', error.message)
        } else {
            console.log(`Success! Fetched ${data.length} tracked_emails.`)
        }
    } catch (e) {
        console.error('Exception tracked_emails:', e)
    }
}

verify()
