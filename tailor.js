// ============================================================
//  Abhishek Bhadre — AI Resume Tailor
//
//  Usage:
//    node tailor.js jd.txt          → reads JD from file
//    pbpaste | node tailor.js       → reads JD from clipboard/stdin
//
//  Output:
//    jobs/<Company>_<Role>.json     → saved tailored config
//    Abhishek_Bhadre_<Company>_<Role>.pdf
// ============================================================

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Base resume content ───────────────────────────────────────
const BASE_RESUME = {
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

// ── Fetch JD from URL using puppeteer ────────────────────────
async function fetchFromURL(url) {
  const puppeteer = require('puppeteer');
  console.log(`Fetching job page: ${url}`);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  const text = await page.evaluate(() => document.body.innerText);
  await browser.close();
  return text;
}

// ── Read JD from URL, file, or stdin ─────────────────────────
async function readJD() {
  const arg = process.argv[2];
  if (arg) {
    if (arg.startsWith('http://') || arg.startsWith('https://')) return fetchFromURL(arg);
    if (fs.existsSync(arg)) return fs.readFileSync(arg, 'utf8');
    return arg;
  }
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
  });
}

// ── Main ──────────────────────────────────────────────────────
(async () => {
  const jd = await readJD();
  if (!jd.trim()) {
    console.error('No job description provided. Usage: node tailor.js jd.txt  OR  pbpaste | node tailor.js');
    process.exit(1);
  }

  console.log('Tailoring resume with Claude...');

  const prompt = `You are a resume tailoring assistant. Given a candidate's base resume content and a job description, your job is to tailor the resume to best match the role.

RULES:
- Never invent or fabricate achievements, metrics, or technologies the candidate did not use
- Only reorder bullets, lightly rephrase wording to emphasize relevant skills, and surface the most relevant content first
- Keep all metrics (30%, 99.1% F1, 10,000+ images, etc.) exactly as they are
- The resume must read naturally, like a human wrote it
- Do NOT use em dashes, en dashes, double hyphens (--), tilde (~), or any other fancy punctuation
- Use plain punctuation only: commas, periods, semicolons, colons, parentheses, and regular hyphens where needed
- Return ONLY valid JSON with no markdown, no code blocks, no explanation

BASE RESUME CONTENT:
${JSON.stringify(BASE_RESUME, null, 2)}

JOB DESCRIPTION:
${jd}

Return a JSON object with this exact structure:
{
  "company": "CompanyName (no spaces, use underscores)",
  "role": "Role_Name (no spaces, use underscores)",
  "summary": "2-3 sentence tailored summary for this specific role",
  "skills": {
    "languages": "reordered language list prioritizing what this JD needs",
    "ml": "reordered ML/AI skills prioritizing what this JD needs",
    "infra": "reordered infra skills prioritizing what this JD needs",
    "frontend": "reordered frontend skills prioritizing what this JD needs"
  },
  "experience": [
    {
      "company": "RAWATTECH",
      "title": "Deep Learning Intern",
      "dates": "Sep 2022 – May 2023",
      "bullets": ["reordered/rephrased bullets — most relevant to this JD first"]
    }
  ],
  "projects": [
    {
      "name": "project name",
      "subtitle": "project subtitle",
      "stack": "tech stack",
      "link": "original link unchanged",
      "bullets": ["reordered/rephrased bullets — most relevant to this JD first"]
    }
  ]
}

Always keep the projects in this exact order: AI Interview Engine first, CodeSyntax AI second, AuthentiText third. Do not reorder them.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });

  const raw = message.content[0].text.trim();

  let tailored;
  try {
    tailored = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('Failed to parse Claude response as JSON.');
      console.error(raw);
      process.exit(1);
    }
    tailored = JSON.parse(match[0]);
  }

  const outFile = path.join(__dirname, 'jobs', `${tailored.company}_${tailored.role}.json`);
  fs.mkdirSync(path.join(__dirname, 'jobs'), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(tailored, null, 2));
  console.log(`Saved: ${outFile}`);

  execSync(`node generate_resume.js "${outFile}"`, { stdio: 'inherit' });
})();
