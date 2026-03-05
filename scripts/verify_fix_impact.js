import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)

async function checkFix() {
    console.log('Checking for recently detected responses...')

    // Check total answered vs unanswered
    const { data: stats, error: statsError } = await supabase
        .from('tracked_emails')
        .select('has_response')
        .eq('is_client_email', true)
        .eq('is_incoming', true)

    if (statsError) {
        console.error('Error fetching stats:', statsError)
        return
    }

    const answered = stats.filter(s => s.has_response).length
    const unanswered = stats.length - answered

    console.log(`Total Emails: ${stats.length}`)
    console.log(`Answered: ${answered}`)
    console.log(`Unanswered: ${unanswered}`)

    // Check latest 5 answered
    const { data: latestAnswered, error: latestError } = await supabase
        .from('tracked_emails')
        .select('id, subject, received_at, responded_at, first_response_at')
        .eq('has_response', true)
        .order('responded_at', { ascending: false })
        .limit(5)

    if (latestError) {
        console.error('Error fetching latest answered:', latestError)
        return
    }

    console.log('\nLatest 5 detected responses:')
    console.table(latestAnswered)
}

checkFix()
