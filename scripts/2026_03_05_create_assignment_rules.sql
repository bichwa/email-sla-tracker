-- v2.9 Database Migration: Assignment Rules
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)

CREATE TABLE IF NOT EXISTS assignment_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    priority INTEGER NOT NULL DEFAULT 10,
    rule_type TEXT NOT NULL, -- 'domain', 'keyword', 'mention'
    rule_value TEXT NOT NULL,
    assignee_email TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE assignment_rules ENABLE ROW LEVEL SECURITY;

-- Allow read for authenticated users
CREATE POLICY "Allow read for authenticated users" ON assignment_rules
    FOR SELECT TO authenticated USING (true);

-- Allow full access for admins (assuming we use the service key for sync, this might not be strictly needed for the sync script but good for management)
CREATE POLICY "Admins have full access" ON assignment_rules
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE email = auth.jwt() ->> 'email' 
            AND is_admin = true
        )
    );

-- Initial data from team assignments
INSERT INTO assignment_rules (priority, rule_type, rule_value, assignee_email, description) VALUES
-- Irene Odago
(10, 'domain', 'apainsurance', 'iodago@solvit.co.ke', 'APA Insurance'),
(10, 'domain', 'apalife', 'iodago@solvit.co.ke', 'APA Life'),
(10, 'domain', 'fidelityshield', 'iodago@solvit.co.ke', 'Fidelity Shield'),
(10, 'domain', 'ga-insurance', 'iodago@solvit.co.ke', 'GA Insurance'),
(10, 'domain', 'madison.co', 'iodago@solvit.co.ke', 'Madison'),
(10, 'domain', 'pioneerassurance', 'iodago@solvit.co.ke', 'Pioneer'),
(10, 'domain', 'icealion', 'iodago@solvit.co.ke', 'ICEA Lion'),
(10, 'domain', 'directline.co', 'iodago@solvit.co.ke', 'Directline'),
(10, 'domain', 'dtbafrica', 'iodago@solvit.co.ke', 'DTB'),
(10, 'domain', 'ncbagroup', 'iodago@solvit.co.ke', 'NCBA'),

-- Joyce Mungasi
(10, 'domain', 'oldmutual', 'jmungasi@solvit.co.ke', 'Old Mutual'),
(10, 'domain', 'heritage.co', 'jmungasi@solvit.co.ke', 'Heritage'),
(10, 'domain', 'cannon.co', 'jmungasi@solvit.co.ke', 'Cannon'),
(10, 'domain', 'corporatekenya', 'jmungasi@solvit.co.ke', 'Corporate Kenya'),
(10, 'domain', 'cickenya', 'jmungasi@solvit.co.ke', 'CIC (Joyce)'),
(10, 'domain', 'definite', 'jmungasi@solvit.co.ke', 'Definite'),
(10, 'domain', 'monarchinsurance', 'jmungasi@solvit.co.ke', 'Monarch'),
(10, 'domain', 'stima-sacco', 'jmungasi@solvit.co.ke', 'Stima Sacco'),

-- Virginia Musyoka
(10, 'domain', 'takaful', 'vmusyoka@solvit.co.ke', 'Takaful'),
(10, 'domain', 'mayfair.co', 'vmusyoka@solvit.co.ke', 'Mayfair'),
(10, 'domain', 'cic.co', 'vmusyoka@solvit.co.ke', 'CIC (Virginia)'),
(10, 'domain', 'occidental-ins', 'vmusyoka@solvit.co.ke', 'Occidental'),
(10, 'domain', 'kenindia', 'vmusyoka@solvit.co.ke', 'Kenindia'),
(10, 'domain', 'sanlam', 'vmusyoka@solvit.co.ke', 'Sanlam'),
(10, 'domain', 'jubilee', 'vmusyoka@solvit.co.ke', 'Jubilee'),
(10, 'domain', 'allianz', 'vmusyoka@solvit.co.ke', 'Allianz'),

-- Belinda Achieng
(10, 'domain', 'firstassurance', 'bachieng@solvit.co.ke', 'First Assurance'),
(10, 'domain', 'pacis', 'bachieng@solvit.co.ke', 'Pacis'),
(10, 'domain', 'britam', 'bachieng@solvit.co.ke', 'Britam'),
(10, 'domain', 'amaco', 'bachieng@solvit.co.ke', 'Amaco'),
(10, 'domain', 'geminia', 'bachieng@solvit.co.ke', 'Geminia'),
(10, 'domain', 'mua.co', 'bachieng@solvit.co.ke', 'MUA'),
(10, 'domain', 'realpeople', 'bachieng@solvit.co.ke', 'Real People'),
(10, 'domain', 'innovexsolutions', 'bachieng@solvit.co.ke', 'Innovex'),

-- Mercy Odondi
(10, 'domain', 'intrafrica', 'modondi@solvit.co.ke', 'Intra Africa'),
(10, 'domain', 'aar.co', 'modondi@solvit.co.ke', 'AAR'),
(10, 'domain', 'starinsurance', 'modondi@solvit.co.ke', 'Star Insurance'),
(10, 'domain', 'jiajiri', 'modondi@solvit.co.ke', 'Jiajiri'),

-- Mention & Keyword examples
(2, 'mention', 'irene', 'iodago@solvit.co.ke', 'Mention of Irene'),
(2, 'mention', 'joyce', 'jmungasi@solvit.co.ke', 'Mention of Joyce'),
(5, 'keyword', 'valuation request', 'iodago@solvit.co.ke', 'Valuation Requests (Assigned to Account Team)')
ON CONFLICT DO NOTHING;
