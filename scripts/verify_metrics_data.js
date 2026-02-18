
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Load .env
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8')
    envConfig.split('\n').forEach(line => {
        const firstEquals = line.indexOf('=')
        if (firstEquals !== -1) {
            const key = line.slice(0, firstEquals).trim()
            let value = line.slice(firstEquals + 1).trim()
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1)
            }
            process.env[key] = value
        }
    })
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function verify() {
    console.log('--- Checking Database State ---')

    const { count: breached } = await supabase
        .from('tracked_emails')
        .select('*', { count: 'exact', head: true })
        .eq('is_client_email', true)
        .eq('is_incoming', true)
        .eq('is_system_generated', false)
        .eq('sla_breached', true)

    console.log(`Current SLA Breached Count: ${breached}`)

    if (breached === 0) {
        console.log('STATUS: BACKFILL NOT DONE (or no breaches found).')
    } else {
        console.log('STATUS: BACKFILL SUCCESSFUL.')
    }
}

verify()
