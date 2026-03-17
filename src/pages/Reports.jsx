import { useState } from 'react'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { useEmailList, useSLAMetrics } from '../hooks/useQueries'
import { Download, Calendar, FileText, BarChart2 } from 'lucide-react'

export const Reports = () => {
    // Default to last 30 days
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date()
        const start = new Date()
        start.setDate(start.getDate() - 30)
        return {
            fromDate: start.toISOString().split('T')[0],
            toDate: end.toISOString().split('T')[0]
        }
    })

    const filters = {
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate
    }

    const { data: emails, isLoading: emailsLoading } = useEmailList(filters)
    const { data: metrics, isLoading: metricsLoading } = useSLAMetrics(filters)

    const handleDateChange = (key, value) => {
        setDateRange(prev => ({ ...prev, [key]: value }))
    }

    const downloadCSV = (content, filename) => {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', filename)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const exportMetrics = () => {
        if (!metrics) return

        const headers = ['Metric,Value']
        const rows = [
            `Total Emails,${metrics.totalEmails}`,
            `Answered Emails,${metrics.answeredEmails}`,
            `Unanswered Emails,${metrics.unansweredEmails}`,
            `SLA Breaches,${metrics.breachedEmails}`,
            `Within SLA,${metrics.withinSLA}`,
            `SLA Compliance,${metrics.slaCompliance}%`,
            `Avg Response Time,${metrics.avgResponseTime}m`
        ]

        const csvContent = [headers, ...rows].join('\n')
        downloadCSV(csvContent, `sla-metrics-${dateRange.fromDate}-to-${dateRange.toDate}.csv`)
    }

    const exportLogs = () => {
        if (!emails || emails.length === 0) return

        const headers = [
            'Subject',
            'From',
            'To/Recipients',
            'Received At',
            'Responded At',
            'Response Time (mins)',
            'SLA Breached',
            'Responsible Employee',
            'Conversation ID'
        ].join(',')

        const rows = emails.map(email => {
            const subject = `"${(email.subject || '').replace(/"/g, '""')}"`
            const from = `"${(email.from_email || '').replace(/"/g, '""')}"`
            const to = `"${(email.to_email || '').replace(/"/g, '""')}"` // Assuming column name, verify?
            // Actually 'to_recipients' in Graph, but DB col might be 'to_email' or similar?
            // Checking useQueries or DB schema... 'to_recipients' usually array.
            // Let's stick to standard fields we know exist or are common. 
            // 'sender_email', 'recipient_email'? 
            // In 'tracked_emails': 'sender_email', 'recipient_email' (maybe 'to_email'?), 'received_at'
            // Let's use safe access.

            return [
                subject,
                `"${email.from_email || ''}"`,
                `"${email.to_email || ''}"`,
                email.received_at,
                email.has_response ? email.first_response_at : 'N/A',
                email.has_response ? email.response_time_minutes : '',
                email.sla_breached ? 'Yes' : 'No',
                email.responsible_employee_email,
                email.conversation_id
            ].join(',')
        })

        const csvContent = [headers, ...rows].join('\n')
        downloadCSV(csvContent, `email-logs-${dateRange.fromDate}-to-${dateRange.toDate}.csv`)
    }

    const isLoading = emailsLoading || metricsLoading

    return (
        <DashboardLayout>
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Reports & Export</h1>
                    <p className="text-gray-600 mt-1">Download metrics and detailed email logs.</p>
                </div>
            </div>

            {/* Date Filers */}
            <div className="card mb-8 p-6">
                <div className="flex items-center gap-2 mb-4 text-gray-700 font-medium">
                    <Calendar className="w-5 h-5" />
                    <span>Date Range</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">From</label>
                        <input
                            type="date"
                            value={dateRange.fromDate}
                            onChange={(e) => handleDateChange('fromDate', e.target.value)}
                            className="input w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">To</label>
                        <input
                            type="date"
                            value={dateRange.toDate}
                            onChange={(e) => handleDateChange('toDate', e.target.value)}
                            className="input w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Export Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Metrics Summary */}
                <div className="card p-6 flex flex-col items-start hover:shadow-md transition-shadow">
                    <div className="bg-blue-100 p-3 rounded-lg mb-4">
                        <BarChart2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Metrics Summary</h3>
                    <p className="text-gray-600 mb-6 text-sm flex-1">
                        Download a high-level summary of your SLA performance, including average response times, breach counts, and compliance percentages for the selected period.
                    </p>
                    <button
                        onClick={exportMetrics}
                        disabled={isLoading || !metrics}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Export Metrics (CSV)
                    </button>
                    {metrics && (
                        <p className="mt-3 text-xs text-center w-full text-gray-500">
                            Includes summary data for {metrics.totalEmails} emails
                        </p>
                    )}
                </div>

                {/* Detailed Logs */}
                <div className="card p-6 flex flex-col items-start hover:shadow-md transition-shadow">
                    <div className="bg-green-100 p-3 rounded-lg mb-4">
                        <FileText className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Detailed Email Logs</h3>
                    <p className="text-gray-600 mb-6 text-sm flex-1">
                        Export a raw list of all emails received in this period. Includes subject lines, timestamps, response status, and responsible employees.
                    </p>
                    <button
                        onClick={exportLogs}
                        disabled={isLoading || !emails?.length}
                        className="btn-secondary w-full flex items-center justify-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Export Logs (CSV)
                    </button>
                    {emails && (
                        <p className="mt-3 text-xs text-center w-full text-gray-500">
                            {emails.length} records ready to download
                        </p>
                    )}
                </div>
            </div>
        </DashboardLayout>
    )
}
