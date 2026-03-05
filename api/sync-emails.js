/**
 * Email sync serverless function
 * Fetches emails from Microsoft Graph API and stores them in Supabase
 */

import { createClient } from '@supabase/supabase-js'
import { Client } from '@microsoft/microsoft-graph-client'

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY // Use service key for server-side
)

export default async function handler(req, res) {
    // Accept both GET (Vercel cron) and POST (manual trigger)
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const body = req.body || {}
        let { accessToken } = body

        // FOOLPROOF SECRET FETCHING
        // Vercel cron sends CRON_SECRET as 'Authorization: Bearer <secret>'
        const authHeader = req.headers['authorization'] || ''
        const cronSecret = req.query.cronSecret || body.cronSecret || req.headers['cronsecret'] || req.headers['x-cron-secret'] || authHeader

        // Clean the secrets for robust matching
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
                message: 'Access token or valid cronSecret is required. You can pass it as ?cronSecret=YOUR_KEY'
            })
        }

        // Initialize Graph client
        const graphClient = Client.init({
            authProvider: (done) => {
                done(null, accessToken)
            },
        })

        // Get active employees
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('*')
            .eq('is_active', true)
            .eq('is_client_facing', true)

        if (empError) {
            console.error('Error fetching employees:', empError)
            return res.status(500).json({ error: 'Failed to fetch employees' })
        }

        // Get classification rules
        const { data: classificationRules, error: rulesError } = await supabase
            .from('email_classification_rules')
            .select('*')
            .eq('is_active', true)
            .order('priority')

        if (rulesError) {
            console.error('Error fetching classification rules:', rulesError)
        }

        // Get assignment rules (v2.9)
        const { data: assignmentRules, error: assignError } = await supabase
            .from('assignment_rules')
            .select('*')
            .eq('is_active', true)
            .order('priority')

        if (assignError) {
            console.warn('Could not fetch assignment_rules, falling back to hardcoded logic:', assignError.message)
        }

        let totalProcessed = 0
        let totalErrors = 0

        // ... rest of the fetch logic ...
        const shuffled = employees.sort(() => 0.5 - Math.random())
        const selectedEmployees = shuffled.slice(0, 5)

        const allEmailsToProcess = []

        console.log(`Processing ${selectedEmployees.length} randomly selected employees (out of ${employees.length})...`)

        await Promise.all(selectedEmployees.map(async (employee) => {
            try {
                const yesterday = new Date()
                yesterday.setDate(yesterday.getDate() - 1)

                const emails = await graphClient
                    .api(`/users/${employee.email}/messages`)
                    .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,conversationId,internetMessageId')
                    .filter(`receivedDateTime ge ${yesterday.toISOString()}`)
                    .orderby('receivedDateTime desc')
                    .top(20)
                    .get()

                if (emails.value) {
                    emails.value.forEach(e => {
                        allEmailsToProcess.push({ email: e, employee })
                    })
                }
            } catch (error) {
                console.error(`Error fetching emails for ${employee.email}:`, error)
                totalErrors++
            }
        }))

        // Batch processing
        const BATCH_SIZE = 10
        for (let i = 0; i < allEmailsToProcess.length; i += BATCH_SIZE) {
            const batch = allEmailsToProcess.slice(i, i + BATCH_SIZE)
            await Promise.all(batch.map(async ({ email, employee }) => {
                try {
                    await processEmail(email, employee, classificationRules, assignmentRules || [])
                    totalProcessed++
                } catch (procError) {
                    console.error(`Error processing email ${email.id}:`, procError)
                    totalErrors++
                }
            }))
        }

        return res.status(200).json({
            success: true,
            processed: totalProcessed,
            errors: totalErrors,
            mode: cronSecret ? 'background' : 'interactive'
        })
    } catch (error) {
        console.error('Email sync error:', error)
        return res.status(500).json({ success: false, error: 'Email sync failed', message: error.message })
    }
}

// ... Auth function omitted ...

/**
 * Process and classify a single email
 */
async function processEmail(email, employee, classificationRules, assignmentRules) {
    const globalMessageId = email.internetMessageId || email.id
    const fromEmail = email.from?.emailAddress?.address || 'unknown'

    // 1. DEDUPLICATION (v2.9 Enhanced)
    // First check by internetMessageId
    const { data: existingById } = await supabase
        .from('tracked_emails')
        .select('id')
        .eq('internet_message_id', globalMessageId)
        .limit(1)
        .maybeSingle()

    if (existingById) return

    // SECOND STAGE: Content-based dedup (Subject + From + Date)
    // This catches emails tracked from multiple mailboxes where internetMessageId might not match
    const { data: existingByContent } = await supabase
        .from('tracked_emails')
        .select('id')
        .eq('subject', email.subject)
        .eq('from_email', fromEmail)
        .eq('received_at', email.receivedDateTime)
        .limit(1)
        .maybeSingle()

    if (existingByContent) return

    // 2. CLASSIFICATION & ASSIGNMENT
    const classification = classifyEmail(email, classificationRules)
    const { scenario, responsibleEmail } = determineScenario(email, employee, assignmentRules)

    const fromName = email.from?.emailAddress?.name || ''
    const toEmail = email.toRecipients?.[0]?.emailAddress?.address || employee.email
    const ccEmails = email.ccRecipients?.map(r => r.emailAddress.address) || []

    await supabase.from('tracked_emails').insert([{
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
        is_incoming: true,
        is_client_email: classification.isClientEmail,
        is_system_generated: classification.isSystemGenerated,
        is_solver_email: classification.isSolverEmail,
        is_internal: classification.isInternal,
        scenario,
        responsible_employee_email: responsibleEmail,
        received_at: email.receivedDateTime,
        is_processed: true,
    }])
}

/**
 * Enhanced assignment engine using DB rules
 */
function determineScenario(email, employee, dbRules) {
    const recipients = [...(email.toRecipients || []), ...(email.ccRecipients || [])]
        .map(r => r.emailAddress?.address?.toLowerCase() || '')

    const body = email.bodyPreview?.toLowerCase() || ''
    const subject = email.subject?.toLowerCase() || ''
    const fromEmail = email.from?.emailAddress?.address?.toLowerCase() || ''

    // 1. Priority: MENTIONS (Keyword match in body for "@Name" or just "Name")
    // Scan DB rules for 'mention' type
    const mentionRule = dbRules.find(r => r.rule_type === 'mention' && body.includes(r.rule_value.toLowerCase()))
    if (mentionRule) {
        return { scenario: 'direct_mention', responsibleEmail: mentionRule.assignee_email }
    }

    // 2. Check if sent to team/group email
    const isGroupEmail = recipients.some(addr =>
        ['team@', 'cs-team@', 'support@', 'info@'].some(p => addr.includes(p))
    )

    if (isGroupEmail) {
        // Try DB rules for domain or keyword assignment
        for (const rule of dbRules) {
            if (rule.rule_type === 'domain' && fromEmail.includes(rule.rule_value.toLowerCase())) {
                return { scenario: 'team_email', responsibleEmail: rule.assignee_email }
            }
            if (rule.rule_type === 'keyword' && (subject.includes(rule.rule_value.toLowerCase()) || body.includes(rule.rule_value.toLowerCase()))) {
                return { scenario: 'team_email', responsibleEmail: rule.assignee_email }
            }
        }

        // Fallback to team@
        return { scenario: 'team_email', responsibleEmail: 'team@solvit.co.ke' }
    }

    // Individual inbox
    return { scenario: 'individual_inbox', responsibleEmail: employee.email }
}

/**
 * Classify email based on rules
 */
function classifyEmail(email, rules) {
    const subject = email.subject?.toLowerCase() || ''
    const body = email.bodyPreview?.toLowerCase() || ''
    const fromEmail = email.from?.emailAddress?.address?.toLowerCase() || ''

    // Hardcoded system keywords fallback
    const systemKeywords = ['delivery status notification', 'automatic reply', 'out of office', 'undeliverable']
    if (systemKeywords.some(k => subject.includes(k) || body.includes(k))) {
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
