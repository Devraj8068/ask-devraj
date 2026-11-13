// Client for the FastAPI backend. Responses stream as Server-Sent Events over a POST.

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000'

export type StepStatus = 'running' | 'done' | 'error'

export type Step = {
  id: string
  label: string
  status: StepStatus
  detail?: string
  ms?: number
  data?: {
    intent?: string
    queries?: string[]
    hits?: { n: number; title: string; score: number }[]
    supported?: boolean
    unsupported_claims?: string[]
    requirements?: { text: string; priority: string }[]
    checked?: number
    downgraded?: number[]
  }
}

export type Source = { n: number; title: string; url: string; text: string; score: number }

export type FitRow = {
  text: string
  priority: 'must' | 'nice'
  status: 'match' | 'partial' | 'gap'
  evidence: string
  sources: number[]
  downgraded?: boolean
}

export type FitResult = {
  role: string
  company: string
  score: number
  rows: FitRow[]
  summary: string
  talking_points: string[]
}

export type AgentEvent =
  | ({ type: 'step' } & Step)
  | { type: 'token'; text: string }
  | { type: 'sources'; items: Source[] }
  | { type: 'verdict'; supported: boolean; claims: string[] }
  | { type: 'replace'; text: string }
  | { type: 'fit'; result: FitResult; sources: Source[] }
  | { type: 'error'; message: string }
  | { type: 'done'; ms: number }

export async function streamAgent(
  path: '/api/chat' | '/api/fit',
  body: unknown,
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') return
    onEvent({ type: 'error', message: "Couldn't reach the agent. It may be waking up — try again in a few seconds." })
    onEvent({ type: 'done', ms: 0 })
    return
  }
  if (!res.ok || !res.body) {
    let message = 'The agent could not answer that.'
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') message = data.detail
      else if (Array.isArray(data.detail)) message = 'Please check your input (job descriptions need at least 80 characters).'
    } catch {
      /* keep default */
    }
    onEvent({ type: 'error', message })
    onEvent({ type: 'done', ms: 0 })
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      for (const line of frame.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            onEvent(JSON.parse(line.slice(6)) as AgentEvent)
          } catch {
            /* ignore malformed frame */
          }
        }
      }
    }
  }
}

export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/health`, { signal })
    return res.ok
  } catch {
    return false
  }
}

/** Merge a step event into the ordered step list (running -> done updates in place). */
export function upsertStep(steps: Step[], e: Step): Step[] {
  const i = steps.findIndex((s) => s.id === e.id)
  const next = { ...(i >= 0 ? steps[i] : {}), ...e }
  if (i < 0) return [...steps, next]
  return steps.map((s, j) => (j === i ? next : s))
}
