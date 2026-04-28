'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface MonthData {
  month: number
  year: number
  label: string
  entradas: { received: number; pending: number; overdue: number; total: number; overdueClients?: Array<{ id: string; companyName: string; value: number }> }
  saidas: { previsto: number; pago: number; total: number; byCategory?: Record<string, number> }
  comissoes: { pending: number; paid: number; total: number }
  saldo: number
  saldoProjetado: number
}

interface Totals {
  entradas: number
  entradasReceived: number
  saidas: number
  saidasPago: number
  comissoes: number
  comissoesPaid: number
  saldo: number
  saldoProjetado: number
}

interface CashflowData {
  year: number
  months: MonthData[]
  totals: Totals
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function CashflowPage() {
  const [data, setData] = useState<CashflowData | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [expandedMonth, setExpandedMonth] = useState<number | null>(new Date().getMonth() + 1)
  const [fullscreen, setFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState<'mensal' | 'diario'>('mensal')
  const [dailyMonth, setDailyMonth] = useState(new Date().getMonth())
  const [dailyData, setDailyData] = useState<Array<{ day: number; entradas: number; saidas: number; saldo: number; items: Array<{ type: 'entrada' | 'saida'; description: string; value: number }> }>>([])

  useEffect(() => {
    if (viewMode !== 'diario' || !data) return
    const m = data.months[dailyMonth]
    if (!m) return

    // Build daily breakdown from payments and expenses
    async function loadDaily() {
      try {
        const params = new URLSearchParams()
        params.set('month', String(dailyMonth + 1))
        params.set('year', String(year))

        const [payments, expenses] = await Promise.all([
          apiFetch<{ data: Array<{ id: string; dueDate: string; paidAt?: string | null; value: number; status: string; client: { companyName: string }; installmentNumber?: number }> }>('/api/payments?' + params.toString() + '&limit=200'),
          apiFetch<Array<{ id: string; dueDate: string; value: number; status: string; description: string; category: string }>>('/api/expenses?month=' + (dailyMonth + 1) + '&year=' + year + '&limit=200'),
        ])

        const daysInMonth = new Date(year, dailyMonth + 1, 0).getDate()
        const days: typeof dailyData = []

        for (let d = 1; d <= daysInMonth; d++) {
          const dayItems: typeof dailyData[0]['items'] = []
          let entradas = 0, saidas = 0

          // Payments for this day — use paidAt for paid (real date), dueDate for pending (projected)
          const dayPayments = (payments.data ?? []).filter(p => {
            const dateToUse = p.status === 'PAID' && p.paidAt ? p.paidAt : p.dueDate
            const pd = new Date(dateToUse)
            return pd.getDate() === d && pd.getMonth() === dailyMonth && pd.getFullYear() === year
          })
          for (const p of dayPayments) {
            entradas += p.value
            dayItems.push({ type: 'entrada', description: p.client?.companyName + ' P' + (p.installmentNumber ?? ''), value: p.value })
          }

          // Expenses for this day (exclude Giulliano mentoring)
          const expArray = Array.isArray(expenses) ? expenses : (expenses as any).data ?? []
          const dayExpenses = expArray.filter((e: any) => {
            const ed = new Date(e.dueDate)
            return ed.getDate() === d && ed.getMonth() === dailyMonth && ed.getFullYear() === year && !(e.category === 'MENTORIA' && e.description?.includes('Giulliano'))
          })
          for (const e of dayExpenses) {
            saidas += e.value
            dayItems.push({ type: 'saida', description: e.description, value: e.value })
          }

          days.push({ day: d, entradas, saidas, saldo: entradas - saidas, items: dayItems })
        }

        setDailyData(days)
      } catch { /* ignore */ }
    }
    loadDaily()
  }, [viewMode, dailyMonth, year, data])

  const loadData = useCallback(async () => {
    const result = await apiFetch<CashflowData>(`/api/cashflow?year=${year}`)
    setData(result)
  }, [year])

  useEffect(() => { loadData() }, [loadData])

  if (!data) {
    return (
      <div style={{ padding: 24, fontFamily: 'var(--font-mono)', fontSize: 12 }}>Carregando...</div>
    )
  }

  const barMax = Math.max(...data.months.map(m => Math.max(m.entradas.total, m.saidas.total + m.comissoes.total)), 1)

  return (
    <div style={{
      padding: fullscreen ? 24 : 0,
      ...(fullscreen ? { position: 'fixed', inset: 0, zIndex: 100, background: 'white', overflow: 'auto' } : {}),
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 20 }}>FLUXO DE CAIXA</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['mensal', 'diario'] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              padding: '4px 12px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11,
              background: viewMode === v ? 'black' : 'white', color: viewMode === v ? 'white' : 'black',
            }}>{v === 'mensal' ? 'MENSAL' : 'DIARIO'}</button>
          ))}
          <button onClick={() => setFullscreen(!fullscreen)} style={{ padding: '4px 12px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 11, background: fullscreen ? 'black' : 'white', color: fullscreen ? 'white' : 'black' }}>
            {fullscreen ? 'MINIMIZAR' : 'MAXIMIZAR'}
          </button>
          <button onClick={() => setYear(y => y - 1)} style={{ padding: '4px 12px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>◀</button>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 16, minWidth: 60, textAlign: 'center' }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} style={{ padding: '4px 12px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>▶</button>
        </div>
      </div>

      {/* DAILY VIEW */}
      {viewMode === 'diario' && (
        <div>
          {/* Month selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={() => setDailyMonth(m => m > 0 ? m - 1 : 11)} style={{ padding: '4px 12px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>◀</button>
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, textTransform: 'uppercase', minWidth: 120, textAlign: 'center' }}>{MONTH_NAMES[dailyMonth]} {year}</span>
            <button onClick={() => setDailyMonth(m => m < 11 ? m + 1 : 0)} style={{ padding: '4px 12px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>▶</button>
          </div>

          {/* KPIs do mês */}
          {data && data.months[dailyMonth] && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#006600', color: 'white', padding: '12px 16px', border: '2px solid black', boxShadow: '3px 3px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Entradas</div>
                <div style={{ fontSize: 16 }}>{fmt(data.months[dailyMonth].entradas.total)}</div>
              </div>
              <div style={{ background: '#cc0000', color: 'white', padding: '12px 16px', border: '2px solid black', boxShadow: '3px 3px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Saidas</div>
                <div style={{ fontSize: 16 }}>{fmt(data.months[dailyMonth].saidas.total + data.months[dailyMonth].comissoes.total)}</div>
              </div>
              <div style={{ background: data.months[dailyMonth].saldoProjetado >= 0 ? '#006600' : '#cc0000', color: 'white', padding: '12px 16px', border: '2px solid black', boxShadow: '3px 3px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Saldo</div>
                <div style={{ fontSize: 16 }}>{fmt(data.months[dailyMonth].saldoProjetado)}</div>
              </div>
            </div>
          )}

          {/* Daily table */}
          <div style={{ border: '2px solid black', boxShadow: '4px 4px 0 black', background: 'white', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'black', color: 'white', textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'center', width: 50 }}>Dia</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Entradas</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Saidas</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Saldo Dia</th>
                </tr>
              </thead>
              <tbody>
                {dailyData.map(d => {
                  const hasData = d.entradas > 0 || d.saidas > 0
                  const isToday = d.day === new Date().getDate() && dailyMonth === new Date().getMonth() && year === new Date().getFullYear()
                  return (
                    <React.Fragment key={d.day}>
                      <tr style={{ borderBottom: '1px solid #eee', background: isToday ? '#fffff0' : hasData ? 'white' : '#fafafa', cursor: hasData ? 'pointer' : 'default' }}
                        onClick={() => setExpandedMonth(expandedMonth === d.day + 100 ? null : d.day + 100)}>
                        <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: isToday ? 900 : hasData ? 700 : 400, color: isToday ? '#4A78FF' : hasData ? 'black' : '#ccc' }}>{d.day}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: d.entradas > 0 ? '#006600' : '#ccc' }}>{d.entradas > 0 ? fmt(d.entradas) : '-'}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: d.saidas > 0 ? '#cc0000' : '#ccc' }}>{d.saidas > 0 ? fmt(d.saidas) : '-'}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: d.saldo > 0 ? '#006600' : d.saldo < 0 ? '#cc0000' : '#ccc' }}>{hasData ? fmt(d.saldo) : '-'}</td>
                      </tr>
                      {expandedMonth === d.day + 100 && d.items.length > 0 && d.items.map((item, i) => (
                        <tr key={i} style={{ background: '#f9f9f9', borderBottom: '1px solid #f0f0f0' }}>
                          <td />
                          <td colSpan={2} style={{ padding: '3px 12px 3px 20px', fontSize: 10, color: item.type === 'entrada' ? '#006600' : '#cc0000' }}>
                            {item.type === 'entrada' ? '↑' : '↓'} {item.description}
                          </td>
                          <td style={{ padding: '3px 12px', textAlign: 'right', fontSize: 10, color: item.type === 'entrada' ? '#006600' : '#cc0000' }}>{fmt(item.value)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}
                <tr style={{ background: '#f0f0f0', fontWeight: 700 }}>
                  <td style={{ padding: '8px 12px' }}>TOTAL</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#006600' }}>{fmt(dailyData.reduce((s, d) => s + d.entradas, 0))}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#cc0000' }}>{fmt(dailyData.reduce((s, d) => s + d.saidas, 0))}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(dailyData.reduce((s, d) => s + d.saldo, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'mensal' && <>
      {/* Totais do Ano */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#006600', color: 'white', padding: '12px 16px', border: '2px solid black', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Entradas Previstas</div>
          <div style={{ fontSize: 18 }}>{fmt(data.totals.entradas)}</div>
          <div style={{ fontSize: 9, opacity: 0.7 }}>Recebido: {fmt(data.totals.entradasReceived)}</div>
        </div>
        <div style={{ background: '#cc0000', color: 'white', padding: '12px 16px', border: '2px solid black', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Saidas Previstas</div>
          <div style={{ fontSize: 18 }}>{fmt(data.totals.saidas + data.totals.comissoes)}</div>
          <div style={{ fontSize: 9, opacity: 0.7 }}>Pago: {fmt(data.totals.saidasPago + data.totals.comissoesPaid)}</div>
        </div>
        <div style={{ background: data.totals.saldoProjetado >= 0 ? '#006600' : '#cc0000', color: 'white', padding: '12px 16px', border: '2px solid black', boxShadow: '4px 4px 0 black', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>Saldo Projetado</div>
          <div style={{ fontSize: 18 }}>{fmt(data.totals.saldoProjetado)}</div>
          <div style={{ fontSize: 9, opacity: 0.7 }}>Real: {fmt(data.totals.saldo)}</div>
        </div>
      </div>

      {/* Grafico de barras simples */}
      <div style={{ background: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black', marginBottom: 24 }}>
        <div className="goon-card-header">COMPARATIVO MENSAL</div>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 8, alignItems: 'flex-end', minHeight: 250, overflowX: 'auto' }}>
          {data.months.map(m => {
            const entH = barMax > 0 ? (m.entradas.total / barMax) * 160 : 0
            const saiH = barMax > 0 ? ((m.saidas.total + m.comissoes.total) / barMax) * 160 : 0
            return (
              <div key={m.month} style={{ flex: 1, minWidth: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 180 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#006600', fontWeight: 700, whiteSpace: 'nowrap', writingMode: 'vertical-lr', transform: 'rotate(180deg)', maxHeight: 55, letterSpacing: 0.5 }}>{m.entradas.total > 0 ? fmt(m.entradas.total) : ''}</span>
                    <div style={{ width: 22, height: Math.max(entH, 2), background: '#006600', border: '1px solid #004400', borderRadius: 2 }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#cc0000', fontWeight: 700, whiteSpace: 'nowrap', writingMode: 'vertical-lr', transform: 'rotate(180deg)', maxHeight: 55, letterSpacing: 0.5 }}>{(m.saidas.total + m.comissoes.total) > 0 ? fmt(m.saidas.total + m.comissoes.total) : ''}</span>
                    <div style={{ width: 22, height: Math.max(saiH, 2), background: '#cc0000', border: '1px solid #990000', borderRadius: 2 }} />
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>{MONTH_NAMES[m.month - 1]}</span>
              </div>
            )
          })}
        </div>
        <div style={{ padding: '0 20px 12px', display: 'flex', gap: 16, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#006600', marginRight: 4, verticalAlign: 'middle' }} />Entradas</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#cc0000', marginRight: 4, verticalAlign: 'middle' }} />Saidas + Comissoes</span>
        </div>
      </div>

      {/* Detalhamento mensal */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.months.map(m => {
          const isExpanded = expandedMonth === m.month
          const hasData = m.entradas.total > 0 || m.saidas.total > 0 || m.comissoes.total > 0

          return (
            <div key={m.month} style={{ background: 'white', border: '2px solid black', boxShadow: isExpanded ? '4px 4px 0 black' : 'none' }}>
              {/* Month header - clickable */}
              <button
                onClick={() => setExpandedMonth(isExpanded ? null : m.month)}
                style={{
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 16px',
                  background: isExpanded ? 'black' : hasData ? 'var(--retro-gray)' : 'white',
                  color: isExpanded ? 'white' : 'black',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                <span>{MONTH_NAMES[m.month - 1]} {m.year}</span>
                <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
                  <span style={{ color: isExpanded ? '#22c55e' : '#006600' }}>+{fmt(m.entradas.total)}</span>
                  <span style={{ color: isExpanded ? '#ff6666' : '#cc0000' }}>-{fmt(m.saidas.total + m.comissoes.total)}</span>
                  <span style={{ color: m.saldoProjetado >= 0 ? (isExpanded ? '#22c55e' : '#006600') : (isExpanded ? '#ff6666' : '#cc0000'), fontWeight: 900 }}>
                    = {fmt(m.saldoProjetado)}
                  </span>
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ padding: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid black' }}>
                        <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 9, textTransform: 'uppercase' }}>Categoria</th>
                        <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 9, textTransform: 'uppercase' }}>Realizado</th>
                        <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 9, textTransform: 'uppercase' }}>Previsto</th>
                        <th style={{ padding: '4px 8px', textAlign: 'right', fontSize: 9, textTransform: 'uppercase' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #ddd', background: '#f0fff0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: '#006600' }}>Entradas (Pagamentos)</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(m.entradas.received)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(m.entradas.pending + m.entradas.overdue)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(m.entradas.total)}</td>
                      </tr>
                      {m.entradas.overdue > 0 && (
                        <>
                          <tr style={{ borderBottom: '1px solid #ddd', background: '#fff0f0' }}>
                            <td style={{ padding: '6px 8px', paddingLeft: 24, fontSize: 10, color: '#cc0000', fontWeight: 700 }}>↳ Inadimplente</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', color: '#cc0000' }}>{fmt(m.entradas.overdue)}</td>
                            <td style={{ padding: '6px 8px' }} />
                            <td style={{ padding: '6px 8px' }} />
                          </tr>
                          {m.entradas.overdueClients?.map(c => (
                            <tr key={c.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                              <td style={{ padding: '3px 8px 3px 40px', fontSize: 9, color: '#cc0000' }}>• {c.companyName}</td>
                              <td style={{ padding: '3px 8px', textAlign: 'right', fontSize: 9, color: '#cc0000' }}>{fmt(c.value)}</td>
                              <td colSpan={2} />
                            </tr>
                          ))}
                        </>
                      )}
                      <tr style={{ borderBottom: '1px solid #ddd', background: '#fff5f5' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: '#cc0000' }}>Despesas</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(m.saidas.pago)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(m.saidas.previsto)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(m.saidas.total)}</td>
                      </tr>
                      {m.saidas.byCategory && Object.entries(m.saidas.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
                        const catLabels: Record<string, string> = { PESSOAL: 'Pessoal Giu', MENTORIA: 'Mentorias', COMISSAO: 'Comissao Vendas', IMPOSTOS: 'Impostos', MARKETING: 'Marketing', PESSOAS: 'Pessoas', SISTEMAS: 'Sistemas', ESTRUTURA: 'Estrutura', OUTRO: 'Outro' }
                        const catColors: Record<string, string> = { PESSOAL: '#000080', MENTORIA: '#4A78FF', COMISSAO: '#e6a800', IMPOSTOS: '#cc0000', MARKETING: '#7c3aed', PESSOAS: '#059669', SISTEMAS: '#06b6d4', ESTRUTURA: '#475569', OUTRO: '#888' }
                        return (
                          <tr key={cat} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '4px 8px 4px 24px', fontSize: 10, color: catColors[cat] ?? '#888' }}>↳ {catLabels[cat] ?? cat}</td>
                            <td colSpan={2} />
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: 10, color: '#555' }}>{fmt(val)}</td>
                          </tr>
                        )
                      })}
                      <tr style={{ borderBottom: '1px solid #ddd', background: '#fffff0' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: '#e6a800' }}>Comissoes</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(m.comissoes.paid)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(m.comissoes.pending)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{fmt(m.comissoes.total)}</td>
                      </tr>
                      <tr style={{ borderTop: '3px solid black', fontWeight: 900 }}>
                        <td style={{ padding: '8px 8px' }}>SALDO PROJETADO</td>
                        <td colSpan={2} />
                        <td style={{ padding: '8px 8px', textAlign: 'right', color: m.saldoProjetado >= 0 ? '#006600' : '#cc0000', fontSize: 14 }}>{fmt(m.saldoProjetado)}</td>
                      </tr>
                      <tr style={{ color: '#666' }}>
                        <td style={{ padding: '4px 8px', fontSize: 10 }}>Saldo Realizado (somente efetivado)</td>
                        <td colSpan={2} />
                        <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: 10 }}>{fmt(m.saldo)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
      </>}
    </div>
  )
}
