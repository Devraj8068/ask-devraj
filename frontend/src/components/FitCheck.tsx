import { useEffect, useRef, useState } from 'react'
import { streamAgent, upsertStep, type FitResult, type Source, type Step } from '../api'
import { sampleJD } from '../data'
import { RichText } from './RichText'
import { FIT_PIPELINE } from '../pipelines'
import { Trace } from './Trace'

const STATUS_LABEL = { match: 'Match', partial: 'Partial', gap: 'Gap' } as const

function ScoreRing({ score }: { score: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <svg className="ring" viewBox="0 0 80 80" width="88" height="88" role="img" aria-label={`Fit score ${score} percent`}>
      <circle cx="40" cy="40" r={r} className="ring-bg" />
      <circle cx="40" cy="40" r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 40 40)" />
      <text x="40" y="46" textAnchor="middle">
        {score}%
      </text>
    </svg>
  )
}

export function FitCheck() {
  const [jd, setJd] = useState('')
  const [steps, setSteps] = useState<Step[]>([])
  const [result, setResult] = useState<FitResult | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [totalMs, setTotalMs] = useState<number>()
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  async function analyze() {
    if (busy || jd.trim().length < 80) return
    setSteps([])
    setResult(null)
    setError('')
    setTotalMs(undefined)
    setBusy(true)
    abortRef.current = new AbortController()
    await streamAgent(
      '/api/fit',
      { jd },
      (e) => {
        if (e.type === 'step') setSteps((s) => upsertStep(s, e))
        else if (e.type === 'fit') {
          setResult(e.result)
          setSources(e.sources)
        } else if (e.type === 'error') setError(e.message)
        else if (e.type === 'done') setTotalMs(e.ms || undefined)
      },
      abortRef.current.signal,
    )
    setBusy(false)
  }

  const tooShort = jd.trim().length > 0 && jd.trim().length < 80

  return (
    <div className="agent-grid">
      <div className="fit">
        <label htmlFor="jd" className="fit-label">
          Paste a job description. The agent checks each requirement against Devraj's real experience and shows the gaps honestly.
        </label>
        <textarea
          id="jd"
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste the job description here…"
          maxLength={6000}
          rows={result ? 4 : 9}
        />
        <div className="fit-actions">
          <button type="button" className="btn ghost" onClick={() => setJd(sampleJD)} disabled={busy}>
            Use a sample JD
          </button>
          <span className="muted small">{tooShort ? 'Needs at least 80 characters' : `${jd.length}/6000`}</span>
          <button type="button" className="btn primary" onClick={() => void analyze()} disabled={busy || jd.trim().length < 80}>
            {busy ? 'Analyzing…' : 'Analyze fit'}
          </button>
        </div>

        {error && <p className="msg-error">{error}</p>}

        {result && (
          <div className="fit-result">
            <div className="fit-head">
              <ScoreRing score={result.score} />
              <div>
                <p className="eyebrow">Fit for</p>
                <h3>
                  {result.role}
                  {result.company ? <span className="muted"> · {result.company}</span> : null}
                </h3>
                {result.summary && <RichText text={result.summary} sources={sources} />}
              </div>
            </div>

            <ul className="fit-rows">
              {result.rows.map((r, i) => (
                <li key={i} className={`fit-row ${r.status}`}>
                  <span className={`pill ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  <div>
                    <p className="req">
                      {r.text} {r.priority === 'nice' && <em className="muted">nice to have</em>}
                    </p>
                    <RichText text={r.evidence} sources={sources} />
                    {r.downgraded && <p className="muted small">Flagged by the validator: part of this evidence wasn't supported by his profile, so it's rated Partial.</p>}
                  </div>
                </li>
              ))}
            </ul>

            {result.talking_points.length > 0 && (
              <div className="talking">
                <p className="eyebrow">Worth asking him about</p>
                <ul>
                  {result.talking_points.map((t) => (
                    <li key={t}>
                      <RichText text={t} sources={sources} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="muted small">
              AI-generated from Devraj's resume and project notes and verified by a validator agent. Score weights must-haves 2× nice-to-haves.
            </p>
          </div>
        )}
      </div>
      <Trace pipeline={FIT_PIPELINE} steps={steps} totalMs={totalMs} idleText="Run a fit check to watch the agents extract requirements, gather evidence, assess and verify." />
    </div>
  )
}
