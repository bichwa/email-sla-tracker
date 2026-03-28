import { Info, Mail, CheckCircle, AlertTriangle, Clock } from 'lucide-react'

export const DashboardKey = () => {
    const definitions = [
        {
            title: 'Unanswered Emails',
            description: 'Incoming client emails that are currently awaiting a response from your team.',
            icon: Mail,
            color: 'text-primary-600',
            bgColor: 'bg-primary-50'
        },
        {
            title: 'Answered Emails',
            description: 'Successfully identified responses sent by staff to client inquiries today.',
            icon: CheckCircle,
            color: 'text-green-600',
            bgColor: 'bg-green-50'
        },
        {
            title: 'SLA Breaches',
            description: 'Emails that did not receive a response within our 30-minute target.',
            icon: AlertTriangle,
            color: 'text-red-600',
            bgColor: 'bg-red-50'
        },
        {
            title: 'SLA Compliance',
            description: 'The overall health percentage of emails managed within the 30-minute SLA.',
            icon: CheckCircle,
            color: 'text-green-600',
            bgColor: 'bg-green-50'
        },
        {
            title: 'Avg Response Time',
            description: 'The average time taken to respond to emails received in the last 24 hours.',
            icon: Clock,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-50'
        }
    ]

    return (
        <div className="card mt-6">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-4">
                <Info className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900">Metrics Glossary</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {definitions.map((def) => {
                    const Icon = def.icon
                    return (
                        <div key={def.title} className="flex gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                            <div className={`p-2 rounded-lg h-fit ${def.bgColor}`}>
                                <Icon className={`w-4 h-4 ${def.color}`} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-800">{def.title}</h3>
                                <p className="text-xs text-gray-500 leading-relaxed mt-1">
                                    {def.description}
                                </p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
