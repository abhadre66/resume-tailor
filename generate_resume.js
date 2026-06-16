// ============================================================
//  Abhishek Bhadre — Resume Generator (PDF)
//
//  Usage:
//    node generate_resume.js                  → default resume
//    node generate_resume.js jobs/google.json → tailored for Google
// ============================================================

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// ── Base content ──────────────────────────────────────────────
const base = {
  summary: `M.S. in Artificial Intelligence from Illinois Institute of Technology with experience building and deploying machine learning and full-stack AI systems in production. Shipped a real-time conversational AI interview platform, a retrieval-augmented generation (RAG) developer tool in production, and a computer vision pipeline on Kubernetes with 30% accuracy improvement. Proficient in Python, TypeScript, LLMs, NLP, and cloud infrastructure across AWS, GCP, Railway, and Vercel.`,

  skills: {
    languages: "Python, TypeScript, JavaScript, SQL, Go, Java (familiar), C++ (familiar)",
    ml:        "PyTorch, TensorFlow, Scikit-learn, XGBoost, HuggingFace Transformers, LangChain, Retrieval-Augmented Generation (RAG), Large Language Models (LLMs), Natural Language Processing (NLP), Computer Vision, Semantic Search, Vector Embeddings, Prompt Engineering, Model Fine-tuning",
    infra:     "Docker, Kubernetes, CI/CD (GitHub Actions), AWS, GCP, FastAPI, Express.js, Node.js, RESTful APIs, PostgreSQL, MySQL, Supabase, Pinecone, FAISS, Git",
    frontend:  "React, Next.js, Tailwind CSS, TypeScript",
  },

  experience: [
    {
      company: "RAWATTECH",
      title: "Deep Learning Intern",
      dates: "Sep 2022 – May 2023",
      bullets: [
        "Developed a YOLO-based object detection model in Python to detect and classify industrial pipe inventory from warehouse images, improving accuracy by 30% and eliminating a fully manual counting process.",
        "Containerized the model with Docker and deployed on Kubernetes for horizontal scaling of model inference, enabling the team to handle variable load without code changes.",
        "Built a data augmentation pipeline using NumPy and Pandas, scaling the training dataset from a few hundred to 10,000+ images and manually re-annotating 500+ edge cases; accuracy improved from 65% to 85.4% on held-out evaluation data.",
        "Designed normalized relational database schemas in SQL to store image metadata and inference results, enabling cross-team queries on model performance and inventory trends.",
      ]
    }
  ],

  projects: [
    {
      name: "AI Interview Engine",
      subtitle: "Voice-First Candidate Screening Platform",
      stack: "Next.js, Express, Claude Sonnet/Haiku, Deepgram, Supabase, Railway, Vercel",
      link: "https://ai-interview-engine-ten.vercel.app/login",
      bullets: [
        "Engineered a real-time voice pipeline integrating Deepgram Nova-2 (speech-to-text) and Aura (text-to-speech) with Claude Sonnet 4.6 (large language model), achieving 4-5s end-to-end latency per conversational turn and replacing human interviewers for initial candidate screening.",
        "Designed a multi-turn conversational AI engine with dynamic context injection: the LLM receives each candidate's parsed resume before the session and generates targeted, role-specific follow-up questions in real time.",
        "Built an automated document ingestion pipeline (PDF parsing, Claude Haiku, MD5 deduplication caching) and a post-interview evaluation system scoring candidates across 4 dimensions with advance/hold/reject output; deployed full-stack on Railway, Vercel, and Supabase (PostgreSQL + Row-Level Security + Magic Link authentication) with Brevo SMTP for transactional email automation.",
      ]
    },
    {
      name: "CodeSyntax AI",
      subtitle: "Full-Stack RAG Developer Assistant",
      stack: "Python, FastAPI, Next.js, LangChain, Pinecone, Docker, GitHub Actions",
      link: "https://syntax-ai-rag.vercel.app",
      bullets: [
        "Built a production retrieval-augmented generation (RAG) system using GPT-4o-mini with semantic search over Python Docs, RealPython, and StackOverflow, indexed in Pinecone via OpenAI vector embeddings.",
        "Implemented an LLM-based query intent classifier and result re-ranker by source authority, plus multi-turn conversation support via LangChain chat-history condensing, both measurably reducing off-topic responses.",
        "Maintained 35+ pytest unit tests and a 55-question domain evaluation set; GitHub Actions CI/CD pipeline builds the Docker image and deploys to Railway (API) and Vercel (frontend) on every merge to main.",
      ]
    },
    {
      name: "AuthentiText",
      subtitle: "AI-Generated Text Detection Engine",
      stack: "Python, XGBoost, DistilBERT, HuggingFace, GCP, Docker",
      link: "https://huggingface.co/spaces/Abhadre/AI-Text-detector",
      bullets: [
        "Trained a weighted ensemble model combining XGBoost (21 hand-crafted linguistic features: perplexity, burstiness, lexical density) with a fine-tuned DistilBERT transformer, achieving 99.1% F1 and 99.96% AUROC on held-out test data.",
        "Conducted systematic model comparison across four architectures (Logistic Regression, Random Forest, XGBoost, DistilBERT) using ROC curves, confusion matrices, and SHAP feature importance; integrated Captum token-level attribution heatmaps for explainable AI (XAI).",
        "Trained on the merged HC3 corpus spanning Wikipedia, Reddit, medicine, and finance domains; deployed as a publicly accessible machine learning inference app on HuggingFace Spaces.",
      ]
    }
  ]
};

// ── Load job config if provided ───────────────────────────────
const jobFile = process.argv[2];
let job = {};
if (jobFile) {
  if (!fs.existsSync(jobFile)) {
    console.error(`File not found: ${jobFile}`);
    process.exit(1);
  }
  job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  console.log(`Using job config: ${job.company} — ${job.role}`);
}

const summary    = job.summary    || base.summary;
const skills     = { ...base.skills, ...(job.skills || {}) };
const experience = job.experience || base.experience;
const projects   = job.projects   || base.projects;
const skillSections = job.skillSections || [
  { label: 'Languages',       key: 'languages' },
  { label: 'ML / AI',         key: 'ml' },
  { label: 'Systems &amp; Infra', key: 'infra' },
  { label: 'Frontend',        key: 'frontend' },
];
const filename   = job.company
  ? `Abhishek_Bhadre_${job.company.replace(/\s+/g, '_')}${job.role ? '_' + job.role.replace(/\s+/g, '_') : ''}.pdf`
  : 'Abhishek_Bhadre.pdf';

// ── Render helpers ────────────────────────────────────────────
const renderBullets = (bullets) =>
  bullets.map(b => `<li>${b}</li>`).join('\n    ');

const renderExperience = (exp) => exp.map(e => `
  <div class="job-row">
    <div class="job-left">
      <span class="job-company">${e.company}</span>, ${e.title}
    </div>
    <div class="job-dates">${e.dates}</div>
  </div>
  <ul class="resume-list">
    ${renderBullets(e.bullets)}
  </ul>
`).join('\n');

const renderProjects = (projs) => projs.map(p => `
  <div class="proj-row">
    <span class="proj-name">${p.name}: ${p.subtitle}</span>
    <span class="proj-stack"> &nbsp;|&nbsp; ${p.stack}</span>
    &nbsp;<span class="proj-link"><a href="${p.link}">Website</a></span>
  </div>
  <ul class="resume-list">
    ${renderBullets(p.bullets)}
  </ul>
`).join('\n');

// ── Build HTML ────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Calibri, 'Segoe UI', Arial, sans-serif;
    font-size: 9pt;
    color: #111111;
    background: white;
    padding: 0.32in 0.45in;
    line-height: 1.2;
  }
  a { color: #111111; text-decoration: underline; }
  .name {
    text-align: center;
    font-size: 18pt;
    font-weight: bold;
    margin-bottom: 3px;
  }
  .contact {
    text-align: center;
    font-size: 9pt;
    margin-bottom: 6px;
    color: #111111;
  }
  .section-header {
    font-size: 9pt;
    font-weight: bold;
    text-transform: uppercase;
    color: #1E3A5F;
    border-bottom: 1px solid #999999;
    margin-top: 6px;
    margin-bottom: 3px;
    padding-bottom: 1px;
    letter-spacing: 0.04em;
  }
  .job-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 3px;
    margin-bottom: 1px;
  }
  .job-left { font-size: 9pt; }
  .job-company { font-weight: bold; }
  .job-dates { font-size: 8.5pt; color: #555555; white-space: nowrap; }
  .subline {
    font-size: 8.5pt;
    color: #555555;
    font-style: italic;
    margin-bottom: 2px;
  }
  .summary {
    font-size: 9pt;
    text-align: justify;
    margin-bottom: 1px;
  }
  ul.resume-list {
    margin: 0 0 2px 0;
    padding-left: 14px;
  }
  ul.resume-list li {
    font-size: 8.5pt;
    margin-bottom: 1px;
  }
  .proj-row {
    margin-top: 3px;
    margin-bottom: 1px;
  }
  .proj-name { font-weight: bold; font-size: 9pt; }
  .proj-stack { font-size: 8.5pt; color: #555555; font-style: italic; }
  .proj-link { font-size: 8.5pt; }
  .skill-row { font-size: 8.5pt; margin-bottom: 2px; }
  .skill-label { font-weight: bold; }
</style>
</head>
<body>

  <div class="name">Abhishek Bhadre</div>

  <div class="contact">
    Chicago, IL &nbsp;|&nbsp; (872) 288-3802 &nbsp;|&nbsp; bhadreabhi06@gmail.com &nbsp;|&nbsp;
    <a href="https://www.linkedin.com/in/abhishek-bhadre06/">LinkedIn</a> &nbsp;|&nbsp;
    <a href="https://github.com/abhadre66">GitHub</a> &nbsp;|&nbsp;
    <a href="https://animate-port-two.vercel.app">Portfolio</a>
  </div>

  <div class="section-header">Summary</div>
  <p class="summary">${summary}</p>

  <div class="section-header">Education</div>

  <div class="job-row">
    <div class="job-left">
      <span class="job-company">Illinois Institute of Technology</span>, M.S. in Artificial Intelligence
    </div>
    <div class="job-dates">Aug 2024 – May 2026</div>
  </div>
  <div class="subline">GPA: 3.30/4.0 &nbsp;|&nbsp; Machine Learning, Deep Learning, NLP, Computer Vision, Distributed Systems</div>

  <div class="job-row">
    <div class="job-left">
      <span class="job-company">Vishwakarma Institute of Technology</span>, B.Tech. in Instrumentation Engineering
    </div>
    <div class="job-dates">Aug 2019 – Jun 2023</div>
  </div>
  <div class="subline">GPA: 3.32/4.0</div>

  <div class="section-header">Experience</div>
  ${renderExperience(experience)}

  <div class="section-header">Projects</div>
  ${renderProjects(projects)}

  <div class="section-header">Technical Skills</div>
  ${skillSections.filter(s => skills[s.key]).map(s => `<div class="skill-row"><span class="skill-label">${s.label}:</span> ${skills[s.key]}</div>`).join('\n  ')}

  <div class="section-header">Certifications &amp; Achievements</div>
  <ul class="resume-list">
    <li><a href="https://learn.microsoft.com/api/credentials/share/en-us/AbhishekBhadre-7588/5FF4A6813F179511?sharingId=27FD363A71031B32">Microsoft Certified: Azure Fundamentals (AZ-900)</a></li>
    <li><a href="https://www.credly.com/badges/c3c06015-285d-4f28-8131-fa6500bcfb74/public_url">AWS Academy Graduate - Generative AI Foundations</a></li>
    <li>HackerRank: SQL Problem Solving (2022)</li>
    <li>INGENIOUS 2021: National Virtual Hackathon Participant</li>
  </ul>

</body>
</html>`;

// ── Generate PDF ──────────────────────────────────────────────
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const outPath = path.join(__dirname, filename);
  await page.pdf({
    path: outPath,
    format: 'Letter',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    pageRanges: '1',
  });
  await browser.close();
  console.log(`Done! ${filename} generated successfully.`);
})();
