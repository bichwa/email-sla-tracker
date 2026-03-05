import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Manual .env loader
const envPath = path.resolve('.env')
if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8')
    env.split('\n').forEach(line => {
        const [key, ...value] = line.split('=')
        if (key && value) {
            process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '')
        }
    })
}

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)

async function analyze() {
    console.log('📊 Analyzing response times...')

    const { data: emails, error } = await supabase
        .from('tracked_emails')
        .select('subject, received_at, responded_at, response_time_minutes')
        .eq('has_response', true)
        .order('response_time_minutes', { ascending: false })
        .limit(20)

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log('\nTop 20 Longest Response Times:')
    console.table(emails.map(e => ({
        Subject: e.subject.substring(0, 30) + '...',
        Received: e.received_at,
        'Response Time (min)': e.response_time_minutes,
        'Days': Math.round(e.response_time_minutes / (60 * 24))
    })))

    // Get today's average
    const today = new Date().toISOString().split('T')[0]
    const { data: todayEmails } = await supabase
        .from('tracked_emails')
        .select('response_time_minutes')
        .eq('has_response', true)
        .gte('received_at', `${today}T00:00:00Z`)

    const todayAvg = todayEmails.length > 0
        ? Math.round(todayEmails.reduce((sum, e) => sum + e.response_time_minutes, 0) / todayEmails.length)
        : 0

    console.log(`\nAverage Response Time (Emails received TODAY): ${todayAvg}m (${todayEmails.length} emails)`)
}

analyze()
