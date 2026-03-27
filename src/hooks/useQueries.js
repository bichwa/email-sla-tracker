import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Fetch unanswered emails from the database
 */
/**
 * Fetch unanswered emails from the database
 */
export const useEmailList = (filters = {}) => {
    return useQuery({
        queryKey: ['email-list', filters],
        queryFn: async () => {
            let query = supabase
                .from('tracked_emails')
                .select('*')
                .eq('is_client_email', true)
                .eq('is_incoming', true)
                .eq('is_system_generated', false)
                .order('received_at', { ascending: false })

            // Apply filters
            if (filters.employeeEmail) {
                // Filter for either responsible OR responder to catch all activity
                query = query.or(`responsible_employee_email.eq.${filters.employeeEmail},first_responder_email.eq.${filters.employeeEmail}`)
            }

            if (filters.scenario) {
                query = query.eq('scenario', filters.scenario)
            }

            if (filters.slaBreached !== undefined) {
                query = query.eq('sla_breached', filters.slaBreached)
            }

            if (filters.hasResponse !== undefined) {
                query = query.eq('has_response', filters.hasResponse)
            } else {
                // Default: If not specified, and not asking for SLA breaches specifically (which might include answered?), 
                // we historically showed only unanswered.
                // However, let's leave it open: if undefined, show ALL.
                // But Dashboard.jsx will control this default.
            }

            if (filters.fromDate) {
                query = query.gte('received_at', `${filters.fromDate}T00:00:00`)
            }

            if (filters.toDate) {
                // Make toDate inclusive by adding the end-of-day timestamp
                query = query.lte('received_at', `${filters.toDate}T23:59:59`)
            }

            // Limit to avoid browser crash on huge datasets if no filters
            // But we have pagination? No, unlimited scroll or just 50... user didn't specify.
            // Previous view return everything.
            // Let's add a safe limit of 500 for now to prevent crashing like before? 
            // Or just return all (the previous issue was 1000 limit *truncating* metrics, but listing 1000 emails is fine for UI usually).
            query = query.limit(200) // Safe UI limit for now

            const { data, count, error } = await query.select('*', { count: 'exact' })

            if (error) throw error
            
            // Post-process to calculate minutes_waiting and real-time SLA status
            const processedEmails = (data || []).map(email => {
                const receivedAt = new Date(email.received_at);
                const now = new Date();
                
                // Calculate waiting/response time
                if (email.has_response) {
                    email.minutes_waiting = email.response_time_minutes || 0;
                } else {
                    email.minutes_waiting = Math.floor((now - receivedAt) / (1000 * 60));
                }

                // Calculate real-time SLA status (default Target is 15 mins)
                const target = 15;
                if (email.has_response) {
                    email.sla_breached = email.response_time_minutes > target;
                } else {
                    email.sla_breached = email.minutes_waiting > target;
                }

                return email;
            });

            return {
                emails: processedEmails,
                totalCount: count || 0
            }
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
            // Base query builder helper
            const buildBaseQuery = () => {
                let q = supabase
                    .from('tracked_emails')
                    .select('*', { count: 'exact', head: true }) // Default to count only
                    .eq('is_client_email', true)
                    .eq('is_incoming', true)
                    .eq('is_system_generated', false)

                if (filters.fromDate) q = q.gte('received_at', `${filters.fromDate}T00:00:00`)
                if (filters.toDate) q = q.lte('received_at', `${filters.toDate}T23:59:59`)
                if (filters.employeeEmail) {
                    q = q.or(`responsible_employee_email.eq.${filters.employeeEmail},first_responder_email.eq.${filters.employeeEmail}`)
                }

                return q
            }

            // 1. Total Emails Count
            const totalQuery = buildBaseQuery()

            // 2. Answered Emails Count
            const answeredQuery = buildBaseQuery().eq('has_response', true)

            // 3. Breached Emails Count
            const breachedQuery = buildBaseQuery().eq('sla_breached', true)

            // 4. Response Times (for efficient avg calc) - only fetch needed column
            let responseTimeQuery = supabase
                .from('tracked_emails')
                .select('response_time_minutes')
                .eq('is_client_email', true)
                .eq('is_incoming', true)
                .eq('is_system_generated', false)
                .eq('has_response', true)
                .not('response_time_minutes', 'is', null)

            if (filters.fromDate) {
                responseTimeQuery = responseTimeQuery.gte('received_at', filters.fromDate)
            } else {
                // Default: Only average emails received in the last 24 hours 
                // to avoid skewing by historical backfills
                const oneDayAgo = new Date()
                oneDayAgo.setHours(oneDayAgo.getHours() - 24)
                responseTimeQuery = responseTimeQuery.gte('received_at', oneDayAgo.toISOString())
            }

            if (filters.toDate) responseTimeQuery = responseTimeQuery.lte('received_at', `${filters.toDate}T23:59:59`)
            if (filters.employeeEmail) {
                responseTimeQuery = responseTimeQuery.or(`responsible_employee_email.eq.${filters.employeeEmail},first_responder_email.eq.${filters.employeeEmail}`)
            }

            // Run in parallel
            const [
                { count: totalEmails, error: errTotal },
                { count: answeredEmails, error: errAnswered },
                { count: breachedEmails, error: errBreached },
                { data: responseTimes, error: errTimes }
            ] = await Promise.all([
                totalQuery,
                answeredQuery,
                breachedQuery,
                responseTimeQuery
            ])

            if (errTotal) throw errTotal
            if (errAnswered) throw errAnswered
            if (errBreached) throw errBreached
            if (errTimes) throw errTimes

            // Calculations
            const unansweredEmails = (totalEmails || 0) - (answeredEmails || 0)
            const total = totalEmails || 0
            const breached = breachedEmails || 0
            const withinSLA = total - breached

            // Avg Response Time
            const avgResponseTime = responseTimes.length > 0
                ? Math.round(responseTimes.reduce((sum, e) => sum + e.response_time_minutes, 0) / responseTimes.length)
                : 0


            const slaCompliance = total > 0
                ? Math.round(((total - breached) / total) * 100)
                : 100

            return {
                totalEmails: total,
                answeredEmails: answeredEmails || 0,
                unansweredEmails,
                breachedEmails: breached,
                withinSLA: total - breached, // Simplified
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
                .select('id, has_response, responsible_employee_email, first_responder_email')
                .eq('is_client_email', true)
                .eq('is_incoming', true)
                .eq('is_system_generated', false)
                .limit(10000) // Fetch top 10k emails to ensure distribution is accurate
                .order('received_at', { ascending: false })

            // Apply date filter
            if (filters.fromDate) {
                query = query.gte('received_at', `${filters.fromDate}T00:00:00`)
            }

            if (filters.toDate) {
                query = query.lte('received_at', `${filters.toDate}T23:59:59`)
            }

            const { data, error } = await query
            if (error) throw error

            // Aggregate data by employee
            const stats = {}

            data.forEach(email => {
                // For received/assigned count, use responsible
                const responsible = email.responsible_employee_email || 'Unassigned'
                // For response count, attribute to the ACTUAL responder if available
                const responder = email.first_responder_email || responsible

                const respName = responsible.split('@')[0]
                const responderName = responder.split('@')[0]

                if (!stats[respName]) {
                    stats[respName] = {
                        name: respName,
                        total_received: 0,
                        total_responded: 0, // This will be responses they WERE ASSIGNED to? 
                        // No, let's keep name/resp separate if we want credit.
                        // Actually, the team chart shows distribution of workload.
                    }
                }
                
                // Add to received for the responsible person
                stats[respName].total_received++

                // Add to responded for the ACTUAL responder
                if (email.has_response) {
                    if (!stats[responderName]) {
                        stats[responderName] = {
                            name: responderName,
                            total_received: 0,
                            total_responded: 0
                        }
                    }
                    stats[responderName].total_responded++
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
