import { useState } from 'react'
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

    const [viewMode, setViewMode] = useState('volume') // 'volume' or 'performance'

    const chartData = teamData.map(member => ({
        name: member.name,
        Responded: member.total_responded || 0,
        Unanswered: member.unanswered || 0,
        Performance: member.total_received > 0 
            ? Math.round((member.total_responded / member.total_received) * 100) 
            : 0,
    }))

    return (
        <div className="card h-full">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Team Performance</h2>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('volume')}
                        className={`text-xs px-3 py-1 rounded-md transition-all ${
                            viewMode === 'volume' 
                                ? 'bg-white text-gray-900 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Volume
                    </button>
                    <button
                        onClick={() => setViewMode('performance')}
                        className={`text-xs px-3 py-1 rounded-md transition-all ${
                            viewMode === 'performance' 
                                ? 'bg-white text-gray-900 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Response Rate %
                    </button>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                        dataKey="name"
                        stroke="#6b7280"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke="#6b7280"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        unit={viewMode === 'performance' ? '%' : ''}
                        domain={viewMode === 'performance' ? [0, 100] : [0, 'auto']}
                    />
                    <Tooltip
                        cursor={{ fill: '#f3f4f6' }}
                        contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '0.5rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    
                    {viewMode === 'volume' ? (
                        <>
                            <Bar name="Answered" dataKey="Responded" stackId="a" fill="#10b981" />
                            <Bar name="Unanswered" dataKey="Unanswered" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </>
                    ) : (
                        <Bar 
                            name="Response Rate (%)" 
                            dataKey="Performance" 
                            fill="#10b981" 
                            radius={[4, 4, 0, 0]} 
                            label={{ position: 'top', fontSize: 10, fill: '#6b7280' }}
                        />
                    )}
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
