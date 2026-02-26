import { useState } from 'react'
import { Filter, X } from 'lucide-react'

export const FiltersBar = ({ onFilterChange, employees }) => {
    const [filters, setFilters] = useState({
        employeeEmail: '',
        scenario: '',
        slaBreached: '',
        fromDate: '',
        toDate: '',
    })

    const [showFilters, setShowFilters] = useState(true)

    const handleFilterChange = (key, value) => {
        const newFilters = { ...filters, [key]: value }
        setFilters(newFilters)

        // Clean up empty filters before passing to parent
        const cleanFilters = Object.entries(newFilters).reduce((acc, [k, v]) => {
            if (v !== '') {
                acc[k] = v === 'true' ? true : v === 'false' ? false : v
            }
            return acc
        }, {})

        onFilterChange(cleanFilters)
    }

    const clearFilters = () => {
        setFilters({
            employeeEmail: '',
            scenario: '',
            slaBreached: '',
            fromDate: '',
            toDate: '',
        })
        onFilterChange({})
    }

    const hasActiveFilters = Object.values(filters).some(v => v !== '')

    return (
        <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                    <Filter className="w-4 h-4" />
                    Filters
                    {hasActiveFilters && (
                        <span className="badge-info">Active</span>
                    )}
                </button>
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                    >
                        <X className="w-4 h-4" />
                        Clear All
                    </button>
                )}
            </div>

            {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t border-gray-200 animate-slide-in">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Employee
                        </label>
                        <select
                            value={filters.employeeEmail}
                            onChange={(e) => handleFilterChange('employeeEmail', e.target.value)}
                            className="input text-sm"
                        >
                            <option value="">All Employees</option>
                            {employees?.map((emp) => (
                                <option key={emp.id} value={emp.email}>
                                    {emp.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Scenario
                        </label>
                        <select
                            value={filters.scenario}
                            onChange={(e) => handleFilterChange('scenario', e.target.value)}
                            className="input text-sm"
                        >
                            <option value="">All Scenarios</option>
                            <option value="team_email">Team Email</option>
                            <option value="direct_mention">Direct Mention</option>
                            <option value="individual_inbox">Individual Inbox</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            SLA Status
                        </label>
                        <select
                            value={filters.slaBreached}
                            onChange={(e) => handleFilterChange('slaBreached', e.target.value)}
                            className="input text-sm"
                        >
                            <option value="">All Status</option>
                            <option value="false">Within SLA</option>
                            <option value="true">Breached</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            From Date
                        </label>
                        <input
                            type="date"
                            value={filters.fromDate}
                            onChange={(e) => handleFilterChange('fromDate', e.target.value)}
                            className="input text-sm"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            To Date
                        </label>
                        <input
                            type="date"
                            value={filters.toDate}
                            onChange={(e) => handleFilterChange('toDate', e.target.value)}
                            className="input text-sm"
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
