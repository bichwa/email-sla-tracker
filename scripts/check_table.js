import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Manual .env loader
const envPath = path.resolve('.env')
if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8')
    env.split('\n').forEach(line => {
        const [key, ...value] = line.split('=')
        if (key && value) {
            process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '')
        }
    })
}

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
)

async function checkTable() {
    console.log('Checking for assignment_rules table...')
    const { data, error } = await supabase.from('assignment_rules').select('*').limit(1)

    if (error) {
        if (error.code === '42P01') {
            console.log('Table assignment_rules does not exist.')
        } else {
            console.error('Error:', error)
        }
    } else {
        console.log('Table assignment_rules exists.')
    }
}

checkTable()
