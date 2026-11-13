import { useState } from 'react'
import type { Step } from '../api'


function StatusIcon({ status }: { status?: Step['status'] }) {
  if (status === 'running') return <span className="ico spin" aria-label="running" />
  if (status === 'done')
    return (
      <span className="ico ok" aria-label="done">
        <svg viewBox="0 0 16 16" width="12" height="12"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    )
  if (status === 'error') return <span className="ico err" aria-label="error">!</span>
  return <span className="ico idle" aria-label="pending" />
}

function StepDetails({ step }: { step: Step }) {
  const d = step.data
  if (!d) return null
  return (
    <div className="step-data">
      {d.intent && (
        <div className="kv">
          <span>intent</span>
          <code>{d.intent}</code>
        </div>
      )}
      {d.queries && d.queries.length > 0 && (
        <div className="chips">
          {d.queries.map((q) => (
            <code key={q} className="qchip">{q}</code>
          ))}
        </div>
      )}
      {d.requirements && (
        <ol className="reqs">
          {d.requirements.map((r) => (
            <li key={r.text}>
              {r.text} <em>{r.priority}</em>
            </li>
          ))}
        </ol>
      )}
      {d.hits && (
        <ul className="hits">
          {d.hits.map((h) => (
            <li key={h.n}>
              <span className="hit-n">{h.n}</span>
              <span className="hit-title">{h.title}</span>
              <span className="bar" title={`cosine similarity ${h.score}`}>
                <span style={{ width: `${Math.max(4, Math.min(100, h.score * 100))}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {d.unsupported_claims && d.unsupported_claims.length > 0 && (
        <ul className="claims">
          {d.unsupported_claims.map((c) => (
            <li key={c}>✗ {c}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Trace({
  pipeline,
  steps,
  totalMs,
  idleText,
}: {
  pipeline: { id: string; label: string; hint: string }[]
  steps: Step[]
  totalMs?: number
  idleText: string
}) {
  const [open, setOpen] = useState<string | null>(null)
  // Show the planned pipeline, plus any extra steps the agent took (e.g. Reviser).
  const ids = [...pipeline.map((p) => p.id), ...steps.map((s) => s.id).filter((id) => !pipeline.some((p) => p.id === id))]
  const skipped = steps.length > 0 && !steps.some((s) => s.status === 'running')

  return (
    <aside className="trace" aria-label="Agent trace">
      <div className="trace-head">
        <h3>Agent trace</h3>
        {totalMs ? <span className="muted mono">{(totalMs / 1000).toFixed(1)}s</span> : null}
      </div>
      {steps.length === 0 && <p className="muted small">{idleText}</p>}
      <ol className="steps">
        {ids.map((id) => {
          const plan = pipeline.find((p) => p.id === id)
          const s = steps.find((x) => x.id === id)
          const hasData = !!s?.data && Object.keys(s.data).length > 0
          const isSkipped = skipped && !s
          return (
            <li key={id} className={`step ${s?.status ?? 'pending'} ${isSkipped ? 'skipped' : ''}`}>
              <button
                type="button"
                className="step-row"
                onClick={() => hasData && setOpen(open === id ? null : id)}
                aria-expanded={hasData ? open === id : undefined}
                disabled={!hasData}
              >
                <StatusIcon status={s?.status} />
                <span className="step-label">{s?.label ?? plan?.label ?? id}</span>
                {s?.ms != null && <span className="mono muted ms">{s.ms} ms</span>}
                {hasData && <span className="chev">{open === id ? '−' : '+'}</span>}
              </button>
              <p className="step-detail">{isSkipped ? 'skipped — not needed for this message' : s?.detail || plan?.hint}</p>
              {open === id && s && <StepDetails step={s} />}
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
