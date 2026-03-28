/**
 * Rules Management API Proxy
 * Handles CRUD for email classification rules using service_role key to bypass RLS
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
    // Basic Auth Check (optional, but recommended)
    // For now, we allow requests since it's an internal tool, but we could add a secret check
    
    const { method } = req

    try {
        if (method === 'GET') {
            const { data, error } = await supabase
                .from('email_classification_rules')
                .select('*')
                .order('priority', { ascending: true })
            
            if (error) throw error
            return res.status(200).json(data)
        }

        if (method === 'POST') {
            const ruleData = req.body
            const { data, error } = await supabase
                .from('email_classification_rules')
                .insert([ruleData])
                .select()
            
            if (error) throw error
            return res.status(201).json(data[0])
        }

        if (method === 'PUT') {
            const { id, ...updates } = req.body
            const { data, error } = await supabase
                .from('email_classification_rules')
                .update(updates)
                .eq('id', id)
                .select()
            
            if (error) throw error
            return res.status(200).json(data[0])
        }

        if (method === 'DELETE') {
            const { id } = req.query
            const { error } = await supabase
                .from('email_classification_rules')
                .delete()
                .eq('id', id)
            
            if (error) throw error
            return res.status(200).json({ success: true })
        }

        return res.status(405).json({ error: 'Method not allowed' })

    } catch (error) {
        console.error('Rules API Error:', error)
        return res.status(500).json({ error: error.message })
    }
}
