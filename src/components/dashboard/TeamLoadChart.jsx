import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

export const TeamLoadChart = ({ teamData, loading }) => {
    if (loading) {
        return (
            <div className="card h-[450px] flex flex-col">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h2>
                <div className="flex-grow flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                </div>
            </div>
        )
    }

    if (!teamData || teamData.length === 0) {
        return (
            <div className="card h-[450px] flex flex-col">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Performance</h2>
                <div className="flex-grow flex items-center justify-center text-gray-500 italic">
                    Initializing team metrics...
                </div>
            </div>
        )
    }

    const [viewMode, setViewMode] = useState('volume') // 'volume' or 'efficiency'

    const chartData = teamData
        .sort((a, b) => b.total_received - a.total_received)
        .map(member => ({
            name: member.name,
            Answered: member.total_responded || 0,
            Unanswered: Math.max(0, member.unanswered || 0),
            Total: member.total_received || 0,
            Efficiency: member.total_received > 0 
                ? Math.round((member.total_responded / member.total_received) * 100) 
                : 0,
        }))

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white/95 backdrop-blur-sm border border-gray-100 p-4 rounded-xl shadow-xl">
                    <p className="text-sm font-bold text-gray-900 mb-2 capitalize">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 text-xs mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                            <span className="text-gray-600 w-20">{entry.name}:</span>
                            <span className="font-bold text-gray-900">
                                {entry.value}{entry.name.includes('Rate') ? '%' : ''}
                            </span>
                        </div>
                    ))}
                    {viewMode === 'volume' && (
                         <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-3 text-xs font-bold text-primary-600">
                            <span className="w-22">Efficiency:</span>
                            <span>{payload[0].payload.Efficiency}%</span>
                        </div>
                    )}
                </div>
            )
        }
        return null
    }

    return (
        <div className="card h-[450px] flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                        Team Load Distribution
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Comparison of assigned vs. resolved inquiries</p>
                </div>
                
                <div className="flex bg-gray-100/80 p-1 rounded-xl backdrop-blur-sm">
                    <button
                        onClick={() => setViewMode('volume')}
                        className={`text-xs px-4 py-2 rounded-lg transition-all duration-300 font-medium ${
                            viewMode === 'volume' 
                                ? 'bg-white text-primary-600 shadow-md scale-105' 
                                : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        Total Volume
                    </button>
                    <button
                        onClick={() => setViewMode('efficiency')}
                        className={`text-xs px-4 py-2 rounded-lg transition-all duration-300 font-medium ${
                            viewMode === 'efficiency' 
                                ? 'bg-white text-green-600 shadow-md scale-105' 
                                : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        Efficiency %
                    </button>
                </div>
            </div>

            <div className="flex-grow">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }} barGap={8}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis
                            dataKey="name"
                            stroke="#9ca3af"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                            className="capitalize"
                        />
                        <YAxis
                            stroke="#9ca3af"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            unit={viewMode === 'efficiency' ? '%' : ''}
                            domain={viewMode === 'efficiency' ? [0, 100] : [0, 'auto']}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.5 }} transitionDuration={300} />
                        
                        {viewMode === 'volume' ? (
                            <>
                                <Bar 
                                    name="Answered" 
                                    dataKey="Answered" 
                                    radius={[6, 6, 0, 0]}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill="#10b981" fillOpacity={0.8} />
                                    ))}
                                </Bar>
                                <Bar 
                                    name="Unanswered" 
                                    dataKey="Unanswered" 
                                    radius={[6, 6, 0, 0]}
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill="#f43f5e" fillOpacity={0.8} />
                                    ))}
                                </Bar>
                            </>
                        ) : (
                            <Bar 
                                name="Response Rate" 
                                dataKey="Efficiency" 
                                radius={[6, 6, 6, 6]}
                                barSize={40}
                            >
                                {chartData.map((entry, index) => {
                                    const colors = entry.Efficiency > 80 ? '#10b981' : entry.Efficiency > 50 ? '#f59e0b' : '#f43f5e'
                                    return <Cell key={`cell-${index}`} fill={colors} fillOpacity={0.8} />
                                })}
                            </Bar>
                        )}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 opacity-80"></div>
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Resolved</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 opacity-80"></div>
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Pending</span>
                </div>
            </div>
        </div>
    )
}
