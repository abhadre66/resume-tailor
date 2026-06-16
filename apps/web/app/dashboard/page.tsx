import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from './SignOutButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: resumes } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">ResumeAI</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm hidden sm:block">{user.email}</span>
          <SignOutButton />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold">My Resumes</h2>
            <p className="text-gray-400 mt-1">Upload a base resume, then tailor it to any job.</p>
          </div>
          <Link
            href="/dashboard/upload"
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl transition text-sm"
          >
            + Upload Resume
          </Link>
        </div>

        {resumes && resumes.length > 0 ? (
          <div className="grid gap-4">
            {resumes.map((resume) => (
              <div key={resume.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{resume.name}</p>
                  <p className="text-gray-400 text-sm mt-0.5">
                    Uploaded {new Date(resume.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-green-900 text-green-400 px-3 py-1 rounded-full">Active</span>
                  <Link
                    href={`/dashboard/tailor?resumeId=${resume.id}`}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition"
                  >
                    Tailor →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-gray-700 rounded-2xl p-16 text-center">
            <p className="text-gray-500 text-lg mb-2">No resumes yet</p>
            <p className="text-gray-600 text-sm mb-6">Upload your base resume to get started</p>
            <Link
              href="/dashboard/upload"
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl transition"
            >
              Upload your first resume
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
