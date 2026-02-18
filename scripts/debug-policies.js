import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kglwjwgdawyufmmlfjos.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbHdqd2dkYXd5dWZtbWxmam9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTY3NTMsImV4cCI6MjA4NDU5Mjc1M30.lz34nCS6o5bUlet7xPKl-ZY6Y9oKrJcjOx-uTOUB1F0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function listPolicies() {
    console.log('Attempting to list policies...')

    // Attempt to query pg_policies via RPC (if a helper exists) or direct query if allowed (unlikely for anon)
    // Since we likely can't query pg_policies directly with anon key, this might fail.
    // Instead, let's just try to be more robust with the error checks.

    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .limit(1)

        if (error) {
            console.error('Still failing with:', error)
        } else {
            console.log('Success! Loop broken.')
        }

    } catch (err) {
        console.error('Error:', err)
    }
}

listPolicies()
