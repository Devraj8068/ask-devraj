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
  let finished = false
  const emit = (e: AgentEvent) => {
    if (e.type === 'done') finished = true
    onEvent(e)
  }
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>
    try {
      chunk = await reader.read()
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      break // network dropped mid-stream; reported below
    }
    const { value, done } = chunk
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      for (const line of frame.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            emit(JSON.parse(line.slice(6)) as AgentEvent)
          } catch {
            /* ignore malformed frame */
          }
        }
      }
    }
  }
  if (!finished && !signal?.aborted) {
    // The stream ended without the server's final event (connection cut, server restarted, timeout).
    onEvent({ type: 'error', message: 'The connection to the agent was interrupted. Please try again.' })
    onEvent({ type: 'done', ms: 0 })
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

/** When a run ends, any step still "running" never finished: mark it as failed. */
export function settleSteps(steps: Step[]): Step[] {
  return steps.map((s) => (s.status === 'running' ? { ...s, status: 'error', detail: 'interrupted' } : s))
}

/** Merge a step event into the ordered step list (running -> done updates in place). */
export function upsertStep(steps: Step[], e: Step): Step[] {
  const i = steps.findIndex((s) => s.id === e.id)
  const next = { ...(i >= 0 ? steps[i] : {}), ...e }
  if (i < 0) return [...steps, next]
  return steps.map((s, j) => (j === i ? next : s))
}
