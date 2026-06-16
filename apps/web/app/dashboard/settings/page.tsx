'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  name: string
  location: string
  phone: string
  email: string
  linkedin: string
  github: string
  portfolio: string
}

const empty: Profile = { name: '', location: '', phone: '', email: '', linkedin: '', github: '', portfolio: '' }

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const res = await fetch(`${apiUrl}/api/profile`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.profile) setProfile({ ...empty, ...data.profile })
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
    await fetch(`${apiUrl}/api/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ profile }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function set(key: keyof Profile, val: string) {
    setProfile(p => ({ ...p, [key]: val }))
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

  const fields: { key: keyof Profile; label: string; placeholder: string; type?: string }[] = [
    { key: 'name',      label: 'Full Name',      placeholder: 'John Doe' },
    { key: 'location',  label: 'Location',        placeholder: 'Chicago, IL' },
    { key: 'phone',     label: 'Phone',           placeholder: '(555) 123-4567' },
    { key: 'email',     label: 'Email',           placeholder: 'you@example.com', type: 'email' },
    { key: 'linkedin',  label: 'LinkedIn URL',    placeholder: 'https://linkedin.com/in/yourname' },
    { key: 'github',    label: 'GitHub URL',      placeholder: 'https://github.com/yourname' },
    { key: 'portfolio', label: 'Portfolio URL',   placeholder: 'https://yoursite.com' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white transition text-sm">← Dashboard</button>
        <h1 className="text-xl font-bold">ResumeAI</h1>
      </nav>

      <main className="max-w-xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Profile Settings</h2>
          <p className="text-gray-400 text-sm mt-1">These details appear on every PDF resume you generate.</p>
        </div>

        <form onSubmit={handleSave} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-300 mb-1">{f.label}</label>
              <input
                type={f.type || 'text'}
                value={profile[f.key]}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          ))}

          <div className="pt-2 flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            {saved && <span className="text-green-400 text-sm">Saved! New PDFs will use these details.</span>}
          </div>
        </form>
      </main>
    </div>
  )
}
