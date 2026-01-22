import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export const TeamLoadChart = ({ teamData, loading }) => {
    if (loading) {
        return (
            <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Load Distribution</h2>
                <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
            </div>
        )
    }

    if (!teamData || teamData.length === 0) {
        return (
            <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Load Distribution</h2>
                <div className="h-64 flex items-center justify-center text-gray-500">
                    No data available
                </div>
            </div>
        )
    }

    const chartData = teamData.map(member => ({
        name: member.name,
        Total: member.total_received || 0,
        Responded: member.total_responded || 0,
        Unanswered: member.unanswered || 0,
    }))

    return (
        <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Team Load Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                        }}
                    />
                    <Legend />
                    <Bar dataKey="Responded" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Unanswered" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
