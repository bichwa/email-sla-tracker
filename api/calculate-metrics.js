/**
 * Calculate daily performance metrics
 * Aggregates email response data into daily summaries
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        // Calculate for yesterday
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        yesterday.setHours(0, 0, 0, 0)

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Get all employees
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('*')
            .eq('is_active', true)
            .eq('is_client_facing', true)

        if (empError) {
            return res.status(500).json({ error: 'Failed to fetch employees' })
        }

        // Calculate metrics for each employee
        for (const employee of employees || []) {
            const { data: emails, error: emailsError } = await supabase
                .from('tracked_emails')
                .select('*')
                .eq('responsible_employee_email', employee.email)
                .eq('is_client_email', true)
                .eq('is_incoming', true)
                .gte('received_at', yesterday.toISOString())
                .lt('received_at', today.toISOString())

            if (emailsError) {
                console.error(`Error fetching emails for ${employee.email}:`, emailsError)
                continue
            }

            const totalReceived = emails.length
            const answeredEmails = emails.filter(e => e.has_response)
            const totalResponded = answeredEmails.length
            const totalFirstResponses = answeredEmails.filter(e =>
                e.first_responder_email === employee.email
            ).length
            const unanswered = totalReceived - totalResponded

            // Response times
            const responseTimes = answeredEmails
                .filter(e => e.response_time_minutes)
                .map(e => e.response_time_minutes)
                .sort((a, b) => a - b)

            const avgResponseTime = responseTimes.length > 0
                ? Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length)
                : 0

            const minResponseTime = responseTimes.length > 0 ? responseTimes[0] : null
            const maxResponseTime = responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : null
            const medianResponseTime = responseTimes.length > 0
                ? responseTimes[Math.floor(responseTimes.length / 2)]
                : null

            // SLA metrics
            const slaCompliant = answeredEmails.filter(e => !e.sla_breached).length
            const slaBreached = answeredEmails.filter(e => e.sla_breached).length
            const slaComplianceRate = totalResponded > 0
                ? ((slaCompliant / totalResponded) * 100).toFixed(2)
                : 0

            // Scenario breakdown
            const directMentions = emails.filter(e => e.scenario === 'direct_mention').length
            const teamEmails = emails.filter(e => e.scenario === 'team_email').length
            const individualInbox = emails.filter(e => e.scenario === 'individual_inbox').length

            // Insert or update metrics
            const { error: metricsError } = await supabase
                .from('daily_performance_metrics')
                .upsert({
                    date: yesterday.toISOString().split('T')[0],
                    employee_email: employee.email,
                    employee_name: employee.name,
                    total_emails_received: totalReceived,
                    total_emails_responded: totalResponded,
                    total_first_responses: totalFirstResponses,
                    unanswered_count: unanswered,
                    avg_response_time_minutes: avgResponseTime,
                    min_response_time_minutes: minResponseTime,
                    max_response_time_minutes: maxResponseTime,
                    median_response_time_minutes: medianResponseTime,
                    sla_target_minutes: 15,
                    sla_compliant_count: slaCompliant,
                    sla_breached_count: slaBreached,
                    sla_compliance_rate: parseFloat(slaComplianceRate),
                    direct_mention_count: directMentions,
                    team_email_count: teamEmails,
                    individual_inbox_count: individualInbox,
                }, {
                    onConflict: 'date,employee_email'
                })

            if (metricsError) {
                console.error(`Error saving metrics for ${employee.email}:`, metricsError)
            }
        }

        return res.status(200).json({
            success: true,
            date: yesterday.toISOString().split('T')[0],
            employeesProcessed: employees.length,
        })
    } catch (error) {
        console.error('Metrics calculation error:', error)
        return res.status(500).json({ error: 'Metrics calculation failed', details: error.message })
    }
}
