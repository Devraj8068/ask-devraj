import { useEffect, useState, type ReactNode } from 'react'
import { certifications, education, experience, metrics, profile, projects, skills } from '../data'
import { useCountUp, useInView, useTheme } from '../hooks'
import { Chat } from './Chat'
import { FitCheck } from './FitCheck'
import { Emphasis } from './RichText'

export type AgentStatus = 'checking' | 'online' | 'waking' | 'offline'

const NAV = [
  ['#agent', 'Ask'],
  ['#experience', 'Experience'],
  ['#projects', 'Projects'],
  ['#skills', 'Skills'],
  ['#contact', 'Contact'],
]

export function Nav() {
  const [theme, toggle] = useTheme()
  return (
    <header className="nav">
      <a href="#top" className="brand" aria-label="Devraj Gaikwad, home">
        <span className="logo">DG</span>
        <span className="brand-name">Devraj Gaikwad</span>
      </a>
      <nav aria-label="Sections">
        {NAV.map(([href, label]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </nav>
      <button type="button" className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? (
          <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
        )}
      </button>
    </header>
  )
}

function Metric({ m, start }: { m: (typeof metrics)[number]; start: boolean }) {
  const v = useCountUp(m.value, start)
  const shown = Number.isInteger(m.value) ? Math.round(v) : v.toFixed(1)
  return (
    <div className="metric">
      <span className="metric-value">
        {m.prefix}
        {shown}
        {m.suffix}
      </span>
      <span className="metric-label">{m.label}</span>
      <span className="metric-note">{m.note}</span>
    </div>
  )
}

export function Hero() {
  const [ref, inView] = useInView<HTMLDivElement>(0.3)
  return (
    <section id="top" className="hero">
      <p className="status-pill">
        <span className="dot" /> {profile.openTo} · {profile.location}
      </p>
      <h1>
        {profile.name}
        <span className="hero-role">{profile.title}</span>
      </h1>
      <p className="hero-tagline">{profile.tagline}</p>
      <div className="hero-cta">
        <a className="btn primary" href="#agent">
          Ask my agent
        </a>
        <a className="btn" href="#agent" onClick={() => window.dispatchEvent(new CustomEvent('open-fit'))}>
          Check my fit for a role
        </a>
        <a className="btn ghost" href={profile.resume} target="_blank" rel="noreferrer">
          Resume (PDF)
        </a>
      </div>
      <div className="metrics" ref={ref}>
        {metrics.map((m) => (
          <Metric key={m.label} m={m} start={inView} />
        ))}
      </div>
    </section>
  )
}

export function AgentSection({ status }: { status: AgentStatus }) {
  const [tab, setTab] = useState<'ask' | 'fit'>('ask')
  // The hero's "Check my fit" button switches tabs.
  useEffect(() => {
    const open = () => setTab('fit')
    window.addEventListener('open-fit', open)
    return () => window.removeEventListener('open-fit', open)
  }, [])
  const statusText = {
    checking: 'Connecting…',
    online: 'Agent online',
    waking: 'Waking up the agent (free hosting sleeps when idle, ~30s)…',
    offline: 'Agent offline right now. Please try again later or email me.',
  }[status]

  return (
    <section id="agent" className="section">
      <div className="section-head">
        <p className="eyebrow">Ask Devraj</p>
        <h2>Don't just read my resume. Interrogate it.</h2>
        <p className="muted">
          A LangGraph multi-agent pipeline answers from my resume and projects, the same pattern I build in production. Watch each
          agent work in the trace.
        </p>
      </div>
      <div className="agent-card">
        <div className="agent-top">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'ask'} className={tab === 'ask' ? 'active' : ''} onClick={() => setTab('ask')}>
              Ask anything
            </button>
            <button role="tab" aria-selected={tab === 'fit'} className={tab === 'fit' ? 'active' : ''} onClick={() => setTab('fit')}>
              Fit check <span className="tag">for recruiters</span>
            </button>
          </div>
          <span className={`agent-status ${status}`}>
            <span className="dot" /> {statusText}
          </span>
        </div>
        <div hidden={tab !== 'ask'}>
          <Chat />
        </div>
        <div hidden={tab !== 'fit'}>
          <FitCheck />
        </div>
      </div>
    </section>
  )
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>(0.15)
  return (
    <div ref={ref} className={`reveal ${inView ? 'in' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function Experience() {
  return (
    <section id="experience" className="section">
      <div className="section-head">
        <p className="eyebrow">Experience</p>
        <h2>Shipping AI to production</h2>
      </div>
      <ol className="timeline">
        {experience.map((job) => (
          <li key={job.org}>
            <Reveal className="tl-item">
              <div className="tl-meta">
                <span className="mono">{job.period}</span>
                <span className="muted small">{job.meta}</span>
              </div>
              <div className="tl-body">
                <h3>
                  {job.role} <span className="muted">· {job.org}</span>
                </h3>
                <ul>
                  {job.points.map((p) => (
                    <li key={p}>
                      <Emphasis text={p} />
                    </li>
                  ))}
                </ul>
                <div className="chips">
                  {job.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          </li>
        ))}
        <li id="education">
          <Reveal className="tl-item">
            <div className="tl-meta">
              <span className="mono">{education.period}</span>
              <span className="muted small">Education</span>
            </div>
            <div className="tl-body">
              <h3>
                {education.degree} <span className="muted">· {education.detail}</span>
              </h3>
              <p className="muted">{education.school}</p>
            </div>
          </Reveal>
        </li>
      </ol>
    </section>
  )
}

export function Projects() {
  return (
    <section id="projects" className="section">
      <div className="section-head">
        <p className="eyebrow">Projects</p>
        <h2>Things I've built on my own</h2>
      </div>
      <div className="project-grid">
        {projects.map((p) => (
          <Reveal key={p.name} className="project">
            <div className="project-top">
              <h3>{p.name}</h3>
              {p.highlight && <span className="highlight">{p.highlight}</span>}
            </div>
            <p>{p.blurb}</p>
            <div className="chips">
              {p.stack.map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
            {p.link ? (
              <a className="link" href={p.link} target="_blank" rel="noreferrer">
                View on GitHub →
              </a>
            ) : (
              <a className="link" href="#agent">
                Try it above ↑
              </a>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  )
}

export function Skills() {
  return (
    <section id="skills" className="section">
      <div className="section-head">
        <p className="eyebrow">Skills</p>
        <h2>Toolbox</h2>
      </div>
      <div className="skill-grid">
        {skills.map((g) => (
          <Reveal key={g.group} className="skill-group">
            <h3>{g.group}</h3>
            <div className="chips">
              {g.items.map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="certs">
        <h3>Certifications</h3>
        <ul>
          {certifications.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </Reveal>
    </section>
  )
}

export function Contact() {
  return (
    <section id="contact" className="section contact">
      <h2>Let's build something.</h2>
      <p className="muted">I'm looking for GenAI and AI engineering roles. The fastest way to reach me is email.</p>
      <div className="hero-cta">
        <a className="btn primary" href={`mailto:${profile.email}`}>
          {profile.email}
        </a>
        <a className="btn" href={profile.linkedin} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
        <a className="btn" href={profile.github} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a className="btn ghost" href={profile.resume} target="_blank" rel="noreferrer">
          Resume (PDF)
        </a>
      </div>
      <footer className="footer muted small">
        Built by Devraj with React, FastAPI, LangGraph, FAISS and gpt-oss on Groq.
      </footer>
    </section>
  )
}
