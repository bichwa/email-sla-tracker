
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kglwjwgdawyufmmlfjos.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbHdqd2dkYXd5dWZtbWxmam9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTY3NTMsImV4cCI6MjA4NDU5Mjc1M30.lz34nCS6o5bUlet7xPKl-ZY6Y9oKrJcjOx-uTOUB1F0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspect() {
    console.log('Inspecting Data Sample...')

    // Fetch 5 rows that SHOULD be breached (unanswered + old)
    const { data, error } = await supabase
        .from('tracked_emails')
        .select('id, subject, received_at, sla_deadline, sla_breached, has_response')
        .eq('is_client_email', true)
        .eq('is_incoming', true)
        .eq('is_system_generated', false)
        .eq('has_response', false)
        .order('received_at', { ascending: true }) // Get oldest
        .limit(5)

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log('--- Sample of Old Unanswered Emails ---')
    data.forEach(email => {
        console.log(`ID: ${email.id}`)
        console.log(`Received: ${email.received_at}`)
        console.log(`Deadline: ${email.sla_deadline}`)
        console.log(`Breached Flag: ${email.sla_breached}`)
        console.log(`-------------------`)
    })

    // Check if ANY breach exists
    const { count } = await supabase
        .from('tracked_emails')
        .select('*', { count: 'exact', head: true })
        .eq('sla_breached', true)

    console.log(`\nTotal rows in DB with sla_breached=true: ${count}`)
}

inspect()
