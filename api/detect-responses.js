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
        const { accessToken } = req.body

        if (!accessToken) {
            return res.status(400).json({ error: 'Access token is required' })
        }

        const graphClient = Client.init({
            authProvider: (done) => {
                done(null, accessToken)
            },
        })

        // Get unanswered emails
        const { data: unansweredEmails, error: fetchError } = await supabase
            .from('tracked_emails')
            .select('*')
            .eq('is_incoming', true)
            .eq('has_response', false)
            .eq('is_client_email', true)

        if (fetchError) {
            return res.status(500).json({ error: 'Failed to fetch emails' })
        }

        let responsesDetected = 0

        // Check each unanswered email
        for (const trackedEmail of unansweredEmails || []) {
            try {
                if (!trackedEmail.responsible_employee_email) {
                    continue
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
        }

        return res.status(200).json({
            success: true,
            responsesDetected,
        })
    } catch (error) {
        console.error('Response detection error:', error)
        return res.status(500).json({ error: 'Response detection failed', details: error.message })
    }
}
