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
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { accessToken, mailboxes } = req.body

        if (!accessToken) {
            return res.status(400).json({ error: 'Access token is required' })
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
        const { data: rules, error: rulesError } = await supabase
            .from('email_classification_rules')
            .select('*')
            .eq('is_active', true)
            .order('priority')

        if (rulesError) {
            console.error('Error fetching rules:', rulesError)
        }

        let totalProcessed = 0
        let totalErrors = 0

        // Fetch emails for each employee
        for (const employee of employees) {
            try {
                // Fetch last 50 emails from the last 24 hours
                const yesterday = new Date()
                yesterday.setDate(yesterday.getDate() - 1)

                const emails = await graphClient
                    .api(`/users/${employee.email}/messages`)
                    .select('id,subject,from,toRecipients,ccRecipients,receivedDateTime,bodyPreview,hasAttachments,conversationId,internetMessageId')
                    .filter(`receivedDateTime ge ${yesterday.toISOString()}`)
                    .orderby('receivedDateTime desc')
                    .top(50)
                    .get()

                // Process each email
                for (const email of emails.value || []) {
                    try {
                        await processEmail(email, employee, rules)
                        totalProcessed++
                    } catch (procError) {
                        console.error(`Error processing email ${email.id}:`, procError)
                        totalErrors++
                    }
                }
            } catch (error) {
                console.error(`Error fetching emails for ${employee.email}:`, error)
                totalErrors++
            }
        }

        return res.status(200).json({
            success: true,
            processed: totalProcessed,
            errors: totalErrors,
        })
    } catch (error) {
        console.error('Email sync error:', error)
        return res.status(500).json({ error: 'Email sync failed', details: error.message })
    }
}

/**
 * Process and classify a single email
 */
async function processEmail(email, employee, rules) {
    // Check if email already exists
    const { data: existing } = await supabase
        .from('tracked_emails')
        .select('id')
        .eq('message_id', email.id)
        .single()

    if (existing) {
        return // Already processed
    }

    // Classify email
    const classification = classifyEmail(email, rules)

    // Determine scenario and responsibility
    const { scenario, responsibleEmail } = determineScenario(email, employee)

    // Extract email addresses
    const fromEmail = email.from?.emailAddress?.address || 'unknown'
    const fromName = email.from?.emailAddress?.name || ''
    const toEmail = email.toRecipients?.[0]?.emailAddress?.address || employee.email
    const ccEmails = email.ccRecipients?.map(r => r.emailAddress.address) || []

    // Insert into database
    const { error } = await supabase
        .from('tracked_emails')
        .insert([{
            message_id: email.id,
            conversation_id: email.conversationId,
            internet_message_id: email.internetMessageId,
            subject: email.subject || null,
            from_email: fromEmail,
            from_name: fromName,
            to_email: toEmail,
            cc_emails: ccEmails,
            body_preview: email.bodyPreview,
            has_attachments: email.hasAttachments || false,
            attachment_count: email.hasAttachments ? 1 : 0,
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

    if (error) {
        console.error('Error inserting email:', error)
        throw error
    }
}

/**
 * Classify email based on rules
 */
function classifyEmail(email, rules) {
    const fromEmail = email.from?.emailAddress?.address?.toLowerCase() || ''
    const subject = email.subject?.toLowerCase() || ''
    const body = email.bodyPreview?.toLowerCase() || ''

    let isClientEmail = true
    let isSystemGenerated = false
    let isSolverEmail = false
    let isInternal = false

    // Apply rules in priority order
    for (const rule of rules || []) {
        let matches = false

        switch (rule.rule_type) {
            case 'sender_email':
                matches = fromEmail === rule.rule_value.toLowerCase()
                break
            case 'sender_domain':
                matches = fromEmail.includes(rule.rule_value.toLowerCase())
                break
            case 'subject_pattern':
                if (rule.rule_value === '^$') {
                    matches = !subject || subject.trim() === ''
                } else {
                    matches = subject.includes(rule.rule_value.toLowerCase())
                }
                break
            case 'keyword':
            case 'body_pattern':
                matches = body.includes(rule.rule_value.toLowerCase())
                break
        }

        if (matches) {
            // Apply classification
            switch (rule.classification) {
                case 'system_generated':
                    isSystemGenerated = true
                    isClientEmail = false
                    break
                case 'solver_email':
                    isSolverEmail = true
                    isClientEmail = false
                    break
                case 'internal':
                    isInternal = true
                    isClientEmail = false
                    break
                case 'client_email':
                default:
                    isClientEmail = true
                    break
            }
            break // Stop at first match (rules are priority-ordered)
        }
    }

    return { isClientEmail, isSystemGenerated, isSolverEmail, isInternal }
}

/**
 * Determine email scenario and responsible person
 */
function determineScenario(email, employee) {
    const toEmail = email.toRecipients?.[0]?.emailAddress?.address?.toLowerCase() || ''
    const bodyPreview = email.bodyPreview?.toLowerCase() || ''

    // Check for @mentions in body
    const mentionMatch = bodyPreview.match(/@(\w+)/i)

    if (mentionMatch) {
        return {
            scenario: 'direct_mention',
            responsibleEmail: employee.email, // The mentioned person (simplified)
        }
    }

    // Check if sent to team email
    if (toEmail.includes('team@')) {
        return {
            scenario: 'team_email',
            responsibleEmail: null, // Team responsibility
        }
    }

    // Individual inbox
    return {
        scenario: 'individual_inbox',
        responsibleEmail: employee.email,
    }
}
