# ResumeAI — Production Pipeline & Build Phases

## Product Vision
A web app where any user uploads their base resume, pastes or links a job description, and gets a tailored, ATS-optimized resume PDF in under 30 seconds. Free tier with a paid pro plan.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + Tailwind CSS |
| Backend API | Node.js + Express |
| Auth | Supabase Auth (Google OAuth + magic link) |
| Database | Supabase PostgreSQL |
| File Storage | Supabase Storage (uploaded resumes, generated PDFs) |
| AI | Anthropic Claude API |
| PDF Generation | Puppeteer or existing generate_resume.js (server-side) |
| Payments | Stripe (subscriptions) |
| Deployment | Vercel (frontend) + Railway (API) |

---

## Phase 1 — Foundation ✅ COMPLETED (Jun 16, 2026)
**Goal:** Working auth + resume upload + database schema

### Tasks
- [x] Initialize Next.js project with Tailwind
- [x] Set up Supabase project (auth, database, storage)
- [x] Build auth flow: Google OAuth login
- [x] Design and run database schema:
  - `users` — id, email, plan, created_at
  - `resumes` — id, user_id, raw_text, parsed_json, created_at
  - `applications` — id, user_id, resume_id, jd_text, company, role, tailored_json, pdf_url, status, created_at
- [x] Build resume upload page: accept PDF, parse to plain text server-side (pdf2json)
- [x] Store parsed resume in Supabase under user account
- [x] Protected routes — redirect unauthenticated users to login
- [x] Express API running on port 4000
- [x] Storage buckets: resumes-uploaded, resumes-generated

### Deliverable
User can sign up with Google, upload a resume, and see it saved to their account.

---

## Phase 2 — Core Tailoring Flow ✅ COMPLETED (Jun 16, 2026)
**Goal:** End-to-end tailoring working in the browser

### Tasks
- [x] Build JD input page: text paste + URL input with mode toggle
- [x] Wire URL input to Puppeteer scraper (`/api/scrape-jd`)
- [x] Port `tailor.js` Claude logic to Express API endpoint `/api/tailor`
  - Input: `{ resumeId, jdText, jdUrl }`
  - Output: tailored resume JSON saved to `applications` table
- [x] Port `generate_resume.js` PDF generation to `/api/generate-pdf` (Puppeteer server-side)
- [x] PDF uploaded to `resumes-generated` Supabase bucket, signed URL returned
- [x] Save `tailored_json` + `original_json` + `pdf_url` to `applications` table
- [x] Build results page: Preview tab + Changes (diff) tab + download PDF button
- [x] 3-step progress indicator during tailoring (Analyzing → Tailoring → Saving)
- [x] VS Code-style diff view: word-level highlights, bullet-by-bullet comparison, skills reorder badges
- [x] Security: userId extracted from Bearer token server-side, never trusted from client
- [x] User row auto-upserted on upload (handles users created before trigger)
- [x] `original_json` column added to `applications` table

### Deliverable
User pastes a JD or drops a URL, gets a tailored PDF with a full diff of what changed.

---

## Phase 3 — Dashboard & Application Tracker (Week 5-6)
**Goal:** Users can manage all their tailored resumes in one place

### Tasks
- [ ] Build dashboard: list of all tailored applications with company, role, date
- [ ] Application status tracking: user marks each as applied / screen / interview / offer / rejected
- [ ] Resume management: user can upload multiple base resumes (e.g. ML Engineer variant, SWE variant)
- [ ] Auto-select best base resume for a given JD role type
- [x] ATS keyword gap report on results page (Level 4 from LOGIC_IMPROVEMENTS.md)
  - Score ring (0-100), matched keywords (green), missing keywords (red)
  - Claude Haiku extracts JD keywords, checks coverage in tailored resume
  - Stored in applications.ats_score + applications.ats_details
- [ ] Delete / re-tailor applications

### Deliverable
Full application tracker. User can manage their entire job search from one dashboard.

---

## Phase 4 — Payments & Plans (Week 7)
**Goal:** Monetization live, free tier enforced

### Tasks
- [ ] Integrate Stripe: create products and prices (Free, Pro)
  - Free: 5 tailored resumes/month
  - Pro ($12/month): unlimited resumes + cover letter + cold email
- [ ] Stripe webhook handler: sync subscription status to `users` table
- [ ] Enforce plan limits server-side on `/api/tailor`
- [ ] Build upgrade/billing page with Stripe Customer Portal
- [ ] Usage counter visible on dashboard ("3 of 5 free tailors used this month")

### Deliverable
Paying users can subscribe. Free users hit a paywall after 5 uses.

---

## Phase 5 — Pro Features (Week 8-9)
**Goal:** Features that justify the Pro plan

### Tasks
- [ ] Cover letter generation: same JD + tailored resume → 3-paragraph cover letter
- [ ] Cold email generation: recruiter outreach email auto-generated
- [ ] Two-pass tailoring (Level 3 from LOGIC_IMPROVEMENTS.md): selection pass + rewrite pass
- [ ] Multiple PDF template options (minimal, modern, classic)
- [ ] Resume score card: ATS score, keyword density, readability rating

### Deliverable
Pro plan has clear differentiation. Cover letter + cold email saves users significant time.

---

## Phase 6 — Feedback Loop & Optimization (Week 10+)
**Goal:** Data-driven improvements to tailoring quality

### Tasks
- [ ] Collect outcome data: user marks applications with results
- [ ] Analytics dashboard (internal): which tailoring strategies correlate with interviews
- [ ] A/B test prompt variations against real outcome data
- [ ] Optimize Claude prompt based on findings
- [ ] Explore fine-tuning a smaller model on (JD, resume, outcome) pairs for cost reduction

### Deliverable
Tailoring quality improves over time based on real user outcomes, not guesswork.

---

## Launch Checklist (Before going public)
- [ ] Custom domain
- [ ] Privacy policy + terms of service
- [ ] Rate limiting on all API routes
- [ ] Error monitoring (Sentry)
- [ ] Email onboarding sequence (Brevo/Resend)
- [ ] Landing page with waitlist or direct signup

---

## Milestone Summary

| Phase | What ships | Timeline |
|---|---|---|
| 1 | Auth + resume upload | Week 1-2 |
| 2 | Core tailoring + PDF download | Week 3-4 |
| 3 | Dashboard + ATS gap report | Week 5-6 |
| 4 | Stripe payments + free tier | Week 7 |
| 5 | Cover letter + pro features | Week 8-9 |
| 6 | Feedback loop + optimization | Week 10+ |
