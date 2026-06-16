'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DiffView from '@/components/DiffView'

interface ResumeData {
  company: string
  role: string
  summary: string
  skills: { languages?: string; ml?: string; infra?: string; frontend?: string }
  experience: { company: string; title: string; dates: string; bullets: string[] }[]
  projects: { name: string; subtitle: string; stack: string; link: string; bullets: string[] }[]
}

interface AtsDetails {
  matched: string[]
  missing: string[]
}

function ScoreRing({ score }: { score: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <svg width="96" height="96" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={radius} fill="none" stroke="#374151" strokeWidth="8" />
      <circle
        cx="48" cy="48" r={radius} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x="48" y="52" textAnchor="middle" fontSize="18" fontWeight="bold" fill="white">{score}</text>
    </svg>
  )
}

function ResultsContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const downloadUrl = searchParams.get('downloadUrl')

  const [tailored, setTailored] = useState<ResumeData | null>(null)
  const [original, setOriginal] = useState<ResumeData | null>(null)
  const [atsScore, setAtsScore] = useState<number | null>(null)
  const [atsDetails, setAtsDetails] = useState<AtsDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [tab, setTab] = useState<'preview' | 'changes'>('preview')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('applications')
        .select('tailored_json, original_json, company, role, ats_score, ats_details')
        .eq('id', params.id)
        .single()
      if (data) {
        setTailored(data.tailored_json)
        setOriginal(data.original_json)
        if (data.ats_score != null) setAtsScore(data.ats_score)
        if (data.ats_details) setAtsDetails(data.ats_details)
      }
      setLoading(false)
    }
    load()
  }, [params.id])

  async function handleDownload() {
    if (!downloadUrl) return
    setDownloading(true)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `Resume_${tailored?.company}_${tailored?.role}.pdf`
    a.click()
    setDownloading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      </div>
    )
  }

  if (!tailored) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <p>Result not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white transition text-sm">← Dashboard</button>
          <h1 className="text-xl font-bold">ResumeAI</h1>
        </div>
        <button
          onClick={handleDownload}
          disabled={!downloadUrl || downloading}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2 rounded-xl transition flex items-center gap-2 text-sm"
        >
          {downloading ? 'Downloading...' : '↓ Download PDF'}
        </button>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">{tailored.company?.replace(/_/g, ' ')} — {tailored.role?.replace(/_/g, ' ')}</h2>
            <p className="text-gray-400 text-sm mt-1">Tailored resume</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="text-sm text-blue-400 hover:text-blue-300 transition">
            Tailor another →
          </button>
        </div>

        {/* ATS Score Card */}
        {atsScore != null && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                <ScoreRing score={atsScore} />
                <p className="text-center text-xs text-gray-400 mt-1">ATS Score</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase text-green-400 tracking-wider mb-1.5">
                    Matched ({atsDetails?.matched?.length ?? 0})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {atsDetails?.matched?.map((kw, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs bg-green-900/40 text-green-300 border border-green-800 px-2 py-0.5 rounded-full">
                        <span className="text-green-400">✓</span>{kw}
                      </span>
                    ))}
                  </div>
                </div>
                {(atsDetails?.missing?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase text-red-400 tracking-wider mb-1.5">
                      Missing ({atsDetails?.missing?.length ?? 0})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {atsDetails?.missing?.map((kw, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-900/40 text-red-300 border border-red-800 px-2 py-0.5 rounded-full">
                          <span className="text-red-400">✗</span>{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1 mb-6">
          {(['preview', 'changes'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {t === 'preview' ? 'Preview' : '⟷ Changes'}
            </button>
          ))}
        </div>

        {tab === 'preview' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5 text-sm">
            <section>
              <h3 className="text-xs font-bold uppercase text-blue-400 tracking-wider mb-2">Summary</h3>
              <p className="text-gray-300 leading-relaxed">{tailored.summary}</p>
            </section>

            {tailored.experience?.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase text-blue-400 tracking-wider mb-2">Experience</h3>
                {tailored.experience.map((exp, i) => (
                  <div key={i} className="mb-4">
                    <div className="flex justify-between items-baseline">
                      <p className="font-semibold">{exp.company} — {exp.title}</p>
                      <span className="text-gray-500 text-xs">{exp.dates}</span>
                    </div>
                    <ul className="mt-1.5 space-y-1 pl-4 list-disc text-gray-300">
                      {exp.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            {tailored.projects?.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase text-blue-400 tracking-wider mb-2">Projects</h3>
                {tailored.projects.map((proj, i) => (
                  <div key={i} className="mb-4">
                    <p className="font-semibold">{proj.name}: {proj.subtitle}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{proj.stack}</p>
                    <ul className="mt-1.5 space-y-1 pl-4 list-disc text-gray-300">
                      {proj.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            {tailored.skills && (
              <section>
                <h3 className="text-xs font-bold uppercase text-blue-400 tracking-wider mb-2">Skills</h3>
                <div className="space-y-1 text-gray-300">
                  {tailored.skills.languages && <p><span className="font-semibold text-white">Languages:</span> {tailored.skills.languages}</p>}
                  {tailored.skills.ml && <p><span className="font-semibold text-white">ML / AI:</span> {tailored.skills.ml}</p>}
                  {tailored.skills.infra && <p><span className="font-semibold text-white">Systems & Infra:</span> {tailored.skills.infra}</p>}
                  {tailored.skills.frontend && <p><span className="font-semibold text-white">Frontend:</span> {tailored.skills.frontend}</p>}
                </div>
              </section>
            )}
          </div>
        )}

        {tab === 'changes' && original && (
          <DiffView original={original} tailored={tailored} />
        )}

        {tab === 'changes' && !original && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-400">
            No original data found. Re-tailor this resume to see changes.
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <button
            onClick={handleDownload}
            disabled={!downloadUrl || downloading}
            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-xl transition"
          >
            {downloading ? 'Downloading...' : '↓ Download Tailored PDF'}
          </button>
        </div>
      </main>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsContent />
    </Suspense>
  )
}
