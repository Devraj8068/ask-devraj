import type { ReactNode } from 'react'
import type { Source } from '../api'

// Minimal Markdown for agent answers: paragraphs, bullet lists, **bold** and [n] citation chips.

const INLINE = /(\*\*[^*]+\*\*|(?:\[\d+\])+)/g

function Cite({ n, source }: { n: number; source?: Source }) {
  return (
    <span className="cite" tabIndex={0} aria-label={source ? `Source ${n}: ${source.title}` : `Source ${n}`}>
      {n}
      {source && (
        <span className="cite-pop" role="tooltip">
          <strong>{source.title}</strong>
          <span>{source.text.length > 220 ? `${source.text.slice(0, 220)}…` : source.text}</span>
        </span>
      )}
    </span>
  )
}

function inline(text: string, sources: Source[], key: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const k = `${key}-${i}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={k}>{part.slice(2, -2)}</strong>
    if (/^(\[\d+\])+$/.test(part)) {
      const nums = [...part.matchAll(/\d+/g)].map((m) => Number(m[0]))
      return (
        <span key={k} className="cites">
          {nums.map((n) => (
            <Cite key={n} n={n} source={sources.find((s) => s.n === n)} />
          ))}
        </span>
      )
    }
    return part
  })
}

/** Models cite in several styles (【2】, [2†L1], [2,5]) — normalize to [2] / [2][5]. */
function normalizeCitations(text: string) {
  return text
    .replace(/【\s*(\d+)[^】]*】/g, '[$1]')
    .replace(/\[(\d+)†[^\]]*\]/g, '[$1]')
    .replace(/\[(\d+(?:\s*,\s*\d+)+)\]/g, (_, nums: string) => nums.split(',').map((n) => `[${n.trim()}]`).join(''))
}

export function RichText({ text, sources = [] }: { text: string; sources?: Source[] }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      const items = list
      blocks.push(
        <ul key={`ul-${blocks.length}`}>
          {items.map((item, i) => (
            <li key={i}>{inline(item, sources, `li-${blocks.length}-${i}`)}</li>
          ))}
        </ul>,
      )
      list = []
    }
  }
  normalizeCitations(text).split('\n').forEach((raw, i) => {
    const line = raw.trim()
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (bullet) list.push(bullet[1])
    else {
      flush()
      if (line) blocks.push(<p key={`p-${i}`}>{inline(line, sources, `p-${i}`)}</p>)
    }
  })
  flush()
  return <div className="rich">{blocks}</div>
}

/** Render resume-style text where **x** marks a metric. */
export function Emphasis({ text }: { text: string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p))}</>
}
