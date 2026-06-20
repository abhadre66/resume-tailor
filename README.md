# ResumeAI

*Your resume, rewritten in the time it takes to read this sentence.*

You've found the job. Now your resume needs to stop sounding like a
general statement of who you are and start sounding like the exact
person that job is looking for. ResumeAI reads the job description,
reads your real experience, and rewrites the overlap — same facts,
same metrics, just pointed at the right target. No invented skills.
No exaggerated bullet points. Just your work, reordered to make sense
to the person about to skim it for six seconds.

## How it thinks

1. **You upload a resume.** Claude parses it into structured data once —
   summary, skills, experience, projects — so it never has to guess
   at your background again.
2. **You paste or link a job description.** A scraper reads the live
   posting if you hand it a URL.
3. **Claude tailors, grounded in what's actually true.** Every skill it
   surfaces, every bullet it reorders, has to trace back to something
   you already wrote. If it can't, it gets flagged, not shipped.
4. **You get a tailored PDF and an ATS score** — what matched the
   posting, what's still missing, and a resume that reads like a human
   wrote it for this exact role.

## What's actually in this repo

```
apps/
  web/      Next.js frontend — auth, upload, tailor, results, ATS view
  api/      Express backend — parsing, tailoring, PDF generation, scoring
tailor.js           Personal CLI tool (gitignored) — same idea, zero UI
generate_resume.js   PDF renderer for the CLI path
supabase_schema.sql  users / resumes / applications
```

Two parallel implementations of one idea: a multi-user product
(`apps/`) for anyone, and a fast, no-frills CLI (`tailor.js`) for one
person applying to a lot of jobs in a hurry. They don't share code,
but they share a philosophy — tailor aggressively, fabricate nothing.

## Stack

| | |
|---|---|
| Frontend | Next.js, Tailwind CSS |
| Backend | Node.js, Express |
| Auth & DB | Supabase (Postgres, Google OAuth + magic link) |
| AI | Claude Sonnet (tailoring) + Claude Haiku (parsing, ATS scoring) |
| PDF | Puppeteer |
| Storage | Supabase Storage |

## Running it

```bash
# backend
cd apps/api && npm install && npm run dev

# frontend
cd apps/web && npm install && npm run dev
```

You'll need a Supabase project (run `supabase_schema.sql` against it),
a Google OAuth app, and an Anthropic API key — drop them in
`.env.local` at the repo root.

## The honest part

Every tailored resume gets checked against the original for numbers
and skills that weren't actually there. Not because the model is
untrustworthy — because a resume is the one document where "close
enough" isn't a feature. If it would invent a metric, it warns instead
of shipping it.
