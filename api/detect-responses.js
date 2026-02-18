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

        // Get unanswered emails - Process 200 per run to clear backlog faster
        const { data: unansweredEmails, error: fetchError } = await supabase
            .from('tracked_emails')
            .select('*')
            .eq('is_incoming', true)
            .eq('has_response', false)
            .eq('is_client_email', true)
            .not('conversation_id', 'is', null) // Must have conversation_id to match
            .order('received_at', { ascending: false }) // Process newest first to show immediate dashboard impact
            .limit(200) // Process max 200 per run

        if (fetchError) {
            console.error('Supabase fetch error:', fetchError)
            return res.status(500).json({ error: 'Failed to fetch emails', details: fetchError.message })
        }

        console.log(`Processing ${unansweredEmails.length} unanswered emails...`)

        let responsesDetected = 0
        let errorsCount = 0
        let skippedCount = 0

        // Group emails by responsible employee to reduce API calls
        const emailsByEmployee = {}
        for (const email of unansweredEmails) {
            if (!email.responsible_employee_email) {
                skippedCount++
                continue
            }
            const key = email.responsible_employee_email
            if (!emailsByEmployee[key]) emailsByEmployee[key] = []
            emailsByEmployee[key].push(email)
        }

        console.log(`Grouped into ${Object.keys(emailsByEmployee).length} employees, skipped ${skippedCount} without responsible email`)

        // Process each employee's emails
        for (const [employeeEmail, emails] of Object.entries(emailsByEmployee)) {
            try {
                // For each employee, fetch their recent sent items ONCE
                // Use the correct Graph API endpoint: mailFolders/sentitems/messages
                const sentEmails = await graphClient
                    .api(`/users/${employeeEmail}/mailFolders/sentitems/messages`)
                    .select('id,sentDateTime,conversationId,toRecipients,subject')
                    .orderby('sentDateTime desc')
                    .top(100)
                    .get()

                if (!sentEmails.value || sentEmails.value.length === 0) {
                    continue
                }

                // Build a map of conversationId -> earliest sent email
                const sentByConversation = {}
                for (const sent of sentEmails.value) {
                    if (sent.conversationId) {
                        if (!sentByConversation[sent.conversationId]) {
                            sentByConversation[sent.conversationId] = sent
                        }
                    }
                }

                // Match tracked emails against sent items by conversationId
                for (const trackedEmail of emails) {
                    const matchingSent = sentByConversation[trackedEmail.conversation_id]

                    if (matchingSent) {
                        // Verify the sent email was AFTER the received email
                        const sentDate = new Date(matchingSent.sentDateTime)
                        const receivedDate = new Date(trackedEmail.received_at)

                        if (sentDate > receivedDate) {
                            const responseTime = Math.floor((sentDate - receivedDate) / (1000 * 60))

                            const { error: updateError } = await supabase
                                .from('tracked_emails')
                                .update({
                                    has_response: true,
                                    first_response_at: matchingSent.sentDateTime,
                                    first_responder_email: employeeEmail,
                                    response_time_minutes: responseTime,
                                    responded_at: matchingSent.sentDateTime,
                                })
                                .eq('id', trackedEmail.id)

                            if (!updateError) {
                                responsesDetected++
                            } else {
                                console.error(`Update error for ${trackedEmail.id}:`, updateError)
                            }
                        }
                    }
                }
            } catch (error) {
                errorsCount++
                console.error(`Error checking sent items for ${employeeEmail}:`, error.message || error)
            }
        }

        console.log(`Done. Responses detected: ${responsesDetected}, Errors: ${errorsCount}, Skipped: ${skippedCount}`)

        return res.status(200).json({
            success: true,
            responsesDetected,
            processed: unansweredEmails.length,
            errors: errorsCount,
            skipped: skippedCount,
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
