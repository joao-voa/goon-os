'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

// ───────── tipos ─────────
interface Mentee {
  clientId: string; company: string; responsible: string | null; tier: string | null
  mentorName: string | null; status: string; openActions: number; overdueActions: number
  daysSinceContact: number | null; attention: boolean
  lastMetrics: { faturamentoAno: number | null; ticketMedio: number | null; roas: number | null; seguidoresIg: number | null; numVendas: number | null; sessionDate: string } | null
}
interface Channel { canal: string; valor: number }
interface CustomField { label: string; value: string }
interface Material { label: string; url?: string }
interface CaseStudy {
  id: string; sessionDate: string; mentorName: string | null
  faturamentoAno: number | null; numVendas: number | null; ticketMedio: number | null
  investimentoTrafego: number | null; roas: number | null; seguidoresIg: number | null; numClientes: number | null
  vendasPorCanal: Channel[] | null; customFields: CustomField[] | null; materiais: Material[] | null
  situacaoAtual: string | null; oQueTrabalhou: string | null; proximosPassos: string | null; transcricao: string | null; pontosPrincipais: string | null
}
interface Action { id: string; what: string; who: string | null; dueDate: string | null; done: boolean; status: string }
interface Detail {
  profile: { mentorName: string | null; status: string; mainPains: string | null; goal: string | null }
  client?: { companyName: string; responsible: string | null; segment: string | null } | null
  attention: boolean; caseStudies: CaseStudy[]; actionItems: Action[]
  meetings?: { id: string; title: string; date: string; status: string }[]
}

// ───────── helpers ─────────
const brl = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const num = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR')
const dt = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
const NEON = '#C7F900', INK = '#0A0A0C', PANEL = '#141418', LINE = '#2A2A30', FG = '#F2F2F2', MUT = '#8b8b94'
const disp = 'var(--font-display)', mono = 'var(--font-mono)'
const KANBAN: [string, string, string][] = [['TODO', 'A Fazer', '#64748b'], ['DOING', 'Fazendo', '#e6a800'], ['DONE', 'Feito', NEON]]

function chip(active: boolean, color: string): React.CSSProperties {
  return { padding: '5px 9px', border: `1px solid ${active ? color : LINE}`, background: active ? color : 'transparent', color: active ? INK : MUT, fontFamily: mono, fontSize: 10, fontWeight: 700, cursor: 'pointer' }
}
const miniBtn: React.CSSProperties = { border: `1px solid ${LINE}`, background: 'transparent', color: FG, cursor: 'pointer', fontFamily: mono, fontSize: 10, padding: '2px 8px' }

export default function MentorshipDashboard() {
  const [mentees, setMentees] = useState<Mentee[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [q, setQ] = useState('')
  const [mentorF, setMentorF] = useState('')
  const [attF, setAttF] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [tab, setTab] = useState<'sessoes' | 'tarefas'>('sessoes')

  const loadList = useCallback(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q); if (mentorF) p.set('mentor', mentorF); if (attF) p.set('attention', 'true')
    apiFetch<{ mentees: Mentee[] }>(`/api/mentorship/cockpit?${p}`).then(r => setMentees(r.mentees || [])).catch(() => {})
  }, [q, mentorF, attF])
  useEffect(() => { loadList() }, [loadList])

  const loadDetail = useCallback((id: string) => {
    apiFetch<Detail>(`/api/mentorship/clients/${id}`).then(setDetail).catch(() => setDetail(null))
  }, [])
  useEffect(() => { if (selId) loadDetail(selId); else setDetail(null) }, [selId, loadDetail])
  useEffect(() => { if (!selId && mentees.length) setSelId(mentees[0].clientId) }, [mentees, selId])

  const mentors = [...new Set(mentees.map(m => m.mentorName).filter(Boolean))] as string[]
  const totAtt = mentees.filter(m => m.attention).length

  async function moveAction(id: string, status: string) {
    setDetail(prev => prev ? { ...prev, actionItems: prev.actionItems.map(a => a.id === id ? { ...a, status, done: status === 'DONE' } : a) } : prev)
    try { await apiFetch(`/api/mentorship/action-items/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }) } catch { toast.error('Erro') }
  }

  const sel = mentees.find(m => m.clientId === selId)

  return (
    <div style={{ background: INK, margin: '-16px', minHeight: 'calc(100vh - 40px)', color: FG, display: 'flex', fontFamily: mono }}>
      {/* ══ LISTA (esquerda) ══ */}
      <aside style={{ width: 300, borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', flexShrink: 0, height: 'calc(100vh - 40px)', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 16px 12px' }}>
          <div style={{ fontFamily: disp, fontSize: 18, fontWeight: 700, letterSpacing: '0.04em' }}>MENTORIA</div>
          <div style={{ fontSize: 10, color: MUT, marginTop: 2 }}>{mentees.length} mentorados · <span style={{ color: totAtt ? '#ff5a5a' : NEON }}>{totAtt} em atenção</span></div>
        </div>
        <div style={{ padding: '0 16px 10px' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente..." style={{ width: '100%', background: PANEL, border: `1px solid ${LINE}`, color: FG, padding: '7px 10px', fontFamily: mono, fontSize: 12, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setAttF(v => !v)} style={chip(attF, '#ff5a5a')}>🔴 Atenção</button>
            <select value={mentorF} onChange={e => setMentorF(e.target.value)} style={{ ...chip(!!mentorF, NEON), cursor: 'pointer' }}>
              <option value="" style={{ background: INK }}>Mentor</option>
              {mentors.map(m => <option key={m} value={m} style={{ background: INK }}>{m}</option>)}
            </select>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {mentees.length === 0 && <div style={{ padding: 20, fontSize: 11, color: MUT, textAlign: 'center' }}>Nenhum mentorado.<br />Inscreva um cliente abaixo.</div>}
          {mentees.map(m => {
            const active = m.clientId === selId
            return (
              <button key={m.clientId} onClick={() => setSelId(m.clientId)} style={{
                width: '100%', textAlign: 'left', background: active ? PANEL : 'transparent', border: 'none',
                borderLeft: `3px solid ${active ? NEON : 'transparent'}`, padding: '11px 14px', cursor: 'pointer', color: FG,
                display: 'flex', flexDirection: 'column', gap: 3, borderBottom: `1px solid ${LINE}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.attention ? '#ff5a5a' : NEON, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 12, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.company}</span>
                  {m.tier && <span style={{ fontSize: 8, background: LINE, padding: '1px 5px', borderRadius: 3 }}>{m.tier}</span>}
                </div>
                <div style={{ fontSize: 9, color: MUT, paddingLeft: 13 }}>
                  {m.mentorName ?? 'sem mentor'} · {m.lastMetrics?.faturamentoAno != null ? brl(m.lastMetrics.faturamentoAno) : 's/ dados'}
                  {m.overdueActions > 0 && <span style={{ color: '#ff5a5a' }}> · {m.overdueActions} atrasada(s)</span>}
                </div>
              </button>
            )
          })}
        </div>
        <button onClick={() => setEnrollOpen(true)} style={{ margin: 12, background: NEON, color: INK, border: 'none', padding: '10px', fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ INSCREVER CLIENTE</button>
      </aside>

      {/* ══ PAINEL (direita) ══ */}
      <main style={{ flex: 1, padding: 24, overflowY: 'auto', height: 'calc(100vh - 40px)' }}>
        {!sel || !detail ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUT, fontFamily: disp, fontSize: 16 }}>
            {mentees.length ? 'Selecione um cliente' : 'Nenhum mentorado ainda'}
          </div>
        ) : (
          <ClientPanel key={sel.clientId} detail={detail} sel={sel} tab={tab} setTab={setTab} onMove={moveAction} onRegister={() => setFormOpen(true)} />
        )}
      </main>

      {enrollOpen && <EnrollModal onClose={() => setEnrollOpen(false)} onDone={id => { setEnrollOpen(false); loadList(); if (id) setSelId(id) }} />}
      {formOpen && selId && <SessionForm clientId={selId} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); loadDetail(selId); loadList() }} />}
    </div>
  )
}

// ───────── Painel do cliente ─────────
function ClientPanel({ detail, sel, tab, setTab, onMove, onRegister }: {
  detail: Detail; sel: Mentee; tab: 'sessoes' | 'tarefas'; setTab: (t: 'sessoes' | 'tarefas') => void
  onMove: (id: string, s: string) => void; onRegister: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const studies = detail.caseStudies
  const last = studies[0], prev = studies[1]
  const delta = (a: number | null, b: number | null) => (a == null || b == null || b === 0) ? null : ((a - b) / b) * 100
  const kpis: [string, string, number | null, number | null][] = [
    ['Faturamento', brl(last?.faturamentoAno ?? null), last?.faturamentoAno ?? null, prev?.faturamentoAno ?? null],
    ['Ticket Médio', brl(last?.ticketMedio ?? null), last?.ticketMedio ?? null, prev?.ticketMedio ?? null],
    ['Nº Clientes', num(last?.numClientes ?? null), last?.numClientes ?? null, prev?.numClientes ?? null],
    ['Nº Vendas', num(last?.numVendas ?? null), last?.numVendas ?? null, prev?.numVendas ?? null],
    ['ROAS', last?.roas != null ? last.roas + 'x' : '—', last?.roas ?? null, prev?.roas ?? null],
    ['Seguidores IG', num(last?.seguidoresIg ?? null), last?.seguidoresIg ?? null, prev?.seguidoresIg ?? null],
  ]
  const openTasks = detail.actionItems.filter(a => a.status !== 'DONE').length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontFamily: disp, fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em' }}>{detail.client?.companyName ?? sel.company}</div>
          <div style={{ fontSize: 11, color: MUT, marginTop: 4 }}>
            {detail.client?.responsible ?? '—'} · Mentor <span style={{ color: FG }}>{detail.profile.mentorName ?? '—'}</span> · {studies.length} sessões
            {sel.attention && <span style={{ marginLeft: 8, background: '#3a1414', color: '#ff5a5a', padding: '2px 8px', fontWeight: 700 }}>🔴 EM ATENÇÃO</span>}
          </div>
        </div>
        <button onClick={onRegister} style={{ background: NEON, color: INK, border: 'none', padding: '10px 16px', fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ REGISTRAR SESSÃO</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
        {kpis.map(([label, val, a, b]) => {
          const dl = delta(a, b)
          return (
            <div key={label} style={{ background: PANEL, border: `1px solid ${LINE}`, padding: '14px 16px' }}>
              <div style={{ fontSize: 9, color: MUT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              <div style={{ fontFamily: disp, fontSize: 22, fontWeight: 700, marginTop: 4, color: label === 'Faturamento' ? NEON : FG }}>{val}</div>
              {dl != null && <div style={{ fontSize: 10, marginTop: 2, color: dl >= 0 ? NEON : '#ff5a5a' }}>{dl >= 0 ? '▲' : '▼'} {Math.abs(dl).toFixed(0)}% vs anterior</div>}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14, marginBottom: 18 }}>
        <Panel title="Evolução do faturamento"><EvolutionChart studies={studies} /></Panel>
        <Panel title="Contexto da mentoria">
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
            <div style={{ marginBottom: 8 }}><span style={{ color: MUT }}>Dores:</span> {detail.profile.mainPains || <span style={{ color: '#555' }}>não preenchido</span>}</div>
            <div><span style={{ color: MUT }}>Objetivo:</span> {detail.profile.goal || <span style={{ color: '#555' }}>não preenchido</span>}</div>
          </div>
        </Panel>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['sessoes', 'tarefas'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 16px', border: `1px solid ${LINE}`, cursor: 'pointer', fontFamily: mono, fontSize: 11, fontWeight: 700,
            background: tab === t ? NEON : 'transparent', color: tab === t ? INK : MUT,
          }}>{t === 'sessoes' ? 'SESSÕES' : `TAREFAS (${openTasks})`}</button>
        ))}
      </div>

      {tab === 'sessoes' && (
        <div>
          {studies.length === 0 && <Panel title=""><div style={{ color: MUT, fontSize: 12 }}>Nenhuma sessão registrada. Clique em “Registrar sessão”.</div></Panel>}
          {studies.map(cs => (
            <div key={cs.id} style={{ background: PANEL, border: `1px solid ${LINE}`, marginBottom: 8 }}>
              <div onClick={() => setExpanded(expanded === cs.id ? null : cs.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                <span>{expanded === cs.id ? '▾' : '▸'} {dt(cs.sessionDate)}{cs.mentorName ? ` · ${cs.mentorName}` : ''}</span>
                <span style={{ color: NEON }}>{brl(cs.faturamentoAno)}</span>
              </div>
              {expanded === cs.id && (
                <div style={{ padding: '12px 14px 14px', fontSize: 11, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 6, borderTop: `1px solid ${LINE}` }}>
                  {cs.pontosPrincipais && <div><b style={{ color: NEON }}>Principais pontos:</b><div style={{ whiteSpace: 'pre-wrap', color: '#ccc' }}>{cs.pontosPrincipais}</div></div>}
                  {cs.oQueTrabalhou && <div><b style={{ color: MUT }}>Passado ao cliente:</b> {cs.oQueTrabalhou}</div>}
                  {cs.proximosPassos && <div><b style={{ color: MUT }}>Próximos passos:</b> {cs.proximosPassos}</div>}
                  {cs.vendasPorCanal && cs.vendasPorCanal.length > 0 && <div><b style={{ color: MUT }}>Por canal:</b> {cs.vendasPorCanal.map((c, i) => <span key={i} style={{ marginRight: 10 }}>{c.canal} {brl(c.valor)}</span>)}</div>}
                  {cs.materiais && cs.materiais.length > 0 && <div><b style={{ color: MUT }}>Materiais:</b> {cs.materiais.map((m, i) => m.url ? <a key={i} href={m.url} target="_blank" rel="noreferrer" style={{ color: NEON, marginRight: 8 }}>{m.label}</a> : <span key={i} style={{ marginRight: 8 }}>{m.label}</span>)}</div>}
                  {cs.transcricao && <details><summary style={{ cursor: 'pointer', color: MUT }}>Transcrição</summary><div style={{ whiteSpace: 'pre-wrap', color: '#aaa', marginTop: 4, maxHeight: 220, overflowY: 'auto', background: INK, padding: 10, border: `1px solid ${LINE}` }}>{cs.transcricao}</div></details>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'tarefas' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {KANBAN.map(([st, label, color]) => {
            const items = detail.actionItems.filter(a => (a.status || (a.done ? 'DONE' : 'TODO')) === st)
            const order = ['TODO', 'DOING', 'DONE']; const idx = order.indexOf(st)
            return (
              <div key={st} style={{ border: `1px solid ${LINE}`, background: PANEL, minHeight: 120 }}>
                <div style={{ background: color, color: color === NEON ? INK : '#fff', padding: '6px 10px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{label} ({items.length})</div>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map(a => {
                    const overdue = a.status !== 'DONE' && a.dueDate && new Date(a.dueDate).getTime() < Date.now()
                    return (
                      <div key={a.id} style={{ background: INK, border: `1px solid ${LINE}`, padding: 8, fontSize: 11 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.what}</div>
                        <div style={{ fontSize: 9, color: overdue ? '#ff5a5a' : MUT, marginBottom: 4 }}>{a.who ?? '—'} · {a.dueDate ? dt(a.dueDate) : 'sem prazo'}{overdue ? ' · ATRASADA' : ''}</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {idx > 0 && <button onClick={() => onMove(a.id, order[idx - 1])} style={miniBtn}>←</button>}
                          {idx < 2 && <button onClick={() => onMove(a.id, order[idx + 1])} style={{ ...miniBtn, marginLeft: 'auto' }}>→</button>}
                        </div>
                      </div>
                    )
                  })}
                  {items.length === 0 && <div style={{ fontSize: 10, color: '#555', textAlign: 'center', padding: 8 }}>—</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${LINE}`, padding: 16 }}>
      {title && <div style={{ fontSize: 9, color: MUT, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{title}</div>}
      {children}
    </div>
  )
}

function EvolutionChart({ studies }: { studies: CaseStudy[] }) {
  const pts = studies.slice().reverse().filter(s => s.faturamentoAno != null).map(s => ({ x: new Date(s.sessionDate).getTime(), y: s.faturamentoAno as number }))
  if (pts.length < 2) return <div style={{ color: MUT, fontSize: 12, padding: '30px 0', textAlign: 'center' }}>Precisa de 2+ sessões com faturamento pra desenhar a evolução.</div>
  const W = 460, H = 160, pad = 8
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const nx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (W - pad * 2)
  const ny = (y: number) => H - pad - ((y - minY) / (maxY - minY || 1)) * (H - pad * 2)
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${nx(p.x).toFixed(1)},${ny(p.y).toFixed(1)}`).join(' ')
  const area = `${d} L${nx(pts[pts.length - 1].x).toFixed(1)},${H - pad} L${nx(pts[0].x).toFixed(1)},${H - pad} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs><linearGradient id="ev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={NEON} stopOpacity="0.25" /><stop offset="100%" stopColor={NEON} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#ev)" />
      <path d={d} fill="none" stroke={NEON} strokeWidth="2" />
      {pts.map((p, i) => <circle key={i} cx={nx(p.x)} cy={ny(p.y)} r="3" fill={INK} stroke={NEON} strokeWidth="1.5" />)}
      <text x={pad} y={12} fill={MUT} fontSize="9" fontFamily={mono}>{brl(maxY)}</text>
      <text x={pad} y={H - 2} fill={MUT} fontSize="9" fontFamily={mono}>{brl(minY)}</text>
    </svg>
  )
}

function EnrollModal({ onClose, onDone }: { onClose: () => void; onDone: (id?: string) => void }) {
  const [list, setList] = useState<{ id: string; company: string; responsible: string | null; tier: string | null }[]>([])
  const [sel, setSel] = useState(''); const [mentor, setMentor] = useState(''); const [saving, setSaving] = useState(false)
  useEffect(() => { apiFetch<typeof list>('/api/mentorship/available-clients').then(setList).catch(() => {}) }, [])
  async function save() {
    if (!sel) { toast.error('Selecione um cliente'); return }
    setSaving(true)
    try { await apiFetch('/api/mentorship/enroll', { method: 'POST', body: JSON.stringify({ clientId: sel, mentorName: mentor || undefined }) }); toast.success('Inscrito'); onDone(sel) }
    catch { toast.error('Erro') } finally { setSaving(false) }
  }
  const inp: React.CSSProperties = { width: '100%', background: PANEL, border: `1px solid ${LINE}`, color: FG, padding: '8px 10px', fontFamily: mono, fontSize: 12, outline: 'none' }
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: INK, border: `1px solid ${LINE}`, color: FG, width: '100%', maxWidth: 420, padding: 20 }}>
        <div style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Inscrever cliente na mentoria</div>
        <label style={{ fontSize: 9, color: MUT, textTransform: 'uppercase' }}>Cliente</label>
        <select value={sel} onChange={e => setSel(e.target.value)} style={{ ...inp, marginTop: 4, marginBottom: 12 }}>
          <option value="" style={{ background: INK }}>Selecione...</option>
          {list.map(c => <option key={c.id} value={c.id} style={{ background: INK }}>{c.company}{c.tier ? ` (${c.tier})` : ''}</option>)}
        </select>
        <label style={{ fontSize: 9, color: MUT, textTransform: 'uppercase' }}>Mentor (opcional)</label>
        <input value={mentor} onChange={e => setMentor(e.target.value)} style={{ ...inp, marginTop: 4 }} placeholder="Ex: Carol, Giulliano..." />
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, border: `1px solid ${LINE}`, background: 'transparent', color: FG, padding: 10, fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving} style={{ flex: 1, border: 'none', background: NEON, color: INK, padding: 10, fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>{saving ? '...' : 'Inscrever'}</button>
        </div>
      </div>
    </div>
  )
}

function SessionForm({ clientId, onClose, onSaved }: { clientId: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ sessionDate: new Date().toISOString().slice(0, 10) })
  const [channels, setChannels] = useState<Channel[]>([])
  const [customs, setCustoms] = useState<CustomField[]>([])
  const [materiais, setMateriais] = useState<Material[]>([])
  const [tasks, setTasks] = useState<{ what: string; who: string }[]>([])
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const numOr = (v?: string) => v && v.trim() ? Number(v.replace(/[^\d.,-]/g, '').replace(',', '.')) : undefined

  async function save() {
    setSaving(true)
    try {
      const study = await apiFetch<{ id: string }>('/api/mentorship/case-studies', {
        method: 'POST',
        body: JSON.stringify({
          clientId, sessionDate: f.sessionDate,
          faturamentoAno: numOr(f.faturamentoAno), ticketMedio: numOr(f.ticketMedio), numVendas: numOr(f.numVendas),
          numClientes: numOr(f.numClientes), investimentoTrafego: numOr(f.investimentoTrafego), roas: numOr(f.roas), seguidoresIg: numOr(f.seguidoresIg),
          vendasPorCanal: channels.filter(c => c.canal), customFields: customs.filter(c => c.label), materiais: materiais.filter(m => m.label),
          pontosPrincipais: f.pontosPrincipais, oQueTrabalhou: f.oQueTrabalhou, proximosPassos: f.proximosPassos, transcricao: f.transcricao,
        }),
      })
      for (const t of tasks.filter(t => t.what.trim())) await apiFetch('/api/mentorship/action-items', { method: 'POST', body: JSON.stringify({ clientId, what: t.what, who: t.who || undefined, caseStudyId: study.id }) })
      toast.success('Sessão registrada'); onSaved()
    } catch { toast.error('Erro ao salvar') } finally { setSaving(false) }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', border: `1px solid ${LINE}`, background: PANEL, color: FG, fontFamily: mono, fontSize: 12, outline: 'none' }
  const lbl: React.CSSProperties = { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: MUT, display: 'block', marginBottom: 3 }
  const sec: React.CSSProperties = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: NEON, margin: '16px 0 6px', borderBottom: `1px solid ${LINE}`, paddingBottom: 4 }
  const dashBtn: React.CSSProperties = { border: `1px dashed ${LINE}`, background: 'transparent', color: MUT, cursor: 'pointer', fontFamily: mono, fontSize: 10, padding: '4px 10px' }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: INK, border: `1px solid ${LINE}`, color: FG, width: '100%', maxWidth: 580, marginTop: 20 }}>
        <div style={{ background: PANEL, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${LINE}` }}>
          <span style={{ fontFamily: disp, fontSize: 14, fontWeight: 700 }}>REGISTRAR SESSÃO</span>
          <button onClick={onClose} style={{ background: 'transparent', color: MUT, border: `1px solid ${LINE}`, borderRadius: 5, width: 24, height: 24, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 16 }}>
          <div><label style={lbl}>Data da sessão</label><input type="date" value={f.sessionDate} onChange={e => set('sessionDate', e.target.value)} style={{ ...inp, colorScheme: 'dark' as React.CSSProperties['colorScheme'] }} /></div>
          <div style={sec}>Métricas do negócio</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['faturamentoAno', 'Faturamento (R$)'], ['ticketMedio', 'Ticket médio (R$)'], ['numClientes', 'Nº de clientes'], ['numVendas', 'Nº de vendas'], ['investimentoTrafego', 'Invest. tráfego (R$)'], ['roas', 'ROAS (x)'], ['seguidoresIg', 'Seguidores IG']].map(([k, l]) => (
              <div key={k}><label style={lbl}>{l}</label><input value={f[k] ?? ''} onChange={e => set(k, e.target.value)} style={inp} /></div>
            ))}
          </div>
          <div style={sec}>Vendas por canal</div>
          {channels.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <input value={c.canal} onChange={e => setChannels(ch => ch.map((x, j) => j === i ? { ...x, canal: e.target.value } : x))} placeholder="Canal (IG, TikTok...)" style={{ ...inp, flex: 1 }} />
              <input value={c.valor || ''} onChange={e => setChannels(ch => ch.map((x, j) => j === i ? { ...x, valor: Number(e.target.value) } : x))} placeholder="R$" style={{ ...inp, width: 100 }} />
              <button onClick={() => setChannels(ch => ch.filter((_, j) => j !== i))} style={{ ...inp, width: 34, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setChannels(ch => [...ch, { canal: '', valor: 0 }])} style={dashBtn}>+ canal</button>
          <div style={sec}>Campos extras</div>
          {customs.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <input value={c.label} onChange={e => setCustoms(cs => cs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Campo" style={{ ...inp, flex: 1 }} />
              <input value={c.value} onChange={e => setCustoms(cs => cs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="Valor" style={{ ...inp, flex: 1 }} />
              <button onClick={() => setCustoms(cs => cs.filter((_, j) => j !== i))} style={{ ...inp, width: 34, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setCustoms(cs => [...cs, { label: '', value: '' }])} style={dashBtn}>+ campo</button>
          <div style={sec}>Registro da reunião</div>
          <div><label style={lbl}>Principais pontos discutidos</label><textarea value={f.pontosPrincipais ?? ''} onChange={e => set('pontosPrincipais', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
          <div style={{ marginTop: 6 }}><label style={lbl}>O que foi passado ao cliente</label><textarea value={f.oQueTrabalhou ?? ''} onChange={e => set('oQueTrabalhou', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
          <div style={{ marginTop: 6 }}><label style={lbl}>Próximos passos</label><textarea value={f.proximosPassos ?? ''} onChange={e => set('proximosPassos', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
          <div style={{ marginTop: 6 }}><label style={lbl}>Transcrição da reunião</label><textarea value={f.transcricao ?? ''} onChange={e => set('transcricao', e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} placeholder="Cole a transcrição aqui..." /></div>
          <div style={sec}>Tarefas (o que ficou / pra quem)</div>
          {tasks.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <input value={t.what} onChange={e => setTasks(ts => ts.map((x, j) => j === i ? { ...x, what: e.target.value } : x))} placeholder="O que" style={{ ...inp, flex: 2 }} />
              <input value={t.who} onChange={e => setTasks(ts => ts.map((x, j) => j === i ? { ...x, who: e.target.value } : x))} placeholder="Quem" style={{ ...inp, flex: 1 }} />
              <button onClick={() => setTasks(ts => ts.filter((_, j) => j !== i))} style={{ ...inp, width: 34, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setTasks(ts => [...ts, { what: '', who: '' }])} style={dashBtn}>+ tarefa</button>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button onClick={onClose} style={{ flex: 1, border: `1px solid ${LINE}`, background: 'transparent', color: FG, padding: 10, fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{ flex: 1, border: 'none', background: NEON, color: INK, padding: 10, fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Salvando...' : 'Registrar sessão'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
