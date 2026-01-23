/**
 * Diagnostic endpoint to check environment variables and secret matching
 * Usage: /api/debug?secret=YOUR_CRON_SECRET
 */

export default async function handler(req, res) {
    const { secret } = req.query

    const envCronSecret = process.env.CRON_SECRET || ''

    // Normalize both for comparison
    const providedSecret = (secret || '').replace(/^Bearer\s+/i, '').trim()
    const storedSecret = envCronSecret.replace(/^Bearer\s+/i, '').trim()

    const isMatch = providedSecret === storedSecret && storedSecret !== ''

    return res.status(200).json({
        diagnostics: {
            isCronSecretMatch: isMatch,
            providedLength: providedSecret.length,
            storedLength: storedSecret.length,
            has_VITE_MICROSOFT_TENANT_ID: !!process.env.VITE_MICROSOFT_TENANT_ID,
            has_VITE_MICROSOFT_CLIENT_ID: !!process.env.VITE_MICROSOFT_CLIENT_ID,
            has_MICROSOFT_CLIENT_SECRET: !!process.env.MICROSOFT_CLIENT_SECRET,
            has_SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
            has_VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
            node_env: process.env.NODE_ENV
        },
        hint: isMatch ? 'Secret matches! Your issue is likely Microsoft Permissions or Tenant ID.' : 'Secret MISMATCH. Check your Vercel Environment Variables.'
    })
}
