import { useState } from 'react'
import { DashboardLayout } from '../../components/layout/DashboardLayout'
import { useClassificationRules } from '../../hooks/useQueries'
import { supabase } from '../../lib/supabase'
import { Plus, Edit, Trash2, Power, PowerOff, Save, X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

export const RulesManagement = () => {
    const { data: rules, isLoading } = useClassificationRules()
    const [editingRule, setEditingRule] = useState(null)
    const [isAddingNew, setIsAddingNew] = useState(false)
    const queryClient = useQueryClient()

    const [formData, setFormData] = useState({
        rule_name: '',
        rule_type: 'sender_domain',
        rule_value: '',
        classification: 'client_email',
        is_active: true,
        priority: 10,
        description: '',
    })

    // Toggle rule active status
    const toggleMutation = useMutation({
        mutationFn: async ({ id, is_active }) => {
            const { error } = await supabase
                .from('email_classification_rules')
                .update({ is_active })
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['classification-rules'])
        },
    })

    // Delete rule
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase
                .from('email_classification_rules')
                .delete()
                .eq('id', id)

            if (error) throw error
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['classification-rules'])
        },
    })

    // Create or update rule
    const saveMutation = useMutation({
        mutationFn: async (ruleData) => {
            if (editingRule) {
                const { error } = await supabase
                    .from('email_classification_rules')
                    .update(ruleData)
                    .eq('id', editingRule.id)

                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('email_classification_rules')
                    .insert([ruleData])

                if (error) throw error
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['classification-rules'])
            setEditingRule(null)
            setIsAddingNew(false)
            resetForm()
        },
    })

    const resetForm = () => {
        setFormData({
            rule_name: '',
            rule_type: 'sender_domain',
            rule_value: '',
            classification: 'client_email',
            is_active: true,
            priority: 10,
            description: '',
        })
    }

    const handleEdit = (rule) => {
        setEditingRule(rule)
        setFormData({
            rule_name: rule.rule_name,
            rule_type: rule.rule_type,
            rule_value: rule.rule_value,
            classification: rule.classification,
            is_active: rule.is_active,
            priority: rule.priority,
            description: rule.description || '',
        })
        setIsAddingNew(true)
    }

    const handleSave = () => {
        saveMutation.mutate(formData)
    }

    const handleCancel = () => {
        setEditingRule(null)
        setIsAddingNew(false)
        resetForm()
    }

    const classificationBadges = {
        client_email: 'badge-success',
        system_generated: 'badge-info',
        solver_email: 'badge-warning',
        internal: 'badge bg-gray-100 text-gray-800',
    }

    const ruleTypeLables = {
        sender_domain: 'Sender Domain',
        subject_pattern: 'Subject Pattern',
        sender_email: 'Sender Email',
        keyword: 'Keyword',
        body_pattern: 'Body Pattern',
    }

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Classification Rules</h1>
                <p className="text-gray-600 mt-1">Manage email classification rules and priorities</p>
            </div>

            {/* Add New Rule Button */}
            {!isAddingNew && (
                <div className="mb-6">
                    <button
                        onClick={() => setIsAddingNew(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add New Rule
                    </button>
                </div>
            )}

            {/* Add/Edit Form */}
            {isAddingNew && (
                <div className="card mb-6 animate-slide-in">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {editingRule ? 'Edit Rule' : 'New Rule'}
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Rule Name *
                            </label>
                            <input
                                type="text"
                                value={formData.rule_name}
                                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                                className="input"
                                placeholder="e.g., System Status Updates"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Rule Type *
                            </label>
                            <select
                                value={formData.rule_type}
                                onChange={(e) => setFormData({ ...formData, rule_type: e.target.value })}
                                className="input"
                            >
                                <option value="sender_domain">Sender Domain</option>
                                <option value="sender_email">Sender Email</option>
                                <option value="subject_pattern">Subject Pattern</option>
                                <option value="keyword">Keyword</option>
                                <option value="body_pattern">Body Pattern</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Rule Value *
                            </label>
                            <input
                                type="text"
                                value={formData.rule_value}
                                onChange={(e) => setFormData({ ...formData, rule_value: e.target.value })}
                                className="input"
                                placeholder="e.g., @solvit.co.ke or ^$"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Classification *
                            </label>
                            <select
                                value={formData.classification}
                                onChange={(e) => setFormData({ ...formData, classification: e.target.value })}
                                className="input"
                            >
                                <option value="client_email">Client Email (Actionable)</option>
                                <option value="system_generated">System Generated</option>
                                <option value="solver_email">Solver Email</option>
                                <option value="internal">Internal</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Priority *
                            </label>
                            <input
                                type="number"
                                value={formData.priority}
                                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                className="input"
                                min="1"
                                placeholder="Lower number = higher priority"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Status
                            </label>
                            <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                />
                                <label htmlFor="is_active" className="text-sm text-gray-700">
                                    Active
                                </label>
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="input"
                                rows="2"
                                placeholder="Optional description of this rule"
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saveMutation.isLoading || !formData.rule_name || !formData.rule_value}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {saveMutation.isLoading ? 'Saving...' : 'Save Rule'}
                        </button>
                        <button
                            onClick={handleCancel}
                            className="btn-secondary flex items-center gap-2"
                        >
                            <X className="w-4 h-4" />
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Rules List */}
            <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Active Rules ({rules?.filter(r => r.is_active).length || 0})
                </h3>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                <th className="pb-3 pr-6">Priority</th>
                                <th className="pb-3 pr-6">Rule Name</th>
                                <th className="pb-3 pr-6">Type</th>
                                <th className="pb-3 pr-6">Value</th>
                                <th className="pb-3 pr-6">Classification</th>
                                <th className="pb-3 pr-6">Status</th>
                                <th className="pb-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {rules?.map((rule) => (
                                <tr key={rule.id} className="hover:bg-gray-50">
                                    <td className="py-4 pr-6">
                                        <span className="text-sm font-medium text-gray-900">{rule.priority}</span>
                                    </td>
                                    <td className="py-4 pr-6">
                                        <div className="text-sm font-medium text-gray-900">{rule.rule_name}</div>
                                        {rule.description && (
                                            <div className="text-xs text-gray-500 mt-1">{rule.description}</div>
                                        )}
                                    </td>
                                    <td className="py-4 pr-6">
                                        <span className="text-sm text-gray-600">
                                            {ruleTypeLables[rule.rule_type] || rule.rule_type}
                                        </span>
                                    </td>
                                    <td className="py-4 pr-6">
                                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                            {rule.rule_value}
                                        </code>
                                    </td>
                                    <td className="py-4 pr-6">
                                        <span className={classificationBadges[rule.classification] || 'badge'}>
                                            {rule.classification.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="py-4 pr-6">
                                        <button
                                            onClick={() => toggleMutation.mutate({ id: rule.id, is_active: !rule.is_active })}
                                            disabled={toggleMutation.isLoading}
                                            className="flex items-center gap-1 text-sm"
                                        >
                                            {rule.is_active ? (
                                                <>
                                                    <Power className="w-4 h-4 text-green-600" />
                                                    <span className="text-green-600">Active</span>
                                                </>
                                            ) : (
                                                <>
                                                    <PowerOff className="w-4 h-4 text-gray-400" />
                                                    <span className="text-gray-400">Inactive</span>
                                                </>
                                            )}
                                        </button>
                                    </td>
                                    <td className="py-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleEdit(rule)}
                                                className="text-primary-600 hover:text-primary-700"
                                                title="Edit"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Are you sure you want to delete this rule?')) {
                                                        deleteMutation.mutate(rule.id)
                                                    }
                                                }}
                                                disabled={deleteMutation.isLoading}
                                                className="text-red-600 hover:text-red-700"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    )
}
