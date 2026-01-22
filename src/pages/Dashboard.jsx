import { useState } from 'react'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { MetricsCards } from '../components/dashboard/MetricsCards'
import { EmailsTable } from '../components/dashboard/EmailsTable'
import { FiltersBar } from '../components/dashboard/FiltersBar'
import { TeamLoadChart } from '../components/dashboard/TeamLoadChart'
import { useUnansweredEmails, useSLAMetrics, useTeamPerformance, useEmployees } from '../hooks/useQueries'
import { RefreshCw } from 'lucide-react'

export const Dashboard = () => {
    const [filters, setFilters] = useState({})

    const { data: emails, isLoading: emailsLoading, refetch: refetchEmails } = useUnansweredEmails(filters)
    const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useSLAMetrics(filters)
    const { data: teamData, isLoading: teamLoading } = useTeamPerformance(filters)
    const { data: employees, isLoading: employeesLoading } = useEmployees()

    const handleRefresh = () => {
        refetchEmails()
        refetchMetrics()
    }

    const isLoading = emailsLoading || metricsLoading || teamLoading || employeesLoading

    return (
        <DashboardLayout>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-600 mt-1">Monitor email SLA performance in real-time</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <MetricsCards metrics={metrics} loading={metricsLoading} />

            <FiltersBar
                onFilterChange={setFilters}
                employees={employees}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <div className="lg:col-span-2">
                    <EmailsTable emails={emails} loading={emailsLoading} />
                </div>
                <div>
                    <TeamLoadChart teamData={teamData} loading={teamLoading} />
                </div>
            </div>
        </DashboardLayout>
    )
}
