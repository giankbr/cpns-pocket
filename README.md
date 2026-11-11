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
The `ANTHROPIC_API_KEY` is used by the server-side AI assistant and must never use a `NEXT_PUBLIC_` prefix. Set `ANTHROPIC_MODEL` to the model ID enabled for your Anthropic account. AI requests are limited by `AI_DAILY_REQUEST_LIMIT` per user.

Public registration is disabled. Create invite-only users through the Supabase dashboard or the admin flow once it is enabled.

## Vercel deployment

Vercel Hobby and Supabase Free can be used for an initial personal deployment. Add the variables from `.env.example` in the Vercel project settings. Use the hosted Supabase project URL and anon key instead of the local values, and run migrations against that project with the Supabase CLI before deploying.

Supabase Free currently has usage limits and may pause projects after inactivity. Anthropic API usage is billed separately by token, so keep the daily limit enabled and monitor the Anthropic console.

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
- Be Vietnam Pro typography and an authenticated Anthropic AI chat with a server-side daily quota.

Practice sessions, CAT simulation, Mini Mode, practice-context AI, and administration are implemented in later phases without exposing answer keys to learner-facing queries.
