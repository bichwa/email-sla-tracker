import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Helper to identify system emails that should be ignored for SLA
 */
const isSystemEmail = (email) => {
    if (email.is_system_generated) return true;

    const subject = (email.subject || '').toLowerCase();
    const fromEmail = (email.from_email || '').toLowerCase();
    const body = (email.body_preview || '').toLowerCase();

    // Relaxed keywords to avoid over-filtering real emails
    const systemKeywords = ['delivery status notification', 'automatic reply', 'out of office', 'undeliverable'];
    const systemDomains = ['jira.com', 'atlassian.net', 'tldv.io', 'render.com', 'africastalking.com', 'microsoft.com', 'azure.com', 'github.com'];

    return systemKeywords.some(k => subject.includes(k) || body.includes(k)) ||
        systemDomains.some(d => fromEmail.includes(d));
}

/**
 * Shared helper to process email data for both list and metrics
 */
const processEmailData = (data, target = 30) => {
    const now = new Date();
    return (data || [])
        .filter(email => !isSystemEmail(email))
        .map(email => {
            const receivedAt = new Date(email.received_at);

            // Calculate waiting/response time
            if (email.has_response) {
                email.minutes_waiting = email.response_time_minutes || 0;
            } else {
                email.minutes_waiting = Math.floor((now - receivedAt) / (1000 * 60));
            }

            // Calculate real-time SLA status
            email.sla_breached = email.minutes_waiting > target;

            return email;
        });
}

/**
 * Fetch emails from the database with real-time SLA calculation
 */
export const useEmailList = (filters = {}) => {
    return useQuery({
        queryKey: ['email-list', filters],
        queryFn: async () => {
            let query = supabase
                .from('tracked_emails')
                .select('*') // Includes responded_at
                .eq('is_client_email', true)
                .eq('is_incoming', true)
                .order('received_at', { ascending: false })

            // Apply filters
            if (filters.employeeEmail) {
                let emailsToFilter = [filters.employeeEmail];
                if (filters.employeeEmail === 'podhiambo@solvit.co.ke') {
                    emailsToFilter.push('jmaina@solvit.co.ke');
                }
                const filterString = emailsToFilter.map(e => `responsible_employee_email.eq.${e},first_responder_email.eq.${e}`).join(',');
                query = query.or(filterString);
            }

            if (filters.scenario) query = query.eq('scenario', filters.scenario)
            if (filters.hasResponse !== undefined) query = query.eq('has_response', filters.hasResponse)

            // Date filtering with format safety (handles DD/MM/YYYY or YYYY-MM-DD)
            const formatDate = (dateStr) => {
                if (!dateStr) return null;
                if (dateStr.includes('/')) return dateStr.split('/').reverse().join('-');
                return dateStr;
            };

            // Timezone offset (+03:00) added to ensure local day start/end is respected
            if (filters.fromDate) query = query.gte('received_at', `${formatDate(filters.fromDate)}T00:00:00+03:00`)
            if (filters.toDate) query = query.lte('received_at', `${formatDate(filters.toDate)}T23:59:59+03:00`)

            query = query.limit(500)

            const { data, error } = await query
            if (error) throw error

            let processedEmails = processEmailData(data, 30);

            // Client-side SLA filtering
            if (filters.slaBreached !== undefined) {
                processedEmails = processedEmails.filter(e => e.sla_breached === filters.slaBreached);
            }

            return {
                emails: processedEmails,
                totalCount: processedEmails.length
            }
        },
    })
}

/**
 * Fetch SLA metrics summary based on REAL-TIME calculations
 */
export const useSLAMetrics = (filters = {}) => {
    return useQuery({
        queryKey: ['sla-metrics', filters],
        queryFn: async () => {
            let query = supabase
                .from('tracked_emails')
                .select('*')
                .eq('is_client_email', true)
                .eq('is_incoming', true)
                .order('received_at', { ascending: false })
                .limit(1000)

            if (filters.employeeEmail) {
                let emailsToFilter = [filters.employeeEmail];
                if (filters.employeeEmail === 'podhiambo@solvit.co.ke') {
                    emailsToFilter.push('jmaina@solvit.co.ke');
                }
                const filterString = emailsToFilter.map(e => `responsible_employee_email.eq.${e},first_responder_email.eq.${e}`).join(',');
                query = query.or(filterString);
            }

            const formatDate = (dateStr) => {
                if (!dateStr) return null;
                if (dateStr.includes('/')) return dateStr.split('/').reverse().join('-');
                return dateStr;
            };

            // Timezone offset (+03:00) added to ensure local day start/end is respected
            if (filters.fromDate) query = query.gte('received_at', `${formatDate(filters.fromDate)}T00:00:00+03:00`)
            if (filters.toDate) query = query.lte('received_at', `${formatDate(filters.toDate)}T23:59:59+03:00`)

            const { data, error } = await query
            if (error) throw error

            const validEmails = processEmailData(data, 30);

            let total = validEmails.length;
            let answered = 0;
            let breached = 0;
            let totalRespTime = 0;
            let respWithTimeCount = 0;

            validEmails.forEach(email => {
                if (email.has_response) {
                    answered++;
                    totalRespTime += (email.response_time_minutes || 0);
                    respWithTimeCount++;
                }
                if (email.sla_breached) breached++;
            });

            return {
                totalEmails: total,
                answeredEmails: answered,
                unansweredEmails: total - answered,
                breachedEmails: breached,
                withinSLA: total - breached,
                avgResponseTime: respWithTimeCount > 0 ? Math.round(totalRespTime / respWithTimeCount) : 0,
                slaCompliance: total > 0 ? Math.round(((total - breached) / total) * 100) : 100,
            }
        },
    })
}

/**
 * Fetch team performance data
 */
export const useTeamPerformance = (filters = {}) => {
    return useQuery({
        queryKey: ['team-performance', filters],
        queryFn: async () => {
            let query = supabase
                .from('tracked_emails')
                .select('id, subject, from_email, body_preview, has_response, responsible_employee_email, first_responder_email, is_system_generated')
                .eq('is_client_email', true)
                .eq('is_incoming', true)
                .limit(5000)
                .order('received_at', { ascending: false })

            if (filters.fromDate) query = query.gte('received_at', `${filters.fromDate}T00:00:00+03:00`)
            if (filters.toDate) query = query.lte('received_at', `${filters.toDate}T23:59:59+03:00`)

            const { data, error } = await query
            if (error) throw error

            // Filter system emails as well for the team chart
            const stats = {}
            const validEmails = (data || []).filter(email => !isSystemEmail(email));

            validEmails.forEach(email => {
                const responsible = email.responsible_employee_email || 'Unassigned'
                const responder = email.first_responder_email || responsible
                const respName = responsible.split('@')[0]
                const responderName = responder.split('@')[0]

                if (!stats[respName]) {
                    stats[respName] = { name: respName, total_received: 0, total_responded: 0 }
                }
                stats[respName].total_received++

                if (email.has_response) {
                    if (!stats[responderName]) {
                        stats[responderName] = { name: responderName, total_received: 0, total_responded: 0 }
                    }
                    stats[responderName].total_responded++
                }
            });

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
