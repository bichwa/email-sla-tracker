import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Fetch unanswered emails from the database
 */
/**
 * Fetch unanswered emails from the database
 */
export const useUnansweredEmails = (filters = {}) => {
    return useQuery({
        queryKey: ['unanswered-emails', filters],
        queryFn: async () => {
            let query = supabase
                .from('unanswered_client_emails')
                .select('*')
                .order('received_at', { ascending: false })

            // Apply filters
            if (filters.employeeEmail) {
                query = query.eq('responsible_employee_email', filters.employeeEmail)
            }

            if (filters.scenario) {
                query = query.eq('scenario', filters.scenario)
            }

            if (filters.slaBreached !== undefined) {
                query = query.eq('sla_breached', filters.slaBreached)
            }

            if (filters.fromDate) {
                query = query.gte('received_at', filters.fromDate)
            }

            if (filters.toDate) {
                query = query.lte('received_at', filters.toDate)
            }

            // Exclude system generated emails
            // The view 'unanswered_client_emails' does not have 'is_system_generated' column
            // and likely already filters this. Removing explicit filter to avoid 400 error.
            // query = query.eq('is_system_generated', false)

            const { data, error } = await query

            if (error) throw error
            return data || []
        },
    })
}

/**
 * Fetch SLA metrics summary
 */
export const useSLAMetrics = (filters = {}) => {
    return useQuery({
        queryKey: ['sla-metrics', filters],
        queryFn: async () => {
            // Get today's date range (for default date filtering IF NEEDED, but SLA metrics usually need all active)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)

            let query = supabase
                .from('tracked_emails')
                .select('*')
                .eq('is_client_email', true)
                .eq('is_incoming', true)
                .eq('is_system_generated', false) // Exclude system emails

            // Apply date filter ONLY if provided. 
            // If not provided, we want to see ALL active unanswered emails/breaches.
            if (filters.fromDate) {
                query = query.gte('received_at', filters.fromDate)
            }
            // Logic: If NO date filter is active, we should still show stats for ALL unanswered emails.
            // But for "Avg Response Time" we might want to default to "Last 7/30 days" if not specified? 
            // For now, let's keep it simple: If no filter, fetch ALL relevant emails (might be heavy later, but correct for "Open Tasks").

            if (filters.toDate) {
                query = query.lte('received_at', filters.toDate)
            }

            if (filters.employeeEmail) {
                query = query.eq('responsible_employee_email', filters.employeeEmail)
            }

            const { data, error } = await query

            if (error) throw error

            // Calculate metrics
            const totalEmails = data.length
            const answeredEmails = data.filter(e => e.has_response).length
            const unansweredEmails = totalEmails - answeredEmails
            const breachedEmails = data.filter(e => e.sla_breached).length
            const withinSLA = answeredEmails - breachedEmails

            // Calculate average response time (only for answered emails)
            const answeredWithTime = data.filter(e => e.has_response && e.response_time_minutes)
            const avgResponseTime = answeredWithTime.length > 0
                ? Math.round(answeredWithTime.reduce((sum, e) => sum + e.response_time_minutes, 0) / answeredWithTime.length)
                : 0

            const slaCompliance = totalEmails > 0
                ? Math.round((withinSLA / totalEmails) * 100)
                : 100

            return {
                totalEmails,
                answeredEmails,
                unansweredEmails,
                breachedEmails,
                withinSLA,
                avgResponseTime,
                slaCompliance,
            }
        },
    })
}

/**
 * Fetch team performance data
 * REFACTORED: Now calculates dynamically from tracked_emails to support date filtering
 */
export const useTeamPerformance = (filters = {}) => {
    return useQuery({
        queryKey: ['team-performance', filters],
        queryFn: async () => {
            let query = supabase
                .from('tracked_emails')
                .select('*')
                .eq('is_client_email', true)
                .eq('is_incoming', true)
                .eq('is_system_generated', false)

            // Apply date filter
            // Default to "Last 30 days" if no filter, to avoid loading entire history
            if (filters.fromDate) {
                query = query.gte('received_at', filters.fromDate)
            } else {
                const thirtyDaysAgo = new Date()
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                query = query.gte('received_at', thirtyDaysAgo.toISOString())
            }

            if (filters.toDate) {
                query = query.lte('received_at', filters.toDate)
            }

            const { data, error } = await query
            if (error) throw error

            // Aggregate data by employee
            const stats = {}

            data.forEach(email => {
                const responsible = email.responsible_employee_email || 'Unassigned'

                // Simplify email to name for display (e.g. "vmusyoka@..." -> "vmusyoka")
                const name = responsible.split('@')[0]

                if (!stats[name]) {
                    stats[name] = {
                        name: name,
                        total_received: 0,
                        total_responded: 0,
                        unanswered: 0,
                    }
                }

                stats[name].total_received++

                if (email.has_response) {
                    stats[name].total_responded++
                } else {
                    stats[name].unanswered++
                }
            })

            return Object.values(stats)
        },
    })
}

/**
 * Fetch all active employees
 */
export const useEmployees = () => {
    return useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .eq('is_active', true)
                .eq('is_client_facing', true)
                .order('name')

            if (error) throw error
            return data || []
        },
    })
}

/**
 * Fetch classification rules
 */
export const useClassificationRules = () => {
    return useQuery({
        queryKey: ['classification-rules'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('email_classification_rules')
                .select('*')
                .order('priority')

            if (error) throw error
            return data || []
        },
    })
}

/**
 * Fetch daily performance metrics
 */
export const useDailyMetrics = (employeeEmail, days = 7) => {
    return useQuery({
        queryKey: ['daily-metrics', employeeEmail, days],
        queryFn: async () => {
            const startDate = new Date()
            startDate.setDate(startDate.getDate() - days)

            let query = supabase
                .from('daily_performance_metrics')
                .select('*')
                .gte('date', startDate.toISOString().split('T')[0])
                .order('date', { ascending: true })

            if (employeeEmail) {
                query = query.eq('employee_email', employeeEmail)
            }

            const { data, error } = await query

            if (error) throw error
            return data || []
        },
    })
}
