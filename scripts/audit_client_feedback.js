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

async function checkData() {
    let output = '🔍 Auditing data for discrepancies...\n'

    // 1. Check for duplicates
    const { data: duplicates } = await supabase
        .from('tracked_emails')
        .select('subject, from_email, received_at')
        .limit(2000)

    const counts = {}
    const dupRecords = []

    duplicates.forEach(d => {
        const key = `${d.subject}|${d.from_email}|${d.received_at}`
        counts[key] = (counts[key] || 0) + 1
        if (counts[key] > 1) {
            dupRecords.push(d)
        }
    })

    output += `\nFound ${dupRecords.length} potential duplicate sets in last 2000 emails.\n`
    if (dupRecords.length > 0) {
        output += `Example duplicate: ${JSON.stringify(dupRecords[0])}\n`
    }

    // 2. Check classification rules
    const { data: rules } = await supabase
        .from('email_classification_rules')
        .select('*')

    output += '\nClassification Rules in DB:\n'
    output += JSON.stringify(rules, null, 2) + '\n'

    // 3. Comparison of Metrics vs List
    const { count: totalUnanswered } = await supabase
        .from('tracked_emails')
        .select('*', { count: 'exact', head: true })
        .eq('is_client_email', true)
        .eq('has_response', false)

    output += `\nMetric Total Unanswered: ${totalUnanswered}\n`

    fs.writeFileSync('audit_results.txt', output)
    console.log('Audit complete. Results written to audit_results.txt')
}

checkData().catch(console.error)
