'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

// ───────── tipos ─────────
interface Mentee {
  clientId: string; company: string; responsible: string | null; tier: string | null
  mentorName: string | null; status: string; openActions: number; overdueActions: number
  daysSinceContact: number | null; attention: boolean
  lastMetrics: { faturamentoMes: number | null; faturamentoAno: number | null; clientesAtivos: number | null; estoqueQtd: number | null; estoqueValor: number | null; ticketMedio: number | null; roas: number | null; seguidoresIg: number | null; numVendas: number | null; sessionDate: string } | null
}
interface Channel { canal: string; valor: number }
interface CustomField { label: string; value: string }
interface Material { label: string; url?: string }
interface CaseStudy {
  id: string; meetingId?: string | null; sessionDate: string; mentorName: string | null
  faturamentoMes: number | null; faturamentoAno: number | null; clientesAtivos: number | null; estoqueQtd: number | null; estoqueValor: number | null
  numVendas: number | null; ticketMedio: number | null
  investimentoTrafego: number | null; roas: number | null; seguidoresIg: number | null; numClientes: number | null
  vendasPorCanal: Channel[] | null; customFields: CustomField[] | null; materiais: Material[] | null
  situacaoAtual: string | null; oQueTrabalhou: string | null; proximosPassos: string | null; transcricao: string | null; pontosPrincipais: string | null
}
interface Action { id: string; what: string; who: string | null; dueDate: string | null; done: boolean; status: string }
interface MonthlyMetric { id: string; month: string; faturamento: number | null; clientesAtivos: number | null; estoqueQtd: number | null; estoqueValor: number | null; ticketMedio: number | null; numVendas: number | null; investimentoTrafego: number | null; roas: number | null; seguidoresIg: number | null; note: string | null }
interface Detail {
  profile: { mentorName: string | null; status: string; mainPains: string | null; goal: string | null }
  client?: {
    companyName: string; tradeName?: string | null; cnpj?: string | null; responsible: string | null
    email?: string | null; whatsapp?: string | null; phone?: string | null; segment: string | null
    city?: string | null; state?: string | null; estimatedRevenue?: string | null; createdAt?: string
    plan?: { value: number; installments: number | null; code: string; name: string } | null
  } | null
  attention: boolean; caseStudies: CaseStudy[]; actionItems: Action[]
  meetings?: { id: string; title: string; type?: string; date: string; status: string }[]
  monthlyMetrics?: MonthlyMetric[]
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
  const [formOpen, setFormOpen] = useState(false)
  const [formMeetingId, setFormMeetingId] = useState<string | undefined>(undefined)
  const [tab, setTab] = useState<'sessoes' | 'tarefas'>('sessoes')
  const [listCollapsed, setListCollapsed] = useState(false)
  const openForm = (meetingId?: string) => { setFormMeetingId(meetingId); setFormOpen(true) }

  async function addTask(what: string) {
    if (!selId || !what.trim()) return
    try {
      await apiFetch('/api/mentorship/action-items', { method: 'POST', body: JSON.stringify({ clientId: selId, what }) })
      loadDetail(selId)
    } catch { toast.error('Erro ao criar tarefa') }
  }

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
  // abre na Visão Geral (selId = null); usuário escolhe o cliente na lista

  const mentors = [...new Set(mentees.map(m => m.mentorName).filter(Boolean))] as string[]
  const totAtt = mentees.filter(m => m.attention).length

  async function moveAction(id: string, status: string) {
    setDetail(prev => prev ? { ...prev, actionItems: prev.actionItems.map(a => a.id === id ? { ...a, status, done: status === 'DONE' } : a) } : prev)
    try { await apiFetch(`/api/mentorship/action-items/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }) } catch { toast.error('Erro') }
  }

  const sel = mentees.find(m => m.clientId === selId)

  return (
    <div style={{ background: INK, minHeight: 'calc(100vh - 56px)', color: FG, display: 'flex', fontFamily: mono }}>
      {/* ══ LISTA (esquerda) — colapsável ══ */}
      {listCollapsed ? (
        <aside style={{ width: 40, borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, height: 'calc(100vh - 56px)', position: 'sticky', top: 0, paddingTop: 14 }}>
          <button onClick={() => setListCollapsed(false)} title="Expandir lista" style={{ background: 'none', border: 'none', color: MUT, cursor: 'pointer', fontSize: 16 }}>▸</button>
          <div style={{ writingMode: 'vertical-rl', marginTop: 12, fontFamily: disp, fontSize: 12, letterSpacing: '0.1em', color: MUT }}>MENTORIA · {mentees.length}</div>
        </aside>
      ) : (
      <aside style={{ width: 300, borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', flexShrink: 0, height: 'calc(100vh - 56px)', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 16px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: disp, fontSize: 18, fontWeight: 700, letterSpacing: '0.04em' }}>MENTORIA</div>
            <button onClick={() => setListCollapsed(true)} title="Recolher lista" style={{ background: 'none', border: 'none', color: MUT, cursor: 'pointer', fontSize: 16 }}>◂</button>
          </div>
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
          <button onClick={() => setSelId(null)} style={{
            width: '100%', textAlign: 'left', background: selId === null ? PANEL : 'transparent', border: 'none',
            borderLeft: `3px solid ${selId === null ? NEON : 'transparent'}`, padding: '12px 14px', cursor: 'pointer', color: FG,
            display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${LINE}`, fontFamily: mono, fontWeight: 700, fontSize: 12,
          }}>
            <span style={{ fontSize: 14 }}>◱</span> VISÃO GERAL
          </button>
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
                  {m.mentorName ?? 'sem mentor'} · {(m.lastMetrics?.faturamentoMes ?? m.lastMetrics?.faturamentoAno) != null ? brl(m.lastMetrics!.faturamentoMes ?? m.lastMetrics!.faturamentoAno) : 's/ dados'}
                  {m.overdueActions > 0 && <span style={{ color: '#ff5a5a' }}> · {m.overdueActions} atrasada(s)</span>}
                </div>
              </button>
            )
          })}
        </div>
        <div style={{ margin: 12, fontSize: 9, color: '#555', textAlign: 'center', lineHeight: 1.5 }}>Todos os clientes ativos aparecem aqui.<br />Selecione um pra ver a ficha completa.</div>
      </aside>
      )}

      {/* ══ PAINEL (direita) ══ */}
      <main style={{ flex: 1, padding: 24, overflowY: 'auto', height: 'calc(100vh - 56px)' }}>
        {selId === null ? (
          <OverviewPanel onSelect={setSelId} />
        ) : !sel || !detail ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUT, fontFamily: disp, fontSize: 16 }}>
            Carregando…
          </div>
        ) : (
          <ClientPanel key={sel.clientId} detail={detail} sel={sel} tab={tab} setTab={setTab} onMove={moveAction} onRegister={openForm} onAddTask={addTask} onReload={() => { loadDetail(selId); loadList() }} />
        )}
      </main>

      {formOpen && selId && <SessionForm clientId={selId} meetingId={formMeetingId} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); loadDetail(selId); loadList() }} />}
    </div>
  )
}

// ───────── Visão Geral (todos os clientes, faturamento somado) ─────────
interface Overview {
  totals: { faturamentoMes: number; clientesAtivos: number; estoqueQtd: number; estoqueValor: number; mentees: number; comDados: number }
  byMentor: { mentor: string; faturamentoMes: number; mentees: number }[]
  monthly: { month: string; faturamento: number }[]
  clients: { clientId: string; company: string; responsible: string | null; mentor: string; faturamentoMes: number | null; clientesAtivos: number | null; estoqueValor: number | null; month: string | null }[]
}
function OverviewPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const [ov, setOv] = useState<Overview | null>(null)
  useEffect(() => { apiFetch<Overview>('/api/mentorship/overview').then(setOv).catch(() => setOv(null)) }, [])
  if (!ov) return <div style={{ color: MUT, fontFamily: disp, fontSize: 15, padding: 40 }}>Carregando visão geral…</div>
  const t = ov.totals
  const kpis: [string, string, boolean][] = [
    ['Faturamento somado (mês)', brl(t.faturamentoMes), true],
    ['Clientes ativos (total)', num(t.clientesAtivos), false],
    ['Estoque total (R$)', brl(t.estoqueValor), false],
    ['Estoque total (peças)', num(t.estoqueQtd), false],
    ['Mentorados', String(t.mentees), false],
  ]
  const monthlyStudies = ov.monthly.map(m => ({ sessionDate: m.month + '-01', faturamentoMes: m.faturamento })) as unknown as CaseStudy[]
  const mesLabel = (ym: string | null) => ym ? new Date(ym.slice(0, 7) + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }) : '—'
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: disp, fontSize: 28, fontWeight: 700, letterSpacing: '-0.01em' }}>Visão Geral</div>
        <div style={{ fontSize: 11, color: MUT, marginTop: 4 }}>{t.mentees} clientes ativos · {t.comDados} com dados de faturamento neste mês</div>
      </div>

      {/* KPIs somados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 18 }}>
        {kpis.map(([l, v, hi]) => (
          <div key={l} style={{ background: PANEL, border: `1px solid ${hi ? NEON : LINE}`, padding: '14px 16px' }}>
            <div style={{ fontSize: 9, color: MUT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
            <div style={{ fontFamily: disp, fontSize: 24, fontWeight: 700, color: hi ? NEON : FG, marginTop: 6 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Evolução somada */}
      <div style={{ marginBottom: 18 }}>
        <Panel title="Evolução do faturamento somado (mês a mês)"><EvolutionChart studies={monthlyStudies} /></Panel>
      </div>

      {/* Ranking de clientes */}
      <Panel title="Ranking de clientes (faturamento do mês)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ color: MUT, textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', fontWeight: 700 }}>#</th>
                <th style={{ padding: '6px 8px', fontWeight: 700 }}>Cliente</th>
                <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Fat. mês</th>
                <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Clientes</th>
                <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Estoque R$</th>
                <th style={{ padding: '6px 8px', fontWeight: 700, textAlign: 'right' }}>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {ov.clients.map((c, i) => (
                <tr key={c.clientId} onClick={() => onSelect(c.clientId)} style={{ cursor: 'pointer', borderTop: `1px solid ${LINE}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = PANEL)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '8px', color: MUT }}>{i + 1}</td>
                  <td style={{ padding: '8px', fontWeight: 700 }}>{c.company}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: c.faturamentoMes != null ? NEON : MUT, fontWeight: 700 }}>{c.faturamentoMes != null ? brl(c.faturamentoMes) : 's/ dados'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{num(c.clientesAtivos)}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{brl(c.estoqueValor)}</td>
                  <td style={{ padding: '8px', textAlign: 'right', color: MUT }}>{mesLabel(c.month)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

// ───────── Tabela de faturamento mês a mês (editável) ─────────
function MonthlyTable({ clientId, metrics, onReload }: { clientId: string; metrics: MonthlyMetric[]; onReload: () => void }) {
  type Row = { month: string; faturamento: string; clientesAtivos: string; estoqueQtd: string; estoqueValor: string; ticketMedio: string; numVendas: string; investimentoTrafego: string; roas: string; seguidoresIg: string }
  const s = (v: number | null) => v == null ? '' : String(v)
  const toRow = (m: MonthlyMetric): Row => ({ month: m.month, faturamento: s(m.faturamento), clientesAtivos: s(m.clientesAtivos), estoqueQtd: s(m.estoqueQtd), estoqueValor: s(m.estoqueValor), ticketMedio: s(m.ticketMedio), numVendas: s(m.numVendas), investimentoTrafego: s(m.investimentoTrafego), roas: s(m.roas), seguidoresIg: s(m.seguidoresIg) })
  const COLS: [keyof Row, string][] = [['faturamento', 'Faturamento (R$)'], ['clientesAtivos', 'Clientes ativos'], ['estoqueQtd', 'Estoque (peças)'], ['estoqueValor', 'Estoque (R$)'], ['ticketMedio', 'Ticket médio (R$)'], ['numVendas', 'Nº vendas'], ['investimentoTrafego', 'Invest. tráfego (R$)'], ['roas', 'ROAS (x)'], ['seguidoresIg', 'Seguidores IG']]
  const sorted = metrics.slice().sort((a, b) => a.month.localeCompare(b.month)) // cronológico (mais antigo → recente)
  const [rows, setRows] = useState<Row[]>(() => sorted.map(toRow))
  const monthsSig = sorted.map(m => m.month).join(',')
  // ressincroniza só quando o conjunto de meses muda (add/del) — não durante edição de valores
  useEffect(() => { setRows(sorted.map(toRow)) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [monthsSig])
  const [draftMonth, setDraftMonth] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const numOr = (v: string) => { const t = v.trim(); if (!t) return null; const n = Number(t.replace(/[^\d.,-]/g, '').replace(',', '.')); return isNaN(n) ? null : n }
  const upd = (i: number, k: keyof Row, v: string) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r))

  async function saveRow(r: Row) {
    setSaving(r.month)
    try {
      await apiFetch(`/api/mentorship/clients/${clientId}/monthly`, { method: 'PUT', body: JSON.stringify({ month: r.month, faturamento: numOr(r.faturamento), clientesAtivos: numOr(r.clientesAtivos), estoqueQtd: numOr(r.estoqueQtd), estoqueValor: numOr(r.estoqueValor), ticketMedio: numOr(r.ticketMedio), numVendas: numOr(r.numVendas), investimentoTrafego: numOr(r.investimentoTrafego), roas: numOr(r.roas), seguidoresIg: numOr(r.seguidoresIg) }) })
      onReload()
    } catch { toast.error('Erro ao salvar mês') } finally { setSaving(null) }
  }
  const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const shiftMonth = (ym: string, delta: number) => { const [y, m] = ym.split('-').map(Number); return ymOf(new Date(y, m - 1 + delta, 1)) }
  async function createMonths(months: string[]) {
    const missing = months.filter(m => !rows.some(r => r.month === m))
    if (!missing.length) { toast.message('Esses meses já estão na tabela'); return }
    setSaving('…')
    try { await Promise.all(missing.map(m => apiFetch(`/api/mentorship/clients/${clientId}/monthly`, { method: 'PUT', body: JSON.stringify({ month: m }) }))); onReload() }
    catch { toast.error('Erro ao gerar meses') } finally { setSaving(null) }
  }
  async function addMonth() {
    if (!draftMonth) return
    if (rows.some(r => r.month === draftMonth)) { toast.error('Esse mês já está na tabela'); return }
    setDraftMonth(''); await createMonths([draftMonth])
  }
  function seedRecent() {
    const base = new Date()
    const months = Array.from({ length: 6 }, (_, k) => ymOf(new Date(base.getFullYear(), base.getMonth() - (5 - k), 1)))
    createMonths(months)
  }
  const earliest = rows.length ? rows[0].month : null
  const latest = rows.length ? rows[rows.length - 1].month : null
  async function delMonth(month: string) {
    if (!confirm('Remover este mês?')) return
    try { await apiFetch(`/api/mentorship/clients/${clientId}/monthly/${month}`, { method: 'DELETE' }); onReload() } catch { toast.error('Erro ao remover') }
  }
  const mesLabel = (ym: string) => new Date(ym + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
  const cell: React.CSSProperties = { width: '100%', background: INK, border: `1px solid ${LINE}`, color: FG, padding: '5px 7px', fontFamily: mono, fontSize: 11, outline: 'none', textAlign: 'right' }
  const th: React.CSSProperties = { padding: '4px 8px', fontWeight: 700, textAlign: 'right' }

  return (
    <Panel title="Faturamento mês a mês">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ color: MUT }}>
              <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: PANEL }}>Mês</th>
              {COLS.map(([k, l]) => <th key={k} style={{ ...th, whiteSpace: 'nowrap' }}>{l}</th>)}
              <th style={{ ...th, width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={COLS.length + 2} style={{ padding: 14, color: MUT, textAlign: 'center' }}>Nenhum mês ainda. Clique em “Gerar últimos 6 meses” abaixo pra começar.</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.month} style={{ borderTop: `1px solid ${LINE}` }}>
                <td style={{ padding: '5px 8px', fontWeight: 700, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: PANEL }}>{mesLabel(r.month)}{saving === r.month && <span style={{ color: MUT, fontWeight: 400 }}> ·</span>}</td>
                {COLS.map(([k]) => (
                  <td key={k} style={{ padding: '4px 6px', minWidth: 92 }}>
                    <input value={r[k]} onChange={e => upd(i, k, e.target.value)} onBlur={() => saveRow(rows[i])} placeholder="—" style={k === 'faturamento' ? { ...cell, color: NEON, fontWeight: 700 } : cell} />
                  </td>
                ))}
                <td style={{ padding: '4px 6px', textAlign: 'center' }}><button onClick={() => delMonth(r.month)} title="Remover mês" style={{ background: 'transparent', border: 'none', color: MUT, cursor: 'pointer', fontSize: 12 }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {rows.length === 0 ? (
          <button onClick={seedRecent} style={{ background: NEON, color: INK, border: 'none', padding: '6px 14px', fontFamily: mono, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Gerar últimos 6 meses</button>
        ) : (
          <>
            <button onClick={() => earliest && createMonths([shiftMonth(earliest, -1)])} style={miniBtn}>◂ mês anterior</button>
            <button onClick={() => latest && createMonths([shiftMonth(latest, 1)])} style={miniBtn}>próximo mês ▸</button>
            <span style={{ width: 1, height: 18, background: LINE }} />
            <input type="month" value={draftMonth} onChange={e => setDraftMonth(e.target.value)} style={{ background: INK, border: `1px solid ${LINE}`, color: FG, padding: '6px 8px', fontFamily: mono, fontSize: 11, colorScheme: 'dark' as React.CSSProperties['colorScheme'] }} />
            <button onClick={addMonth} style={{ background: 'transparent', color: NEON, border: `1px solid ${NEON}`, padding: '6px 12px', fontFamily: mono, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ mês específico</button>
          </>
        )}
        <span style={{ fontSize: 10, color: MUT }}>edite os valores e clique fora do campo para salvar</span>
      </div>
    </Panel>
  )
}

// ───────── Painel do cliente ─────────
function ClientPanel({ detail, sel, tab, setTab, onMove, onRegister, onAddTask, onReload }: {
  detail: Detail; sel: Mentee; tab: 'sessoes' | 'tarefas'; setTab: (t: 'sessoes' | 'tarefas') => void
  onMove: (id: string, s: string) => void; onRegister: (meetingId?: string) => void; onAddTask: (what: string) => void; onReload: () => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [newTask, setNewTask] = useState('')
  const [viewCs, setViewCs] = useState<CaseStudy | null>(null)
  // sessão registrada de uma reunião: por meetingId ou pela data (mesmo dia)
  const sessionForMeeting = (mId: string, mDate: string) =>
    detail.caseStudies.find(cs => cs.meetingId === mId) ||
    detail.caseStudies.find(cs => new Date(cs.sessionDate).toDateString() === new Date(mDate).toDateString())
  const studies = detail.caseStudies
  const last = studies[0], prev = studies[1]
  // métricas mensais (fonte de verdade dos números) — desc por mês
  const metrics = (detail.monthlyMetrics ?? []).slice().sort((a, b) => b.month.localeCompare(a.month))
  const lastM = metrics[0], prevM = metrics[1]
  const delta = (a: number | null, b: number | null) => (a == null || b == null || b === 0) ? null : ((a - b) / b) * 100
  const kpis: [string, string, number | null, number | null][] = [
    ['Fat. do Mês', brl(lastM?.faturamento ?? null), lastM?.faturamento ?? null, prevM?.faturamento ?? null],
    ['Clientes Ativos', num(lastM?.clientesAtivos ?? null), lastM?.clientesAtivos ?? null, prevM?.clientesAtivos ?? null],
    ['Estoque (peças)', num(lastM?.estoqueQtd ?? null), lastM?.estoqueQtd ?? null, prevM?.estoqueQtd ?? null],
    ['Estoque (R$)', brl(lastM?.estoqueValor ?? null), lastM?.estoqueValor ?? null, prevM?.estoqueValor ?? null],
    ['Ticket Médio', brl(lastM?.ticketMedio ?? last?.ticketMedio ?? null), lastM?.ticketMedio ?? last?.ticketMedio ?? null, prevM?.ticketMedio ?? prev?.ticketMedio ?? null],
    ['Nº Vendas', num(lastM?.numVendas ?? last?.numVendas ?? null), lastM?.numVendas ?? last?.numVendas ?? null, prevM?.numVendas ?? prev?.numVendas ?? null],
    ['ROAS', (lastM?.roas ?? last?.roas) != null ? (lastM?.roas ?? last?.roas) + 'x' : '—', lastM?.roas ?? last?.roas ?? null, prevM?.roas ?? prev?.roas ?? null],
    ['Seguidores IG', num(lastM?.seguidoresIg ?? last?.seguidoresIg ?? null), lastM?.seguidoresIg ?? last?.seguidoresIg ?? null, prevM?.seguidoresIg ?? prev?.seguidoresIg ?? null],
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
        <button onClick={() => onRegister()} style={{ background: NEON, color: INK, border: 'none', padding: '10px 16px', fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ REGISTRAR SESSÃO</button>
      </div>

      {/* Última reunião em destaque */}
      {last && (last.pontosPrincipais || last.oQueTrabalhou || last.proximosPassos || (last.materiais && last.materiais.length > 0)) && (
        <div style={{ background: PANEL, border: `1px solid ${NEON}`, borderLeft: `3px solid ${NEON}`, padding: 16, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 9, color: NEON, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>★ Última reunião · {dt(last.sessionDate)}</span>
            {last.materiais && last.materiais.length > 0 && <span style={{ fontSize: 10, color: MUT }}>{last.materiais.length} anexo(s)</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, fontSize: 12, lineHeight: 1.55 }}>
            {last.pontosPrincipais && <div><div style={{ color: NEON, fontSize: 9, textTransform: 'uppercase', marginBottom: 3 }}>Principais pontos</div><div style={{ whiteSpace: 'pre-wrap', color: '#ddd' }}>{last.pontosPrincipais}</div></div>}
            {last.oQueTrabalhou && <div><div style={{ color: MUT, fontSize: 9, textTransform: 'uppercase', marginBottom: 3 }}>Passado ao cliente</div><div style={{ color: '#ddd' }}>{last.oQueTrabalhou}</div></div>}
            {last.proximosPassos && <div><div style={{ color: MUT, fontSize: 9, textTransform: 'uppercase', marginBottom: 3 }}>Próximos passos</div><div style={{ color: '#ddd' }}>{last.proximosPassos}</div></div>}
          </div>
          {last.materiais && last.materiais.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {last.materiais.map((m, i) => (
                <a key={i} href={m.url} target="_blank" rel="noreferrer" download={m.url?.startsWith('data:') ? m.label : undefined} style={{ background: INK, border: `1px solid ${LINE}`, color: NEON, padding: '5px 10px', fontSize: 10, textDecoration: 'none' }}>{m.url?.startsWith('data:') ? '📎' : '🔗'} {m.label}</a>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
        {kpis.map(([label, val, a, b]) => {
          const dl = delta(a, b)
          return (
            <div key={label} style={{ background: PANEL, border: `1px solid ${LINE}`, padding: '14px 16px' }}>
              <div style={{ fontSize: 9, color: MUT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
              <div style={{ fontFamily: disp, fontSize: 22, fontWeight: 700, marginTop: 4, color: label === 'Fat. do Mês' ? NEON : FG }}>{val}</div>
              {dl != null && <div style={{ fontSize: 10, marginTop: 2, color: dl >= 0 ? NEON : '#ff5a5a' }}>{dl >= 0 ? '▲' : '▼'} {Math.abs(dl).toFixed(0)}% vs anterior</div>}
            </div>
          )
        })}
      </div>

      {/* Faturamento mês a mês — tabela editável (fonte de verdade dos números) */}
      <div style={{ marginBottom: 18 }}>
        <MonthlyTable clientId={sel.clientId} metrics={metrics} onReload={onReload} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14, marginBottom: 18 }}>
        <Panel title="Evolução do faturamento (mês a mês)"><EvolutionChart studies={metrics.map(m => ({ sessionDate: m.month + '-01T12:00:00', faturamentoMes: m.faturamento })) as unknown as CaseStudy[]} /></Panel>
        <Panel title="Contexto da mentoria">
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>
            <div style={{ marginBottom: 8 }}><span style={{ color: MUT }}>Dores:</span> {detail.profile.mainPains || <span style={{ color: '#555' }}>não preenchido</span>}</div>
            <div><span style={{ color: MUT }}>Objetivo:</span> {detail.profile.goal || <span style={{ color: '#555' }}>não preenchido</span>}</div>
          </div>
        </Panel>
      </div>

      {/* Ficha do cliente + reuniões */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 18 }}>
        <Panel title="Ficha do cliente">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 11 }}>
            {[
              ['Programa', detail.client?.plan ? `${detail.client.plan.code} · ${brl(detail.client.plan.value)}` : '—'],
              ['CNPJ', detail.client?.cnpj || '—'],
              ['Responsável', detail.client?.responsible || '—'],
              ['Segmento', detail.client?.segment || '—'],
              ['E-mail', detail.client?.email || '—'],
              ['WhatsApp', detail.client?.whatsapp || detail.client?.phone || '—'],
              ['Cidade', [detail.client?.city, detail.client?.state].filter(Boolean).join('/') || '—'],
              ['Fat. estimado', detail.client?.estimatedRevenue || '—'],
            ].map(([l, v]) => (
              <div key={l}><div style={{ color: MUT, fontSize: 9, textTransform: 'uppercase' }}>{l}</div><div style={{ color: FG, wordBreak: 'break-word' }}>{v}</div></div>
            ))}
          </div>
        </Panel>
        <Panel title={`Reuniões (${detail.meetings?.filter(m => m.status === 'DONE').length ?? 0} realizadas)`}>
          <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(detail.meetings ?? []).length === 0 && <div style={{ color: '#555', fontSize: 11 }}>Nenhuma reunião.</div>}
            {(detail.meetings ?? []).map(m => {
              const cs = sessionForMeeting(m.id, m.date)
              return (
                <div key={m.id} onClick={() => cs ? setViewCs(cs) : (m.status === 'DONE' ? onRegister(m.id) : undefined)}
                  title={cs ? 'Ver registro da reunião' : (m.status === 'DONE' ? 'Registrar esta reunião' : '')}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '5px 4px', borderBottom: `1px solid ${LINE}`, cursor: m.status === 'DONE' ? 'pointer' : 'default', gap: 8 }}>
                  <span style={{ color: m.status === 'DONE' ? FG : MUT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.status === 'DONE' ? '✓' : '○'} {m.title}</span>
                  {cs ? <span style={{ color: NEON, fontSize: 9, fontWeight: 700 }}>registro ›</span> : m.status === 'DONE' ? <span style={{ color: MUT, fontSize: 9 }}>+ registrar</span> : null}
                  <span style={{ color: MUT, flexShrink: 0 }}>{dt(m.date)}</span>
                </div>
              )
            })}
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
                <span style={{ color: MUT, fontWeight: 400 }}>{cs.ticketMedio != null ? `ticket ${brl(cs.ticketMedio)}` : ''}</span>
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
                  {items.length === 0 && st !== 'TODO' && <div style={{ fontSize: 10, color: '#555', textAlign: 'center', padding: 8 }}>—</div>}
                  {st === 'TODO' && (
                    <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTask.trim()) { onAddTask(newTask.trim()); setNewTask('') } }}
                      placeholder="+ nova tarefa (Enter)" style={{ background: 'transparent', border: `1px dashed ${LINE}`, color: FG, padding: '6px 8px', fontFamily: mono, fontSize: 10, outline: 'none' }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {viewCs && <SessionView cs={viewCs} onClose={() => setViewCs(null)} />}
    </div>
  )
}

// ───────── Modal: registro de uma reunião ─────────
function SessionView({ cs, onClose }: { cs: CaseStudy; onClose: () => void }) {
  const row = (l: string, v: React.ReactNode) => v ? <div style={{ marginBottom: 8 }}><div style={{ color: NEON, fontSize: 9, textTransform: 'uppercase', marginBottom: 3 }}>{l}</div><div style={{ color: '#ddd', fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{v}</div></div> : null
  const metrics = ([
    ['Fat. mês', brl(cs.faturamentoMes)], ['Clientes ativos', num(cs.clientesAtivos)],
    ['Estoque (pç)', num(cs.estoqueQtd)], ['Estoque R$', brl(cs.estoqueValor)],
    ['Ticket', brl(cs.ticketMedio)], ['Vendas', num(cs.numVendas)],
    ['ROAS', cs.roas != null ? cs.roas + 'x' : '—'], ['IG', num(cs.seguidoresIg)],
    ['Fat. ano', brl(cs.faturamentoAno)],
  ] as [string, string][]).filter(([, v]) => v !== '—')
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: INK, border: `1px solid ${NEON}`, color: FG, width: '100%', maxWidth: 620, marginTop: 24 }}>
        <div style={{ background: PANEL, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${LINE}` }}>
          <span style={{ fontFamily: disp, fontSize: 14, fontWeight: 700 }}>REGISTRO · {dt(cs.sessionDate)}{cs.mentorName ? ` · ${cs.mentorName}` : ''}</span>
          <button onClick={onClose} style={{ background: 'transparent', color: MUT, border: `1px solid ${LINE}`, borderRadius: 5, width: 24, height: 24, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 16, fontFamily: mono }}>
          {metrics.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginBottom: 14 }}>
              {metrics.map(([l, v]) => <div key={l} style={{ border: `1px solid ${LINE}`, padding: '6px 8px' }}><div style={{ fontSize: 8, color: MUT, textTransform: 'uppercase' }}>{l}</div><div style={{ fontSize: 13, fontWeight: 700, color: l === 'Fat. mês' ? NEON : FG }}>{v}</div></div>)}
            </div>
          )}
          {row('Principais pontos', cs.pontosPrincipais)}
          {row('O que foi passado ao cliente', cs.oQueTrabalhou)}
          {row('Próximos passos', cs.proximosPassos)}
          {cs.vendasPorCanal && cs.vendasPorCanal.length > 0 && row('Vendas por canal', cs.vendasPorCanal.map(c => `${c.canal}: ${brl(c.valor)}`).join('  ·  '))}
          {cs.customFields && cs.customFields.length > 0 && row('Campos extras', cs.customFields.map(c => `${c.label}: ${c.value}`).join('  ·  '))}
          {cs.materiais && cs.materiais.length > 0 && (
            <div style={{ marginBottom: 8 }}><div style={{ color: NEON, fontSize: 9, textTransform: 'uppercase', marginBottom: 4 }}>Materiais / anexos</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{cs.materiais.map((m, i) => <a key={i} href={m.url} target="_blank" rel="noreferrer" download={m.url?.startsWith('data:') ? m.label : undefined} style={{ background: PANEL, border: `1px solid ${LINE}`, color: NEON, padding: '5px 10px', fontSize: 10, textDecoration: 'none' }}>{m.url?.startsWith('data:') ? '📎' : '🔗'} {m.label}</a>)}</div>
            </div>
          )}
          {cs.transcricao && <div><div style={{ color: MUT, fontSize: 9, textTransform: 'uppercase', marginBottom: 4 }}>Transcrição</div><div style={{ whiteSpace: 'pre-wrap', color: '#aaa', fontSize: 11, background: PANEL, padding: 10, border: `1px solid ${LINE}`, maxHeight: 300, overflowY: 'auto' }}>{cs.transcricao}</div></div>}
          {!cs.pontosPrincipais && !cs.oQueTrabalhou && !cs.transcricao && metrics.length === 0 && <div style={{ color: MUT, fontSize: 12 }}>Registro sem detalhes.</div>}
        </div>
      </div>
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
  // agrega por mês: um ponto por mês, valor = faturamento do mês da sessão mais recente daquele mês
  const byMonth = new Map<string, number>()
  for (const s of studies) { // studies vem em ordem desc (mais recente primeiro)
    if (s.faturamentoMes == null) continue
    const dt = new Date(s.sessionDate)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    if (!byMonth.has(key)) byMonth.set(key, s.faturamentoMes)
  }
  const pts = [...byMonth.entries()].map(([k, y]) => ({ x: new Date(k + '-01').getTime(), y })).sort((a, b) => a.x - b.x)
  if (pts.length < 2) return <div style={{ color: MUT, fontSize: 12, padding: '30px 0', textAlign: 'center' }}>Precisa de 2+ meses com faturamento pra desenhar a evolução.</div>
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

function SessionForm({ clientId, meetingId, onClose, onSaved }: { clientId: string; meetingId?: string; onClose: () => void; onSaved: () => void }) {
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
          clientId, meetingId, sessionDate: f.sessionDate,
          ticketMedio: numOr(f.ticketMedio), numVendas: numOr(f.numVendas),
          investimentoTrafego: numOr(f.investimentoTrafego), roas: numOr(f.roas), seguidoresIg: numOr(f.seguidoresIg),
          vendasPorCanal: channels.filter(c => c.canal), customFields: customs.filter(c => c.label), materiais: materiais.filter(m => m.label || m.url).map(m => ({ label: m.label || 'arquivo', url: m.url })),
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
          <div style={sec}>Métricas de marketing / vendas da sessão</div>
          <div style={{ fontSize: 10, color: MUT, marginBottom: 8 }}>Faturamento, clientes ativos e estoque agora ficam na tabela “Faturamento mês a mês” da ficha do cliente.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['ticketMedio', 'Ticket médio (R$)'], ['numVendas', 'Nº de vendas'], ['investimentoTrafego', 'Invest. tráfego (R$)'], ['roas', 'ROAS (x)'], ['seguidoresIg', 'Seguidores IG']].map(([k, l]) => (
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

          <div style={sec}>Materiais / anexos da reunião</div>
          {materiais.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
              {m.url?.startsWith('data:') ? (
                <span style={{ flex: 1, fontSize: 11, color: FG, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {m.label}</span>
              ) : (
                <>
                  <input value={m.label} onChange={e => setMateriais(ms => ms.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Nome" style={{ ...inp, flex: 1 }} />
                  <input value={m.url ?? ''} onChange={e => setMateriais(ms => ms.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://..." style={{ ...inp, flex: 1 }} />
                </>
              )}
              <button onClick={() => setMateriais(ms => ms.filter((_, j) => j !== i))} style={{ ...inp, width: 34, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <label style={{ ...dashBtn, cursor: 'pointer' }}>
              📎 Subir arquivo
              <input type="file" style={{ display: 'none' }} onChange={e => {
                const file = e.target.files?.[0]; if (!file) return
                if (file.size > 4 * 1024 * 1024) { toast.error('Arquivo muito grande (máx 4MB)'); return }
                const reader = new FileReader()
                reader.onload = () => setMateriais(ms => [...ms, { label: file.name, url: reader.result as string }])
                reader.readAsDataURL(file)
                e.currentTarget.value = ''
              }} />
            </label>
            <button onClick={() => setMateriais(ms => [...ms, { label: '', url: '' }])} style={dashBtn}>+ link</button>
          </div>

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
