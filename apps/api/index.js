require('dotenv').config({ path: '../../.env.local' })
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const PDFParser = require('pdf2json')
const { createClient } = require('@supabase/supabase-js')
const Anthropic = require('@anthropic-ai/sdk')

const app = express()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

app.use(cors({ origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000' }))
app.use(express.json())

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const anthropic = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Auth helper ───────────────────────────────────────────────
async function getUserFromRequest(req) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user
}

// ── Health ────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// ── Resume Upload ─────────────────────────────────────────────
app.post('/api/resume/upload', upload.single('file'), async (req, res) => {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { name } = req.body
    const file = req.file
    if (!file || !name?.trim()) return res.status(400).json({ error: 'Missing file or name' })

    const rawText = await new Promise((resolve, reject) => {
      const parser = new PDFParser(null, 1)
      parser.on('pdfParser_dataReady', () => resolve(parser.getRawTextContent()))
      parser.on('pdfParser_dataError', (err) => reject(new Error(err.parserError || 'PDF parsing failed')))
      parser.parseBuffer(file.buffer)
    })

    // Ensure user row exists (handles users who signed up before trigger was created)
    await supabase.from('users').upsert(
      { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || null },
      { onConflict: 'id', ignoreDuplicates: true }
    )

    // Parse resume into structured JSON + extract profile using Claude Haiku
    let parsedJson = null
    let profile = null
    try {
      const parseMsg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Parse this resume text into structured JSON. Return ONLY valid JSON, no markdown.

RESUME TEXT:
${rawText.slice(0, 6000)}

Return this exact structure:
{
  "profile": {
    "name": "Full Name",
    "location": "City, State",
    "phone": "phone number or null",
    "email": "email or null",
    "linkedin": "full LinkedIn URL or null",
    "github": "full GitHub URL or null",
    "portfolio": "portfolio URL or null",
    "education": [
      {
        "school": "University Name",
        "degree": "Degree and Major",
        "dates": "date range",
        "gpa": "GPA or null",
        "courses": "relevant courses or null"
      }
    ],
    "certifications": ["certification 1", "certification 2"]
  },
  "resume": {
    "summary": "professional summary paragraph",
    "skills": {
      "languages": "programming languages comma separated",
      "ml": "ML/AI/data skills comma separated or null",
      "infra": "infrastructure/devops/backend skills comma separated or null",
      "frontend": "frontend skills comma separated or null"
    },
    "experience": [
      {
        "company": "Company Name",
        "title": "Job Title",
        "dates": "date range",
        "bullets": ["bullet 1", "bullet 2"]
      }
    ],
    "projects": [
      {
        "name": "Project Name",
        "subtitle": "short project subtitle",
        "stack": "tech stack",
        "link": "URL or null",
        "bullets": ["bullet 1", "bullet 2"]
      }
    ]
  }
}`
        }]
      })
      const parseRaw = parseMsg.content[0].text.trim()
      const parsed = JSON.parse(parseRaw.match(/\{[\s\S]*\}/)?.[0] || parseRaw)
      profile = parsed.profile || null
      parsedJson = parsed.resume || null
    } catch (e) {
      console.error('Resume parse failed (non-fatal):', e.message)
    }

    const filePath = `${user.id}/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`
    const { error: storageError } = await supabase.storage
      .from('resumes-uploaded')
      .upload(filePath, file.buffer, { contentType: 'application/pdf' })
    if (storageError) throw new Error(`Storage error: ${storageError.message}`)

    const { data, error: dbError } = await supabase
      .from('resumes')
      .insert({ user_id: user.id, name: name.trim(), raw_text: rawText, file_url: filePath, parsed_json: parsedJson, profile })
      .select()
      .single()
    if (dbError) throw new Error(`Database error: ${dbError.message}`)

    res.json({ success: true, resume: data })
  } catch (err) {
    console.error('Upload error:', err.message)
    res.status(500).json({ error: err.message || 'Upload failed' })
  }
})

// ── Scrape JD from URL ────────────────────────────────────────
app.post('/api/scrape-jd', async (req, res) => {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { url } = req.body
    if (!url) return res.status(400).json({ error: 'Missing url' })

    const puppeteer = require('puppeteer')
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
    const text = await page.evaluate(() => document.body.innerText)
    await browser.close()

    if (!text?.trim()) return res.status(422).json({ error: 'Could not extract text from this URL' })

    res.json({ text: text.trim() })
  } catch (err) {
    console.error('Scrape error:', err.message)
    res.status(500).json({ error: 'Failed to fetch job page. Paste the JD manually instead.' })
  }
})

// ── Tailor Resume ─────────────────────────────────────────────
app.post('/api/tailor', async (req, res) => {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { resumeId, jdText, jdUrl } = req.body
    if (!resumeId || !jdText?.trim()) return res.status(400).json({ error: 'Missing resumeId or jdText' })

    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('*')
      .eq('id', resumeId)
      .eq('user_id', user.id)
      .single()
    if (resumeError || !resume) return res.status(404).json({ error: 'Resume not found' })

    const prompt = `You are a professional resume tailoring assistant. Given a candidate's resume (as extracted text) and a job description, tailor the resume to best match the role.

RULES:
- Never invent or fabricate achievements, metrics, or technologies the candidate did not use
- Only reorder bullets, lightly rephrase wording to emphasize relevant skills, and surface the most relevant content first
- Keep all metrics exactly as they are
- The resume must read naturally, like a human wrote it
- Do NOT use em dashes, en dashes, double hyphens (--), tilde (~), or fancy punctuation
- Use plain punctuation only: commas, periods, semicolons, colons, parentheses, regular hyphens
- Return ONLY valid JSON with no markdown, no code blocks, no explanation

CANDIDATE RESUME:
${resume.raw_text}

JOB DESCRIPTION:
${jdText}

Return a JSON object with this exact structure:
{
  "company": "CompanyName (no spaces, use underscores)",
  "role": "Role_Name (no spaces, use underscores)",
  "summary": "2-3 sentence tailored professional summary for this specific role",
  "skills": {
    "languages": "programming languages list, most relevant to this JD first",
    "ml": "ML/AI skills list, most relevant to this JD first",
    "infra": "infrastructure/systems skills, most relevant to this JD first",
    "frontend": "frontend skills list"
  },
  "experience": [
    {
      "company": "company name",
      "title": "job title",
      "dates": "date range",
      "bullets": ["reordered/rephrased bullets, most relevant to this JD first"]
    }
  ],
  "projects": [
    {
      "name": "project name",
      "subtitle": "project subtitle",
      "stack": "tech stack",
      "link": "original link unchanged",
      "bullets": ["reordered/rephrased bullets, most relevant to this JD first"]
    }
  ]
}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    })

    const raw = message.content[0].text.trim()
    let tailored
    try {
      tailored = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Claude returned invalid JSON')
      tailored = JSON.parse(match[0])
    }

    // ATS keyword scoring
    let atsScore = null
    let atsDetails = null
    try {
      const atsMessage = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: `You are an ATS analyzer. Extract the 10-15 most important technical skills, tools, and keywords from this job description. Then check which ones appear in the resume JSON.

JOB DESCRIPTION:
${jdText.slice(0, 3000)}

RESUME (JSON):
${JSON.stringify({ summary: tailored.summary, skills: tailored.skills, experience: tailored.experience?.map(e => ({ bullets: e.bullets })), projects: tailored.projects?.map(p => ({ stack: p.stack, bullets: p.bullets })) })}

Return ONLY valid JSON, no markdown:
{"score":<0-100 integer>,"matched":["keyword",...],"missing":["keyword",...]}`
        }]
      })
      const atsRaw = atsMessage.content[0].text.trim()
      const atsParsed = JSON.parse(atsRaw.match(/\{[\s\S]*\}/)?.[0] || atsRaw)
      atsScore = atsParsed.score
      atsDetails = { matched: atsParsed.matched || [], missing: atsParsed.missing || [] }
    } catch (e) {
      console.error('ATS scoring failed (non-fatal):', e.message)
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        user_id: user.id,
        resume_id: resumeId,
        company: tailored.company,
        role: tailored.role,
        jd_text: jdText,
        jd_url: jdUrl || null,
        tailored_json: tailored,
        original_json: resume.parsed_json || null,
        ats_score: atsScore,
        ats_details: atsDetails,
        status: 'applied'
      })
      .select()
      .single()
    if (appError) throw new Error(`Database error: ${appError.message}`)

    res.json({ success: true, applicationId: application.id, tailored, atsScore, atsDetails })
  } catch (err) {
    console.error('Tailor error:', err.message)
    res.status(500).json({ error: err.message || 'Tailoring failed' })
  }
})

// ── Generate PDF ──────────────────────────────────────────────
app.post('/api/generate-pdf', async (req, res) => {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })

    const { applicationId } = req.body
    if (!applicationId) return res.status(400).json({ error: 'Missing applicationId' })

    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*')
      .eq('id', applicationId)
      .eq('user_id', user.id)
      .single()
    if (appError || !application) return res.status(404).json({ error: 'Application not found' })

    const { data: resume } = await supabase
      .from('resumes')
      .select('profile')
      .eq('id', application.resume_id)
      .single()

    const job = application.tailored_json
    const html = buildResumeHTML(job, resume?.profile || null)

    const puppeteer = require('puppeteer')
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      pageRanges: '1',
    })
    await browser.close()

    const filePath = `${user.id}/${applicationId}.pdf`
    const { error: storageError } = await supabase.storage
      .from('resumes-generated')
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
    if (storageError) throw new Error(`Storage error: ${storageError.message}`)

    const { data: signedData, error: signedError } = await supabase.storage
      .from('resumes-generated')
      .createSignedUrl(filePath, 3600)
    if (signedError) throw new Error(`Signed URL error: ${signedError.message}`)

    await supabase.from('applications').update({ pdf_url: filePath }).eq('id', applicationId)

    res.json({ success: true, downloadUrl: signedData.signedUrl })
  } catch (err) {
    console.error('PDF error:', err.message)
    res.status(500).json({ error: err.message || 'PDF generation failed' })
  }
})

// ── Resume HTML builder ───────────────────────────────────────
function buildResumeHTML(job, profile) {
  const skills = job.skills || {}
  const experience = job.experience || []
  const projects = job.projects || []
  const summary = job.summary || ''

  // Profile defaults (fallback for old resumes without parsed profile)
  const name = profile?.name || 'Your Name'
  const location = profile?.location || ''
  const phone = profile?.phone || ''
  const email = profile?.email || ''
  const linkedin = profile?.linkedin || null
  const github = profile?.github || null
  const portfolio = profile?.portfolio || null
  const education = profile?.education || []
  const certifications = profile?.certifications || []

  const contactParts = [
    location,
    phone,
    email,
    linkedin ? `<a href="${linkedin}">LinkedIn</a>` : null,
    github ? `<a href="${github}">GitHub</a>` : null,
    portfolio ? `<a href="${portfolio}">Portfolio</a>` : null,
  ].filter(Boolean)

  const renderBullets = (bullets) => bullets.map(b => `<li>${b}</li>`).join('\n')

  const renderExperience = (exp) => exp.map(e => `
    <div class="job-row">
      <div class="job-left"><span class="job-company">${e.company}</span>, ${e.title}</div>
      <div class="job-dates">${e.dates}</div>
    </div>
    <ul class="resume-list">${renderBullets(e.bullets)}</ul>
  `).join('')

  const renderProjects = (projs) => projs.map(p => `
    <div class="proj-row">
      <span class="proj-name">${p.name}: ${p.subtitle}</span>
      <span class="proj-stack"> &nbsp;|&nbsp; ${p.stack}</span>
      ${p.link ? `&nbsp;<span class="proj-link"><a href="${p.link}">Website</a></span>` : ''}
    </div>
    <ul class="resume-list">${renderBullets(p.bullets)}</ul>
  `).join('')

  const renderEducation = (edu) => edu.map(e => `
    <div class="job-row">
      <div class="job-left"><span class="job-company">${e.school}</span>, ${e.degree}</div>
      <div class="job-dates">${e.dates}</div>
    </div>
    ${(e.gpa || e.courses) ? `<div class="subline">${[e.gpa ? `GPA: ${e.gpa}` : null, e.courses].filter(Boolean).join(' &nbsp;|&nbsp; ')}</div>` : ''}
  `).join('')

  const skillSections = [
    { label: 'Languages', key: 'languages' },
    { label: 'ML / AI', key: 'ml' },
    { label: 'Systems &amp; Infra', key: 'infra' },
    { label: 'Frontend', key: 'frontend' },
  ]

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #111; background: white; padding: 0.32in 0.45in; line-height: 1.2; }
  a { color: #111; text-decoration: underline; }
  .name { text-align: center; font-size: 18pt; font-weight: bold; margin-bottom: 3px; }
  .contact { text-align: center; font-size: 9pt; margin-bottom: 6px; }
  .section-header { font-size: 9pt; font-weight: bold; text-transform: uppercase; color: #1E3A5F; border-bottom: 1px solid #999; margin-top: 6px; margin-bottom: 3px; padding-bottom: 1px; letter-spacing: 0.04em; }
  .job-row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 3px; margin-bottom: 1px; }
  .job-left { font-size: 9pt; }
  .job-company { font-weight: bold; }
  .job-dates { font-size: 8.5pt; color: #555; white-space: nowrap; }
  .subline { font-size: 8.5pt; color: #555; font-style: italic; margin-bottom: 2px; }
  .summary { font-size: 9pt; text-align: justify; margin-bottom: 1px; }
  ul.resume-list { margin: 0 0 2px 0; padding-left: 14px; }
  ul.resume-list li { font-size: 8.5pt; margin-bottom: 1px; }
  .proj-row { margin-top: 3px; margin-bottom: 1px; }
  .proj-name { font-weight: bold; font-size: 9pt; }
  .proj-stack { font-size: 8.5pt; color: #555; font-style: italic; }
  .proj-link { font-size: 8.5pt; }
  .skill-row { font-size: 8.5pt; margin-bottom: 2px; }
  .skill-label { font-weight: bold; }
</style>
</head>
<body>
  <div class="name">${name}</div>
  <div class="contact">${contactParts.join(' &nbsp;|&nbsp; ')}</div>

  <div class="section-header">Summary</div>
  <p class="summary">${summary}</p>

  ${education.length > 0 ? `
  <div class="section-header">Education</div>
  ${renderEducation(education)}
  ` : ''}

  <div class="section-header">Experience</div>
  ${renderExperience(experience)}

  <div class="section-header">Projects</div>
  ${renderProjects(projects)}

  <div class="section-header">Technical Skills</div>
  ${skillSections.filter(s => skills[s.key]).map(s => `<div class="skill-row"><span class="skill-label">${s.label}:</span> ${skills[s.key]}</div>`).join('\n')}

  ${certifications.length > 0 ? `
  <div class="section-header">Certifications &amp; Achievements</div>
  <ul class="resume-list">
    ${certifications.map(c => `<li>${c}</li>`).join('\n')}
  </ul>
  ` : ''}
</body>
</html>`
}

const PORT = process.env.PORT || 4000
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`))
