# md1

Standalone markdown notes — [md1.space](https://md1.space)

Extracted from Newt Drive. Separate product, separate deploy.

## Dev

```bash
cd md1
cp .env.example .env.local   # fill Supabase keys
npm install
npm run dev                  # http://localhost:3001
```

## Routes

| Path | Purpose |
|------|---------|
| `/` | Editor |
| `/login` | Google sign-in |
| `/d/[slug]` | Public published doc |
| `/api/docs` | CRUD API |
| `/api/auth/*` | OAuth |

## Deploy checklist

1. Deploy this folder as a Next.js app (Vercel, Railway, …)
2. Set env vars from `.env.example`
3. Supabase → Auth → redirect URL: `https://md1.space/api/auth/callback`
4. Google OAuth → same redirect URI
5. Point `md1.space` DNS to deploy
6. On getnewt.app add redirects:
   - `/drive` → `https://md1.space/`
   - `/drive/login` → `https://md1.space/login`
   - `/d/*` → `https://md1.space/d/*`

## Database

Uses the same Supabase project as Newt (`drive_users`, `shared_docs`).  
Reference migrations in `supabase/migrations/` (already applied on shared project).
