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

## Phase 1 — Foundation (Week 1-2)
**Goal:** Working auth + resume upload + database schema

### Tasks
- [ ] Initialize Next.js project with Tailwind
- [ ] Set up Supabase project (auth, database, storage)
- [ ] Build auth flow: Google OAuth + magic link login
- [ ] Design database schema:
  - `users` — id, email, plan, created_at
  - `resumes` — id, user_id, raw_text, parsed_json, created_at
  - `applications` — id, user_id, resume_id, jd_text, company, role, tailored_json, pdf_url, status, created_at
- [ ] Build resume upload page: accept PDF/DOCX, parse to plain text server-side
- [ ] Store parsed resume in Supabase under user account
- [ ] Protected routes — redirect unauthenticated users to login

### Deliverable
User can sign up, upload a resume, and see it saved to their account.

---

## Phase 2 — Core Tailoring Flow (Week 3-4)
**Goal:** End-to-end tailoring working in the browser

### Tasks
- [ ] Build JD input page: text paste + URL input field
- [ ] Wire URL input to Puppeteer scraper (server-side API route)
- [ ] Port `tailor.js` Claude logic to an Express API endpoint `/api/tailor`
  - Input: `{ resume_json, jd_text }`
  - Output: tailored resume JSON
- [ ] Add structured JD parsing step (Level 1 from LOGIC_IMPROVEMENTS.md)
- [ ] Port `generate_resume.js` PDF generation to server-side API route `/api/generate-pdf`
- [ ] Save tailored JSON + PDF URL to `applications` table
- [ ] Build results page: preview tailored resume, download PDF button
- [ ] Loading state with progress indicator during tailoring

### Deliverable
User pastes a JD, clicks tailor, gets a downloadable PDF in under 30 seconds.

---

## Phase 3 — Dashboard & Application Tracker (Week 5-6)
**Goal:** Users can manage all their tailored resumes in one place

### Tasks
- [ ] Build dashboard: list of all tailored applications with company, role, date
- [ ] Application status tracking: user marks each as applied / screen / interview / offer / rejected
- [ ] Resume management: user can upload multiple base resumes (e.g. ML Engineer variant, SWE variant)
- [ ] Auto-select best base resume for a given JD role type
- [ ] ATS keyword gap report on results page (Level 4 from LOGIC_IMPROVEMENTS.md)
  - "Your resume covers 8/10 required skills. Missing: Spark, Terraform"
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
