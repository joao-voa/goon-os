'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { canSeeSales, PRODUCT_COLORS } from '@/lib/constants'
import { toast } from 'sonner'

interface Deal { companyName: string; value: number; date: string; salesRep: string | null; product: string | null; productCode: string }
interface MonthSales { month: number; label: string; count: number; total: number; deals: Deal[] }
interface ProgramTotal { code: string; count: number; total: number }
interface SalesData { year: number; totalYear: number; countYear: number; months: MonthSales[]; byProgram: ProgramTotal[] }
interface Goal { month: number; targetValue: number; targetCount: number }
interface GoalsData { year: number; months: Goal[]; totalValue: number; totalCount: number }

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#f59e0b' }
const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }

function gaugeColor(pct: number) { return pct >= 1 ? C.green : pct >= 0.6 ? C.amber : C.red }

// ---- Velocímetro (SVG semicírculo com ponteiro) ----
function Gauge({ value, target, label, kind }: { value: number; target: number; label: string; kind: 'money' | 'count' }) {
  const pct = target > 0 ? value / target : 0
  const clamped = Math.max(0, Math.min(pct, 1))
  const color = gaugeColor(pct)
  const angle = 180 - clamped * 180 // graus (180=esq, 0=dir)
  const rad = (angle * Math.PI) / 180
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
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<SalesData | null>(null)
  const [goals, setGoals] = useState<GoalsData | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [productFilter, setProductFilter] = useState('')
  const [metaMonth, setMetaMonth] = useState(new Date().getMonth() + 1)
  const [editValue, setEditValue] = useState('')
  const [editCount, setEditCount] = useState('')
  const [saving, setSaving] = useState(false)

  const loadGoals = useCallback(() => {
    apiFetch<GoalsData>(`/api/crm/goals?year=${year}`).then(setGoals).catch(() => {})
  }, [year])

  useEffect(() => {
    if (!isOwner) return
    const qs = `year=${year}${productFilter ? `&product=${productFilter}` : ''}`
    apiFetch<SalesData>(`/api/crm/sales-by-month?${qs}`).then(setData).catch(() => {})
    loadGoals()
  }, [isOwner, year, productFilter, loadGoals])

  // preenche o editor quando muda o mês/metas
  useEffect(() => {
    const g = goals?.months.find(m => m.month === metaMonth)
    setEditValue(g && g.targetValue ? String(g.targetValue) : '')
    setEditCount(g && g.targetCount ? String(g.targetCount) : '')
  }, [goals, metaMonth])

  async function saveMeta(applyAll: boolean) {
    setSaving(true)
    try {
      await apiFetch('/api/crm/goals', {
        method: 'PUT',
        body: JSON.stringify({ year, month: metaMonth, targetValue: parseFloat(editValue) || 0, targetCount: parseInt(editCount) || 0, applyAll }),
      })
      toast.success(applyAll ? 'Meta aplicada a todos os meses' : `Meta de ${MONTH_FULL[metaMonth - 1]} salva`)
      loadGoals()
    } catch { toast.error('Erro ao salvar meta') } finally { setSaving(false) }
  }

  if (authLoading) return null
  if (!isOwner) {
    return <div style={{ padding: 40, fontFamily: 'var(--font-sans)', fontSize: 14, color: C.mid }}>🔒 Acesso restrito. Esta página é exclusiva do dono do sistema.</div>
  }

  const maxTotal = data ? Math.max(...data.months.map(m => m.total), 1) : 1
  const activeMonths = data ? data.months.filter(m => m.count > 0) : []
  const avgTicket = data && data.countYear > 0 ? data.totalYear / data.countYear : 0

  const mesSales = data?.months.find(m => m.month === metaMonth)
  const mesGoal = goals?.months.find(m => m.month === metaMonth)
  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }

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

      {/* ===== METAS / VELOCÍMETRO ===== */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Meta · quão perto estamos</span>
          <select value={metaMonth} onChange={e => setMetaMonth(parseInt(e.target.value))} style={{ padding: '6px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 13, background: '#fff', cursor: 'pointer' }}>
            {MONTH_FULL.map((mn, i) => <option key={i} value={i + 1}>{mn}</option>)}
          </select>
        </div>

        {/* Velocímetros: mês (R$ e qtd) + ano (R$ e qtd) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, padding: '20px 16px' }}>
          <Gauge label={`${MONTH_FULL[metaMonth - 1]} · R$`} value={mesSales?.total ?? 0} target={mesGoal?.targetValue ?? 0} kind="money" />
          <Gauge label={`${MONTH_FULL[metaMonth - 1]} · Vendas`} value={mesSales?.count ?? 0} target={mesGoal?.targetCount ?? 0} kind="count" />
          <Gauge label={`Ano ${year} · R$`} value={data?.totalYear ?? 0} target={goals?.totalValue ?? 0} kind="money" />
          <Gauge label={`Ano ${year} · Vendas`} value={data?.countYear ?? 0} target={goals?.totalCount ?? 0} kind="count" />
        </div>

        {/* Editor de meta */}
        <div style={{ borderTop: `1px solid ${C.line}`, padding: '14px 20px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', background: '#fafbfc' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>Meta {MONTH_FULL[metaMonth - 1]} (R$)</label>
            <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="0" style={{ width: 150, padding: '8px 12px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 13 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>Meta de vendas (qtd)</label>
            <input type="number" value={editCount} onChange={e => setEditCount(e.target.value)} placeholder="0" style={{ width: 130, padding: '8px 12px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: 'var(--font-sans)', fontSize: 13 }} />
          </div>
          <button onClick={() => saveMeta(false)} disabled={saving} style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 }}>Salvar mês</button>
          <button onClick={() => saveMeta(true)} disabled={saving} style={{ background: C.neon, color: C.ink, border: 'none', borderRadius: 6, padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700 }}>Aplicar a todos os meses</button>
        </div>
      </div>

      {/* KPIs do ano */}
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

      {/* Totalizador por programa (clicável = filtro) */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Por programa · {year}</span>
          {productFilter && (
            <button onClick={() => setProductFilter('')} style={{ background: '#f1f5f9', color: C.ink, border: 'none', borderRadius: 6, cursor: 'pointer', padding: '5px 12px', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600 }}>✕ limpar filtro</button>
          )}
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

      {/* Barras por mês */}
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
    </div>
  )
}
