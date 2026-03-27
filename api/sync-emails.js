/**
 * Email sync serverless function
 * High Performance Bulk Version (Prevent Timeouts)
 */

import { createClient } from '@supabase/supabase-js'
import { Client } from '@microsoft/microsoft-graph-client'

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = 25000; // 25 seconds safety margin

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

        // 1. Fetch needed metadata in parallel
        const [empRes, rulesRes, assignRes, existingRes] = await Promise.all([
            supabase.from('employees').select('*').eq('is_active', true).eq('is_client_facing', true),
            supabase.from('email_classification_rules').select('*').eq('is_active', true).order('priority'),
            supabase.from('assignment_rules').select('*').eq('is_active', true).order('priority'),
            supabase.from('tracked_emails').select('internet_message_id, subject, from_email, received_at').order('received_at', { ascending: false }).limit(1000)
        ]);

        if (empRes.error) throw empError;
        const employees = empRes.data;
        const classificationRules = rulesRes.data || [];
        const assignmentRules = assignRes.data || [];
        const existingEmails = existingRes.data || [];

        // Map existing for fast lookup
        const existingIds = new Set(existingEmails.map(e => e.internet_message_id));
        const existingContent = new Set(existingEmails.map(e => `${e.subject}|${e.from_email}|${e.received_at}`));

        let totalProcessed = 0
        let totalErrors = 0
        const allEmailsToInsert = []

        // 2. Fetch emails from Graph (Parallel)
        await Promise.all(employees.map(async (employee) => {
            // Safety check: Don't start new fetches if we are running out of time
            if (Date.now() - startTime > 15000) return; 

            try {
                const emails = await graphClient
                    .api(`/users/${employee.email}/mailFolders/inbox/messages`)
                    .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,conversationId,internetMessageId')
                    .orderby('receivedDateTime desc')
                    .top(100)
                    .get()

                if (emails.value) {
                    for (const email of emails.value) {
                        const globalMessageId = email.internetMessageId || email.id
                        const fromEmail = (email.from?.emailAddress?.address || email.sender?.emailAddress?.address || 'unknown').toLowerCase()
                        const contentKey = `${email.subject}|${fromEmail}|${email.receivedDateTime}`;

                        // Skip if exists
                        if (existingIds.has(globalMessageId) || existingContent.has(contentKey)) continue;

                        // Classification & Assignment
                        const isIncoming = fromEmail !== employee.email.toLowerCase()
                        const classification = classifyEmail(email, classificationRules)
                        const { scenario, responsibleEmail } = determineScenario(email, employee, assignmentRules)

                        const fromName = email.from?.emailAddress?.name || email.sender?.emailAddress?.name || ''
                        const toEmail = email.toRecipients?.[0]?.emailAddress?.address || employee.email
                        const ccEmails = email.ccRecipients?.map(r => r.emailAddress.address) || []

                        allEmailsToInsert.push({
                            message_id: email.id,
                            conversation_id: email.conversationId,
                            internet_message_id: globalMessageId,
                            subject: email.subject || null,
                            from_email: fromEmail,
                            from_name: fromName,
                            to_email: toEmail,
                            cc_emails: ccEmails,
                            body_preview: email.bodyPreview,
                            has_attachments: email.hasAttachments || false,
                            is_incoming: isIncoming,
                            is_client_email: classification.isClientEmail,
                            is_system_generated: classification.isSystemGenerated,
                            is_solver_email: classification.isSolverEmail,
                            is_internal: classification.isInternal,
                            scenario,
                            responsible_employee_email: responsibleEmail,
                            received_at: email.receivedDateTime,
                            is_processed: true,
                            has_response: !isIncoming,
                            responded_at: !isIncoming ? email.receivedDateTime : null,
                            first_responder_email: !isIncoming ? fromEmail : null,
                            response_time_minutes: !isIncoming ? 0 : null
                        })

                        // Track in-memory to prevent duplicates within the same sync pulse
                        existingIds.add(globalMessageId);
                        existingContent.add(contentKey);
                    }
                }
            } catch (error) {
                console.error(`Error fetching for ${employee.email}:`, error)
                totalErrors++
            }
        }))

        // 3. Bulk Insert (Max 500 at a time to be safe)
        if (allEmailsToInsert.length > 0) {
            const BATCH_SIZE = 500;
            for (let i = 0; i < allEmailsToInsert.length; i += BATCH_SIZE) {
                const batch = allEmailsToInsert.slice(i, i + BATCH_SIZE);
                const { error: insertError } = await supabase.from('tracked_emails').insert(batch);
                if (insertError) {
                    console.error('Bulk insert error:', insertError);
                    totalErrors += batch.length;
                } else {
                    totalProcessed += batch.length;
                }
            }
        }

        return res.status(200).json({
            success: true,
            processed: totalProcessed,
            errors: totalErrors,
            duration: `${Date.now() - startTime}ms`
        })

    } catch (error) {
        console.error('Sync error:', error)
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

function determineScenario(email, employee, dbRules) {
    const recipients = [...(email.toRecipients || []), ...(email.ccRecipients || [])]
        .map(r => r.emailAddress?.address?.toLowerCase() || '')
    const body = email.bodyPreview?.toLowerCase() || ''
    const subject = email.subject?.toLowerCase() || ''
    const fromEmail = email.from?.emailAddress?.address?.toLowerCase() || ''

    const mentionRule = dbRules.find(r => r.rule_type === 'mention' && body.includes(r.rule_value.toLowerCase()))
    if (mentionRule) return { scenario: 'direct_mention', responsibleEmail: mentionRule.assignee_email }

    const isToCS = recipients.some(addr => addr.includes('cs@solvit.co.ke') || addr.includes('cs@'))
    if (isToCS) {
        const csRule = dbRules.find(r => r.rule_type === 'team_inbox' && r.rule_value.toLowerCase().includes('cs@'))
        return { scenario: 'customer_service_inbox', responsibleEmail: csRule?.assignee_email || 'jmungasi@solvit.co.ke' }
    }

    const isToTeam = recipients.some(addr => ['team@', 'cs-team@', 'support@', 'info@'].some(p => addr.includes(p)))
    if (isToTeam) {
        for (const rule of dbRules) {
            if (rule.rule_type === 'domain' && fromEmail.includes(rule.rule_value.toLowerCase())) return { scenario: 'team_email', responsibleEmail: rule.assignee_email }
            if (rule.rule_type === 'keyword' && (subject.includes(rule.rule_value.toLowerCase()) || body.includes(rule.rule_value.toLowerCase()))) return { scenario: 'team_email', responsibleEmail: rule.assignee_email }
        }
        return { scenario: 'team_email', responsibleEmail: 'team@solvit.co.ke' }
    }

    return { scenario: 'individual_inbox', responsibleEmail: employee.email }
}

function classifyEmail(email, rules) {
    const subject = email.subject?.toLowerCase() || ''
    const body = email.bodyPreview?.toLowerCase() || ''
    const fromEmail = email.from?.emailAddress?.address?.toLowerCase() || ''

    // Global priority: undeliverable/notifications (hardcoded safety)
    const systemKeywords = ['delivery status notification', 'automatic reply', 'out of office', 'undeliverable']
    const systemDomains = ['jira.com', 'atlassian.net', 'tldv.io', 'render.com', 'africastalking.com', 'microsoft.com', 'azure.com', 'github.com']
    
    if (systemKeywords.some(k => subject.includes(k) || body.includes(k)) || systemDomains.some(d => fromEmail.includes(d))) {
        return { isClientEmail: false, isSystemGenerated: true, isSolverEmail: false, isInternal: false }
    }

    for (const rule of rules || []) {
        let matches = false
        const val = rule.rule_value.toLowerCase()
        if (rule.rule_type === 'sender_email') matches = fromEmail === val
        else if (rule.rule_type === 'sender_domain') matches = fromEmail.includes(val)
        else if (rule.rule_type === 'subject_pattern') matches = subject.includes(val)
        else if (rule.rule_type === 'keyword') matches = body.includes(val) || subject.includes(val)

        if (matches) {
            return {
                isClientEmail: rule.classification === 'client_email',
                isSystemGenerated: rule.classification === 'system_generated',
                isSolverEmail: rule.classification === 'solver_email',
                isInternal: rule.classification === 'internal'
            }
        }
    }
    return { isClientEmail: true, isSystemGenerated: false, isSolverEmail: false, isInternal: false }
}
