/**
 * BACKFILL SCRIPT
 * Forcibly scans the last 30 days of sent items for all employees
 * to catch responses missed during the service key outage.
 */

import { createClient } from '@supabase/supabase-js'
import { Client } from '@microsoft/microsoft-graph-client'
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

async function getBackgroundAccessToken() {
    const tenantId = process.env.VITE_MICROSOFT_TENANT_ID
    const clientId = process.env.VITE_MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

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
    if (!response.ok) throw new Error(`Auth failed: ${JSON.stringify(data)}`)
    return data.access_token
}

async function backfill() {
    console.log('🚀 Starting deep backfill...')

    const accessToken = await getBackgroundAccessToken()
    const graphClient = Client.init({
        authProvider: (done) => done(null, accessToken),
    })

    // 1. Get employees
    const { data: employees } = await supabase
        .from('employees')
        .select('email')
        .eq('is_active', true)
        .eq('is_client_facing', true)

    const employeeEmails = employees.map(e => e.email)
    console.log(`Checking ${employeeEmails.length} mailboxes...`)

    // 2. Build massive sent map (last 1000 items per person)
    const combinedSentByConversation = {}

    for (const email of employeeEmails) {
        try {
            console.log(`Scanning sent items for ${email}...`)
            const sent = await graphClient
                .api(`/users/${email}/mailFolders/sentitems/messages`)
                .select('id,sentDateTime,conversationId,subject')
                .orderby('sentDateTime desc')
                .top(500) // Deep scan
                .get()

            if (sent.value) {
                sent.value.forEach(msg => {
                    if (!msg.conversationId) return
                    const existing = combinedSentByConversation[msg.conversationId]
                    if (!existing || new Date(msg.sentDateTime) < new Date(existing.sentDateTime)) {
                        combinedSentByConversation[msg.conversationId] = {
                            ...msg,
                            responderEmail: email
                        }
                    }
                })
            }
        } catch (err) {
            console.warn(`Skipping ${email}: ${err.message}`)
        }
    }

    console.log(`Mapped ${Object.keys(combinedSentByConversation).length} unique sent conversations.`)

    // 3. Get unanswered emails from the last 14 days
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const { data: unanswered } = await supabase
        .from('tracked_emails')
        .select('*')
        .eq('has_response', false)
        .eq('is_client_email', true)
        .gte('received_at', fourteenDaysAgo.toISOString())

    console.log(`Checking ${unanswered.length} recent unanswered emails for matches...`)

    let recovered = 0
    for (const email of unanswered) {
        const match = combinedSentByConversation[email.conversation_id]
        if (match) {
            const sentDate = new Date(match.sentDateTime)
            const receivedDate = new Date(email.received_at)

            if (sentDate > receivedDate) {
                const diff = Math.floor((sentDate - receivedDate) / (1000 * 60))
                console.log(`✅ MATCH! Conversation ${email.conversation_id} answered by ${match.responderEmail} in ${diff}m`)

                await supabase
                    .from('tracked_emails')
                    .update({
                        has_response: true,
                        first_response_at: match.sentDateTime,
                        first_responder_email: match.responderEmail,
                        response_time_minutes: diff,
                        responded_at: match.sentDateTime
                    })
                    .eq('id', email.id)

                recovered++
            }
        }
    }

    console.log(`🎉 Backfill complete! Recovered ${recovered} missing responses.`)
}

backfill().catch(console.error)
