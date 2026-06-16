'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STEPS = ['Analyzing job description...', 'Tailoring your resume with AI...', 'Saving results...']

interface Resume {
  id: string
  name: string
}

function TailorForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialResumeId = searchParams.get('resumeId') || ''
  const retailorId = searchParams.get('retailorId') || ''

  const [resumes, setResumes] = useState<Resume[]>([])
  const [selectedResumeId, setSelectedResumeId] = useState(initialResumeId)
  const [mode, setMode] = useState<'paste' | 'url'>('paste')
  const [jdText, setJdText] = useState('')
  const [jdUrl, setJdUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoSelecting, setAutoSelecting] = useState(false)
  const [autoSelectReason, setAutoSelectReason] = useState('')
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: r } = await supabase
        .from('resumes')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (r) setResumes(r)

      // Pre-fill JD from a previous application being re-tailored
      if (retailorId) {
        const { data: app } = await supabase
          .from('applications')
          .select('jd_text, resume_id')
          .eq('id', retailorId)
          .single()
        if (app) {
          setJdText(app.jd_text || '')
          setSelectedResumeId(app.resume_id || initialResumeId)
        }
      }
    }
    load()
  }, [retailorId, initialResumeId])

  async function getAuthHeader() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    return `Bearer ${session.access_token}`
  }

  async function handleAutoSelect() {
    const text = jdText.trim()
    if (!text) { setError('Paste the job description first, then auto-select.'); return }
    if (resumes.length <= 1) {
      if (resumes.length === 1) setSelectedResumeId(resumes[0].id)
      return
    }
    setAutoSelecting(true)
    setError('')
    setAutoSelectReason('')
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const res = await fetch(`${apiUrl}/api/auto-select-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: await getAuthHeader() },
        body: JSON.stringify({ jdText: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSelectedResumeId(data.resumeId)
      setAutoSelectReason(data.reason || '')
    } catch (err: any) {
      setError(err.message || 'Auto-select failed')
    }
    setAutoSelecting(false)
  }

  async function handleTailor() {
    if (mode === 'paste' && !jdText.trim()) { setError('Please paste the job description.'); return }
    if (mode === 'url' && !jdUrl.trim()) { setError('Please enter a job URL.'); return }
    if (!selectedResumeId) { setError('Please select a resume.'); return }

    setLoading(true)
    setError('')
    setStep(0)

    try {
      const authHeader = await getAuthHeader()
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

      let finalJdText = jdText
      if (mode === 'url') {
        const scrapeRes = await fetch(`${apiUrl}/api/scrape-jd`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify({ url: jdUrl }),
        })
        const scrapeData = await scrapeRes.json()
        if (!scrapeRes.ok) throw new Error(scrapeData.error || 'Failed to fetch job page')
        finalJdText = scrapeData.text
      }

      setStep(1)
      const tailorRes = await fetch(`${apiUrl}/api/tailor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ resumeId: selectedResumeId, jdText: finalJdText, jdUrl: mode === 'url' ? jdUrl : null }),
      })
      const tailorData = await tailorRes.json()
      if (!tailorRes.ok) throw new Error(tailorData.error || 'Tailoring failed')

      setStep(2)
      const pdfRes = await fetch(`${apiUrl}/api/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({ applicationId: tailorData.applicationId }),
      })
      const pdfData = await pdfRes.json()
      if (!pdfRes.ok) throw new Error(pdfData.error || 'PDF generation failed')

      router.push(`/dashboard/results/${tailorData.applicationId}?downloadUrl=${encodeURIComponent(pdfData.downloadUrl)}`)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const selectedResume = resumes.find(r => r.id === selectedResumeId)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition text-sm">← Back</button>
        <h1 className="text-xl font-bold">ResumeAI</h1>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold mb-2">{retailorId ? 'Re-tailor Resume' : 'Tailor Resume'}</h2>
        <p className="text-gray-400 mb-8">Paste a job description or drop a URL and we'll tailor your resume in seconds.</p>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5">

          {/* Resume selector — shown when multiple resumes exist or none pre-selected */}
          {resumes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Base Resume</label>
              <div className="flex gap-2">
                <select
                  value={selectedResumeId}
                  onChange={e => { setSelectedResumeId(e.target.value); setAutoSelectReason('') }}
                  className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                >
                  {!selectedResumeId && <option value="">Select a resume...</option>}
                  {resumes.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                {resumes.length > 1 && (
                  <button
                    onClick={handleAutoSelect}
                    disabled={autoSelecting}
                    className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition whitespace-nowrap"
                  >
                    {autoSelecting ? '...' : 'Auto-pick'}
                  </button>
                )}
              </div>
              {autoSelectReason && (
                <p className="text-green-400 text-xs mt-1.5 px-1">AI picked <strong>{selectedResume?.name}</strong>: {autoSelectReason}</p>
              )}
            </div>
          )}

          {resumes.length === 0 && (
            <div className="bg-yellow-900/30 border border-yellow-800 rounded-xl px-4 py-3 text-yellow-400 text-sm">
              No resumes uploaded yet. <a href="/dashboard/upload" className="underline">Upload one first.</a>
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex bg-gray-800 rounded-xl p-1 gap-1">
            {(['paste', 'url'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${mode === m ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {m === 'paste' ? 'Paste JD' : 'Job URL'}
              </button>
            ))}
          </div>

          {mode === 'paste' ? (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Job Description</label>
              <textarea
                rows={12}
                placeholder="Paste the full job description here..."
                value={jdText}
                onChange={e => setJdText(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none text-sm"
              />
              <p className="text-gray-600 text-xs mt-1">{jdText.length} characters</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Job URL</label>
              <input
                type="url"
                placeholder="https://jobs.example.com/..."
                value={jdUrl}
                onChange={e => setJdUrl(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <p className="text-gray-500 text-xs mt-1">We'll scrape the job page automatically. If it fails, switch to Paste JD.</p>
            </div>
          )}

          {error && <p className="text-red-400 text-sm bg-red-950 border border-red-900 rounded-lg px-3 py-2">{error}</p>}

          {loading && (
            <div className="bg-gray-800 rounded-xl p-4">
              {STEPS.map((s, i) => (
                <div key={i} className={`flex items-center gap-3 py-1.5 text-sm ${i < step ? 'text-green-400' : i === step ? 'text-white' : 'text-gray-600'}`}>
                  {i < step ? (
                    <span>✓</span>
                  ) : i === step ? (
                    <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0"/>
                  )}
                  {s}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleTailor}
            disabled={loading || !selectedResumeId}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? 'Tailoring...' : 'Tailor My Resume'}
          </button>
        </div>
      </main>
    </div>
  )
}

export default function TailorPage() {
  return (
    <Suspense>
      <TailorForm />
    </Suspense>
  )
}
