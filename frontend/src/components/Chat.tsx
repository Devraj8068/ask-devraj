import { useEffect, useRef, useState, type FormEvent } from 'react'
import { streamAgent, upsertStep, type Source, type Step } from '../api'
import { suggestedQuestions } from '../data'
import { RichText } from './RichText'
import { CHAT_PIPELINE } from '../pipelines'
import { Trace } from './Trace'

type Message = {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  verified?: boolean
  revisedClaims?: string[]
  error?: string
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [steps, setSteps] = useState<Step[]>([])
  const [totalMs, setTotalMs] = useState<number>()
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const updateLast = (fn: (m: Message) => Message) =>
    setMessages((ms) => ms.map((m, i) => (i === ms.length - 1 ? fn(m) : m)))

  async function ask(question: string) {
    const q = question.trim()
    if (!q || busy) return
    const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }))
    setMessages((ms) => [...ms, { role: 'user', content: q }, { role: 'assistant', content: '' }])
    setInput('')
    setSteps([])
    setTotalMs(undefined)
    setBusy(true)
    abortRef.current = new AbortController()

    await streamAgent(
      '/api/chat',
      { question: q, history },
      (e) => {
        switch (e.type) {
          case 'step':
            setSteps((s) => upsertStep(s, e))
            break
          case 'token':
            updateLast((m) => ({ ...m, content: m.content + e.text }))
            break
          case 'sources':
            updateLast((m) => ({ ...m, sources: e.items }))
            break
          case 'verdict':
            updateLast((m) => ({ ...m, verified: e.supported, revisedClaims: e.supported ? undefined : e.claims }))
            break
          case 'replace':
            updateLast((m) => ({ ...m, content: e.text }))
            break
          case 'error':
            updateLast((m) => ({ ...m, error: e.message }))
            break
          case 'done':
            setTotalMs(e.ms || undefined)
            break
        }
      },
      abortRef.current.signal,
    )
    setBusy(false)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void ask(input)
  }

  const last = messages[messages.length - 1]
  const thinking = busy && last?.role === 'assistant' && !last.content && !last.error

  return (
    <div className="agent-grid">
      <div className="chat">
        <div className="chat-log" ref={logRef} aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-empty">
              <p className="lead">
                Hi! I'm Devraj's portfolio agent. Ask me about his experience, projects or skills. Every answer is grounded in his
                resume, cited, and fact-checked before you see it.
              </p>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="msg user">
                {m.content}
              </div>
            ) : (
              <div key={i} className="msg bot">
                {m.content && <RichText text={m.content} sources={m.sources} />}
                {thinking && i === messages.length - 1 && (
                  <span className="typing" aria-label="Agent is thinking">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
                {m.error && <p className="msg-error">{m.error}</p>}
                {(m.verified !== undefined || (m.sources && m.sources.length > 0)) && !m.error && (
                  <div className="msg-foot">
                    {m.verified === true && <span className="badge ok">✓ Fact-checked against sources</span>}
                    {m.verified === false && (
                      <span className="badge warn" title={m.revisedClaims?.join('; ')}>
                        ↻ Revised: removed {m.revisedClaims?.length} unsupported claim{m.revisedClaims?.length === 1 ? '' : 's'}
                      </span>
                    )}
                    {m.sources && m.sources.length > 0 && (
                      <details className="sources">
                        <summary>{m.sources.length} sources</summary>
                        <ol>
                          {m.sources.map((s) => (
                            <li key={s.n}>
                              <a href={s.url}>{s.title}</a>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ),
          )}
        </div>

        <div className="suggestions" aria-label="Suggested questions">
          {suggestedQuestions.map((q) => (
            <button key={q} type="button" className="chip" onClick={() => void ask(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>

        <form className="ask-form" onSubmit={onSubmit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about Devraj…"
            maxLength={500}
            aria-label="Your question"
          />
          <button type="submit" className="btn primary" disabled={busy || !input.trim()}>
            {busy ? 'Thinking…' : 'Ask'}
          </button>
        </form>
      </div>
      <Trace pipeline={CHAT_PIPELINE} steps={steps} totalMs={totalMs} idleText="Ask a question to watch the agents plan, retrieve, answer and fact-check in real time." />
    </div>
  )
}
