'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SignOutButton from './SignOutButton'

interface Resume {
  id: string
  name: string
  created_at: string
}

interface Application {
  id: string
  company: string
  role: string
  ats_score: number | null
  created_at: string
  resume_id: string
  jd_text: string
  pdf_url: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [resumes, setResumes] = useState<Resume[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingResume, setDeletingResume] = useState<string | null>(null)
  const [deletingApp, setDeletingApp] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email || '')

      const [{ data: r }, { data: a }] = await Promise.all([
        supabase.from('resumes').select('id, name, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('applications').select('id, company, role, ats_score, created_at, resume_id, jd_text, pdf_url').eq('user_id', user.id).order('created_at', { ascending: false }),
      ])
      setResumes(r || [])
      setApplications(a || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function getAuthHeader() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return `Bearer ${session?.access_token}`
  }

  async function deleteResume(id: string) {
    if (!confirm('Delete this resume and all its tailored applications?')) return
    setDeletingResume(id)
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/resume/${id}`, {
      method: 'DELETE',
      headers: { Authorization: await getAuthHeader() },
    })
    if (res.ok) {
      setResumes(prev => prev.filter(r => r.id !== id))
      setApplications(prev => prev.filter(a => a.resume_id !== id))
    }
    setDeletingResume(null)
  }

  async function deleteApplication(id: string) {
    if (!confirm('Delete this tailored application?')) return
    setDeletingApp(id)
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/application/${id}`, {
      method: 'DELETE',
      headers: { Authorization: await getAuthHeader() },
    })
    if (res.ok) setApplications(prev => prev.filter(a => a.id !== id))
    setDeletingApp(null)
  }

  function scoreColor(score: number | null) {
    if (score == null) return 'text-gray-500 bg-gray-800'
    if (score >= 75) return 'text-green-400 bg-green-900/40'
    if (score >= 50) return 'text-yellow-400 bg-yellow-900/40'
    return 'text-red-400 bg-red-900/40'
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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">ResumeAI</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm hidden sm:block">{userEmail}</span>
          <button onClick={() => router.push('/dashboard/settings')} className="text-gray-400 hover:text-white text-sm transition">Settings</button>
          <SignOutButton />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-12">

        {/* Resumes */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold">My Resumes</h2>
              <p className="text-gray-400 text-sm mt-0.5">Your base resumes. Upload multiple variants for different roles.</p>
            </div>
            <Link
              href="/dashboard/upload"
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm"
            >
              + Upload Resume
            </Link>
          </div>

          {resumes.length > 0 ? (
            <div className="grid gap-3">
              {resumes.map(resume => (
                <div key={resume.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{resume.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">Uploaded {new Date(resume.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/tailor?resumeId=${resume.id}`}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition"
                    >
                      Tailor →
                    </Link>
                    <button
                      onClick={() => deleteResume(resume.id)}
                      disabled={deletingResume === resume.id}
                      className="text-gray-500 hover:text-red-400 disabled:opacity-40 transition text-sm px-2 py-1.5"
                      title="Delete resume"
                    >
                      {deletingResume === resume.id ? '...' : '✕'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-gray-700 rounded-2xl p-14 text-center">
              <p className="text-gray-500 mb-2">No resumes yet</p>
              <Link href="/dashboard/upload" className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm">
                Upload your first resume
              </Link>
            </div>
          )}
        </section>

        {/* Applications */}
        {applications.length > 0 && (
          <section>
            <div className="mb-5">
              <h2 className="text-2xl font-bold">Tailored Applications</h2>
              <p className="text-gray-400 text-sm mt-0.5">All your tailored resumes. Re-tailor or download anytime.</p>
            </div>

            <div className="grid gap-3">
              {applications.map(app => (
                <div key={app.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">
                      {app.company?.replace(/_/g, ' ')} — {app.role?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">{new Date(app.created_at).toLocaleDateString()}</p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {app.ats_score != null && (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${scoreColor(app.ats_score)}`}>
                        ATS {app.ats_score}
                      </span>
                    )}
                    <Link
                      href={`/dashboard/tailor?resumeId=${app.resume_id}&retailorId=${app.id}`}
                      className="text-blue-400 hover:text-blue-300 text-sm transition"
                    >
                      Re-tailor
                    </Link>
                    <Link
                      href={`/dashboard/results/${app.id}`}
                      className="text-gray-300 hover:text-white text-sm transition"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => deleteApplication(app.id)}
                      disabled={deletingApp === app.id}
                      className="text-gray-500 hover:text-red-400 disabled:opacity-40 transition text-sm px-1"
                      title="Delete application"
                    >
                      {deletingApp === app.id ? '...' : '✕'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
