
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
// import fetch from 'node-fetch'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env')

// Load .env manually
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

// MS Graph Config
const TENANT_ID = process.env.VITE_MICROSOFT_TENANT_ID
const CLIENT_ID = process.env.VITE_MICROSOFT_CLIENT_ID
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET

if (!CLIENT_SECRET) {
    console.error('ERROR: MICROSOFT_CLIENT_SECRET is missing in .env')
    process.exit(1)
}

async function getAccessToken() {
    const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`
    const bodyParams = new URLSearchParams({
        client_id: CLIENT_ID,
        scope: 'https://graph.microsoft.com/.default',
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
    })

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyParams.toString(),
        })

        const data = await response.json()
        if (!response.ok) throw new Error(JSON.stringify(data))
        return data.access_token
    } catch (error) {
        console.error('Error fetching token:', error.message)
        return null
    }
}

async function checkResponse(accessToken, email) {
    // If no responsible person, we can't check sent items.
    // Fallback: check a generic "team" or "info" account? 
    // For now, if no responsible email, skip.
    if (!email.responsible_employee_email) {
        console.log(`Skipping ${email.id} (No responsible email)`)
        return null
    }

    const userId = email.responsible_employee_email
    const url = `https://graph.microsoft.com/v1.0/users/${userId}/sentItems?$filter=conversationId eq '${email.conversation_id}'&$top=1`

    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (response.status === 403) {
            console.error(`403 Forbidden for ${userId} (Permissions issue)`)
            return 'PERMISSION_ERROR'
        }

        if (!response.ok) {
            const err = await response.text()
            console.error(`Error querying Graph for ${userId}:`, err)
            return null
        }

        const data = await response.json()
        if (data.value && data.value.length > 0) {
            return data.value[0] // Found a response
        }
    } catch (error) {
        console.error(`Exception checking response for ${userId}:`, error.message)
    }

    return null
}

async function backfill() {
    console.log('--- Starting Response Backfill ---')

    // Get Access Token
    const token = await getAccessToken()
    if (!token) {
        console.error('Failed to get MS Graph Token. Aborting.')
        return
    }
    console.log('Got MS Graph Token. Proceeding...')

    // Fetch batch of unanswered emails
    // Start with recent ones (last 50)
    const { data: emails, error } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('is_client_email', true)
        .eq('is_incoming', true)
        .eq('has_response', false)
        .eq('is_system_generated', false)
        .order('received_at', { ascending: false })
        .limit(50)

    if (error) {
        console.error('Error fetching emails:', error)
        return
    }

    console.log(`Checking ${emails.length} recent unanswered emails for responses...`)

    let updatedCount = 0
    let processedCount = 0
    let permissionErrors = 0

    for (const email of emails) {
        processedCount++
        process.stdout.write(`Processing ${processedCount}/${emails.length}: ${email.subject?.substring(0, 30)}... `)

        const responseMsg = await checkResponse(token, email)

        if (responseMsg === 'PERMISSION_ERROR') {
            console.log('❌ PERMISSION ERROR')
            permissionErrors++
            if (permissionErrors > 5) {
                console.log('Too many permission errors. Stopping.')
                break
            }
            continue
        }

        if (responseMsg) {
            console.log('✅ RESPONSE FOUND!')

            // Calculate response time
            const receivedTime = new Date(email.received_at)
            const responseTime = new Date(responseMsg.receivedDateTime) // Sent items use receivedDateTime too? Or createdDateTime.
            // Usually sent items have createdDateTime/sentDateTime.
            const responseTimeReal = new Date(responseMsg.sentDateTime || responseMsg.createdDateTime)

            const diffMinutes = Math.round((responseTimeReal - receivedTime) / (1000 * 60))

            // Update DB
            const { error: updateError } = await supabase
                .from('tracked_emails')
                .update({
                    has_response: true,
                    response_time_minutes: diffMinutes > 0 ? diffMinutes : 0,
                    // sla_breached: diffMinutes > 15 ? true : false // Keep existing logic or update?
                    // Let's rely on standard logic. If we assume existing ones are breached if >15.
                    // But if we found a response, we should recalculate sla_breached accurately.
                    sla_breached: diffMinutes > (parseInt(process.env.VITE_DEFAULT_SLA_MINUTES) || 15)
                })
                .eq('id', email.id)

            if (updateError) {
                console.error('Failed to update DB:', updateError)
            } else {
                updatedCount++
            }

        } else {
            console.log('No response found.')
        }
    }

    console.log(`\n--- Backfill Complete ---`)
    console.log(`Processed: ${processedCount}`)
    console.log(`Updated: ${updatedCount}`)
    console.log(`Permission Errors: ${permissionErrors}`)
}

backfill()
