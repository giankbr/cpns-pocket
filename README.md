# CPOCKET

CPOCKET is a private study workspace for Indonesian CPNS preparation (SKD: TWK, TIU, TKP, plus SKB English). Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Supabase, and the Anthropic API.

## Features

- **Dashboard**: questions answered, accuracy, study time, streak, daily target, 14-day activity, progress per subject, recent sessions.
- **Materi**: subjects → topics → learning materials.
- **Latihan Soal**: filter by subject, topic, difficulty, and status (unanswered, previously wrong, bookmarked). Each answer is checked on the server with key + explanation; TKP shows weighted scores (1–5). Sessions can be resumed.
- **Simulasi CAT**: configurable presets (`exam_configurations`) or custom subjects/count/duration. Countdown, autosave, auto-submit on timeout, confirmation before finishing, navigation grid. Answers are scored only after the session ends.
- **Hasil**: total score, correct/incorrect/blank, score per subject, full review with explanations.
- **Mode mini (Daily Challenge)**: floating window via the Document Picture-in-Picture API (inline panel / bottom sheet fallback). Available on every page, survives navigation, with a question tab (current session or a quick daily challenge) and a shared **Tanya AI** chat.
- **Bookmark & Riwayat**, light/dark/system theme, responsive down to phone width.

Answer keys live in `question_answer_keys`, which has no client policies. Sessions are created, answered, and scored through `SECURITY DEFINER` functions (`start_study_session`, `submit_answer`, `finish_study_session`, `get_session_feedback`), so keys never reach the browser before an answer is evaluated.

## Local setup

Requirements: Node.js 22+ (scripts and tests run TypeScript directly), npm, a Supabase project.

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project URL and anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/scripts only (content import). Never expose to the browser. |
| `ANTHROPIC_API_KEY` | A standard API key (`sk-ant-api03-…`) from the Anthropic Console. Server-side only. |
| `ANTHROPIC_WORKSPACE_ID` | Only needed for keys that are not scoped to a workspace. |
| `ANTHROPIC_MODEL` | Defaults to `claude-opus-5-5`. |
| `AI_DAILY_REQUEST_LIMIT` | AI requests per user per day (default 20). |

Database: apply `supabase/migrations/*.sql` in order (Supabase CLI `supabase db push`, or the SQL editor). Public sign-up should be disabled in Supabase Auth; create users from the dashboard.

## Importing study content (PDF → questions)

Source files are private and copyrighted; they live in `content/` (gitignored) and are for personal study only.

```bash
npm run content:extract    # content/raw/** → text (pdftotext, OCR fallback via tesseract, textutil for .doc/.docx)
npm run content:estimate   # token count + cost estimate (free)
npm run content:submit     # Message Batches API → Claude structures questions + materials (paid)
npm run content:collect    # fetch results, validate, write content/structured/*.json
npm run content:import     # dry run; add --write to insert as status 'draft'
npm run content:publish    # flip reviewed drafts to 'published'
```

Requires `pdftotext`/`pdftoppm` (poppler) and `tesseract` (`brew install poppler tesseract tesseract-lang`). Questions without an answer key, with fewer than 5 options, or depending on figures are dropped. Imports are idempotent via `content_hash`.

## Commands

```bash
npm run dev      # dev server
npm run lint     # ESLint
npm test         # node:test — scoring, answer persistence, session recovery, Mini Mode sync
npm run build    # production build
```

Commits follow Conventional Commits (husky + commitlint); the pre-commit hook runs lint.

## Deployment

Vercel + Supabase. Add the variables above in the Vercel project settings and apply the migrations to the hosted project before deploying. Anthropic usage is billed per token; keep `AI_DAILY_REQUEST_LIMIT` enabled.
