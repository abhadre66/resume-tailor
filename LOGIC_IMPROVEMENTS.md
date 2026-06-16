# Resume Tailoring — Logic Improvement Roadmap

## Current State
- Base resume hardcoded as a JS object in `tailor.js`
- Single Claude call receives raw JD text + base resume and returns tailored JSON
- Bullets reordered/rephrased by intuition, no semantic matching
- Fixed PDF template, no ATS scoring, no feedback loop

---

## Level 1 — Smarter JD Parsing (Do First)

**Problem:** Claude currently receives the raw JD as a blob of text and has to figure out what matters.

**Fix:** Add a dedicated JD parsing step before tailoring.

```
JD text → Claude (parse call) → structured JD object → tailoring call
```

Structured JD output:
```json
{
  "required_skills": ["Python", "PyTorch", "RAG"],
  "preferred_skills": ["Azure", "Spark"],
  "key_action_verbs": ["design", "deploy", "optimize"],
  "seniority": "mid-level",
  "domain_keywords": ["LLM", "MLOps", "microservices"],
  "role_type": "ML Engineering"
}
```

**Why it matters:** Tailoring against a structured object is far more precise than tailoring against a wall of text. The model knows what is required vs. nice-to-have.

---

## Level 2 — Resume as a Structured Knowledge Base

**Problem:** Bullets are plain strings. Claude has no metadata to reason about.

**Fix:** Store each bullet with tags so the matcher can score relevance without re-reading text every time.

```json
{
  "bullet": "Built a production RAG system using GPT-4o-mini with Pinecone...",
  "skills": ["RAG", "Python", "Pinecone", "LangChain", "Docker"],
  "domain": "ML Engineering",
  "impact_metric": true,
  "impact_value": null
}
```

**Why it matters:** Enables deterministic skill matching before Claude even runs — Claude then focuses on rephrasing, not discovery.

---

## Level 3 — Two-Pass Tailoring

**Problem:** One Claude call does everything: selects, reorders, rephrases, writes summary. Quality suffers.

**Fix:** Split into two passes.

**Pass 1 — Selection pass:**
- Input: structured JD + tagged resume bullets
- Task: score and rank each bullet by relevance to this JD (0-10)
- Output: ordered list of bullet IDs with scores

**Pass 2 — Rewrite pass:**
- Input: top-ranked bullets + JD action verbs + role type
- Task: rephrase selected bullets to mirror JD language, write summary
- Output: final tailored resume JSON

**Why it matters:** Selection and writing are different cognitive tasks. Splitting them reduces hallucination and improves precision.

---

## Level 4 — ATS Keyword Gap Analysis ✅ IMPLEMENTED (Jun 16, 2026)

**Problem:** User has no visibility into whether the tailored resume will pass ATS filters.

**Fix:** After tailoring, run a gap check.

```
required_skills (from Level 1) → check against tailored resume text → missing_keywords[]
```

Surface to user:
- "Your resume covers 8/10 required skills"
- "Missing: Spark, Terraform — add these if you have real experience with them"

**Why it matters:** Most resumes are filtered by ATS before a human sees them. This is the single highest-leverage improvement for user outcomes.

---

### How ATS Scoring Works (Current Implementation)

**Trigger:** Runs automatically at the end of every `/api/tailor` call, after Claude Sonnet returns the tailored resume JSON.

**Model:** Claude Haiku (`claude-haiku-4-5-20251001`) — fast and cheap, no need for Sonnet here.

**Input sent to Claude Haiku:**
- The raw JD text (first 3000 characters)
- The tailored resume content (summary, skills, experience bullets, project bullets and stacks) serialized as JSON

**What Claude Haiku does:**
1. Reads the JD and extracts the 10-15 most important technical skills, tools, and keywords required for the role
2. Checks each keyword against the tailored resume content
3. Splits them into `matched` (found in resume) and `missing` (not found)
4. Computes a `score` from 0-100 representing percentage of required keywords covered

**Output JSON:**
```json
{
  "score": 82,
  "matched": ["Python", "PyTorch", "Docker", "FastAPI", "PostgreSQL"],
  "missing": ["Spark", "Terraform", "Kubernetes"]
}
```

**Storage:**
- `ats_score` (integer 0-100) → saved to `applications.ats_score`
- `{ matched[], missing[] }` → saved to `applications.ats_details` (jsonb)

**Failure handling:** Wrapped in try-catch. If the Claude call or JSON parsing fails, `ats_score` and `ats_details` are stored as null and the tailor response still succeeds.

**Displayed on results page:**
- Animated ring gauge (green ≥ 75, yellow ≥ 50, red < 50)
- Green chips with checkmark for each matched keyword
- Red chips with X for each missing keyword

**Known limitation:** Claude Haiku evaluates keyword presence semantically, not with exact string matching. A JD that requires "Kubernetes" and a resume that says "K8s" may or may not match depending on how the model interprets them. A future improvement (Level 1 + Level 2 combined) would use deterministic exact/fuzzy matching against a structured keyword list extracted from the JD.

---

## Level 5 — Feedback Loop

**Problem:** No way to know if the current tailoring logic actually works.

**Fix:** Track application outcomes per tailored resume.

User marks each application:
- `no_response` / `recruiter_screen` / `technical_interview` / `offer`

Use this data to:
1. Identify which prompt strategies correlate with callbacks
2. A/B test prompt variations against real outcomes
3. Eventually fine-tune a smaller, cheaper model on (JD, resume, outcome) triples

**Why it matters:** Without a feedback loop, you are optimizing blindly. This closes the loop.

---

## Level 6 — Multi-Resume Base Selection

**Problem:** One base resume fits all roles poorly. An ML engineering resume is wrong for a data analyst role.

**Fix:** User maintains multiple base resume variants (e.g. ML Engineer, Data Analyst, SWE).

```
JD role_type → classify → select best base resume variant → tailor
```

**Why it matters:** Tailoring from the right starting point produces dramatically better output than tailoring a wrong base.

---

## Level 7 — Cover Letter + Cold Email Generation

**Fix:** After tailoring, use the same JD + tailored resume to generate:
- A 3-paragraph cover letter matching the role
- A 5-line recruiter cold email for LinkedIn/email outreach

Both reuse the structured JD and tailored summary — no extra user input needed.

---

## Priority Order

| Priority | Improvement | Effort | Impact |
|---|---|---|---|
| 1 | Structured JD parsing (Level 1) | Low | High |
| 2 | ATS keyword gap analysis (Level 4) | Low | High |
| 3 | Tagged resume bullets (Level 2) | Medium | High |
| 4 | Two-pass tailoring (Level 3) | Medium | Medium |
| 5 | Cover letter + cold email (Level 7) | Low | High |
| 6 | Multi-resume base selection (Level 6) | Medium | Medium |
| 7 | Feedback loop (Level 5) | High | Very High (long term) |
