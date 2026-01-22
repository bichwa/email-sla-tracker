# Email SLA Tracker v2 - Deployment Guide

## Prerequisites

Before deploying, ensure you have:

1. **Microsoft Entra ID Application** registered with:
   - Application (client) ID
   - Tenant ID
   - API permissions: `User.Read`, `Mail.Read`, `Mail.ReadWrite`

2. **Supabase Project** set up with:
   - Project URL
   - Anon key (for frontend)
   - Service role key (for backend API functions)
   - Database schema deployed (see `database-schema.sql`)

3. **Vercel Account** (free tier works)

---

## Environment Variables Setup

### Frontend Variables (VITE_)

Create a `.env` file in the project root:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# Microsoft Entra ID
VITE_MICROSOFT_CLIENT_ID=your_client_id_here
VITE_MICROSOFT_TENANT_ID=your_tenant_id_here
VITE_MICROSOFT_REDIRECT_URI=https://your-domain.vercel.app/auth/callback

# Optional
VITE_DEFAULT_SLA_MINUTES=15
```

### Backend Variables (for Vercel)

In Vercel project settings, add these environment variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

**IMPORTANT**: `SUPABASE_SERVICE_KEY` must be the **service role key**, not the anon key!

---

## Deployment Steps

### 1. Deploy Database Schema

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste your database schema
4. Run the SQL script
5. Verify tables are created

### 2. Configure Supabase Auth

1. In Supabase Dashboard → **Authentication** → **Providers**
2. Enable **Azure** provider
3. Configure with your Microsoft application details:
   - Azure Tenant ID
   - Azure Client ID
   - Azure Client Secret (if using)
4. Add redirect URL: `https://your-project.supabase.co/auth/v1/callback`

### 3. Add Employees to Database

Run SQL in Supabase to add employees:

```sql
INSERT INTO employees (email, name, is_admin, is_client_facing) VALUES
  ('grace@solvit.co.ke', 'Grace Mungai', true, true),
  ('jessica@solvit.co.ke', 'Jessica Mining', true, true),
  ('joyce@solvit.co.ke', 'Joyce', false, true),
  ('mercy@solvit.co.ke', 'Mercy', false, true),
  ('bmuthama@solvit.co.ke', 'Brian Muthama', false, true)
ON CONFLICT (email) DO NOTHING;
```

### 4. Deploy to Vercel

#### Option A: Via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Option B: Via GitHub Integration

1. Push code to GitHub repository
2. Go to [Vercel Dashboard](https://vercel.com)
3. Click **Add New Project**
4. Import your GitHub repository
5. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add environment variables from step 1
7. Click **Deploy**

### 5. Configure OAuth Redirect

After deployment:

1. Note your Vercel URL (e.g., `https://email-sla-tracker.vercel.app`)
2. Update Microsoft Entra ID app registration:
   - Add redirect URI: `https://your-domain.vercel.app/auth/callback`
   - Add redirect URI: `https://your-project.supabase.co/auth/v1/callback`
3. Update Supabase OAuth settings with the same URIs
4. Update `.env` file with production URL

---

## Post-Deployment Configuration

### Set Up Email Sync

The email sync needs to be triggered manually or scheduled. You have two options:

#### Option 1: Manual Trigger (for testing)

Create a simple UI button that calls:

```javascript
const syncEmails = async () => {
  const accessToken = await getAccessToken()
  const response = await fetch('/api/sync-emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
  })
  return response.json()
}
```

#### Option 2: Scheduled Sync (recommended)

Add another cron job to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/sync-emails",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/detect-responses",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/calculate-metrics",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Note**: Vercel cron jobs on the free tier are limited. Consider upgrading or using an external service like GitHub Actions.

### Configure Classification Rules

1. Log in as an admin user
2. Go to **Rules Management**
3. Add classification rules based on your email patterns:
   - System-generated emails
   - Solver emails
   - Internal emails

Example rules:
- **Type**: Sender Domain, **Value**: `@solvit.co.ke`, **Classification**: Internal
- **Type**: Subject Pattern, **Value**: `^$`, **Classification**: Solver Email
- **Type**: Sender Email, **Value**: `noreply@system.com`, **Classification**: System Generated

---

## Testing Checklist

- [ ] Authentication works with Microsoft account
- [ ] Dashboard loads and shows metrics
- [ ] Filters work correctly
- [ ] Email sync runs successfully
- [ ] Response detection works
- [ ] SLA calculations are accurate
- [ ] Admin can manage rules
- [ ] Daily metrics job runs at midnight

---

## Troubleshooting

### Authentication Issues

**Problem**: "Sign in failed" or redirect loop

**Solutions**:
1. Verify redirect URIs match exactly in both Microsoft and Supabase
2. Check that Microsoft app has correct API permissions
3. Ensure tenant ID and client ID are correct
4. Clear browser cache and cookies

### Email Sync Not Working

**Problem**: No emails appearing in dashboard

**Solutions**:
1. Check Vercel function logs for errors
2. Verify `SUPABASE_SERVICE_KEY` is set (not anon key)
3. Ensure Microsoft Graph API permissions are granted and admin-consented
4. Check employee emails match Microsoft mailboxes exactly

### SLA Calculations Incorrect

**Problem**: SLA breach status is wrong

**Solutions**:
1. Verify database triggers are created (`calculate_sla_deadline`, `check_sla_breach`)
2. Check `sla_target_minutes` in `system_config` table
3. Ensure response detection is running

### Performance Issues

**Problem**: Dashboard loads slowly

**Solutions**:
1. Add indexes to frequently queried columns
2. Limit date range in queries
3. Use views for complex aggregations
4. Enable database query caching

---

## Monitoring

### Vercel Logs

View function logs in Vercel Dashboard:
- Go to **Deployments** → Select deployment → **Functions**
- View real-time logs and errors

### Supabase Logs

Monitor database queries:
- Supabase Dashboard → **Logs** → **Postgres Logs**
- Check for slow queries or errors

### Daily Health Check

Monitor:
- Number of emails synced daily
- SLA compliance percentage
- Response detection accuracy
- Cron job execution

---

## Maintenance

### Weekly Tasks
- Review SLA breach trends
- Check classification rule accuracy
- Monitor error logs

### Monthly Tasks
- Review and update classification rules
- Audit employee list
- Check system performance metrics

### Updates
- Keep dependencies updated: `npm audit fix`
- Monitor Supabase and Vercel for service updates
- Review Microsoft Graph API changes

---

## Support

For issues or questions:
1. Check Vercel function logs
2. Check Supabase logs
3. Review Microsoft Graph API documentation
4. Contact development team

---

## Next Steps (Future Enhancements)

- [ ] Implement webhook subscriptions for real-time email updates
- [ ] Add email notification system for SLA breaches
- [ ] Create detailed analytics and reporting
- [ ] Build mobile app
- [ ] Add multi-tenant support for commercialization
- [ ] Implement AI-powered email classification
