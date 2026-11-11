# CPNS Pocket

CPNS Pocket is a private learning workspace for CPNS preparation. It uses Next.js, TypeScript, Tailwind CSS, and Supabase.

## Local setup

Requirements: Node.js 20+, npm, and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npm install
cp .env.example .env.local
supabase start
supabase db reset
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` from `supabase status`. The service-role key is only needed for future invite administration and must never be exposed to the browser.
The `ANTHROPIC_API_KEY` will be used by the server-side AI assistant and must never use a `NEXT_PUBLIC_` prefix.

Public registration is disabled. Create invite-only users through the Supabase dashboard or the admin flow once it is enabled.

## Commands

```bash
npm run dev
npm run lint
npm run build
```

The database starts empty by design. Questions and learning materials are not fabricated seed content and should be added through an authenticated content administration workflow.

## Current foundation

- Private email/password login backed by Supabase Auth.
- Middleware session refresh and protected dashboard route.
- Empty-state dashboard for study metrics and subjects.
- Supabase CLI schema with RLS for profiles, learning content, sessions, answers, bookmarks, and exam configurations.
- Answer keys are stored separately from learner-visible question options.

Practice sessions, CAT simulation, Mini Mode, and administration are implemented in later phases without exposing answer keys to learner-facing queries.
