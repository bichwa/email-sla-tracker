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

        // Get unanswered emails - Limit to oldest 50 to prevent timeouts
        const { data: unansweredEmails, error: fetchError } = await supabase
            .from('tracked_emails')
            .select('*')
            .eq('is_incoming', true)
            .eq('has_response', false)
            .eq('is_client_email', true)
            .order('received_at', { ascending: true }) // Process oldest first
            .limit(50) // Process max 50 per run

        if (fetchError) {
            return res.status(500).json({ error: 'Failed to fetch emails' })
        }

        console.log(`Processing ${unansweredEmails.length} unanswered emails...`)

        let responsesDetected = 0

        // Check emails in parallel batches to run faster
        const BATCH_SIZE = 10
        for (let i = 0; i < unansweredEmails.length; i += BATCH_SIZE) {
            const batch = unansweredEmails.slice(i, i + BATCH_SIZE)

            await Promise.all(batch.map(async (trackedEmail) => {
                try {
                    if (!trackedEmail.responsible_employee_email) {
                        return
                    }

                    // Fetch sent emails from the responsible person
                    const sentEmails = await graphClient
                        .api(`/users/${trackedEmail.responsible_employee_email}/sentItems`)
                        .filter(`conversationId eq '${trackedEmail.conversation_id}' and sentDateTime gt ${trackedEmail.received_at}`)
                        .select('id,sentDateTime,toRecipients')
                        .top(10)
                        .get()

                    if (sentEmails.value && sentEmails.value.length > 0) {
                        // Found a response
                        const firstResponse = sentEmails.value[0]
                        const responseTime = Math.floor(
                            (new Date(firstResponse.sentDateTime) - new Date(trackedEmail.received_at)) / (1000 * 60)
                        )

                        // Update tracked email
                        const { error: updateError } = await supabase
                            .from('tracked_emails')
                            .update({
                                has_response: true,
                                first_response_at: firstResponse.sentDateTime,
                                first_responder_email: trackedEmail.responsible_employee_email,
                                response_time_minutes: responseTime,
                                responded_at: firstResponse.sentDateTime,
                            })
                            .eq('id', trackedEmail.id)

                        if (!updateError) {
                            responsesDetected++
                        }
                    }
                } catch (error) {
                    console.error(`Error checking responses for email ${trackedEmail.id}:`, error)
                }
            }))
        }

        return res.status(200).json({
            success: true,
            responsesDetected,
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
