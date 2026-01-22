# Email SLA Tracker v2.0

Production-ready email SLA tracking system for Solvit Limited.

## Features

- Real-time email tracking and SLA monitoring
- Microsoft Graph API integration
- Supabase PostgreSQL backend
- Microsoft Entra ID authentication
- Automated email classification
- Team performance dashboard
- Daily summary reporting

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with your credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MICROSOFT_CLIENT_ID=your_client_id
VITE_MICROSOFT_TENANT_ID=your_tenant_id
VITE_MICROSOFT_REDIRECT_URI=http://localhost:5173/auth/callback
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Deployment

Deploy to Vercel:
```bash
vercel --prod
```

## Technology Stack

- **Frontend**: React 19 + Vite 7
- **Styling**: TailwindCSS
- **State Management**: React Query
- **Authentication**: Supabase Auth + Microsoft Entra ID
- **Database**: Supabase PostgreSQL
- **API**: Microsoft Graph API
- **Hosting**: Vercel

## License

Proprietary - Solvit Limited
