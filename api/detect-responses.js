/**
 * Detect responses to emails (High Performance Bulk Version)
 */

import { createClient } from '@supabase/supabase-js'
import { Client } from '@microsoft/microsoft-graph-client'

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
    const startTime = Date.now();
    
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const body = req.body || {}
        let { accessToken } = body

        const authHeader = req.headers['authorization'] || ''
        const cronSecret = req.query.cronSecret || body.cronSecret || req.headers['cronsecret'] || req.headers['x-cron-secret'] || authHeader

        const cleanProvided = (cronSecret || '').replace(/^Bearer\s+/i, '').trim()
        const cleanStored = (process.env.CRON_SECRET || '').replace(/^Bearer\s+/i, '').trim()

        if (cleanProvided && cleanProvided === cleanStored && cleanStored !== '') {
            accessToken = await getBackgroundAccessToken()
        }

        if (!accessToken) {
            return res.status(401).json({ success: false, error: 'Unauthorized' })
        }

        const graphClient = Client.init({
            authProvider: (done) => done(null, accessToken),
        })

        // 1. Fetch needed metadata
        const [empRes, unansweredRes] = await Promise.all([
            supabase.from('employees').select('email').eq('is_active', true).eq('is_client_facing', true),
            supabase.from('tracked_emails')
                .select('*')
                .eq('is_incoming', true)
                .eq('has_response', false)
                .eq('is_client_email', true)
                .not('conversation_id', 'is', null)
                .order('received_at', { ascending: false })
                .limit(200) // Lowered to ensure we finish in 30s
        ]);

        if (empRes.error) throw empRes.error;
        const employeeEmails = empRes.data.map(e => e.email);
        const unansweredEmails = unansweredRes.data || [];

        if (unansweredEmails.length === 0) {
            return res.status(200).json({ success: true, message: 'No unanswered emails to process' });
        }

        // 2. Fetch Sent Items from ALL mailboxes (Parallel)
        const combinedSentByConversation = {}
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const dateFilter = threeDaysAgo.toISOString();

        await Promise.all(employeeEmails.map(async (employeeEmail) => {
            if (Date.now() - startTime > 15000) return; // Safety

            try {
                const sentEmails = await graphClient
                    .api(`/users/${employeeEmail}/messages`) // Use all messages to be safe
                    .filter(`receivedDateTime ge ${dateFilter} and from/emailAddress/address eq '${employeeEmail}'`)
                    .select('id,receivedDateTime,conversationId,toRecipients,subject')
                    .orderby('receivedDateTime desc')
                    .top(100)
                    .get()

                if (sentEmails.value) {
                    for (const sent of sentEmails.value) {
                        if (!sent.conversationId) continue;
                        const existing = combinedSentByConversation[sent.conversationId];
                        if (!existing || new Date(sent.receivedDateTime) < new Date(existing.receivedDateTime)) {
                            combinedSentByConversation[sent.conversationId] = {
                                ...sent,
                                responderEmail: employeeEmail
                            };
                        }
                    }
                }
            } catch (error) {
                console.warn(`Could not check for ${employeeEmail}:`, error.message);
            }
        }));

        // 3. Match and Prepare Updates
        const updates = []
        for (const trackedEmail of unansweredEmails) {
            let matchingSent = combinedSentByConversation[trackedEmail.conversation_id]
            
            if (!matchingSent && trackedEmail.subject) {
                const normalizedSubject = trackedEmail.subject.toLowerCase().replace(/^re:\s*/i, '').trim()
                matchingSent = Object.values(combinedSentByConversation).find(sent => {
                    const sentSub = (sent.subject || '').toLowerCase().replace(/^re:\s*/i, '').trim()
                    return sentSub === normalizedSubject && new Date(sent.receivedDateTime) > new Date(trackedEmail.received_at)
                })
            }

            if (matchingSent) {
                const sentDate = new Date(matchingSent.receivedDateTime)
                const receivedDate = new Date(trackedEmail.received_at)
                if (sentDate > receivedDate) {
                    const responseTime = Math.floor((sentDate - receivedDate) / (1000 * 60))
                    updates.push({
                        ...trackedEmail, // Keep original fields for upsert
                        has_response: true,
                        responded_at: matchingSent.receivedDateTime,
                        first_responder_email: matchingSent.responderEmail,
                        response_time_minutes: responseTime,
                        is_processed: true
                    })
                }
            }
        }

        // 4. Bulk Upsert (Fastest way to update multiple records by ID)
        let responsesDetected = 0
        if (updates.length > 0) {
            const { error: upsertError } = await supabase.from('tracked_emails').upsert(updates);
            if (upsertError) throw upsertError;
            responsesDetected = updates.length;
        }

        return res.status(200).json({
            success: true,
            responsesDetected,
            duration: `${Date.now() - startTime}ms`
        })

    } catch (error) {
        console.error('Detection error:', error)
        return res.status(500).json({ success: false, error: error.message })
    }
}

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
    const response = await fetch(url, { method: 'POST', body: bodyParams })
    const data = await response.json()
    return data.access_token
}
