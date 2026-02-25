/**
 * Detect responses to emails
 * Checks sent items to see if tracked emails have been responded to
 */

import { createClient } from '@supabase/supabase-js'
import { Client } from '@microsoft/microsoft-graph-client'

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const body = req.body || {}
        let { accessToken } = body

        // FOOLPROOF SECRET FETCHING
        const cronSecret = req.query.cronSecret || body.cronSecret || req.headers['cronsecret'] || req.headers['x-cron-secret']

        const cleanProvided = (cronSecret || '').replace(/^Bearer\s+/i, '').trim()
        const cleanStored = (process.env.CRON_SECRET || '').replace(/^Bearer\s+/i, '').trim()

        // Verification: If cronSecret is provided, try to get a system token
        if (cleanProvided && cleanProvided === cleanStored && cleanStored !== '') {
            console.log('Valid CRON_SECRET provided. Fetching background token...')
            accessToken = await getBackgroundAccessToken()
        }

        if (!accessToken) {
            return res.status(400).json({
                success: false,
                error: 'Unauthorized',
                message: 'Access token or valid cronSecret is required.'
            })
        }

        const graphClient = Client.init({
            authProvider: (done) => {
                done(null, accessToken)
            },
        })

        // Get ALL active, client-facing employees (real mailboxes we can check sent items from)
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('email')
            .eq('is_active', true)
            .eq('is_client_facing', true)

        if (empError) {
            console.error('Error fetching employees:', empError)
            return res.status(500).json({ error: 'Failed to fetch employees' })
        }

        const employeeEmails = employees.map(e => e.email)
        console.log(`Found ${employeeEmails.length} active employees to check sent items for`)

        // Get unanswered emails - Process 500 per run to clear backlog faster
        const { data: unansweredEmails, error: fetchError } = await supabase
            .from('tracked_emails')
            .select('*')
            .eq('is_incoming', true)
            .eq('has_response', false)
            .eq('is_client_email', true)
            .not('conversation_id', 'is', null)
            .order('received_at', { ascending: false })
            .limit(500)

        if (fetchError) {
            console.error('Supabase fetch error:', fetchError)
            return res.status(500).json({ error: 'Failed to fetch emails', details: fetchError.message })
        }

        console.log(`Processing ${unansweredEmails.length} unanswered emails...`)

        let responsesDetected = 0
        let errorsCount = 0

        // STEP 1: Fetch sent items from ALL real employee mailboxes in parallel
        // This is the key fix — instead of only checking the assigned employee's sent items,
        // we check ALL employees because:
        //   a) team@solvit.co.ke emails could be answered by ANY team member
        //   b) Even individually-assigned emails might be answered by a colleague
        const combinedSentByConversation = {}

        // Process employees in batches of 5 to avoid overloading Graph API
        const EMP_BATCH_SIZE = 5
        for (let i = 0; i < employeeEmails.length; i += EMP_BATCH_SIZE) {
            const batch = employeeEmails.slice(i, i + EMP_BATCH_SIZE)

            await Promise.all(batch.map(async (employeeEmail) => {
                try {
                    const sentEmails = await graphClient
                        .api(`/users/${employeeEmail}/mailFolders/sentitems/messages`)
                        .select('id,sentDateTime,conversationId,toRecipients,subject')
                        .orderby('sentDateTime desc')
                        .top(100)
                        .get()

                    if (!sentEmails.value || sentEmails.value.length === 0) return

                    for (const sent of sentEmails.value) {
                        if (!sent.conversationId) continue

                        // Keep the EARLIEST response per conversation across all employees
                        const existing = combinedSentByConversation[sent.conversationId]
                        if (!existing || new Date(sent.sentDateTime) < new Date(existing.sentDateTime)) {
                            combinedSentByConversation[sent.conversationId] = {
                                ...sent,
                                responderEmail: employeeEmail
                            }
                        }
                    }
                } catch (error) {
                    // Don't count as error — some mailboxes may not be accessible
                    console.warn(`Could not fetch sent items for ${employeeEmail}: ${error.message || error}`)
                }
            }))
        }

        console.log(`Built combined sent map with ${Object.keys(combinedSentByConversation).length} unique conversations`)

        // STEP 2: Match ALL unanswered emails against the combined sent items map
        // Process in batches to avoid too many concurrent DB updates
        const DB_BATCH_SIZE = 20
        for (let i = 0; i < unansweredEmails.length; i += DB_BATCH_SIZE) {
            const batch = unansweredEmails.slice(i, i + DB_BATCH_SIZE)

            await Promise.all(batch.map(async (trackedEmail) => {
                try {
                    const matchingSent = combinedSentByConversation[trackedEmail.conversation_id]

                    if (!matchingSent) return

                    // Verify the sent email was AFTER the received email
                    const sentDate = new Date(matchingSent.sentDateTime)
                    const receivedDate = new Date(trackedEmail.received_at)

                    if (sentDate <= receivedDate) return

                    const responseTime = Math.floor((sentDate - receivedDate) / (1000 * 60))

                    const { error: updateError } = await supabase
                        .from('tracked_emails')
                        .update({
                            has_response: true,
                            first_response_at: matchingSent.sentDateTime,
                            first_responder_email: matchingSent.responderEmail,
                            response_time_minutes: responseTime,
                            responded_at: matchingSent.sentDateTime,
                        })
                        .eq('id', trackedEmail.id)

                    if (!updateError) {
                        responsesDetected++
                    } else {
                        console.error(`Update error for ${trackedEmail.id}:`, updateError)
                        errorsCount++
                    }
                } catch (error) {
                    errorsCount++
                    console.error(`Error processing email ${trackedEmail.id}:`, error.message || error)
                }
            }))
        }

        console.log(`Done. Responses detected: ${responsesDetected}, Errors: ${errorsCount}`)

        return res.status(200).json({
            success: true,
            responsesDetected,
            processed: unansweredEmails.length,
            conversationsChecked: Object.keys(combinedSentByConversation).length,
            employeesChecked: employeeEmails.length,
            errors: errorsCount,
            mode: cronSecret ? 'background' : 'interactive'
        })
    } catch (error) {
        console.error('Response detection error:', error)
        return res.status(500).json({
            success: false,
            error: 'Response detection failed',
            message: error.message,
            hint: 'Check Vercel logs and environment variables'
        })
    }
}

/**
 * Fetch a background access token using Microsoft Client Credentials flow
 */
async function getBackgroundAccessToken() {
    const tenantId = process.env.VITE_MICROSOFT_TENANT_ID
    const clientId = process.env.VITE_MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

    if (!tenantId || !clientId || !clientSecret) {
        throw new Error('Missing Microsoft environment variables for background sync')
    }

    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
    const bodyParams = new URLSearchParams({
        client_id: clientId,
        scope: 'https://graph.microsoft.com/.default',
        client_secret: clientSecret,
        grant_type: 'client_credentials',
    })

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyParams.toString(),
        })

        const text = await response.text()
        let data
        try {
            data = JSON.parse(text)
        } catch (e) {
            data = { error: 'invalid_json', error_description: text }
        }

        if (!response.ok) {
            throw new Error(`Microsoft Auth Error (${response.status}): ${data.error_description || data.error || text}`)
        }

        return data.access_token
    } catch (error) {
        throw new Error(`Failed to contact Microsoft Auth: ${error.message}`)
    }
}
