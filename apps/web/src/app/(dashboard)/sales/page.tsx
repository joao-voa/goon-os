'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { canSeeSales, PRODUCT_COLORS } from '@/lib/constants'
import { toast } from 'sonner'

interface Deal { companyName: string; value: number; date: string; salesRep: string | null; product: string | null; productCode: string }
interface MonthSales { month: number; label: string; count: number; total: number; deals: Deal[] }
interface ProgramTotal { code: string; count: number; total: number }
interface SalesData { year: number; totalYear: number; countYear: number; months: MonthSales[]; byProgram: ProgramTotal[] }
interface Goal { month: number; targetValue: number; targetCount: number }
interface GoalsData { year: number; product: string; months: Goal[]; totalValue: number; totalCount: number }
interface OvProgram { product: string; metaValue: number; metaCount: number; soldValue: number; soldCount: number }
interface OvMonth { month: number; metaValue: number; metaCount: number; soldValue: number; soldCount: number; byProgram: OvProgram[] }
interface OverviewData { year: number; months: OvMonth[]; yearTotal: { metaValue: number; metaCount: number; soldValue: number; soldCount: number } }

const META_PRODUCTS = [
  { v: '', l: 'Geral (todos)' }, { v: 'GE', l: 'GE' }, { v: 'GI', l: 'GI' },
  { v: 'TTS', l: 'TTS' }, { v: 'TTSG', l: 'TTS Grupo' }, { v: 'GA', l: 'GA' }, { v: 'GS', l: 'GS' }, { v: 'AURA', l: 'AURA' },
]

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc', neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#f59e0b' }
const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }
const gaugeColor = (pct: number) => pct >= 1 ? C.green : pct >= 0.6 ? C.amber : C.red

// ---- Velocímetro (SVG semicírculo com ponteiro) ----
function Gauge({ value, target, label, kind }: { value: number; target: number; label: string; kind: 'money' | 'count' }) {
  const pct = target > 0 ? value / target : 0
  const clamped = Math.max(0, Math.min(pct, 1))
  const color = gaugeColor(pct)
  const rad = ((180 - clamped * 180) * Math.PI) / 180
  const nx = 100 + 66 * Math.cos(rad)
  const ny = 100 - 66 * Math.sin(rad)
  const fmtV = (n: number) => kind === 'money' ? fmtBRL(n) : String(Math.round(n))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.mid, marginBottom: 4 }}>{label}</div>
      <svg viewBox="0 0 200 118" style={{ width: '100%', maxWidth: 260 }}>
        <path d="M 12 100 A 88 88 0 0 1 188 100" fill="none" stroke="#eef2f6" strokeWidth="15" strokeLinecap="round" />
        <path d="M 12 100 A 88 88 0 0 1 188 100" fill="none" stroke={color} strokeWidth="15" strokeLinecap="round" pathLength={100} strokeDasharray="100" strokeDashoffset={100 - clamped * 100} style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s' }} />
        <line x1="100" y1="100" x2={nx} y2={ny} stroke={C.ink} strokeWidth="3" strokeLinecap="round" style={{ transition: 'all 0.6s ease' }} />
        <circle cx="100" cy="100" r="6" fill={C.ink} />
        <text x="100" y="72" textAnchor="middle" style={{ fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 800, fill: color }}>{target > 0 ? `${Math.round(pct * 100)}%` : '—'}</text>
      </svg>
      <div style={{ ...num, fontSize: 15, fontWeight: 800, color: C.ink, marginTop: -4 }}>{fmtV(value)}</div>
      <div style={{ ...num, fontSize: 12, color: C.dim }}>de {target > 0 ? fmtV(target) : 'meta não definida'}</div>
    </div>
  )
}

export default function SalesPage() {
  const { user, loading: authLoading } = useAuth()
  const isOwner = canSeeSales(user?.email)
  const [tab, setTab] = useState<'vendas' | 'meta'>('vendas')
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<SalesData | null>(null)
  const [goals, setGoals] = useState<GoalsData | null>(null)
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [openMonths, setOpenMonths] = useState<Record<number, boolean>>({})
  const [expanded, setExpanded] = useState<number | null>(null)
  const [productFilter, setProductFilter] = useState('')
  const [edits, setEdits] = useState<Record<number, { v: string; c: string }>>({})
  const [ovEdits, setOvEdits] = useState<Record<string, { v: string; c: string }>>({})
  const [ovDirty, setOvDirty] = useState<Set<string>>(new Set())
  const [allV, setAllV] = useState('')
  const [allC, setAllC] = useState('')
  const [saving, setSaving] = useState(false)

  const loadGoals = useCallback(() => {
    apiFetch<GoalsData>(`/api/crm/goals?year=${year}&product=${productFilter || 'GERAL'}`).then(setGoals).catch(() => {})
  }, [year, productFilter])
  const loadOverview = useCallback(() => {
    apiFetch<OverviewData>(`/api/crm/goals-overview?year=${year}`).then(setOverview).catch(() => {})
  }, [year])

  useEffect(() => {
    if (!isOwner) return
    const qs = `year=${year}${productFilter ? `&product=${productFilter}` : ''}`
    apiFetch<SalesData>(`/api/crm/sales-by-month?${qs}`).then(setData).catch(() => {})
    loadGoals()
    loadOverview()
  }, [isOwner, year, productFilter, loadGoals, loadOverview])

  useEffect(() => {
    if (!goals) return
    const e: Record<number, { v: string; c: string }> = {}
    for (const g of goals.months) e[g.month] = { v: g.targetValue ? String(g.targetValue) : '', c: g.targetCount ? String(g.targetCount) : '' }
    setEdits(e)
  }, [goals])

  // Edição no drill-down do Geral: chave `${mês}-${programa}`
  useEffect(() => {
    if (!overview) return
    const e: Record<string, { v: string; c: string }> = {}
    for (const m of overview.months) for (const pg of m.byProgram) e[`${m.month}-${pg.product}`] = { v: pg.metaValue ? String(pg.metaValue) : '', c: pg.metaCount ? String(pg.metaCount) : '' }
    setOvEdits(e); setOvDirty(new Set())
  }, [overview])

  const setOv = (mo: number, prod: string, field: 'v' | 'c', val: string) => {
    const k = `${mo}-${prod}`
    setOvEdits(p => ({ ...p, [k]: { ...(p[k] ?? { v: '', c: '' }), [field]: val } }))
    setOvDirty(p => new Set(p).add(k))
  }

  async function saveOverview() {
    setSaving(true)
    try {
      await Promise.all([...ovDirty].map(k => {
        const idx = k.indexOf('-')
        const mo = parseInt(k.slice(0, idx)); const product = k.slice(idx + 1)
        const e = ovEdits[k] ?? { v: '', c: '' }
        return apiFetch('/api/crm/goals', { method: 'PUT', body: JSON.stringify({ year, month: mo, product, targetValue: parseFloat(e.v) || 0, targetCount: parseInt(e.c) || 0 }) })
      }))
      toast.success('Metas salvas')
      loadOverview(); loadGoals()
    } catch { toast.error('Erro ao salvar metas') } finally { setSaving(false) }
  }

  async function saveAll() {
    setSaving(true)
    try {
      await Promise.all(Object.entries(edits).map(([m, e]) =>
        apiFetch('/api/crm/goals', { method: 'PUT', body: JSON.stringify({ year, month: parseInt(m), product: productFilter || 'GERAL', targetValue: parseFloat(e.v) || 0, targetCount: parseInt(e.c) || 0 }) })))
      toast.success('Metas salvas')
      loadGoals(); loadOverview()
    } catch { toast.error('Erro ao salvar metas') } finally { setSaving(false) }
  }

  function fillAll() {
    const e: Record<number, { v: string; c: string }> = {}
    for (let m = 1; m <= 12; m++) e[m] = { v: allV, c: allC }
    setEdits(e)
  }

  if (authLoading) return null
  if (!isOwner) {
    return <div style={{ padding: 40, fontFamily: 'var(--font-sans)', fontSize: 14, color: C.mid }}>🔒 Acesso restrito. Esta página é exclusiva do dono do sistema.</div>
  }

  const maxTotal = data ? Math.max(...data.months.map(m => m.total), 1) : 1
  const activeMonths = data ? data.months.filter(m => m.count > 0) : []
  const avgTicket = data && data.countYear > 0 ? data.totalYear / data.countYear : 0
  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
  const curMonth = new Date().getMonth() + 1
  const nowYear = new Date().getFullYear()
  // Helpers do drill-down editável (Geral)
  const PROGRAMS = META_PRODUCTS.filter(p => p.v)
  const ovMetaV = (mo: number, prod: string) => parseFloat(ovEdits[`${mo}-${prod}`]?.v || '') || 0
  const ovMetaC = (mo: number, prod: string) => parseInt(ovEdits[`${mo}-${prod}`]?.c || '') || 0
  const monthMetaV = (mo: number) => PROGRAMS.reduce((s, p) => s + ovMetaV(mo, p.v), 0)
  const monthMetaC = (mo: number) => PROGRAMS.reduce((s, p) => s + ovMetaC(mo, p.v), 0)
  const yearMetaV = Array.from({ length: 12 }, (_, i) => i + 1).reduce((s, mo) => s + monthMetaV(mo), 0)
  const yearMetaC = Array.from({ length: 12 }, (_, i) => i + 1).reduce((s, mo) => s + monthMetaC(mo), 0)
  const soldOf = (mo: number, prod: string) => overview?.months.find(x => x.month === mo)?.byProgram.find(p => p.product === prod)

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Vendas</h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, margin: '2px 0 0' }}>Vendas e renovações por mês · valor do contrato · cancelados fora</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${C.line}`, borderRadius: 100, padding: 4 }}>
          <button onClick={() => setYear(y => y - 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.mid, padding: '2px 8px', fontSize: 14 }}>‹</button>
          <span style={{ ...num, fontWeight: 700, minWidth: 42, textAlign: 'center', fontSize: 14 }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.mid, padding: '2px 8px', fontSize: 14 }}>›</button>
        </div>
      </div>

      {/* Sub-abas */}
      <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${C.line}` }}>
        {(['vendas', 'meta'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '9px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: tab === t ? 700 : 500,
            color: tab === t ? C.ink : C.dim, borderBottom: tab === t ? `2px solid ${C.neon}` : '2px solid transparent', marginBottom: -1,
          }}>{t === 'vendas' ? 'Vendas' : 'Meta'}</button>
        ))}
      </div>

      {/* ===================== ABA VENDAS ===================== */}
      {tab === 'vendas' && <>
        {/* Velocímetros (visão — edição na aba Meta) */}
        {(() => {
          const mS = data?.months.find(x => x.month === curMonth)
          const mG = goals?.months.find(x => x.month === curMonth)
          return (
            <div style={{ ...card, padding: '20px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Meta{productFilter ? ` · ${productFilter}` : ''} · quão perto estamos</span>
                <button onClick={() => setTab('meta')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: C.mid }}>ajustar metas ›</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {year === nowYear && <Gauge label={`${MONTH_FULL[curMonth - 1]} · R$`} value={mS?.total ?? 0} target={mG?.targetValue ?? 0} kind="money" />}
                {year === nowYear && <Gauge label={`${MONTH_FULL[curMonth - 1]} · Vendas`} value={mS?.count ?? 0} target={mG?.targetCount ?? 0} kind="count" />}
                <Gauge label={`Ano ${year} · R$`} value={data?.totalYear ?? 0} target={goals?.totalValue ?? 0} kind="money" />
                <Gauge label={`Ano ${year} · Vendas`} value={data?.countYear ?? 0} target={goals?.totalCount ?? 0} kind="count" />
              </div>
            </div>
          )
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { label: productFilter ? `Total ${productFilter}` : 'Total no Ano', value: fmtBRL(data?.totalYear ?? 0), accent: C.ink },
            { label: 'Contratos', value: String(data?.countYear ?? 0), accent: '#4A78FF' },
            { label: 'Ticket Médio', value: fmtBRL(avgTicket), accent: C.green },
            { label: 'Meses com Venda', value: String(activeMonths.length), accent: '#7c3aed' },
          ].map(k => (
            <div key={k.label} style={{ ...card, borderTop: `3px solid ${k.accent}`, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.mid }}>{k.label}</div>
              <div style={{ ...num, fontSize: 22, fontWeight: 700, color: k.accent, marginTop: 4 }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Por programa · {year}</span>
            {productFilter && <button onClick={() => setProductFilter('')} style={{ background: '#f1f5f9', color: C.ink, border: 'none', borderRadius: 6, cursor: 'pointer', padding: '5px 12px', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600 }}>✕ limpar filtro</button>}
          </div>
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {(data?.byProgram ?? []).length === 0 && <div style={{ fontSize: 12, color: C.dim, padding: 8 }}>Sem vendas em {year}.</div>}
            {(data?.byProgram ?? []).map(pg => {
              const on = productFilter === pg.code
              const color = PRODUCT_COLORS[pg.code] ?? C.dim
              return (
                <button key={pg.code} onClick={() => setProductFilter(on ? '' : pg.code)} style={{ textAlign: 'left', cursor: 'pointer', padding: '12px 14px', background: on ? C.ink : '#fff', border: `1px solid ${on ? C.ink : C.line}`, borderLeft: `4px solid ${color}`, borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 800, color: on ? '#fff' : C.ink }}>{pg.code}</span>
                    <span style={{ ...num, fontSize: 11, color: on ? '#94a3b8' : C.dim }}>{pg.count}x</span>
                  </div>
                  <div style={{ ...num, fontSize: 16, fontWeight: 700, color: on ? '#fff' : color, marginTop: 2 }}>{fmtBRL(pg.total)}</div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Evolução mensal{productFilter ? ` · ${productFilter}` : ''}</div>
          <div style={{ padding: 12 }}>
            {activeMonths.length === 0 && <div style={{ fontSize: 12, color: C.dim, textAlign: 'center', padding: 24 }}>Nenhuma venda{productFilter ? ` de ${productFilter}` : ''} em {year}.</div>}
            {data?.months.map(m => m.count > 0 && (
              <div key={m.month} style={{ borderBottom: `1px solid ${C.line}` }}>
                <div onClick={() => setExpanded(expanded === m.month ? null : m.month)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 4px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12.5 }}>
                  <span style={{ width: 70, fontWeight: 700 }}>{expanded === m.month ? '▾' : '▸'} {m.label}</span>
                  <div style={{ flex: 1, background: '#f1f5f9', height: 20, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ width: `${(m.total / maxTotal) * 100}%`, background: C.ink, height: '100%', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ width: 44, textAlign: 'center', color: C.dim, fontSize: 11 }}>{m.count}x</span>
                  <span style={{ ...num, width: 120, textAlign: 'right', fontWeight: 700 }}>{fmtBRL(m.total)}</span>
                </div>
                {expanded === m.month && (
                  <div style={{ padding: '4px 4px 12px 80px' }}>
                    {m.deals.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: 'var(--font-sans)', fontSize: 12, color: C.mid, borderBottom: '1px solid #f5f5f5' }}>
                        <span>{new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })} · <strong style={{ color: C.ink }}>{d.companyName}</strong>{d.product ? ` · ${d.product}` : ''}{d.salesRep ? ` · ${d.salesRep}` : ''}</span>
                        <span style={{ ...num, fontWeight: 700, color: C.ink }}>{fmtBRL(d.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </>}

      {/* ===================== ABA META ===================== */}
      {tab === 'meta' && <>
        {/* Seletor de produto */}
        <div style={{ ...card, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Meta de <span style={{ color: productFilter ? (PRODUCT_COLORS[productFilter] ?? C.ink) : C.ink }}>{productFilter ? (META_PRODUCTS.find(p => p.v === productFilter)?.l ?? productFilter) : 'toda a operação'}</span></span>
          <select value={productFilter} onChange={e => setProductFilter(e.target.value)} style={{ padding: '8px 12px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
            {META_PRODUCTS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
        </div>

        {productFilter === '' ? (
          /* ===== GERAL — consolidado com drill-down por mês ===== */
          <>
            <div style={{ ...card, padding: '20px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              <Gauge label={`Ano ${year} · R$`} value={overview?.yearTotal.soldValue ?? 0} target={yearMetaV} kind="money" />
              <Gauge label={`Ano ${year} · Vendas`} value={overview?.yearTotal.soldCount ?? 0} target={yearMetaC} kind="count" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: C.mid }}>Clique num mês e preencha a meta de cada programa. O total do mês é a soma dos programas.</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { const anyOpen = Object.values(openMonths).some(Boolean); if (anyOpen) setOpenMonths({}); else { const o: Record<number, boolean> = {}; for (let m = 1; m <= 12; m++) o[m] = true; setOpenMonths(o) } }} style={{ background: '#fff', color: C.ink, border: `1px solid ${C.line}`, borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600 }}>{Object.values(openMonths).some(Boolean) ? 'Recolher tudo' : 'Expandir tudo'}</button>
                <button onClick={saveOverview} disabled={saving || ovDirty.size === 0} style={{ background: ovDirty.size ? C.neon : '#e2e8f0', color: C.ink, border: 'none', borderRadius: 6, padding: '7px 16px', cursor: ovDirty.size ? 'pointer' : 'default', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700 }}>{saving ? 'Salvando…' : `Salvar metas${ovDirty.size ? ` (${ovDirty.size})` : ''}`}</button>
              </div>
            </div>
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.bg, color: C.mid }}>
                      {['Mês', 'Meta R$', 'Vendido', '%', 'Meta vendas', 'Feitas', '%'].map((h, i) => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: i === 0 ? 'left' : 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, borderBottom: `1px solid ${C.line}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(mo => {
                      const ov = overview?.months.find(x => x.month === mo)
                      const mV = monthMetaV(mo), mC = monthMetaC(mo)
                      const soldV = ov?.soldValue ?? 0, soldC = ov?.soldCount ?? 0
                      const open = openMonths[mo]
                      const pctV = mV > 0 ? soldV / mV : 0
                      const pctC = mC > 0 ? soldC / mC : 0
                      const isCur = mo === curMonth && year === nowYear
                      return (
                        <Fragment key={mo}>
                          <tr onClick={() => setOpenMonths(p => ({ ...p, [mo]: !p[mo] }))} style={{ background: isCur ? 'rgba(199,249,0,0.07)' : 'transparent', borderBottom: `1px solid ${C.bg}`, cursor: 'pointer' }}>
                            <td style={{ padding: '9px 14px', fontWeight: isCur ? 800 : 700, color: C.ink }}>{open ? '▾' : '▸'} {MONTH_FULL[mo - 1]}</td>
                            <td style={{ ...num, padding: '9px 14px', textAlign: 'right', color: C.ink }}>{fmtBRL(mV)}</td>
                            <td style={{ ...num, padding: '9px 14px', textAlign: 'right', color: C.mid }}>{fmtBRL(soldV)}</td>
                            <td style={{ ...num, padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: mV > 0 ? gaugeColor(pctV) : C.dim }}>{mV > 0 ? `${Math.round(pctV * 100)}%` : '—'}</td>
                            <td style={{ ...num, padding: '9px 14px', textAlign: 'right', color: C.ink }}>{mC}</td>
                            <td style={{ ...num, padding: '9px 14px', textAlign: 'right', color: C.mid }}>{soldC}</td>
                            <td style={{ ...num, padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: mC > 0 ? gaugeColor(pctC) : C.dim }}>{mC > 0 ? `${Math.round(pctC * 100)}%` : '—'}</td>
                          </tr>
                          {open && PROGRAMS.map(prog => {
                            const sold = soldOf(mo, prog.v)
                            const sv = sold?.soldValue ?? 0, sc = sold?.soldCount ?? 0
                            const mv = ovMetaV(mo, prog.v), mc = ovMetaC(mo, prog.v)
                            const pv = mv > 0 ? sv / mv : 0, pc = mc > 0 ? sc / mc : 0
                            const color = PRODUCT_COLORS[prog.v] ?? C.dim
                            return (
                              <tr key={prog.v} style={{ background: '#fbfcfd', borderBottom: `1px solid ${C.bg}` }}>
                                <td style={{ padding: '5px 14px 5px 30px', fontSize: 12.5 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color, marginRight: 6 }} />{prog.l}</td>
                                <td style={{ padding: '4px 14px', textAlign: 'right' }}><input type="number" value={ovEdits[`${mo}-${prog.v}`]?.v ?? ''} onChange={e => setOv(mo, prog.v, 'v', e.target.value)} placeholder="0" style={{ width: 100, padding: '5px 8px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 12.5, textAlign: 'right' }} /></td>
                                <td style={{ ...num, padding: '4px 14px', textAlign: 'right', fontSize: 12.5, color: C.mid }}>{fmtBRL(sv)}</td>
                                <td style={{ ...num, padding: '4px 14px', textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: mv > 0 ? gaugeColor(pv) : C.dim }}>{mv > 0 ? `${Math.round(pv * 100)}%` : '—'}</td>
                                <td style={{ padding: '4px 14px', textAlign: 'right' }}><input type="number" value={ovEdits[`${mo}-${prog.v}`]?.c ?? ''} onChange={e => setOv(mo, prog.v, 'c', e.target.value)} placeholder="0" style={{ width: 60, padding: '5px 8px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 12.5, textAlign: 'right' }} /></td>
                                <td style={{ ...num, padding: '4px 14px', textAlign: 'right', fontSize: 12.5, color: C.mid }}>{sc}</td>
                                <td style={{ ...num, padding: '4px 14px', textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: mc > 0 ? gaugeColor(pc) : C.dim }}>{mc > 0 ? `${Math.round(pc * 100)}%` : '—'}</td>
                              </tr>
                            )
                          })}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: C.bg, fontWeight: 800 }}>
                      <td style={{ padding: '10px 14px', color: C.ink }}>Ano</td>
                      <td style={{ ...num, padding: '10px 14px', textAlign: 'right', color: C.ink }}>{fmtBRL(yearMetaV)}</td>
                      <td style={{ ...num, padding: '10px 14px', textAlign: 'right', color: C.mid }}>{fmtBRL(overview?.yearTotal.soldValue ?? 0)}</td>
                      <td style={{ ...num, padding: '10px 14px', textAlign: 'right', color: yearMetaV > 0 ? gaugeColor((overview?.yearTotal.soldValue ?? 0) / yearMetaV) : C.dim }}>{yearMetaV > 0 ? `${Math.round((overview?.yearTotal.soldValue ?? 0) / yearMetaV * 100)}%` : '—'}</td>
                      <td style={{ ...num, padding: '10px 14px', textAlign: 'right', color: C.ink }}>{yearMetaC}</td>
                      <td style={{ ...num, padding: '10px 14px', textAlign: 'right', color: C.mid }}>{overview?.yearTotal.soldCount ?? 0}</td>
                      <td style={{ ...num, padding: '10px 14px', textAlign: 'right', color: yearMetaC > 0 ? gaugeColor((overview?.yearTotal.soldCount ?? 0) / yearMetaC) : C.dim }}>{yearMetaC > 0 ? `${Math.round((overview?.yearTotal.soldCount ?? 0) / yearMetaC * 100)}%` : '—'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        ) : (
        <>
        {/* Velocímetros do ano */}
        <div style={{ ...card, padding: '20px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          <Gauge label={`Ano ${year} · ${productFilter} · R$`} value={data?.totalYear ?? 0} target={goals?.totalValue ?? 0} kind="money" />
          <Gauge label={`Ano ${year} · ${productFilter} · Vendas`} value={data?.countYear ?? 0} target={goals?.totalCount ?? 0} kind="count" />
        </div>

        {/* Aplicar a todos */}
        <div style={{ ...card, padding: '14px 20px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', background: C.bg }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>Aplicar a todos — Meta R$</label>
            <input type="number" value={allV} onChange={e => setAllV(e.target.value)} placeholder="0" style={{ width: 150, padding: '8px 12px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>Meta vendas</label>
            <input type="number" value={allC} onChange={e => setAllC(e.target.value)} placeholder="0" style={{ width: 120, padding: '8px 12px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 13 }} />
          </div>
          <button onClick={fillAll} style={{ background: '#fff', color: C.ink, border: `1px solid ${C.line}`, borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 }}>Preencher todos os meses</button>
          <div style={{ flex: 1 }} />
          <button onClick={saveAll} disabled={saving} style={{ background: C.neon, color: C.ink, border: 'none', borderRadius: 6, padding: '9px 20px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700 }}>{saving ? 'Salvando…' : 'Salvar metas'}</button>
        </div>

        {/* Tabela de todos os meses */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, color: C.mid }}>
                  {['Mês', 'Meta R$', 'Vendido', '%', 'Meta vendas', 'Feitas', '%'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: i === 0 ? 'left' : 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, borderBottom: `1px solid ${C.line}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(mo => {
                  const s = data?.months.find(x => x.month === mo)
                  const e = edits[mo] ?? { v: '', c: '' }
                  const metaV = parseFloat(e.v) || 0
                  const metaC = parseInt(e.c) || 0
                  const vend = s?.total ?? 0
                  const feitas = s?.count ?? 0
                  const pctV = metaV > 0 ? vend / metaV : 0
                  const pctC = metaC > 0 ? feitas / metaC : 0
                  const isCur = mo === curMonth && year === nowYear
                  return (
                    <tr key={mo} style={{ background: isCur ? 'rgba(199,249,0,0.07)' : 'transparent', borderBottom: `1px solid ${C.bg}` }}>
                      <td style={{ padding: '8px 14px', fontWeight: isCur ? 800 : 600, color: C.ink }}>{MONTH_FULL[mo - 1]}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right' }}>
                        <input type="number" value={e.v} onChange={ev => setEdits(p => ({ ...p, [mo]: { ...e, v: ev.target.value } }))} placeholder="0" style={{ width: 110, padding: '6px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 13, textAlign: 'right' }} />
                      </td>
                      <td style={{ ...num, padding: '8px 14px', textAlign: 'right', color: C.mid }}>{fmtBRL(vend)}</td>
                      <td style={{ ...num, padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: metaV > 0 ? gaugeColor(pctV) : C.dim }}>{metaV > 0 ? `${Math.round(pctV * 100)}%` : '—'}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'right' }}>
                        <input type="number" value={e.c} onChange={ev => setEdits(p => ({ ...p, [mo]: { ...e, c: ev.target.value } }))} placeholder="0" style={{ width: 70, padding: '6px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 13, textAlign: 'right' }} />
                      </td>
                      <td style={{ ...num, padding: '8px 14px', textAlign: 'right', color: C.mid }}>{feitas}</td>
                      <td style={{ ...num, padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: metaC > 0 ? gaugeColor(pctC) : C.dim }}>{metaC > 0 ? `${Math.round(pctC * 100)}%` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: C.bg, fontWeight: 800 }}>
                  <td style={{ padding: '10px 14px', color: C.ink }}>Ano</td>
                  <td style={{ ...num, padding: '10px 14px', textAlign: 'right', color: C.ink }}>{fmtBRL(goals?.totalValue ?? 0)}</td>
                  <td style={{ ...num, padding: '10px 14px', textAlign: 'right', color: C.mid }}>{fmtBRL(data?.totalYear ?? 0)}</td>
                  <td style={{ ...num, padding: '10px 14px', textAlign: 'right', color: (goals?.totalValue ?? 0) > 0 ? gaugeColor((data?.totalYear ?? 0) / (goals!.totalValue)) : C.dim }}>{(goals?.totalValue ?? 0) > 0 ? `${Math.round((data?.totalYear ?? 0) / goals!.totalValue * 100)}%` : '—'}</td>
                  <td style={{ ...num, padding: '10px 14px', textAlign: 'right', color: C.ink }}>{goals?.totalCount ?? 0}</td>
                  <td style={{ ...num, padding: '10px 14px', textAlign: 'right', color: C.mid }}>{data?.countYear ?? 0}</td>
                  <td style={{ ...num, padding: '10px 14px', textAlign: 'right', color: (goals?.totalCount ?? 0) > 0 ? gaugeColor((data?.countYear ?? 0) / (goals!.totalCount)) : C.dim }}>{(goals?.totalCount ?? 0) > 0 ? `${Math.round((data?.countYear ?? 0) / goals!.totalCount * 100)}%` : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        </>
        )}
      </>}
    </div>
  )
}
