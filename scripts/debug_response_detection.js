
import { createClient } from '@supabase/supabase-js'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Manually load .env since dotenv install failed
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env')

if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8')
    envConfig.split('\n').forEach(line => {
        const firstEquals = line.indexOf('=')
        if (firstEquals !== -1) {
            const key = line.slice(0, firstEquals).trim()
            let value = line.slice(firstEquals + 1).trim()

            // Strip quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1)
            }

            if (key) {
                process.env[key] = value
            }
        }
    })
}

const logContent = `Environment Check:
Keys found in .env: ${Object.keys(process.env).filter(k => !['Path', 'SystemRoot'].includes(k)).join(', ')}
Tenant ID: ${process.env.VITE_MICROSOFT_TENANT_ID ? (process.env.VITE_MICROSOFT_TENANT_ID.substring(0, 5) + '...') : 'MISSING'}
Client ID: ${process.env.VITE_MICROSOFT_CLIENT_ID ? (process.env.VITE_MICROSOFT_CLIENT_ID.substring(0, 5) + '...') : 'MISSING'}
Secret (MICROSOFT_CLIENT_SECRET): ${process.env.MICROSOFT_CLIENT_SECRET ? 'PRESENT' : 'MISSING'}
`
fs.writeFileSync('debug_env_keys.txt', logContent)
console.log(logContent)

// Mock the environment if running locally and .env not loaded automatically (it might be since user has it open)
// But better safe:
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kglwjwgdawyufmmlfjos.supabase.co'
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnbHdqd2dkYXd5dWZtbWxmam9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTY3NTMsImV4cCI6MjA4NDU5Mjc1M30.lz34nCS6o5bUlet7xPKl-ZY6Y9oKrJcjOx-uTOUB1F0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function getAccessToken() {
    const tenantId = process.env.VITE_MICROSOFT_TENANT_ID
    const clientId = process.env.VITE_MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

    console.log('Fetching MS Token...')
    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    const bodyParams = new URLSearchParams({
        client_id: clientId,
        scope: 'https://graph.microsoft.com/.default',
        client_secret: clientSecret,
        grant_type: 'client_credentials',
    })

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: bodyParams.toString(),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(JSON.stringify(data))

    // Decode token to see roles
    try {
        const parts = data.access_token.split('.')
        if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
            console.log('\n--- Token Inspection ---')
            console.log('Roles/Scopes in Token:', payload.roles || payload.scp)
            console.log('Iss:', payload.iss)
            console.log('Sub:', payload.sub)
            console.log('------------------------\n')
        }
    } catch (e) {
        console.error('Error decoding token:', e)
    }

    return data.access_token
}

async function debug() {
    console.log('--- Debugging Response Detection ---')

    // 1. Get a recent "Unanswered" email to test with
    const { data: emails, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('has_response', false)
        .eq('is_incoming', true)
        .eq('is_client_email', true)
        .eq('is_system_generated', false)
        .order('received_at', { ascending: false }) // Get NEWEST to increase chance it remembers
        .limit(1)

    if (error || !emails.length) {
        console.error('No unanswered emails found to test.')
        return
    }

    const email = emails[0]
    console.log(`Testing Email ID: ${email.id}`)
    console.log(`Subject: ${email.subject}`)
    console.log(`Received: ${email.received_at}`)
    console.log(`Conversation ID: ${email.conversation_id}`)
    console.log(`Assigned To: ${email.responsible_employee_email}`)

    if (!email.responsible_employee_email) {
        console.log('SKIPPING: No responsible employee assigned. Script only checks responsible person.')
        return
    }

    // 2. Query MS Graph
    try {
        const token = await getAccessToken()

        // Exact query from detect-responses.js
        // /users/${email}/sentItems?filter=conversationId eq ...
        const endpoint = `https://graph.microsoft.com/v1.0/users/${email.responsible_employee_email}/sentItems`
        const filter = `conversationId eq '${email.conversation_id}'` // Leaving out time check for now to see if ANY exist

        console.log(`\nQuerying MS Graph: ${endpoint}`)
        console.log(`Filter: ${filter}`)

        const graphUrl = `${endpoint}?$filter=${encodeURIComponent(filter)}&$select=id,sentDateTime,subject,toRecipients`

        const res = await fetch(graphUrl, {
            headers: { Authorization: `Bearer ${token}` }
        })

        const graphData = await res.json()

        if (graphData.error) {
            console.error('Graph API Error:', graphData.error)
        } else {
            console.log(`\nFound ${graphData.value ? graphData.value.length : 0} sent items with this Conversation ID.`)
            if (graphData.value && graphData.value.length > 0) {
                console.log('First match:', graphData.value[0])
                console.log('--- DIAGNOSIS ---')
                console.log('If matches > 0: The logic works, but maybe the Cron Job is not running or timing out?')
                console.log('If timestamp of match < received_at: It is an OLD reply (thread history), not a new one.')
            } else {
                console.log('--- DIAGNOSIS ---')
                console.log('No sent items found. Possible reasons:')
                console.log('1. User replied from a different email account?')
                console.log('2. Microsoft threaded them differently (changed ID)?')
                console.log('3. Conversation ID in DB is wrong?')
            }
        }

    } catch (e) {
        console.error('Script Error:', e)
    }
}

debug()
