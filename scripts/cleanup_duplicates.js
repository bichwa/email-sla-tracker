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

async function cleanup() {
    console.log('🧹 Starting duplicate cleanup...')

    // 1. Fetch all emails (fetching in chunks as there's 19k+)
    // We only need the columns we're deduping on + ID
    let allEmails = []
    const PAGE_SIZE = 1000
    let start = 0
    let hasMore = true

    while (hasMore) {
        console.log(`Fetching records ${start} to ${start + PAGE_SIZE}...`)
        const { data, error } = await supabase
            .from('tracked_emails')
            .select('id, subject, from_email, received_at')
            .range(start, start + PAGE_SIZE - 1)
            .order('created_at', { ascending: false })

        if (error) throw error
        allEmails = allEmails.concat(data)

        if (data.length < PAGE_SIZE) hasMore = false
        start += PAGE_SIZE
    }

    console.log(`Total records fetched: ${allEmails.length}`)

    // 2. Identify duplicates
    const seen = new Set()
    const toDelete = []

    allEmails.forEach(email => {
        const key = `${email.subject}|${email.from_email}|${email.received_at}`
        if (seen.has(key)) {
            toDelete.push(email.id)
        } else {
            seen.add(key)
        }
    })

    console.log(`Found ${toDelete.length} duplicates to remove.`)

    // 3. Delete in batches
    if (toDelete.length > 0) {
        const DELETE_BATCH_SIZE = 100
        for (let i = 0; i < toDelete.length; i += DELETE_BATCH_SIZE) {
            const batch = toDelete.slice(i, i + DELETE_BATCH_SIZE)
            console.log(`Deleting batch ${i / DELETE_BATCH_SIZE + 1}...`)
            const { error: delError } = await supabase
                .from('tracked_emails')
                .delete()
                .in('id', batch)

            if (delError) console.error(`Error deleting batch:`, delError)
        }
        console.log(`🎉 Cleanup complete! Removed ${toDelete.length} duplicates.`)
    } else {
        console.log('No duplicates found. Database is clean.')
    }
}

cleanup().catch(console.error)
