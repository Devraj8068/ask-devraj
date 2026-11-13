import { useEffect, useState } from 'react'
import { checkHealth } from './api'
import { AgentSection, Contact, Experience, Hero, Nav, Projects, Skills, type AgentStatus } from './components/Sections'

/** Free hosting sleeps when idle: poll the health endpoint until the agent is up (about 90s max). */
function useAgentStatus(): AgentStatus {
  const [status, setStatus] = useState<AgentStatus>('checking')
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const started = Date.now()
    const poll = async () => {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 6000)
      const ok = await checkHealth(ctrl.signal)
      clearTimeout(t)
      if (cancelled) return
      if (ok) return setStatus('online')
      if (Date.now() - started > 90_000) return setStatus('offline')
      setStatus('waking')
      timer = setTimeout(poll, 5000)
    }
    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])
  return status
}

export default function App() {
  const status = useAgentStatus()
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <AgentSection status={status} />
        <Experience />
        <Projects />
        <Skills />
        <Contact />
      </main>
    </>
  )
}
