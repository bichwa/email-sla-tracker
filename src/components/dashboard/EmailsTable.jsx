import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Mail, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'

export const EmailsTable = ({ emails, totalCount = 0, loading, title = 'Emails' }) => {
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    if (loading) {
        // ... loading state logic ...
        return (
            <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="animate-pulse flex gap-4 border-b border-gray-200 pb-3">
                            <div className="flex-1">
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                            <div className="h-6 bg-gray-200 rounded w-20"></div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (!emails || emails.length === 0) {
        return (
            <div className="card text-center py-12">
                <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No {title} Found</h3>
                <p className="text-gray-600">No emails match the current filters.</p>
            </div>
        )
    }

    // Pagination Logic
    const totalPages = Math.ceil(emails.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const currentEmails = emails.slice(startIndex, startIndex + itemsPerPage)

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage)
        }
    }

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        {title}
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Total {totalCount.toLocaleString()} {title.toLowerCase()} tracked
                    </p>
                </div>
                <span className="text-sm text-gray-500 font-medium bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                    Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, emails.length)} of {emails.length} items
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 mb-4">
                    <thead>
                        <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <th className="pb-3 pr-6">Subject</th>
                            <th className="pb-3 pr-6">From</th>
                            <th className="pb-3 pr-6">To</th>
                            <th className="pb-3 pr-6">Responsible</th>
                            <th className="pb-3 pr-6">Received</th>
                            <th className="pb-3 pr-6">Waiting</th>
                            <th className="pb-3">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {currentEmails.map((email) => {
                            const minutesWaiting = Math.floor(email.minutes_waiting || 0)
                            const isBreached = email.sla_breached

                            return (
                                <tr
                                    key={email.id}
                                    className={`hover:bg-gray-50 transition-colors ${isBreached ? 'bg-red-50' : ''
                                        }`}
                                >
                                    <td className="py-4 pr-6">
                                        <div className="max-w-xs">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {email.subject || '(No Subject)'}
                                            </p>
                                            {email.body_preview && (
                                                <p className="text-xs text-gray-500 truncate mt-1">
                                                    {email.body_preview}
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 pr-6">
                                        <div className="text-sm text-gray-900">{email.from_name || email.from_email}</div>
                                        <div className="text-xs text-gray-500">{email.from_email}</div>
                                    </td>
                                    <td className="py-4 pr-6">
                                        <div className="text-sm text-gray-600">{email.to_email}</div>
                                    </td>
                                    <td className="py-4 pr-6">
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm text-gray-900">
                                                {email.responsible_employee_email || 'Team'}
                                            </div>
                                            {email.scenario === 'direct_mention' && (
                                                <span className="badge badge-info text-xs">@mention</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-4 pr-6">
                                        <div className="text-sm text-gray-600">
                                            {new Date(email.received_at).toLocaleString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                            })}
                                        </div>
                                    </td>
                                    <td className="py-4 pr-6">
                                        <div className={`text-sm font-medium ${isBreached ? 'text-red-600' : 'text-gray-900'}`}>
                                            {minutesWaiting}m
                                        </div>
                                    </td>
                                    <td className="py-4">
                                        {isBreached ? (
                                            <span className="badge-danger">
                                                Breached
                                            </span>
                                        ) : (
                                            <span className="badge-success">
                                                On Track
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="btn-secondary flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                </button>
                <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                </span>
                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="btn-secondary flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1"
                >
                    Next
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
