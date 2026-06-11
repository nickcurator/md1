# md1

Standalone markdown notes — [md1.space](https://md1.space)

Repo: https://github.com/nickcurator/md1

## Dev

```bash
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

## Deploy (Vercel)

1. Import **nickcurator/md1** (root is repo root — no monorepo subfolder)
2. Env vars from `.env.example`
3. Supabase redirect: `https://md1.space/api/auth/callback`
4. Domain: `md1.space`

## Database

Same Supabase project as Newt (`drive_users`, `shared_docs`).  
Migrations in `supabase/migrations/` are reference only — already applied.
