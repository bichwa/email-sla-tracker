/**
 * Master Sync Endpoint
 * Triggers both Email Sync and Response Detection
 */

export default async function handler(req, res) {
    const cronSecret = req.query.cronSecret || req.body?.cronSecret || req.headers['cronsecret']
    const cleanSecret = (cronSecret || '').replace(/^Bearer\s+/i, '').trim()

    if (!cleanSecret || cleanSecret !== (process.env.CRON_SECRET || '').replace(/^Bearer\s+/i, '').trim()) {
        return res.status(401).json({ error: 'Unauthorized: Invalid cronSecret' })
    }

    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://${req.headers.host}`

    try {
        console.log('Starting Master Sync...')

        // Use Fetch to trigger the other endpoints internally
        // We pass the same secret
        const [syncRes, detectRes] = await Promise.all([
            fetch(`${baseUrl}/api/sync-emails`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cronSecret: cleanSecret })
            }),
            fetch(`${baseUrl}/api/detect-responses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cronSecret: cleanSecret })
            })
        ])

        const syncData = await syncRes.json()
        const detectData = await detectRes.json()

        return res.status(200).json({
            success: true,
            sync: syncData,
            detect: detectData,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Master Sync Failed',
            message: error.message
        })
    }
}
