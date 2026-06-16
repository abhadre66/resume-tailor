'use client'

import { diffWords } from 'diff'

interface ResumeData {
  summary: string
  skills: { languages?: string; ml?: string; infra?: string; frontend?: string }
  experience: { company: string; title: string; dates: string; bullets: string[] }[]
  projects: { name: string; subtitle: string; stack: string; link: string; bullets: string[] }[]
}

function WordDiff({ original, tailored }: { original: string; tailored: string }) {
  const parts = diffWords(original, tailored)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.added) return <mark key={i} className="bg-green-900/60 text-green-300 rounded px-0.5">{part.value}</mark>
        if (part.removed) return <mark key={i} className="bg-red-900/60 text-red-300 line-through rounded px-0.5">{part.value}</mark>
        return <span key={i} className="text-gray-300">{part.value}</span>
      })}
    </span>
  )
}

function BulletDiff({ originals, tailoreds }: { originals: string[]; tailoreds: string[] }) {
  const maxLen = Math.max(originals.length, tailoreds.length)

  return (
    <div className="space-y-2">
      {Array.from({ length: maxLen }).map((_, i) => {
        const orig = originals[i]
        const tail = tailoreds[i]

        if (!orig && tail) {
          return (
            <div key={i} className="flex gap-2 items-start">
              <div className="w-1 rounded bg-green-500 self-stretch flex-shrink-0"/>
              <p className="text-sm text-green-300 bg-green-900/20 rounded px-2 py-1 flex-1">{tail}</p>
            </div>
          )
        }

        if (orig && !tail) {
          return (
            <div key={i} className="flex gap-2 items-start">
              <div className="w-1 rounded bg-red-500 self-stretch flex-shrink-0"/>
              <p className="text-sm text-red-300 bg-red-900/20 line-through rounded px-2 py-1 flex-1">{orig}</p>
            </div>
          )
        }

        const hasChange = orig !== tail
        return (
          <div key={i} className={`flex gap-2 items-start ${hasChange ? '' : 'opacity-60'}`}>
            <div className={`w-1 rounded self-stretch flex-shrink-0 ${hasChange ? 'bg-yellow-500' : 'bg-gray-700'}`}/>
            <p className="text-sm rounded px-2 py-1 flex-1">
              {hasChange ? <WordDiff original={orig} tailored={tail} /> : <span className="text-gray-400">{tail}</span>}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default function DiffView({ original, tailored }: { original: ResumeData; tailored: ResumeData }) {
  const summaryChanged = original.summary !== tailored.summary
  const skillKeys = ['languages', 'ml', 'infra', 'frontend'] as const

  return (
    <div className="space-y-6 text-sm">

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-400 bg-gray-800 rounded-lg px-4 py-2">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-800 inline-block"/><mark className="bg-green-900/60 text-green-300 rounded px-1">Added</mark></span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-800 inline-block"/><mark className="bg-red-900/60 text-red-300 line-through rounded px-1">Removed</mark></span>
        <span className="flex items-center gap-1.5"><span className="w-1 h-3 rounded bg-yellow-500 inline-block"/>Modified bullet</span>
        <span className="flex items-center gap-1.5"><span className="w-1 h-3 rounded bg-gray-600 inline-block"/>Unchanged</span>
      </div>

      {/* Summary */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-bold uppercase text-blue-400 tracking-wider">Summary</h3>
          {summaryChanged && <span className="text-xs bg-yellow-900 text-yellow-400 px-2 py-0.5 rounded-full">Modified</span>}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          {summaryChanged
            ? <p><WordDiff original={original.summary} tailored={tailored.summary} /></p>
            : <p className="text-gray-400">{tailored.summary}</p>
          }
        </div>
      </section>

      {/* Experience */}
      <section>
        <h3 className="text-xs font-bold uppercase text-blue-400 tracking-wider mb-2">Experience</h3>
        {tailored.experience?.map((exp, i) => {
          const origExp = original.experience?.[i]
          return (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-3">
              <div className="flex justify-between items-baseline mb-3">
                <p className="font-semibold text-white">{exp.company} — {exp.title}</p>
                <span className="text-gray-500 text-xs">{exp.dates}</span>
              </div>
              <BulletDiff originals={origExp?.bullets || []} tailoreds={exp.bullets} />
            </div>
          )
        })}
      </section>

      {/* Projects */}
      <section>
        <h3 className="text-xs font-bold uppercase text-blue-400 tracking-wider mb-2">Projects</h3>
        {tailored.projects?.map((proj, i) => {
          const origProj = original.projects?.[i]
          return (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-3">
              <p className="font-semibold text-white mb-0.5">{proj.name}: {proj.subtitle}</p>
              <p className="text-gray-500 text-xs mb-3">{proj.stack}</p>
              <BulletDiff originals={origProj?.bullets || []} tailoreds={proj.bullets} />
            </div>
          )
        })}
      </section>

      {/* Skills */}
      <section>
        <h3 className="text-xs font-bold uppercase text-blue-400 tracking-wider mb-2">Skills</h3>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
          {skillKeys.map(key => {
            const orig = original.skills?.[key] || ''
            const tail = tailored.skills?.[key] || ''
            if (!tail) return null
            const changed = orig !== tail
            const labels: Record<string, string> = { languages: 'Languages', ml: 'ML / AI', infra: 'Systems & Infra', frontend: 'Frontend' }
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-white text-xs">{labels[key]}:</span>
                  {changed && <span className="text-xs bg-yellow-900 text-yellow-400 px-1.5 py-0.5 rounded-full">Reordered</span>}
                </div>
                {changed ? <p><WordDiff original={orig} tailored={tail} /></p> : <p className="text-gray-400 text-xs">{tail}</p>}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
