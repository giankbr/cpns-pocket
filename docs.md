# Build CPNS Pocket — Personal CPNS Learning Platform

## Project Overview

Build a production-ready personal CPNS learning platform called **CPNS Pocket** using Next.js, TypeScript, Supabase, and Tailwind CSS.

The application is designed for one private user who wants to study Indonesian CPNS exam materials, practice questions, and run CAT simulations.

The primary differentiator is **Mini Mode**, an interactive floating study window using Chrome's Document Picture-in-Picture API.

The product should feel like a lightweight personal learning workspace, not a traditional LMS.

## 1. Technology Stack

- Next.js App Router (latest stable compatible version)
- TypeScript (strict mode)
- Tailwind CSS
- shadcn/ui
- Lucide React
- Supabase PostgreSQL
- Supabase Auth
- React Hook Form
- Zod
- Zustand for client-side study session state where appropriate
- Vercel deployment

Use Server Components by default. Use Client Components only where interaction requires them.

## 2. Design Direction

Design inspiration: Linear, Notion, and modern minimalist productivity applications.

Visual guidelines:
- Clean and minimal interface.
- White or warm neutral background.
- Subtle borders and shadows.
- Neutral gray typography.
- One restrained accent color.
- Consistent spacing and typography.
- Avoid excessive gradients, colorful cards, and unnecessary illustrations.
- Responsive desktop-first layout.
- Support laptop resolutions starting from 1280px width.
- Good keyboard navigation and accessibility.

The application must feel calm, focused, and lightweight.

## 3. Authentication

Implement private authentication.

Requirements:
- Email and password login.
- Disable public registration.
- Only authorized user accounts can access the application.
- Protect all dashboard and API routes.
- Use Supabase Row Level Security.
- Each user's study records must only be accessible to that user.
- Do not expose Supabase service role keys to the browser.

## 4. Dashboard

Create a dashboard containing:

- Welcome message.
- Total questions answered.
- Overall accuracy.
- Study time.
- Current study streak.
- Daily study target.
- Progress by TWK, TIU, and TKP.
- Recent study sessions.
- Continue learning action.
- Quick access to practice and CAT simulation.

Keep the dashboard simple and information-dense.

## 5. Learning Subjects

Implement three main subjects:

### TWK
- Pancasila.
- UUD 1945.
- Bhinneka Tunggal Ika.
- NKRI.
- National history and civic knowledge.

### TIU
- Verbal reasoning.
- Numerical reasoning.
- Logical reasoning.
- Analytical reasoning.
- Figural reasoning.

### TKP
- Pelayanan publik.
- Jejaring kerja.
- Sosial budaya.
- Teknologi informasi.
- Profesionalisme.
- Anti-radikalisme.

Each subject contains topics, learning materials, and question collections.

Allow questions to be filtered by:
- Subject.
- Topic.
- Difficulty.
- Previously answered or unanswered.
- Bookmarked status.

## 6. Practice Mode

Build an interactive question practice interface.

Requirements:
- Display one question at a time.
- Multiple-choice answers.
- Previous and next navigation.
- Question numbering.
- Answer selection.
- Explanation after submitting an answer.
- Bookmark questions.
- Track answered questions.
- Autosave answers.
- Resume unfinished sessions.

TWK and TIU:
- One correct answer.
- Score based on correctness.

TKP:
- Weighted scoring per answer option.
- Do not use binary correct/incorrect scoring.
- Display the selected option's score and explanation when appropriate.

## 7. CAT Simulation

Build a configurable CAT simulation engine.

Features:
- Select subject or mixed examination.
- Configurable number of questions.
- Configurable exam duration.
- Randomized question ordering.
- Question navigation grid.
- Answer status indicators.
- Countdown timer.
- Automatic submission when time expires.
- Confirmation before manual submission.
- Prevent accidental session loss.
- Store completed exam results.

Results page:
- Total score.
- Correct answers.
- Incorrect answers.
- Unanswered questions.
- Score breakdown by subject.
- Question review.
- Explanations.

Do not hardcode official CPNS passing grades or exam configurations. Make these configurable because exam regulations can change.

## 8. Mini Mode — Core Feature

Implement Chrome Document Picture-in-Picture API.

The Mini Mode must be an actual interactive floating HTML window, not an iframe screenshot or simulated modal.

Requirements:

1. Add an "Open Mini Mode" button to active practice sessions.
2. Check browser support before displaying the feature.
3. Open a Document Picture-in-Picture window following a user click.
4. Render the current question and answer options inside the floating window.
5. Include:
   - Question number.
   - Question text.
   - Answer options.
   - Previous button.
   - Next button.
   - Timer when applicable.
   - Progress indicator.
   - Close button.
6. Keep the floating window synchronized with the main application.
7. Preserve selected answers when switching between normal and Mini Mode.
8. Autosave answers.
9. Handle closing the floating window gracefully.
10. Restore the normal interface without losing progress.

Technical constraints:
- Use `documentPictureInPicture.requestWindow()`.
- Detect support through `documentPictureInPicture` availability.
- Use a secure browser context.
- Handle browser API failures gracefully.
- Implement a compact inline fallback when Document Picture-in-Picture is unavailable.
- Do not assume the floating window can always remain on top of every application or bypass operating-system restrictions.
- Keep application state in a shared session store rather than duplicating business logic inside the floating window.
- Ensure React components and required styles work correctly in the PiP document.

Target window dimensions: approximately 340 × 440 pixels.

The user should be able to resize the window where supported.

## 9. Bookmark and History

Bookmarks:
- Save questions.
- Remove bookmarks.
- Practice bookmarked questions.

History:
- View completed and unfinished sessions.
- View previous scores.
- Review incorrect answers.
- Track study duration.
- Resume unfinished sessions.

## 10. Database

Create Supabase migrations for:

- profiles
- subjects
- topics
- learning_materials
- questions
- question_options
- study_sessions
- session_answers
- bookmarks
- exam_configurations

Use UUID primary keys, foreign keys, appropriate indexes, timestamps, and constraints.

Use `score` for TKP answer options and `is_correct` for objective questions.

Do not expose correct answers or TKP scoring information through client-facing question queries before the answer is submitted. Implement secure answer evaluation on the server.

Create RLS policies for all user-owned data.

## 11. Seed Data

Create sample development seed data:

- Three subjects.
- At least three topics per subject.
- Five sample questions per subject.
- Five answer options for each question.
- Correct answer and explanation for TWK/TIU.
- Weighted scoring and explanations for TKP.

Clearly mark sample questions as development/demo content. Do not present fabricated questions as official government exam questions.

## 12. Implementation Phases

Phase 1 — Foundation:
- Project initialization.
- Supabase integration.
- Authentication.
- Database migrations.
- Basic dashboard layout.

Phase 2 — Learning:
- Subject pages.
- Topics and materials.
- Question bank.
- Practice engine.
- Bookmark functionality.

Phase 3 — Examination:
- CAT simulation.
- Timer.
- Answer navigation.
- Scoring.
- Result review.

Phase 4 — Mini Mode:
- Document Picture-in-Picture.
- Floating question interface.
- Shared state synchronization.
- Autosave.
- Fallback mode.

Phase 5 — Finalization:
- History and analytics.
- Responsive design.
- Accessibility.
- Security checks.
- Performance optimization.
- Vercel deployment.

## 13. Engineering Requirements

- Use reusable components.
- Keep business logic separate from UI.
- Use TypeScript strict mode.
- Validate user input with Zod.
- Use proper loading, empty, and error states.
- Avoid unnecessary dependencies.
- Avoid hardcoded mock data in production components.
- Use environment variables for Supabase configuration.
- Provide `.env.example`.
- Include database migration files.
- Include setup and deployment documentation.
- Add tests for scoring, answer persistence, session recovery, and Mini Mode state synchronization.

## 14. Deliverables

Produce:
1. Complete Next.js project.
2. Supabase database schema and migrations.
3. Authentication implementation.
4. Working learning dashboard.
5. Functional TWK/TIU/TKP practice engine.
6. Functional CAT simulation.
7. Working Chrome Document Picture-in-Picture Mini Mode.
8. Bookmark and history features.
9. Development seed data.
10. README with local setup and Vercel deployment instructions.

## Final Instruction

Implement this application incrementally, starting with Phase 1.

Before implementing each phase:
- Inspect the existing project structure.
- Define the implementation plan.
- Identify dependencies.
- Implement functional features rather than placeholder interfaces.
- Run type checking and relevant tests.
- Fix errors before proceeding.

Do not stop after generating a UI prototype. The goal is a functional, secure, deployable personal CPNS learning platform.