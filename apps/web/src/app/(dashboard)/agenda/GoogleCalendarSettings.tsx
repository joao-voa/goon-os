'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

export interface CalendarConfig {
  enabled: boolean
  serviceAccountEmail: string | null
  clientId: string | null
  scopes: string[]
  mentors: Array<{ id: string; name: string; email: string; isActive: boolean }>
  knownMentorNames: string[]
}

const C = {
  ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc',
  neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#f59e0b',
}
const sans = 'var(--font-sans)'

export default function GoogleCalendarSettings({ onClose, onChanged }: { onClose: () => void; onChanged: (cfg: CalendarConfig) => void }) {
  const [cfg, setCfg] = useState<CalendarConfig | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [tests, setTests] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<CalendarConfig>('/api/meetings/calendar/config')
      setCfg(data)
      onChanged(data)
    } catch { toast.error('Erro ao carregar configuração') }
  }, [onChanged])

  useEffect(() => { load() }, [load])

  async function add() {
    if (!name.trim() || !email.trim()) { toast.error('Preencha mentor e e-mail'); return }
    setSaving(true)
    try {
      await apiFetch('/api/meetings/calendar/mentors', { method: 'POST', body: JSON.stringify({ name, email }) })
      setName(''); setEmail('')
      await load()
    } catch { toast.error('Erro ao salvar') }
    setSaving(false)
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/api/meetings/calendar/mentors/${id}`, { method: 'DELETE' })
      await load()
    } catch { toast.error('Erro ao remover') }
  }

  async function test(mEmail: string) {
    setTests(t => ({ ...t, [mEmail]: 'Testando...' }))
    try {
      const r = await apiFetch<{ ok: boolean; eventsToday?: number; error?: string }>('/api/meetings/calendar/test', { method: 'POST', body: JSON.stringify({ email: mEmail }) })
      setTests(t => ({ ...t, [mEmail]: r.ok ? `Conectado. ${r.eventsToday} compromisso(s) hoje.` : `Falhou: ${r.error}` }))
    } catch { setTests(t => ({ ...t, [mEmail]: 'Falhou' })) }
  }

  const input: React.CSSProperties = { padding: '8px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans, fontSize: 13, color: C.ink, background: '#fff', minWidth: 0 }
  const unmapped = (cfg?.knownMentorNames ?? []).filter(n => !cfg?.mentors.some(m => m.name.toLowerCase() === n.toLowerCase()))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', fontFamily: sans }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: C.ink }}>Agendas Google</span>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', color: C.mid }}>×</button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!cfg ? <div style={{ color: C.dim, fontSize: 13 }}>Carregando...</div> : <>
            <div style={{ padding: 12, borderRadius: 8, background: cfg.enabled ? '#f0fdf4' : '#fffbeb', border: `1px solid ${cfg.enabled ? '#bbf7d0' : '#fde68a'}`, fontSize: 13, color: C.ink, lineHeight: 1.5 }}>
              {cfg.enabled ? (
                <>
                  <strong style={{ color: C.green }}>Integração ativa.</strong> Reuniões com mentor cadastrado abaixo vão direto para a agenda dele, com link do Meet.
                  <div style={{ fontSize: 12, color: C.mid, marginTop: 6 }}>
                    Delegação no Admin do Workspace: ID do cliente <code>{cfg.clientId}</code>, escopo <code>{cfg.scopes.join(', ')}</code>
                  </div>
                </>
              ) : (
                <><strong style={{ color: '#b45309' }}>Integração ainda não ligada.</strong> Falta a credencial do Google no servidor. Os mentores já podem ser cadastrados.</>
              )}
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, marginBottom: 8 }}>Mentores e agendas</div>
              {cfg.mentors.length === 0 && <div style={{ fontSize: 13, color: C.dim, marginBottom: 8 }}>Nenhum mentor cadastrado.</div>}
              {cfg.mentors.map(m => (
                <div key={m.id} style={{ padding: '9px 0', borderTop: `1px solid ${C.bg}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13, color: C.ink, minWidth: 90 }}>{m.name}</strong>
                    <span style={{ fontSize: 13, color: C.mid, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</span>
                    {cfg.enabled && <button onClick={() => test(m.email)} style={{ padding: '4px 10px', border: `1px solid ${C.line}`, borderRadius: 6, background: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: C.ink }}>Testar</button>}
                    <button onClick={() => remove(m.id)} style={{ padding: '4px 8px', border: `1px solid ${C.line}`, borderRadius: 6, background: '#fff', fontSize: 11, cursor: 'pointer', color: C.red }}>×</button>
                  </div>
                  {tests[m.email] && <div style={{ fontSize: 12, marginTop: 4, color: tests[m.email].startsWith('Conectado') ? C.green : tests[m.email] === 'Testando...' ? C.mid : C.red }}>{tests[m.email]}</div>}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <input list="gcal-mentor-names" value={name} onChange={e => setName(e.target.value)} placeholder="Mentor (como aparece na agenda)" style={{ ...input, flex: '1 1 160px' }} />
                <datalist id="gcal-mentor-names">{unmapped.map(n => <option key={n} value={n} />)}</datalist>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="e-mail do Workspace" inputMode="email" style={{ ...input, flex: '1 1 180px' }} />
                <button onClick={add} disabled={saving} style={{ padding: '8px 14px', border: 'none', borderRadius: 6, background: C.neon, color: C.ink, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Adicionar</button>
              </div>
              {unmapped.length > 0 && (
                <div style={{ fontSize: 12, color: C.dim, marginTop: 8 }}>Mentores na agenda sem e-mail: {unmapped.join(', ')}</div>
              )}
            </div>
          </>}
        </div>
      </div>
    </div>
  )
}
