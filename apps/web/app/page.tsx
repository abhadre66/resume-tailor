import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <nav className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h1 className="text-xl font-bold">ResumeAI</h1>
        <Link href="/login" className="text-sm bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg transition font-medium">
          Get Started
        </Link>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-5xl font-bold mb-4 max-w-2xl leading-tight">
          Tailor your resume to any job in seconds
        </h2>
        <p className="text-gray-400 text-lg mb-8 max-w-xl">
          Paste a job description, get a perfectly tailored, ATS-optimized PDF resume. Powered by Claude AI.
        </p>
        <Link
          href="/login"
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3.5 rounded-xl text-lg transition"
        >
          Get Started
        </Link>
      </main>
    </div>
  )
}
