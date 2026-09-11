'use client'

import React, { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'

// ── Tipos (só o que o dashboard usa) ──────────────────────────────────────────
interface Overdue { id: string; companyName: string; value: number }
interface CashflowMonth {
  month: number
  entradas: { received: number; pending: number; overdue: number; total: number; overdueClients?: Overdue[] }
  layers: { impostos: number; custoOperacao: number; distribuicao: number; pessoalGiu: number }
}
interface CashflowTotals {
  entradas: number; entradasReceived: number
  impostos: number; custoOperacao: number; distribuicao: number; pessoalGiu: number
}
interface CashflowData { year: number; months: CashflowMonth[]; totals: CashflowTotals }

interface Stats {
  kpis: { totalActiveClients: number; newClientsThisMonth: number; totalRevenue: number }
  financialKpis: { totalReceivedMonth: number; toReceiveMonth: number; totalPending: number; totalOverdue: number; overdueCount: number }
  negotiation?: { total: number; count: number; leads: Array<{ id: string; companyName: string; stage: string; value: number }> }
  pendencies: { total: number; contractUnsigned: number; paymentOverdue: number; renewalPending: number }
  renewals: { count: number; clients: Array<{ id: string; companyName: string; daysLeft: number }> }
  pipelineSummary: Array<{ stage: string; count: number }>
}
interface MonthSales { month: number; total: number; count: number }
interface SalesData { totalYear: number; countYear: number; months: MonthSales[] }
interface Goal { month: number; targetValue: number; targetCount: number }
interface GoalsData { months: Goal[]; totalValue: number; totalCount: number }
interface Buckets { ativos: number; recorrentes: number; base: number; leads: number }

const fmtBRL = (n?: number | null) => n != null ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'R$ 0'
const fmtK = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace('.', ',')}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`
const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc', neon: '#C7F900', green: '#16a34a', greenDk: '#15803d', red: '#dc2626', amber: '#f59e0b', slate: '#475569', blue: '#4A78FF', purple: '#7c3aed' }
const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
const gaugeColor = (pct: number) => pct >= 1 ? C.green : pct >= 0.6 ? C.amber : C.red

const STAGE_LABEL: Record<string, string> = { NOVO: 'Novo', FUP: 'Em contato', REUNIAO_AGENDADA: 'Agendado', EM_NEGOCIACAO: 'Em negociação', REPESCAGEM: 'Repescagem', PERDIDO: 'Perdido', FECHADO: 'Ganho' }
const STAGE_COLOR: Record<string, string> = { NOVO: '#94a3b8', FUP: '#4A78FF', REUNIAO_AGENDADA: '#7c3aed', EM_NEGOCIACAO: '#f59e0b', REPESCAGEM: '#06b6d4', PERDIDO: '#dc2626', FECHADO: '#16a34a' }
const PIPE_ORDER = ['NOVO', 'FUP', 'REUNIAO_AGENDADA', 'EM_NEGOCIACAO', 'REPESCAGEM', 'FECHADO']

// ── Velocímetro ───────────────────────────────────────────────────────────────
function Gauge({ value, target, label, sub }: { value: number; target: number; label: string; sub?: string }) {
  const pct = target > 0 ? value / target : 0
  const clamped = Math.max(0, Math.min(pct, 1))
  const color = gaugeColor(pct)
  const rad = ((180 - clamped * 180) * Math.PI) / 180
  const nx = 100 + 66 * Math.cos(rad), ny = 100 - 66 * Math.sin(rad)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.mid, marginBottom: 2 }}>{label}</div>
      <svg viewBox="0 0 200 116" style={{ width: '100%', maxWidth: 230 }}>
        <path d="M 12 100 A 88 88 0 0 1 188 100" fill="none" stroke="#eef2f6" strokeWidth="15" strokeLinecap="round" />
        <path d="M 12 100 A 88 88 0 0 1 188 100" fill="none" stroke={color} strokeWidth="15" strokeLinecap="round" pathLength={100} strokeDasharray="100" strokeDashoffset={100 - clamped * 100} style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s' }} />
        <line x1="100" y1="100" x2={nx} y2={ny} stroke={C.ink} strokeWidth="3" strokeLinecap="round" style={{ transition: 'all 0.6s ease' }} />
        <circle cx="100" cy="100" r="6" fill={C.ink} />
        <text x="100" y="74" textAnchor="middle" style={{ fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 800, fill: color }}>{target > 0 ? `${Math.round(pct * 100)}%` : '—'}</text>
      </svg>
      <div style={{ ...num, fontSize: 15, fontWeight: 800, color: C.ink, marginTop: -6 }}>{fmtBRL(value)}</div>
      <div style={{ ...num, fontSize: 11.5, color: C.dim }}>{sub ?? (target > 0 ? `meta ${fmtBRL(target)}` : 'meta não definida')}</div>
    </div>
  )
}

function SectionHeader({ title, href, action }: { title: string; href?: string; action?: string }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>{title}</span>
      {href && <a href={href} style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: C.mid, textDecoration: 'none' }}>{action ?? 'ver tudo'} ›</a>}
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [cf, setCf] = useState<CashflowData | null>(null)
  const [sales, setSales] = useState<SalesData | null>(null)
  const [goals, setGoals] = useState<GoalsData | null>(null)
  const [buckets, setBuckets] = useState<Buckets | null>(null)
  const [loading, setLoading] = useState(true)

  const year = new Date().getFullYear()
  const curMonth = new Date().getMonth() + 1

  useEffect(() => {
    apiFetch('/api/payments/check-overdue', { method: 'POST' }).catch(() => {})
    Promise.all([
      apiFetch<Stats>('/api/dashboard').catch(() => null),
      apiFetch<CashflowData>(`/api/cashflow?year=${year}`).catch(() => null),
      apiFetch<SalesData>(`/api/crm/sales-by-month?year=${year}`).catch(() => null),
      apiFetch<GoalsData>(`/api/crm/goals?year=${year}&product=GERAL`).catch(() => null),
      apiFetch<Buckets>('/api/clients/buckets/counts').catch(() => null),
    ]).then(([s, c, sa, g, b]) => {
      setStats(s); setCf(c); setSales(sa); setGoals(g); setBuckets(b); setLoading(false)
    })
  }, [year])

  if (loading) return <div style={{ padding: 24, color: C.mid }}>Carregando visão geral…</div>

  // ── Derivados ──
  const mesSold = sales?.months.find(m => m.month === curMonth)?.total ?? 0
  const mesMeta = goals?.months.find(m => m.month === curMonth)?.targetValue ?? 0
  const anoSold = sales?.totalYear ?? 0
  const anoMeta = goals?.totalValue ?? 0
  const ativos = buckets?.ativos ?? stats?.kpis.totalActiveClients ?? 0

  // Fluxo (camadas do ano)
  const t = cf?.totals
  const receita = t?.entradas ?? 0
  const lucro = receita - (t?.impostos ?? 0) - (t?.custoOperacao ?? 0)
  const resultado = lucro - (t?.distribuicao ?? 0)

  // Inadimplência (fora carteira — vem do fluxo já corrigido)
  const overdueMonths = cf?.months ?? []
  const overdueTotal = overdueMonths.reduce((s, m) => s + m.entradas.overdue, 0)
  const overdueMap = new Map<string, { name: string; value: number }>()
  for (const m of overdueMonths) for (const o of (m.entradas.overdueClients ?? [])) {
    const cur = overdueMap.get(o.id) ?? { name: o.companyName, value: 0 }
    cur.value += o.value; overdueMap.set(o.id, cur)
  }
  const overdueList = [...overdueMap.values()].sort((a, b) => b.value - a.value).slice(0, 6)
  const overdueCount = overdueMap.size

  // CRM funil
  const pipeMap = new Map((stats?.pipelineSummary ?? []).map(p => [p.stage, p.count]))
  const pipeMax = Math.max(...PIPE_ORDER.map(s => pipeMap.get(s) ?? 0), 1)

  // Faturamento do mês (recebido) + a receber
  const cfMes = cf?.months.find(m => m.month === curMonth)
  const receitaMes = cfMes?.entradas.total ?? stats?.financialKpis.totalReceivedMonth ?? 0
  const aReceberMes = cfMes ? cfMes.entradas.pending : stats?.financialKpis.toReceiveMonth ?? 0

  const kpis = [
    { label: 'Clientes ativos', value: String(ativos), sub: 'contrato no prazo', accent: C.neon, href: '/clients' },
    { label: `Vendas · ${MONTH_ABBR[curMonth - 1]}`, value: fmtBRL(mesSold), sub: mesMeta > 0 ? `${Math.round(mesSold / mesMeta * 100)}% da meta` : 'sem meta', accent: C.ink, href: '/sales' },
    { label: 'A receber no mês', value: fmtBRL(aReceberMes), sub: 'parcelas pendentes', accent: C.amber, href: '/payments' },
    { label: 'Inadimplência', value: fmtBRL(overdueTotal), sub: `${overdueCount} cliente${overdueCount !== 1 ? 's' : ''} vencido${overdueCount !== 1 ? 's' : ''}`, accent: C.red, href: '/pendencies' },
  ]

  const waterfall = [
    { l: 'Faturamento', v: receita, kind: 'base' as const },
    { l: 'Impostos', v: -(t?.impostos ?? 0), kind: 'out' as const },
    { l: 'Custo da operação', v: -(t?.custoOperacao ?? 0), kind: 'out' as const },
    { l: 'Lucro da operação', v: lucro, kind: 'sub' as const },
    { l: 'Distribuição', v: -(t?.distribuicao ?? 0), kind: 'out' as const },
    { l: 'Resultado da empresa', v: resultado, kind: 'result' as const },
  ]

  const barMax = Math.max(...(cf?.months ?? []).map(m => m.entradas.total), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Visão geral</h1>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, margin: '2px 0 0' }}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} · {MONTH_FULL[curMonth - 1]} de {year}</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {kpis.map(k => (
          <a key={k.label} href={k.href} style={{ ...card, borderTop: `3px solid ${k.accent}`, padding: '16px 18px', textDecoration: 'none', display: 'block' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.mid, fontWeight: 600 }}>{k.label}</div>
            <div style={{ ...num, fontSize: 24, fontWeight: 700, color: k.accent === C.neon ? C.ink : k.accent, marginTop: 6 }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: C.dim, marginTop: 2 }}>{k.sub}</div>
          </a>
        ))}
      </div>

      {/* Velocímetro + Fluxo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Vendas */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <SectionHeader title="Vendas · meta" href="/sales" action="ajustar" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '18px 12px' }}>
            <Gauge label={`Mês · ${MONTH_ABBR[curMonth - 1]}`} value={mesSold} target={mesMeta} />
            <Gauge label={`Ano ${year}`} value={anoSold} target={anoMeta} />
          </div>
          <div style={{ padding: '0 20px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.mid }}>
            <span>{sales?.months.find(m => m.month === curMonth)?.count ?? 0} vendas no mês</span>
            <span>{sales?.countYear ?? 0} no ano</span>
          </div>
        </div>

        {/* Fluxo de caixa */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <SectionHeader title={`Fluxo de caixa · ${year}`} href="/payments" action="abrir" />
          <div style={{ padding: '6px 0' }}>
            {waterfall.map((r, i) => (
              <div key={r.l} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: r.kind === 'result' ? '12px 20px' : '8px 20px',
                background: r.kind === 'result' ? (resultado >= 0 ? 'rgba(199,249,0,0.10)' : 'rgba(220,38,38,0.05)') : 'transparent',
                borderTop: (r.kind === 'sub' || r.kind === 'result') && i > 0 ? `1px solid ${C.line}` : 'none',
              }}>
                <span style={{ fontSize: 13, fontWeight: r.kind === 'sub' || r.kind === 'result' || r.kind === 'base' ? 700 : 500, color: r.kind === 'out' ? C.mid : C.ink }}>{r.l}</span>
                <span style={{ ...num, fontSize: r.kind === 'result' ? 18 : 14, fontWeight: r.kind === 'sub' || r.kind === 'result' || r.kind === 'base' ? 800 : 600, color: r.kind === 'result' ? (r.v >= 0 ? C.greenDk : C.red) : r.kind === 'out' ? C.red : C.ink }}>{r.v < 0 ? '−' : ''}{fmtBRL(Math.abs(r.v))}</span>
              </div>
            ))}
          </div>
          {/* mini barras entradas por mês */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 44, padding: '0 20px 14px' }}>
            {(cf?.months ?? []).map(m => {
              const h = (m.entradas.total / barMax) * 38
              const isCur = m.month === curMonth
              return <div key={m.month} title={`${MONTH_ABBR[m.month - 1]} · ${fmtBRL(m.entradas.total)}`} style={{ flex: 1, height: Math.max(h, 2), background: isCur ? C.neon : '#dbe4ea', borderRadius: '2px 2px 0 0' }} />
            })}
          </div>
        </div>
      </div>

      {/* Inadimplentes + CRM */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        {/* Inadimplentes */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <SectionHeader title="Inadimplentes" href="/pendencies" action="ver pendências" />
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'baseline', gap: 10, borderBottom: `1px solid ${C.line}` }}>
            <span style={{ ...num, fontSize: 26, fontWeight: 800, color: C.red }}>{fmtBRL(overdueTotal)}</span>
            <span style={{ fontSize: 12.5, color: C.mid }}>{overdueCount} cliente{overdueCount !== 1 ? 's' : ''} · fora carteira</span>
          </div>
          {overdueList.length === 0 && <div style={{ padding: '18px 20px', color: C.dim, fontSize: 13 }}>Nenhum inadimplente. 🎉</div>}
          {overdueList.map((o, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px', borderTop: i > 0 ? `1px solid ${C.bg}` : 'none' }}>
              <span style={{ fontSize: 13, color: C.ink }}>{o.name}</span>
              <span style={{ ...num, fontSize: 13, fontWeight: 700, color: C.red }}>{fmtBRL(o.value)}</span>
            </div>
          ))}
        </div>

        {/* CRM funil */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <SectionHeader title="CRM · funil" href="/crm" action="abrir" />
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 9 }}>
            {PIPE_ORDER.map(stage => {
              const n = pipeMap.get(stage) ?? 0
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 108, fontSize: 12.5, color: C.slate, fontWeight: 600 }}>{STAGE_LABEL[stage] ?? stage}</span>
                  <div style={{ flex: 1, background: C.bg, height: 18, borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${(n / pipeMax) * 100}%`, height: '100%', background: STAGE_COLOR[stage], borderRadius: 5, transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ ...num, width: 30, textAlign: 'right', fontSize: 13, fontWeight: 700, color: C.ink }}>{n}</span>
                </div>
              )
            })}
          </div>
          {stats?.negotiation && stats.negotiation.count > 0 && (
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb' }}>
              <span style={{ fontSize: 12.5, color: '#92400e', fontWeight: 600 }}>Em negociação · {stats.negotiation.count}</span>
              <span style={{ ...num, fontSize: 14, fontWeight: 800, color: '#92400e' }}>{fmtBRL(stats.negotiation.total)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Renovações (se houver) */}
      {stats?.renewals && stats.renewals.count > 0 && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <SectionHeader title={`Renovações próximas · ${stats.renewals.count}`} href="/pendencies" action="ver" />
          <div style={{ display: 'flex', gap: 10, padding: '14px 20px', flexWrap: 'wrap' }}>
            {stats.renewals.clients.slice(0, 8).map(c => (
              <a key={c.id} href={`/clients/${c.id}`} style={{ ...num, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 14px', border: `1px solid ${C.line}`, borderRadius: 8, background: c.daysLeft < 0 ? '#fef2f2' : c.daysLeft <= 15 ? '#fffbeb' : '#fff' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 700, color: C.ink }}>{c.companyName}</span>
                <span style={{ fontSize: 11, color: c.daysLeft < 0 ? C.red : c.daysLeft <= 15 ? C.amber : C.mid }}>{c.daysLeft < 0 ? `vencido há ${Math.abs(c.daysLeft)}d` : `${c.daysLeft}d restantes`}</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
