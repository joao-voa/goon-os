'use client'

import { useState, useEffect, useRef } from 'react'

/** Lista suspensa com checkbox: nenhum marcado = todos. */
export default function MultiSelect({ options, selected, onChange, allLabel, style }: {
  options: Array<{ value: string; label: string }>
  selected: string[]
  onChange: (v: string[]) => void
  allLabel: string
  style: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const isAll = selected.length === 0 || selected.length === options.length
  const text = isAll ? allLabel : options.filter(o => selected.includes(o.value)).map(o => o.label).join(', ')
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]
    onChange(next.length === options.length ? [] : next)
  }
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{ ...style, display: 'flex', alignItems: 'center', gap: 8, minWidth: 160, justifyContent: 'space-between' }}>
        <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 30, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: '4px 0', minWidth: '100%' }}>
          <label style={{ ...row, borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>
            <input type="checkbox" checked={isAll} onChange={() => onChange([])} />
            {allLabel}
          </label>
          {options.map(o => (
            <label key={o.value} style={row}>
              <input type="checkbox" checked={!isAll && selected.includes(o.value)} onChange={() => toggle(o.value)} />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
