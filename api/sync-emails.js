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
        const body = req.body || {}
        let { accessToken } = body

        // FOOLPROOF SECRET FETCHING
        const cronSecret = req.query.cronSecret || body.cronSecret || req.headers['cronsecret'] || req.headers['x-cron-secret']

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
            mode: cronSecret ? 'background' : 'interactive'
        })
    } catch (error) {
        console.error('Email sync error:', error)
        // Return detailed error to help user debug in cronjob.org
        return res.status(500).json({
            success: false,
            error: 'Email sync failed',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            hint: 'Check Vercel logs and environment variables (Tenant ID, Client ID, Client Secret)'
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
        const missing = []
        if (!tenantId) missing.push('VITE_MICROSOFT_TENANT_ID')
        if (!clientId) missing.push('VITE_MICROSOFT_CLIENT_ID')
        if (!clientSecret) missing.push('MICROSOFT_CLIENT_SECRET')
        throw new Error(`Missing environment variables for background sync: ${missing.join(', ')}`)
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

    // FALLBACK SYSTEM KEYWORDS (Hardcoded based on client feedback)
    const systemKeywords = [
        'client not picking',
        'not ready',
        'unreachable',
        'undeliverable',
        'automatic reply',
        'out of office',
        'ticket',
        'update on',
        'status of'
    ]

    for (const keyword of systemKeywords) {
        if (subject.includes(keyword) || body.includes(keyword)) {
            return {
                isClientEmail: false,
                isSystemGenerated: true,
                isSolverEmail: false,
                isInternal: false
            }
        }
    }

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
    const toRecipients = email.toRecipients?.map(r => r.emailAddress?.address?.toLowerCase() || '') || []
    const ccRecipients = email.ccRecipients?.map(r => r.emailAddress?.address?.toLowerCase() || '') || []
    const allRecipients = [...toRecipients, ...ccRecipients]
    
    const bodyPreview = email.bodyPreview?.toLowerCase() || ''

    // Check for @mentions in body
    const mentionMatch = bodyPreview.match(/@(\w+)/i)

    if (mentionMatch) {
        return {
            scenario: 'direct_mention',
            responsibleEmail: employee.email, // The mentioned person (simplified)
        }
    }

    // Check if sent to team email (ANY recipient is team@)
    // You can add more group emails here
    const isGroupEmail = allRecipients.some(email => 
        email.includes('team@') || 
        email.includes('support@') || 
        email.includes('info@')
    )

    if (isGroupEmail) {
        return {
            scenario: 'team_email',
            // IMPORTANT: Group emails are NOT assigned to individuals by default
            // This fixes the "marked as unread for all team members" issue
            responsibleEmail: null, 
        }
    }

    // Individual inbox
    // Only if the employee is explicitly in the TO or CC list (and it's not a group catch-all)
    return {
        scenario: 'individual_inbox',
        responsibleEmail: employee.email,
    }
}
