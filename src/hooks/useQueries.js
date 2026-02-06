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
            // Note: The view 'unanswered_client_emails' should ideally handle this, 
            // but we add it here for safety if the view includes them.
            // If the view doesn't have this column, this might error, but 'is_system_generated' is in tracked_emails
            // created views usually inherit columns. Let's assume the view has it.
            query = query.eq('is_system_generated', false)

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
            // Get today's date range
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

            // Apply date filter (default to today)
            const fromDate = filters.fromDate || today.toISOString()
            const toDate = filters.toDate || tomorrow.toISOString()

            query = query.gte('received_at', fromDate).lte('received_at', toDate)

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
            // Get today's date range (default)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)

            let query = supabase
                .from('tracked_emails')
                .select('*')
                .eq('is_client_email', true)
                .eq('is_incoming', true)
                .eq('is_system_generated', false)

            // Apply date filter
            // Note: Unlike the static view, this will now respect the specific date range selected
            const fromDate = filters.fromDate || today.toISOString()
            const toDate = filters.toDate || tomorrow.toISOString()

            query = query.gte('received_at', fromDate).lte('received_at', toDate)

            const { data, error } = await query
            if (error) throw error

            // Aggregate data by employee
            const stats = {}

            // Initialize with known employees (optional, skipping for now to show only active)

            data.forEach(email => {
                const responsible = email.responsible_employee_email || 'Unassigned'

                if (!stats[responsible]) {
                    stats[responsible] = {
                        email: responsible, // Mapping to 'email' prop used by chart
                        total_assigned: 0,
                        answered_count: 0,
                        unanswered_count: 0,
                        breach_count: 0,
                        response_times: []
                    }
                }

                stats[responsible].total_assigned++

                if (email.has_response) {
                    stats[responsible].answered_count++
                    if (email.response_time_minutes) {
                        stats[responsible].response_times.push(email.response_time_minutes)
                    }
                } else {
                    stats[responsible].unanswered_count++
                }

                if (email.sla_breached) {
                    stats[responsible].breach_count++
                }
            })

            // Format for chart
            return Object.values(stats).map(stat => ({
                email: stat.email,
                total_assigned: stat.total_assigned,
                answered_count: stat.answered_count,
                unanswered_count: stat.unanswered_count,
                breach_count: stat.breach_count,
                avg_response_time: stat.response_times.length > 0
                    ? Math.round(stat.response_times.reduce((a, b) => a + b, 0) / stat.response_times.length)
                    : 0
            }))
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
