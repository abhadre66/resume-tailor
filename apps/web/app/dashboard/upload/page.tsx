'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleUpload() {
    if (!name.trim()) { setError('Please enter a name for this resume.'); return }
    if (!file) { setError('Please select a PDF file.'); return }

    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('name', name)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/resume/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition text-sm">← Back</button>
        <h1 className="text-xl font-bold">ResumeAI</h1>
      </nav>

      <main className="max-w-xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold mb-2">Upload Base Resume</h2>
        <p className="text-gray-400 mb-8">This is the resume we'll tailor for each job. Upload your best, most complete version.</p>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Resume Name</label>
            <input
              type="text"
              placeholder="e.g. ML Engineer Base"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">PDF File</label>
            <div
              className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-blue-500 transition"
              onClick={() => document.getElementById('file-input')?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') setFile(f) }}
            >
              {file ? (
                <div>
                  <p className="text-blue-400 font-medium">{file.name}</p>
                  <p className="text-gray-500 text-xs mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <>
                  <p className="text-gray-400">Click or drag & drop a PDF</p>
                  <p className="text-gray-600 text-sm mt-1">PDF only, max 5MB</p>
                </>
              )}
              <input
                id="file-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm bg-red-950 border border-red-900 rounded-lg px-3 py-2">{error}</p>}

          <button
            onClick={handleUpload}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Uploading...
              </>
            ) : 'Upload Resume'}
          </button>
        </div>
      </main>
    </div>
  )
}
