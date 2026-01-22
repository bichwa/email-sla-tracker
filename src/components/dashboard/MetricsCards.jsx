import { Mail, AlertTriangle, Clock, CheckCircle } from 'lucide-react'

export const MetricsCards = ({ metrics, loading }) => {
    const cards = [
        {
            title: 'Unanswered Emails',
            value: metrics?.unansweredEmails || 0,
            icon: Mail,
            color: 'primary',
            description: 'Awaiting response',
        },
        {
            title: 'SLA Breaches',
            value: metrics?.breachedEmails || 0,
            icon: AlertTriangle,
            color: 'danger',
            description: 'Beyond 15 minutes',
        },
        {
            title: 'Avg Response Time',
            value: `${metrics?.avgResponseTime || 0}m`,
            icon: Clock,
            color: 'warning',
            description: 'Today's average',
    },
        {
            title: 'SLA Compliance',
            value: `${metrics?.slaCompliance || 100}%`,
            icon: CheckCircle,
            color: 'success',
            description: 'Within SLA target',
        },
    ]

    const colorClasses = {
        primary: 'bg-primary-100 text-primary-600',
        danger: 'bg-red-100 text-red-600',
        warning: 'bg-yellow-100 text-yellow-600',
        success: 'bg-green-100 text-green-600',
    }

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="card animate-pulse">
                        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                        <div className="h-8 bg-gray-200 rounded w-1/3 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {cards.map((card) => {
                const Icon = card.icon
                return (
                    <div
                        key={card.title}
                        className="card hover:shadow-md transition-shadow duration-200 animate-fade-in"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-600">{card.title}</h3>
                            <div className={`p-2 rounded-lg ${colorClasses[card.color]}`}>
                                <Icon className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mb-2">
                            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                        </div>
                        <p className="text-xs text-gray-500">{card.description}</p>
                    </div>
                )
            })}
        </div>
    )
}
