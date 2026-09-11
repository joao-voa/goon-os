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
  billing?: Billing
}
interface Billing {
  plan: { code: string; name: string; value: number; installments: number | null; installmentValue: number | null; paymentType: string; status: string; renewalStatus: string | null; startDate: string; endDate: string | null } | null
  delinquent: boolean; overdueCount: number; overdueTotal: number; oldestOverdueDue: string | null
  nextDue: { dueDate: string; value: number; installment: number; totalInstallments: number } | null
  paidCount: number; totalPayments: number
}

// ───────── helpers ─────────
const brl = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const num = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR')
const dt = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'
// paleta clara + neon (design system GOON)
const NEON = '#C7F900', INK = '#0f172a', MUT = '#64748b', DIM = '#94a3b8', LINE = '#e2e8f0', BG = '#f8fafc', CARD = '#fff', FG = '#0f172a'
const GREEN = '#16a34a', RED = '#dc2626', AMBER = '#f59e0b', SLATE = '#475569'
const disp = 'var(--font-display)', mono = 'var(--font-sans)'
const tnum: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' }
const cardStyle: React.CSSProperties = { background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
const KANBAN: [string, string, string][] = [['TODO', 'A Fazer', SLATE], ['DOING', 'Fazendo', AMBER], ['DONE', 'Feito', GREEN]]

function chip(active: boolean, color: string): React.CSSProperties {
  return { padding: '6px 12px', borderRadius: 100, border: `1px solid ${active ? color : LINE}`, background: active ? color : CARD, color: active ? (color === NEON ? INK : '#fff') : MUT, fontFamily: mono, fontSize: 12, fontWeight: 600, cursor: 'pointer' }
}
const miniBtn: React.CSSProperties = { border: `1px solid ${LINE}`, background: CARD, color: SLATE, cursor: 'pointer', fontFamily: mono, fontSize: 11, padding: '4px 9px', borderRadius: 6 }

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
    <div style={{ background: BG, minHeight: 'calc(100vh - 56px)', color: FG, display: 'flex', fontFamily: mono }}>
      {/* ══ LISTA (esquerda) — colapsável ══ */}
      {listCollapsed ? (
        <aside style={{ width: 44, background: CARD, borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, height: 'calc(100vh - 56px)', position: 'sticky', top: 0, paddingTop: 14 }}>
          <button onClick={() => setListCollapsed(false)} title="Expandir lista" style={{ background: 'none', border: 'none', color: MUT, cursor: 'pointer', fontSize: 16 }}>▸</button>
          <div style={{ writingMode: 'vertical-rl', marginTop: 12, fontFamily: disp, fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', color: MUT }}>Mentoria · {mentees.length}</div>
        </aside>
      ) : (
      <aside style={{ width: 300, background: CARD, borderRight: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', flexShrink: 0, height: 'calc(100vh - 56px)', position: 'sticky', top: 0 }}>
        <div style={{ padding: '18px 16px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: disp, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: INK }}>Mentoria</div>
            <button onClick={() => setListCollapsed(true)} title="Recolher lista" style={{ background: 'none', border: 'none', color: DIM, cursor: 'pointer', fontSize: 16 }}>◂</button>
          </div>
          <div style={{ fontSize: 12, color: MUT, marginTop: 3 }}>{mentees.length} mentorados · <span style={{ color: totAtt ? RED : GREEN, fontWeight: 600 }}>{totAtt} em atenção</span></div>
        </div>
        <div style={{ padding: '0 16px 12px' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente..." className="goon-input" />
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setAttF(v => !v)} style={chip(attF, RED)}>Atenção</button>
            <select value={mentorF} onChange={e => setMentorF(e.target.value)} style={{ ...chip(!!mentorF, NEON), cursor: 'pointer' }}>
              <option value="">Mentor</option>
              {mentors.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', borderTop: `1px solid ${LINE}` }}>
          <button onClick={() => setSelId(null)} style={{
            width: '100%', textAlign: 'left', background: selId === null ? BG : 'transparent', border: 'none',
            borderLeft: `3px solid ${selId === null ? NEON : 'transparent'}`, padding: '12px 14px', cursor: 'pointer', color: INK,
            display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${LINE}`, fontFamily: mono, fontWeight: 700, fontSize: 13,
          }}>
            <span style={{ fontSize: 14 }}>◱</span> Visão geral
          </button>
          {mentees.length === 0 && <div style={{ padding: 20, fontSize: 12, color: MUT, textAlign: 'center' }}>Nenhum mentorado.<br />Inscreva um cliente abaixo.</div>}
          {mentees.map(m => {
            const active = m.clientId === selId
            return (
              <button key={m.clientId} onClick={() => setSelId(m.clientId)} style={{
                width: '100%', textAlign: 'left', background: active ? BG : 'transparent', border: 'none',
                borderLeft: `3px solid ${active ? NEON : 'transparent'}`, padding: '11px 14px', cursor: 'pointer', color: INK,
                display: 'flex', flexDirection: 'column', gap: 3, borderBottom: `1px solid ${LINE}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.attention ? RED : GREEN, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: 13, color: INK, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.company}</span>
                  {m.tier && <span style={{ fontSize: 9, background: BG, border: `1px solid ${LINE}`, color: MUT, padding: '1px 6px', borderRadius: 100, fontWeight: 600 }}>{m.tier}</span>}
                </div>
                <div style={{ fontSize: 11, color: MUT, paddingLeft: 14, ...tnum }}>
                  {m.mentorName ?? 'sem mentor'} · {(m.lastMetrics?.faturamentoMes ?? m.lastMetrics?.faturamentoAno) != null ? brl(m.lastMetrics!.faturamentoMes ?? m.lastMetrics!.faturamentoAno) : 's/ dados'}
                  {m.overdueActions > 0 && <span style={{ color: RED }}> · {m.overdueActions} atrasada(s)</span>}
                </div>
              </button>
            )
          })}
        </div>
        <div style={{ margin: 12, fontSize: 11, color: DIM, textAlign: 'center', lineHeight: 1.5 }}>Todos os clientes ativos aparecem aqui.<br />Selecione um pra ver a ficha completa.</div>
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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: disp, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: INK, margin: 0 }}>Visão Geral</h1>
        <div style={{ fontSize: 13, color: MUT, marginTop: 4 }}>{t.mentees} clientes ativos · {t.comDados} com dados de faturamento neste mês</div>
      </div>

      {/* KPIs somados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {kpis.map(([l, v, hi]) => (
          <div key={l} style={{ ...cardStyle, padding: '16px 18px', borderTop: hi ? `3px solid ${NEON}` : `1px solid ${LINE}` }}>
            <div style={{ fontSize: 11, color: MUT, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{l}</div>
            <div style={{ ...tnum, fontFamily: disp, fontSize: 24, fontWeight: 700, color: INK, marginTop: 6 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Evolução somada */}
      <div style={{ marginBottom: 20 }}>
        <Panel title="Evolução do faturamento somado (mês a mês)"><EvolutionChart studies={monthlyStudies} /></Panel>
      </div>

      {/* Ranking de clientes */}
      <Panel title="Ranking de clientes (faturamento do mês)">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: MUT, textAlign: 'left', background: BG }}>
                <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>#</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cliente</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Fat. mês</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Clientes</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Estoque R$</th>
                <th style={{ padding: '8px 10px', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {ov.clients.map((c, i) => (
                <tr key={c.clientId} onClick={() => onSelect(c.clientId)} style={{ cursor: 'pointer', borderTop: `1px solid ${LINE}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = BG)} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '9px 10px', color: DIM, ...tnum }}>{i + 1}</td>
                  <td style={{ padding: '9px 10px', fontWeight: 700, color: INK }}>{c.company}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: c.faturamentoMes != null ? INK : DIM, fontWeight: 700, ...tnum }}>{c.faturamentoMes != null ? brl(c.faturamentoMes) : 's/ dados'}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', ...tnum }}>{num(c.clientesAtivos)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', ...tnum }}>{brl(c.estoqueValor)}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', color: MUT, ...tnum }}>{mesLabel(c.month)}</td>
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
  const cell: React.CSSProperties = { width: '100%', background: CARD, border: `1px solid ${LINE}`, color: INK, padding: '6px 8px', fontFamily: mono, fontSize: 12, outline: 'none', textAlign: 'right', borderRadius: 6, ...tnum }
  const th: React.CSSProperties = { padding: '8px 8px', fontWeight: 600, textAlign: 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.03em' }

  return (
    <Panel title="Faturamento mês a mês">
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: MUT, background: BG }}>
              <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: BG }}>Mês</th>
              {COLS.map(([k, l]) => <th key={k} style={{ ...th, whiteSpace: 'nowrap' }}>{l}</th>)}
              <th style={{ ...th, width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={COLS.length + 2} style={{ padding: 16, color: MUT, textAlign: 'center' }}>Nenhum mês ainda. Clique em “Gerar últimos 6 meses” abaixo pra começar.</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.month} style={{ borderTop: `1px solid ${LINE}` }}>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: INK, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: CARD }}>{mesLabel(r.month)}{saving === r.month && <span style={{ color: MUT, fontWeight: 400 }}> ·</span>}</td>
                {COLS.map(([k]) => (
                  <td key={k} style={{ padding: '4px 6px', minWidth: 92 }}>
                    <input value={r[k]} onChange={e => upd(i, k, e.target.value)} onBlur={() => saveRow(rows[i])} placeholder="—" style={k === 'faturamento' ? { ...cell, color: INK, fontWeight: 700 } : cell} />
                  </td>
                ))}
                <td style={{ padding: '4px 6px', textAlign: 'center' }}><button onClick={() => delMonth(r.month)} title="Remover mês" style={{ background: 'transparent', border: 'none', color: DIM, cursor: 'pointer', fontSize: 12 }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {rows.length === 0 ? (
          <button onClick={seedRecent} style={{ background: NEON, color: INK, border: 'none', padding: '7px 14px', fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: 6 }}>+ Gerar últimos 6 meses</button>
        ) : (
          <>
            <button onClick={() => earliest && createMonths([shiftMonth(earliest, -1)])} style={miniBtn}>◂ mês anterior</button>
            <button onClick={() => latest && createMonths([shiftMonth(latest, 1)])} style={miniBtn}>próximo mês ▸</button>
            <span style={{ width: 1, height: 18, background: LINE }} />
            <input type="month" value={draftMonth} onChange={e => setDraftMonth(e.target.value)} style={{ background: CARD, border: `1px solid ${LINE}`, color: INK, padding: '6px 8px', fontFamily: mono, fontSize: 12, borderRadius: 6 }} />
            <button onClick={addMonth} style={{ background: CARD, color: INK, border: `1px solid ${LINE}`, padding: '6px 12px', fontFamily: mono, fontSize: 12, fontWeight: 600, cursor: 'pointer', borderRadius: 6 }}>+ mês específico</button>
          </>
        )}
        <span style={{ fontSize: 11, color: DIM }}>edite os valores e clique fora do campo para salvar</span>
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
  const badge: React.CSSProperties = { marginLeft: 8, background: '#fee2e2', color: RED, padding: '2px 10px', borderRadius: 100, fontWeight: 700, fontSize: 11 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: disp, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: INK, margin: 0 }}>{detail.client?.companyName ?? sel.company}</h1>
          <div style={{ fontSize: 13, color: MUT, marginTop: 4 }}>
            {detail.client?.responsible ?? '—'} · Mentor <span style={{ color: INK, fontWeight: 600 }}>{detail.profile.mentorName ?? '—'}</span> · {studies.length} sessões
            {sel.attention && <span style={badge}>Em atenção</span>}
            {detail.billing?.delinquent && <span style={badge}>Inadimplente</span>}
          </div>
        </div>
        <button onClick={() => onRegister()} style={{ background: NEON, color: INK, border: 'none', padding: '10px 16px', fontFamily: mono, fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 6 }}>+ Registrar sessão</button>
      </div>

      {/* Última reunião em destaque */}
      {last && (last.pontosPrincipais || last.oQueTrabalhou || last.proximosPassos || (last.materiais && last.materiais.length > 0)) && (
        <div style={{ ...cardStyle, borderLeft: `3px solid ${NEON}`, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: INK, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Última reunião · {dt(last.sessionDate)}</span>
            {last.materiais && last.materiais.length > 0 && <span style={{ fontSize: 11, color: MUT }}>{last.materiais.length} anexo(s)</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, fontSize: 13, lineHeight: 1.55 }}>
            {last.pontosPrincipais && <div><div style={{ color: MUT, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 4 }}>Principais pontos</div><div style={{ whiteSpace: 'pre-wrap', color: INK }}>{last.pontosPrincipais}</div></div>}
            {last.oQueTrabalhou && <div><div style={{ color: MUT, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 4 }}>Passado ao cliente</div><div style={{ color: INK }}>{last.oQueTrabalhou}</div></div>}
            {last.proximosPassos && <div><div style={{ color: MUT, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 4 }}>Próximos passos</div><div style={{ color: INK }}>{last.proximosPassos}</div></div>}
          </div>
          {last.materiais && last.materiais.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {last.materiais.map((m, i) => (
                <a key={i} href={m.url} target="_blank" rel="noreferrer" download={m.url?.startsWith('data:') ? m.label : undefined} style={{ background: BG, border: `1px solid ${LINE}`, color: INK, padding: '5px 10px', fontSize: 11, textDecoration: 'none', borderRadius: 6 }}>{m.url?.startsWith('data:') ? '📎' : '🔗'} {m.label}</a>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {kpis.map(([label, val, a, b]) => {
          const dl = delta(a, b)
          return (
            <div key={label} style={{ ...cardStyle, padding: '16px 18px', borderTop: label === 'Fat. do Mês' ? `3px solid ${NEON}` : `1px solid ${LINE}` }}>
              <div style={{ fontSize: 11, color: MUT, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
              <div style={{ ...tnum, fontFamily: disp, fontSize: 22, fontWeight: 700, marginTop: 4, color: INK }}>{val}</div>
              {dl != null && <div style={{ fontSize: 11, marginTop: 3, color: dl >= 0 ? GREEN : RED, fontWeight: 600 }}>{dl >= 0 ? '▲' : '▼'} {Math.abs(dl).toFixed(0)}% vs anterior</div>}
            </div>
          )
        })}
      </div>

      {/* Faturamento mês a mês — tabela editável (fonte de verdade dos números) */}
      <div style={{ marginBottom: 20 }}>
        <MonthlyTable clientId={sel.clientId} metrics={metrics} onReload={onReload} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 14, marginBottom: 20 }}>
        <Panel title="Evolução do faturamento (mês a mês)"><EvolutionChart studies={metrics.map(m => ({ sessionDate: m.month + '-01T12:00:00', faturamentoMes: m.faturamento })) as unknown as CaseStudy[]} /></Panel>
        <Panel title="Contexto da mentoria">
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ marginBottom: 8 }}><span style={{ color: MUT, fontWeight: 600 }}>Dores:</span> {detail.profile.mainPains || <span style={{ color: DIM }}>não preenchido</span>}</div>
            <div><span style={{ color: MUT, fontWeight: 600 }}>Objetivo:</span> {detail.profile.goal || <span style={{ color: DIM }}>não preenchido</span>}</div>
          </div>
        </Panel>
      </div>

      {/* Plano & Financeiro */}
      {detail.billing && (() => {
        const b = detail.billing!
        const p = b.plan
        const end = p?.endDate ? new Date(p.endDate) : null
        const daysLeft = end ? Math.ceil((end.getTime() - Date.now()) / 86400000) : null
        const vigencia = p ? `${dt(p.startDate)} → ${end ? dt(p.endDate) : 'sem término'}` : '—'
        const vigColor = daysLeft != null && daysLeft < 0 ? RED : daysLeft != null && daysLeft <= 30 ? AMBER : INK
        const parcelas = p ? (p.installments && p.installmentValue ? `${p.installments}× ${brl(p.installmentValue)}` : p.installments ? `${p.installments}×` : 'à vista') : '—'
        const items: [string, React.ReactNode, string?][] = [
          ['Programa', p ? `${p.code} · ${p.name}` : '—'],
          ['Valor total', p ? brl(p.value) : '—', INK],
          ['Parcelas', parcelas],
          ['Vigência', vigencia + (daysLeft != null ? daysLeft < 0 ? ' (encerrada)' : daysLeft <= 30 ? ` (${daysLeft}d p/ vencer)` : '' : ''), vigColor],
          ['Situação', b.delinquent ? `Inadimplente` : 'Adimplente', b.delinquent ? RED : GREEN],
          ['Próxima parcela', b.nextDue ? `${dt(b.nextDue.dueDate)} · ${brl(b.nextDue.value)} (${b.nextDue.installment}/${b.nextDue.totalInstallments})` : '—'],
          ['Parcelas pagas', `${b.paidCount}/${b.totalPayments}`],
        ]
        return (
          <div style={{ marginBottom: 20 }}>
            <Panel title="Plano & Financeiro">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px 18px', fontSize: 13 }}>
                {items.map(([l, v, c]) => (
                  <div key={l}>
                    <div style={{ fontSize: 11, color: MUT, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 3 }}>{l}</div>
                    <div style={{ color: c ?? INK, fontWeight: c ? 700 : 400 }}>{v}</div>
                  </div>
                ))}
              </div>
              {b.delinquent && (
                <div style={{ marginTop: 12, background: '#fef2f2', border: `1px solid ${RED}`, color: RED, padding: '9px 12px', fontSize: 12, borderRadius: 8 }}>
                  ⚠ {b.overdueCount} parcela(s) em atraso · total <b>{brl(b.overdueTotal)}</b>{b.oldestOverdueDue ? ` · vencida desde ${dt(b.oldestOverdueDue)}` : ''}
                </div>
              )}
            </Panel>
          </div>
        )
      })()}

      {/* Ficha do cliente + reuniões */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, marginBottom: 20 }}>
        <Panel title="Ficha do cliente">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', fontSize: 12 }}>
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
              <div key={l}><div style={{ color: MUT, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{l}</div><div style={{ color: INK, wordBreak: 'break-word' }}>{v}</div></div>
            ))}
          </div>
        </Panel>
        <Panel title={`Reuniões (${detail.meetings?.filter(m => m.status === 'DONE').length ?? 0} realizadas)`}>
          <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(detail.meetings ?? []).length === 0 && <div style={{ color: DIM, fontSize: 12 }}>Nenhuma reunião.</div>}
            {(detail.meetings ?? []).map(m => {
              const cs = sessionForMeeting(m.id, m.date)
              return (
                <div key={m.id} onClick={() => cs ? setViewCs(cs) : (m.status === 'DONE' ? onRegister(m.id) : undefined)}
                  title={cs ? 'Ver registro da reunião' : (m.status === 'DONE' ? 'Registrar esta reunião' : '')}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '7px 4px', borderBottom: `1px solid ${LINE}`, cursor: m.status === 'DONE' ? 'pointer' : 'default', gap: 8 }}>
                  <span style={{ color: m.status === 'DONE' ? INK : MUT, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.status === 'DONE' ? '✓' : '○'} {m.title}</span>
                  {cs ? <span style={{ color: GREEN, fontSize: 11, fontWeight: 700 }}>registro ›</span> : m.status === 'DONE' ? <span style={{ color: MUT, fontSize: 11 }}>+ registrar</span> : null}
                  <span style={{ color: MUT, flexShrink: 0, ...tnum }}>{dt(m.date)}</span>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: `1px solid ${LINE}` }}>
        {(['sessoes', 'tarefas'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: mono, fontSize: 13,
            fontWeight: tab === t ? 700 : 500, color: tab === t ? INK : DIM,
            borderBottom: tab === t ? `2px solid ${NEON}` : '2px solid transparent', marginBottom: -1,
          }}>{t === 'sessoes' ? 'Sessões' : `Tarefas (${openTasks})`}</button>
        ))}
      </div>

      {tab === 'sessoes' && (
        <div>
          {studies.length === 0 && <Panel title=""><div style={{ color: MUT, fontSize: 13 }}>Nenhuma sessão registrada. Clique em “Registrar sessão”.</div></Panel>}
          {studies.map(cs => (
            <div key={cs.id} style={{ ...cardStyle, marginBottom: 8 }}>
              <div onClick={() => setExpanded(expanded === cs.id ? null : cs.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: INK }}>
                <span>{expanded === cs.id ? '▾' : '▸'} {dt(cs.sessionDate)}{cs.mentorName ? ` · ${cs.mentorName}` : ''}</span>
                <span style={{ color: MUT, fontWeight: 500, ...tnum }}>{cs.ticketMedio != null ? `ticket ${brl(cs.ticketMedio)}` : ''}</span>
              </div>
              {expanded === cs.id && (
                <div style={{ padding: '12px 16px 16px', fontSize: 12, lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: 8, borderTop: `1px solid ${LINE}` }}>
                  {cs.pontosPrincipais && <div><b style={{ color: INK }}>Principais pontos:</b><div style={{ whiteSpace: 'pre-wrap', color: SLATE }}>{cs.pontosPrincipais}</div></div>}
                  {cs.oQueTrabalhou && <div><b style={{ color: INK }}>Passado ao cliente:</b> <span style={{ color: SLATE }}>{cs.oQueTrabalhou}</span></div>}
                  {cs.proximosPassos && <div><b style={{ color: INK }}>Próximos passos:</b> <span style={{ color: SLATE }}>{cs.proximosPassos}</span></div>}
                  {cs.vendasPorCanal && cs.vendasPorCanal.length > 0 && <div><b style={{ color: INK }}>Por canal:</b> {cs.vendasPorCanal.map((c, i) => <span key={i} style={{ marginRight: 10, color: SLATE }}>{c.canal} {brl(c.valor)}</span>)}</div>}
                  {cs.materiais && cs.materiais.length > 0 && <div><b style={{ color: INK }}>Materiais:</b> {cs.materiais.map((m, i) => m.url ? <a key={i} href={m.url} target="_blank" rel="noreferrer" style={{ color: GREEN, marginRight: 8 }}>{m.label}</a> : <span key={i} style={{ marginRight: 8 }}>{m.label}</span>)}</div>}
                  {cs.transcricao && <details><summary style={{ cursor: 'pointer', color: MUT }}>Transcrição</summary><div style={{ whiteSpace: 'pre-wrap', color: SLATE, marginTop: 4, maxHeight: 220, overflowY: 'auto', background: BG, padding: 10, border: `1px solid ${LINE}`, borderRadius: 8 }}>{cs.transcricao}</div></details>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'tarefas' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {KANBAN.map(([st, label, color]) => {
            const items = detail.actionItems.filter(a => (a.status || (a.done ? 'DONE' : 'TODO')) === st)
            const order = ['TODO', 'DOING', 'DONE']; const idx = order.indexOf(st)
            return (
              <div key={st} style={{ ...cardStyle, minHeight: 120, overflow: 'hidden' }}>
                <div style={{ background: BG, color, padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: `1px solid ${LINE}` }}>{label} ({items.length})</div>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map(a => {
                    const overdue = a.status !== 'DONE' && a.dueDate && new Date(a.dueDate).getTime() < Date.now()
                    return (
                      <div key={a.id} style={{ background: CARD, border: `1px solid ${LINE}`, padding: 10, fontSize: 12, borderRadius: 8 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4, color: INK }}>{a.what}</div>
                        <div style={{ fontSize: 11, color: overdue ? RED : MUT, marginBottom: 6 }}>{a.who ?? '—'} · {a.dueDate ? dt(a.dueDate) : 'sem prazo'}{overdue ? ' · ATRASADA' : ''}</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {idx > 0 && <button onClick={() => onMove(a.id, order[idx - 1])} style={miniBtn}>←</button>}
                          {idx < 2 && <button onClick={() => onMove(a.id, order[idx + 1])} style={{ ...miniBtn, marginLeft: 'auto' }}>→</button>}
                        </div>
                      </div>
                    )
                  })}
                  {items.length === 0 && st !== 'TODO' && <div style={{ fontSize: 11, color: DIM, textAlign: 'center', padding: 8 }}>—</div>}
                  {st === 'TODO' && (
                    <input value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTask.trim()) { onAddTask(newTask.trim()); setNewTask('') } }}
                      placeholder="+ nova tarefa (Enter)" style={{ background: 'transparent', border: `1px dashed ${LINE}`, color: INK, padding: '8px 10px', fontFamily: mono, fontSize: 12, outline: 'none', borderRadius: 8 }} />
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
  const row = (l: string, v: React.ReactNode) => v ? <div style={{ marginBottom: 10 }}><div style={{ color: MUT, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 3 }}>{l}</div><div style={{ color: INK, fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{v}</div></div> : null
  const metrics = ([
    ['Fat. mês', brl(cs.faturamentoMes)], ['Clientes ativos', num(cs.clientesAtivos)],
    ['Estoque (pç)', num(cs.estoqueQtd)], ['Estoque R$', brl(cs.estoqueValor)],
    ['Ticket', brl(cs.ticketMedio)], ['Vendas', num(cs.numVendas)],
    ['ROAS', cs.roas != null ? cs.roas + 'x' : '—'], ['IG', num(cs.seguidoresIg)],
    ['Fat. ano', brl(cs.faturamentoAno)],
  ] as [string, string][]).filter(([, v]) => v !== '—')
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, color: INK, width: '100%', maxWidth: 620, marginTop: 24, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ background: BG, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${LINE}` }}>
          <span style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: INK }}>Registro · {dt(cs.sessionDate)}{cs.mentorName ? ` · ${cs.mentorName}` : ''}</span>
          <button onClick={onClose} style={{ background: 'transparent', color: MUT, border: `1px solid ${LINE}`, borderRadius: 6, width: 26, height: 26, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 18, fontFamily: mono }}>
          {metrics.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginBottom: 16 }}>
              {metrics.map(([l, v]) => <div key={l} style={{ border: `1px solid ${LINE}`, borderRadius: 8, padding: '8px 10px' }}><div style={{ fontSize: 10, color: MUT, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{l}</div><div style={{ fontSize: 14, fontWeight: 700, color: INK, ...tnum }}>{v}</div></div>)}
            </div>
          )}
          {row('Principais pontos', cs.pontosPrincipais)}
          {row('O que foi passado ao cliente', cs.oQueTrabalhou)}
          {row('Próximos passos', cs.proximosPassos)}
          {cs.vendasPorCanal && cs.vendasPorCanal.length > 0 && row('Vendas por canal', cs.vendasPorCanal.map(c => `${c.canal}: ${brl(c.valor)}`).join('  ·  '))}
          {cs.customFields && cs.customFields.length > 0 && row('Campos extras', cs.customFields.map(c => `${c.label}: ${c.value}`).join('  ·  '))}
          {cs.materiais && cs.materiais.length > 0 && (
            <div style={{ marginBottom: 10 }}><div style={{ color: MUT, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 5 }}>Materiais / anexos</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{cs.materiais.map((m, i) => <a key={i} href={m.url} target="_blank" rel="noreferrer" download={m.url?.startsWith('data:') ? m.label : undefined} style={{ background: BG, border: `1px solid ${LINE}`, color: INK, padding: '5px 10px', fontSize: 11, textDecoration: 'none', borderRadius: 6 }}>{m.url?.startsWith('data:') ? '📎' : '🔗'} {m.label}</a>)}</div>
            </div>
          )}
          {cs.transcricao && <div><div style={{ color: MUT, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 5 }}>Transcrição</div><div style={{ whiteSpace: 'pre-wrap', color: SLATE, fontSize: 12, background: BG, padding: 10, border: `1px solid ${LINE}`, borderRadius: 8, maxHeight: 300, overflowY: 'auto' }}>{cs.transcricao}</div></div>}
          {!cs.pontosPrincipais && !cs.oQueTrabalhou && !cs.transcricao && metrics.length === 0 && <div style={{ color: MUT, fontSize: 13 }}>Registro sem detalhes.</div>}
        </div>
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...cardStyle, padding: 16 }}>
      {title && <div style={{ fontSize: 11, color: MUT, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 12 }}>{title}</div>}
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
  if (pts.length < 2) return <div style={{ color: MUT, fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Precisa de 2+ meses com faturamento pra desenhar a evolução.</div>
  const W = 460, H = 160, pad = 8
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const nx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (W - pad * 2)
  const ny = (y: number) => H - pad - ((y - minY) / (maxY - minY || 1)) * (H - pad * 2)
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${nx(p.x).toFixed(1)},${ny(p.y).toFixed(1)}`).join(' ')
  const area = `${d} L${nx(pts[pts.length - 1].x).toFixed(1)},${H - pad} L${nx(pts[0].x).toFixed(1)},${H - pad} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      <defs><linearGradient id="ev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={NEON} stopOpacity="0.35" /><stop offset="100%" stopColor={NEON} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#ev)" />
      <path d={d} fill="none" stroke={INK} strokeWidth="2" />
      {pts.map((p, i) => <circle key={i} cx={nx(p.x)} cy={ny(p.y)} r="3" fill={CARD} stroke={INK} strokeWidth="1.5" />)}
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

  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: `1px solid ${LINE}`, background: CARD, color: INK, fontFamily: mono, fontSize: 13, outline: 'none', borderRadius: 6 }
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: MUT, display: 'block', marginBottom: 4 }
  const sec: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: INK, margin: '18px 0 8px', borderBottom: `1px solid ${LINE}`, paddingBottom: 5 }
  const dashBtn: React.CSSProperties = { border: `1px dashed ${LINE}`, background: 'transparent', color: MUT, cursor: 'pointer', fontFamily: mono, fontSize: 12, padding: '6px 12px', borderRadius: 6 }
  const xBtn: React.CSSProperties = { border: `1px solid ${LINE}`, background: CARD, color: MUT, width: 34, cursor: 'pointer', borderRadius: 6 }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, color: INK, width: '100%', maxWidth: 580, marginTop: 20, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ background: BG, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${LINE}` }}>
          <span style={{ fontFamily: disp, fontSize: 15, fontWeight: 700, color: INK }}>Registrar sessão</span>
          <button onClick={onClose} style={{ background: 'transparent', color: MUT, border: `1px solid ${LINE}`, borderRadius: 6, width: 26, height: 26, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 18 }}>
          <div><label style={lbl}>Data da sessão</label><input type="date" value={f.sessionDate} onChange={e => set('sessionDate', e.target.value)} style={inp} /></div>
          <div style={sec}>Métricas de marketing / vendas da sessão</div>
          <div style={{ fontSize: 12, color: MUT, marginBottom: 8 }}>Faturamento, clientes ativos e estoque agora ficam na tabela “Faturamento mês a mês” da ficha do cliente.</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['ticketMedio', 'Ticket médio (R$)'], ['numVendas', 'Nº de vendas'], ['investimentoTrafego', 'Invest. tráfego (R$)'], ['roas', 'ROAS (x)'], ['seguidoresIg', 'Seguidores IG']].map(([k, l]) => (
              <div key={k}><label style={lbl}>{l}</label><input value={f[k] ?? ''} onChange={e => set(k, e.target.value)} style={inp} /></div>
            ))}
          </div>
          <div style={sec}>Vendas por canal</div>
          {channels.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={c.canal} onChange={e => setChannels(ch => ch.map((x, j) => j === i ? { ...x, canal: e.target.value } : x))} placeholder="Canal (IG, TikTok...)" style={{ ...inp, flex: 1 }} />
              <input value={c.valor || ''} onChange={e => setChannels(ch => ch.map((x, j) => j === i ? { ...x, valor: Number(e.target.value) } : x))} placeholder="R$" style={{ ...inp, width: 100 }} />
              <button onClick={() => setChannels(ch => ch.filter((_, j) => j !== i))} style={xBtn}>✕</button>
            </div>
          ))}
          <button onClick={() => setChannels(ch => [...ch, { canal: '', valor: 0 }])} style={dashBtn}>+ canal</button>
          <div style={sec}>Campos extras</div>
          {customs.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={c.label} onChange={e => setCustoms(cs => cs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Campo" style={{ ...inp, flex: 1 }} />
              <input value={c.value} onChange={e => setCustoms(cs => cs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="Valor" style={{ ...inp, flex: 1 }} />
              <button onClick={() => setCustoms(cs => cs.filter((_, j) => j !== i))} style={xBtn}>✕</button>
            </div>
          ))}
          <button onClick={() => setCustoms(cs => [...cs, { label: '', value: '' }])} style={dashBtn}>+ campo</button>

          <div style={sec}>Materiais / anexos da reunião</div>
          {materiais.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
              {m.url?.startsWith('data:') ? (
                <span style={{ flex: 1, fontSize: 12, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {m.label}</span>
              ) : (
                <>
                  <input value={m.label} onChange={e => setMateriais(ms => ms.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Nome" style={{ ...inp, flex: 1 }} />
                  <input value={m.url ?? ''} onChange={e => setMateriais(ms => ms.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://..." style={{ ...inp, flex: 1 }} />
                </>
              )}
              <button onClick={() => setMateriais(ms => ms.filter((_, j) => j !== i))} style={xBtn}>✕</button>
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
          <div style={{ marginTop: 8 }}><label style={lbl}>O que foi passado ao cliente</label><textarea value={f.oQueTrabalhou ?? ''} onChange={e => set('oQueTrabalhou', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
          <div style={{ marginTop: 8 }}><label style={lbl}>Próximos passos</label><textarea value={f.proximosPassos ?? ''} onChange={e => set('proximosPassos', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
          <div style={{ marginTop: 8 }}><label style={lbl}>Transcrição da reunião</label><textarea value={f.transcricao ?? ''} onChange={e => set('transcricao', e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} placeholder="Cole a transcrição aqui..." /></div>
          <div style={sec}>Tarefas (o que ficou / pra quem)</div>
          {tasks.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={t.what} onChange={e => setTasks(ts => ts.map((x, j) => j === i ? { ...x, what: e.target.value } : x))} placeholder="O que" style={{ ...inp, flex: 2 }} />
              <input value={t.who} onChange={e => setTasks(ts => ts.map((x, j) => j === i ? { ...x, who: e.target.value } : x))} placeholder="Quem" style={{ ...inp, flex: 1 }} />
              <button onClick={() => setTasks(ts => ts.filter((_, j) => j !== i))} style={xBtn}>✕</button>
            </div>
          ))}
          <button onClick={() => setTasks(ts => [...ts, { what: '', who: '' }])} style={dashBtn}>+ tarefa</button>
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button onClick={onClose} style={{ flex: 1, border: `1px solid ${LINE}`, background: CARD, color: INK, padding: 11, fontFamily: mono, fontSize: 13, fontWeight: 700, cursor: 'pointer', borderRadius: 6 }}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{ flex: 1, border: 'none', background: NEON, color: INK, padding: 11, fontFamily: mono, fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', borderRadius: 6 }}>{saving ? 'Salvando...' : 'Registrar sessão'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
