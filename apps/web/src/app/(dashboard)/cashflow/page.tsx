'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface Layers { impostos: number; custoOperacao: number; distribuicao: number; pessoalGiu: number }

interface MonthData {
  month: number
  year: number
  label: string
  entradas: { received: number; pending: number; overdue: number; total: number; overdueClients?: Array<{ id: string; companyName: string; value: number }> }
  saidas: { previsto: number; pago: number; total: number; byCategory?: Record<string, number>; items?: Array<{ description: string; category: string; value: number; status: string }> }
  comissoes: { pending: number; paid: number; total: number }
  layers: Layers
  saldo: number
  saldoProjetado: number
}

interface Totals {
  entradas: number; entradasReceived: number; saidas: number; saidasPago: number
  comissoes: number; comissoesPaid: number; saldo: number; saldoProjetado: number
  impostos: number; custoOperacao: number; distribuicao: number; pessoalGiu: number
}

interface CashflowData { year: number; months: MonthData[]; totals: Totals }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// paleta
const C = {
  ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0',
  neon: '#C7F900', green: '#16a34a', greenDk: '#15803d', red: '#dc2626', amber: '#f59e0b',
  slate: '#475569', bg: '#f8fafc',
}

const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }

export default function CashflowPage() {
  const [data, setData] = useState<CashflowData | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [viewMode, setViewMode] = useState<'mensal' | 'diario'>('mensal')
  const [scope, setScope] = useState<'ano' | 'mes'>('mes')
  const [showGiu, setShowGiu] = useState(false)
  const [expandedMonth, setExpandedMonth] = useState<number | null>(new Date().getMonth() + 1)
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [dailyMonth, setDailyMonth] = useState(new Date().getMonth())
  const [dailyData, setDailyData] = useState<Array<{ day: number; entradas: number; saidas: number; saldo: number; items: Array<{ type: 'entrada' | 'saida'; description: string; value: number }> }>>([])
  const [dayOpen, setDayOpen] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    const result = await apiFetch<CashflowData>(`/api/cashflow?year=${year}`)
    setData(result)
  }, [year])
  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (viewMode !== 'diario') return
    async function loadDaily() {
      try {
        const [payments, expenses] = await Promise.all([
          apiFetch<{ data: Array<{ id: string; dueDate: string; paidAt?: string | null; value: number; status: string; client: { companyName: string }; installmentNumber?: number }> }>(`/api/payments?month=${dailyMonth + 1}&year=${year}&limit=300`),
          apiFetch<Array<{ id: string; dueDate: string; value: number; status: string; description: string; category: string }>>(`/api/expenses?month=${dailyMonth + 1}&year=${year}&limit=300`),
        ])
        const daysInMonth = new Date(year, dailyMonth + 1, 0).getDate()
        const days: typeof dailyData = []
        const expArray = Array.isArray(expenses) ? expenses : (expenses as any).data ?? []
        for (let d = 1; d <= daysInMonth; d++) {
          const items: typeof dailyData[0]['items'] = []
          let entradas = 0, saidas = 0
          for (const p of (payments.data ?? [])) {
            const dt = new Date(p.status === 'PAID' && p.paidAt ? p.paidAt : p.dueDate)
            if (dt.getDate() === d && dt.getMonth() === dailyMonth && dt.getFullYear() === year) {
              entradas += p.value; items.push({ type: 'entrada', description: p.client?.companyName ?? '', value: p.value })
            }
          }
          for (const e of expArray) {
            const dt = new Date(e.dueDate)
            const skip = e.category === 'MENTORIA' && e.description?.includes('Giulliano')
            if (!skip && dt.getDate() === d && dt.getMonth() === dailyMonth && dt.getFullYear() === year) {
              saidas += e.value; items.push({ type: 'saida', description: e.description, value: e.value })
            }
          }
          days.push({ day: d, entradas, saidas, saldo: entradas - saidas, items })
        }
        setDailyData(days)
      } catch { /* ignore */ }
    }
    loadDaily()
  }, [viewMode, dailyMonth, year])

  if (!data) return <div style={{ padding: 24, color: C.mid }}>Carregando fluxo de caixa…</div>

  const mesAtual = data.months[new Date().getMonth()]
  // Agrega ano ou mês conforme escopo
  const src = scope === 'ano'
    ? { receita: data.totals.entradas, recebido: data.totals.entradasReceived, impostos: data.totals.impostos, custo: data.totals.custoOperacao, distrib: data.totals.distribuicao, giu: data.totals.pessoalGiu, aReceber: data.totals.entradas - data.totals.entradasReceived }
    : mesAtual
      ? { receita: mesAtual.entradas.total, recebido: mesAtual.entradas.received, impostos: mesAtual.layers.impostos, custo: mesAtual.layers.custoOperacao, distrib: mesAtual.layers.distribuicao, giu: mesAtual.layers.pessoalGiu, aReceber: mesAtual.entradas.pending + mesAtual.entradas.overdue }
      : { receita: 0, recebido: 0, impostos: 0, custo: 0, distrib: 0, giu: 0, aReceber: 0 }

  const lucroOperacao = src.receita - src.impostos - src.custo
  const resultadoEmpresa = lucroOperacao - src.distrib
  const saldoFinal = resultadoEmpresa - (showGiu ? src.giu : 0)

  // waterfall steps
  const steps = [
    { label: 'Faturamento', value: src.receita, kind: 'base' as const, hint: scope === 'ano' ? `Recebido ${fmt(src.recebido)}` : 'Tudo que entra no mês' },
    { label: 'Impostos', value: -src.impostos, kind: 'out' as const, hint: '6% sobre a receita' },
    { label: 'Custo da operação', value: -src.custo, kind: 'out' as const, hint: 'Time, contabilidade, sistemas, comissões' },
    { label: 'Lucro da operação', value: lucroOperacao, kind: 'sub' as const, hint: 'Receita − impostos − custo' },
    { label: 'Distribuição', value: -src.distrib, kind: 'out' as const, hint: 'Repasses aos sócios / mentores' },
    { label: 'Resultado da empresa', value: resultadoEmpresa, kind: 'sub' as const, hint: 'Depois de distribuir' },
    ...(showGiu ? [{ label: 'Pessoal Giulliano', value: -src.giu, kind: 'out' as const, hint: 'Não é da empresa' }] : []),
    { label: 'Saldo final', value: saldoFinal, kind: 'result' as const, hint: showGiu ? 'Depois de tudo' : 'Fora o pessoal do Giu' },
  ]

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
  const pill = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 100, border: `1px solid ${active ? C.ink : C.line}`, cursor: 'pointer',
    fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
    background: active ? C.ink : '#fff', color: active ? '#fff' : C.mid, transition: 'all .15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Fluxo de Caixa</h1>
          <p style={{ margin: '2px 0 0', color: C.mid, fontSize: 13 }}>Da receita ao saldo — o que a operação realmente gera.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setViewMode(viewMode === 'mensal' ? 'diario' : 'mensal')} style={pill(viewMode === 'diario')}>{viewMode === 'mensal' ? 'Ver diário' : 'Ver mensal'}</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${C.line}`, borderRadius: 100, padding: 4 }}>
            <button onClick={() => setYear(y => y - 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.mid, padding: '2px 8px', fontSize: 14 }}>‹</button>
            <span style={{ ...num, fontWeight: 700, minWidth: 42, textAlign: 'center', fontSize: 14 }}>{year}</span>
            <button onClick={() => setYear(y => y + 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.mid, padding: '2px 8px', fontSize: 14 }}>›</button>
          </div>
        </div>
      </div>

      {viewMode === 'mensal' && <>
        {/* Escopo + toggle Giu */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setScope('mes')} style={pill(scope === 'mes')}>Mês atual</button>
          <button onClick={() => setScope('ano')} style={pill(scope === 'ano')}>Ano {year}</button>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowGiu(!showGiu)} style={{
            ...pill(showGiu), borderColor: showGiu ? C.neon : C.line, background: showGiu ? C.neon : '#fff', color: C.ink,
          }}>{showGiu ? 'Mostrando pessoal Giu' : 'Ocultar pessoal Giu'}</button>
        </div>

        {/* WATERFALL — o coração */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Resultado {scope === 'ano' ? `de ${year}` : 'do mês'}</span>
            <span style={{ ...num, fontSize: 13, color: saldoFinal >= 0 ? C.greenDk : C.red, fontWeight: 700 }}>{saldoFinal >= 0 ? 'Positivo' : 'Negativo'}</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {steps.map((s, i) => {
              const isTotal = s.kind === 'sub' || s.kind === 'result' || s.kind === 'base'
              const valColor = s.kind === 'result' ? (s.value >= 0 ? C.greenDk : C.red)
                : s.kind === 'out' ? C.red
                : s.kind === 'sub' ? (s.value >= 0 ? C.ink : C.red)
                : C.ink
              return (
                <div key={s.label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  padding: s.kind === 'result' ? '16px 22px' : '11px 22px',
                  background: s.kind === 'result' ? (saldoFinal >= 0 ? 'rgba(199,249,0,0.10)' : 'rgba(220,38,38,0.05)') : 'transparent',
                  borderTop: isTotal && i > 0 ? `1px solid ${C.line}` : 'none',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{
                      fontFamily: 'var(--font-sans)', fontSize: s.kind === 'result' ? 16 : 14,
                      fontWeight: isTotal ? 700 : 500, color: s.kind === 'out' ? C.mid : C.ink,
                    }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: C.dim }}>{s.hint}</span>
                  </div>
                  <span style={{ ...num, fontSize: s.kind === 'result' ? 22 : 15, fontWeight: isTotal ? 800 : 600, color: valColor, whiteSpace: 'nowrap' }}>
                    {s.value < 0 ? '−' : ''}{fmt(Math.abs(s.value))}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* KPIs rápidos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { label: 'Faturamento', value: src.receita, color: C.ink, sub: `Recebido ${fmt(src.recebido)}` },
            { label: 'A receber', value: src.aReceber, color: C.amber, sub: 'Pendente + vencido' },
            { label: 'Lucro da operação', value: lucroOperacao, color: C.greenDk, sub: 'Antes de distribuir' },
            { label: 'Saldo final', value: saldoFinal, color: saldoFinal >= 0 ? C.greenDk : C.red, sub: showGiu ? 'Depois de tudo' : 'Fora pessoal Giu', hero: true },
          ].map(k => (
            <div key={k.label} style={{ ...card, padding: '16px 18px', borderTop: k.hero ? `3px solid ${C.neon}` : `1px solid ${C.line}` }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.mid, fontWeight: 600 }}>{k.label}</div>
              <div style={{ ...num, fontSize: 24, fontWeight: 700, color: k.color, marginTop: 6 }}>{fmt(k.value)}</div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Comparativo mensal */}
        <div style={{ ...card, padding: '18px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Comparativo mensal</span>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.mid }}>
              <span><i style={{ display: 'inline-block', width: 9, height: 9, background: C.green, borderRadius: 2, marginRight: 5 }} />Entra</span>
              <span><i style={{ display: 'inline-block', width: 9, height: 9, background: C.slate, borderRadius: 2, marginRight: 5 }} />Custo</span>
              <span><i style={{ display: 'inline-block', width: 9, height: 9, background: C.neon, borderRadius: 2, marginRight: 5 }} />Distribuição</span>
            </div>
          </div>
          {(() => {
            const barMax = Math.max(...data.months.map(m => Math.max(m.entradas.total, m.layers.custoOperacao + m.layers.distribuicao)), 1)
            return (
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', minHeight: 170, overflowX: 'auto', paddingBottom: 4 }}>
                {data.months.map(m => {
                  const entH = (m.entradas.total / barMax) * 140
                  const custoH = (m.layers.custoOperacao / barMax) * 140
                  const distH = (m.layers.distribuicao / barMax) * 140
                  const isCur = m.month === new Date().getMonth() + 1 && year === new Date().getFullYear()
                  return (
                    <div key={m.month} style={{ flex: 1, minWidth: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 145 }}>
                        <div style={{ width: 14, height: Math.max(entH, m.entradas.total > 0 ? 2 : 0), background: C.green, borderRadius: '3px 3px 0 0' }} title={`Entra ${fmt(m.entradas.total)}`} />
                        <div style={{ display: 'flex', flexDirection: 'column-reverse', height: 145, justifyContent: 'flex-start' }}>
                          <div style={{ width: 14, height: Math.max(custoH, m.layers.custoOperacao > 0 ? 2 : 0), background: C.slate, borderRadius: distH > 0 ? 0 : '3px 3px 0 0' }} title={`Custo ${fmt(m.layers.custoOperacao)}`} />
                          <div style={{ width: 14, height: Math.max(distH, m.layers.distribuicao > 0 ? 2 : 0), background: C.neon, borderRadius: '3px 3px 0 0' }} title={`Distribuição ${fmt(m.layers.distribuicao)}`} />
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: isCur ? 800 : 600, color: isCur ? C.ink : C.dim, textTransform: 'uppercase' }}>{MONTH_NAMES[m.month - 1]}</span>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Detalhamento por mês */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, marginTop: 4 }}>Mês a mês</span>
          {data.months.map(m => {
            const isOpen = expandedMonth === m.month
            const hasData = m.entradas.total > 0 || m.saidas.total > 0
            const lucro = m.entradas.total - m.layers.impostos - m.layers.custoOperacao
            const result = lucro - m.layers.distribuicao - (showGiu ? m.layers.pessoalGiu : 0)
            return (
              <div key={m.month} style={{ ...card, boxShadow: isOpen ? '0 4px 12px rgba(0,0,0,0.06)' : '0 1px 2px rgba(0,0,0,0.04)', opacity: hasData ? 1 : 0.55 }}>
                <button onClick={() => setExpandedMonth(isOpen ? null : m.month)} style={{
                  width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                  padding: '13px 18px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.03em', color: isOpen ? C.ink : C.slate, minWidth: 90 }}>
                    {MONTH_NAMES[m.month - 1]} {m.year}
                  </span>
                  <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span style={{ ...num, fontSize: 12, color: C.green }}>+{fmt(m.entradas.total)}</span>
                    <span style={{ ...num, fontSize: 12, color: C.slate }}>−{fmt(m.layers.custoOperacao + m.layers.impostos)}</span>
                    <span style={{ ...num, fontSize: 12, color: '#7a9a00' }}>−{fmt(m.layers.distribuicao)}</span>
                    <span style={{ ...num, fontSize: 13, fontWeight: 800, color: result >= 0 ? C.greenDk : C.red, minWidth: 80, textAlign: 'right' }}>{fmt(result)}</span>
                    <span style={{ color: C.dim, fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div style={{ padding: '4px 18px 18px' }}>
                    <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                      {/* mini waterfall do mês */}
                      {[
                        { l: 'Faturamento', v: m.entradas.total, sign: 1 },
                        { l: 'Impostos', v: -m.layers.impostos, sign: -1 },
                        { l: 'Custo da operação', v: -m.layers.custoOperacao, sign: -1 },
                        { l: 'Lucro da operação', v: lucro, sign: 0 },
                        { l: 'Distribuição (repasses)', v: -m.layers.distribuicao, sign: -1 },
                        ...(showGiu ? [{ l: 'Pessoal Giulliano', v: -m.layers.pessoalGiu, sign: -1 }] : []),
                        { l: 'Resultado', v: result, sign: 2 },
                      ].map(r => (
                        <div key={r.l} style={{
                          display: 'flex', justifyContent: 'space-between', padding: '7px 0',
                          borderTop: r.sign === 0 || r.sign === 2 ? `1px solid ${C.line}` : 'none',
                        }}>
                          <span style={{ fontSize: 13, fontWeight: r.sign === 0 || r.sign === 2 ? 700 : 500, color: r.sign === -1 ? C.mid : C.ink }}>{r.l}</span>
                          <span style={{ ...num, fontSize: 13, fontWeight: r.sign === 0 || r.sign === 2 ? 800 : 600, color: r.sign === 2 ? (r.v >= 0 ? C.greenDk : C.red) : r.sign === -1 ? C.red : C.ink }}>
                            {r.v < 0 ? '−' : ''}{fmt(Math.abs(r.v))}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* categorias de despesa */}
                    {m.saidas.byCategory && Object.keys(m.saidas.byCategory).length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.dim, fontWeight: 600, marginBottom: 6 }}>Despesas por categoria</div>
                        {Object.entries(m.saidas.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
                          const labels: Record<string, string> = { PESSOAL: 'Pessoal', MENTORIA: 'Repasses', COMISSAO: 'Comissões', IMPOSTOS: 'Impostos', MARKETING: 'Marketing', PESSOAS: 'Time / pessoas', SISTEMAS: 'Sistemas', ESTRUTURA: 'Estrutura', OUTRO: 'Outro' }
                          const key = `${m.month}-${cat}`
                          const open = expandedCat === key
                          const items = (m.saidas.items ?? []).filter(i => i.category === cat)
                          return (
                            <div key={cat}>
                              <button onClick={() => setExpandedCat(open ? null : key)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.bg}`, cursor: 'pointer' }}>
                                <span style={{ fontSize: 12.5, color: C.slate }}>{open ? '▾' : '▸'} {labels[cat] ?? cat} <span style={{ color: C.dim }}>({items.length})</span></span>
                                <span style={{ ...num, fontSize: 12.5, color: C.slate }}>{fmt(val)}</span>
                              </button>
                              {open && items.sort((a, b) => b.value - a.value).map((it, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 4px 18px' }}>
                                  <span style={{ fontSize: 11.5, color: C.mid }}>{it.description || '—'}</span>
                                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 100, background: it.status === 'PAGO' ? '#dcfce7' : '#fef3c7', color: it.status === 'PAGO' ? '#166534' : '#92400e' }}>{it.status}</span>
                                    <span style={{ ...num, fontSize: 11.5, color: C.mid }}>{fmt(it.value)}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </>}

      {/* DAILY VIEW */}
      {viewMode === 'diario' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <button onClick={() => setDailyMonth(m => m > 0 ? m - 1 : 11)} style={{ border: `1px solid ${C.line}`, background: '#fff', borderRadius: 8, cursor: 'pointer', color: C.mid, padding: '4px 12px' }}>‹</button>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, minWidth: 120, textAlign: 'center' }}>{MONTH_NAMES[dailyMonth]} {year}</span>
            <button onClick={() => setDailyMonth(m => m < 11 ? m + 1 : 0)} style={{ border: `1px solid ${C.line}`, background: '#fff', borderRadius: 8, cursor: 'pointer', color: C.mid, padding: '4px 12px' }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { l: 'Entradas', v: dailyData.reduce((s, d) => s + d.entradas, 0), c: C.greenDk },
              { l: 'Saídas', v: dailyData.reduce((s, d) => s + d.saidas, 0), c: C.red },
              { l: 'Saldo', v: dailyData.reduce((s, d) => s + d.saldo, 0), c: dailyData.reduce((s, d) => s + d.saldo, 0) >= 0 ? C.greenDk : C.red },
            ].map(k => (
              <div key={k.l} style={{ ...card, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', color: C.mid, fontWeight: 600 }}>{k.l}</div>
                <div style={{ ...num, fontSize: 20, fontWeight: 700, color: k.c, marginTop: 4 }}>{fmt(k.v)}</div>
              </div>
            ))}
          </div>
          <div style={{ ...card, overflow: 'hidden' }}>
            {dailyData.filter(d => d.entradas > 0 || d.saidas > 0).map(d => {
              const isToday = d.day === new Date().getDate() && dailyMonth === new Date().getMonth() && year === new Date().getFullYear()
              const open = dayOpen === d.day
              return (
                <div key={d.day} style={{ borderBottom: `1px solid ${C.bg}` }}>
                  <button onClick={() => setDayOpen(open ? null : d.day)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', background: isToday ? 'rgba(199,249,0,0.08)' : 'transparent', border: 'none', cursor: 'pointer' }}>
                    <span style={{ ...num, fontWeight: isToday ? 800 : 600, color: C.ink, minWidth: 28 }}>{String(d.day).padStart(2, '0')}</span>
                    <div style={{ display: 'flex', gap: 16 }}>
                      {d.entradas > 0 && <span style={{ ...num, fontSize: 12, color: C.green }}>+{fmt(d.entradas)}</span>}
                      {d.saidas > 0 && <span style={{ ...num, fontSize: 12, color: C.red }}>−{fmt(d.saidas)}</span>}
                      <span style={{ ...num, fontSize: 12, fontWeight: 700, color: d.saldo >= 0 ? C.greenDk : C.red, minWidth: 74, textAlign: 'right' }}>{fmt(d.saldo)}</span>
                    </div>
                  </button>
                  {open && d.items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px 4px 44px', background: C.bg }}>
                      <span style={{ fontSize: 11.5, color: it.type === 'entrada' ? C.greenDk : C.red }}>{it.type === 'entrada' ? '↑' : '↓'} {it.description}</span>
                      <span style={{ ...num, fontSize: 11.5, color: it.type === 'entrada' ? C.greenDk : C.red }}>{fmt(it.value)}</span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
