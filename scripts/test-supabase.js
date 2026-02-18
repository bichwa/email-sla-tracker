import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load .env
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testConnection() {
    console.log('Testing Supabase connection...')
    console.log('URL:', supabaseUrl)
    
    // Test 1: Fetch from 'tracked_emails' (as used in useSLAMetrics)
    const { data, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .limit(5)

    if (error) {
        console.error('Error fetching tracked_emails:', error)
    } else {
        console.log(`Success! Fetched ${data.length} rows from tracked_emails.`)
        if (data.length > 0) console.log('Sample:', data[0])
    }
}

testConnection()
