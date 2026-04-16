'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface MonthData {
  month: number
  year: number
  label: string
  entradas: { received: number; pending: number; overdue: number; total: number }
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
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 20 }}>FLUXO DE CAIXA</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setYear(y => y - 1)} style={{ padding: '4px 12px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>◀</button>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 16, minWidth: 60, textAlign: 'center' }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} style={{ padding: '4px 12px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>▶</button>
        </div>
      </div>

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
        <div style={{ padding: '16px 20px', display: 'flex', gap: 8, alignItems: 'flex-end', height: 180, overflowX: 'auto' }}>
          {data.months.map(m => {
            const entH = barMax > 0 ? (m.entradas.total / barMax) * 140 : 0
            const saiH = barMax > 0 ? ((m.saidas.total + m.comissoes.total) / barMax) * 140 : 0
            return (
              <div key={m.month} style={{ flex: 1, minWidth: 55, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 140, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: '#006600', fontWeight: 700, whiteSpace: 'nowrap' }}>{m.entradas.total > 0 ? fmt(m.entradas.total) : ''}</span>
                    <div style={{ width: 18, height: Math.max(entH, 2), background: '#006600', border: '1px solid #004400' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: '#cc0000', fontWeight: 700, whiteSpace: 'nowrap' }}>{(m.saidas.total + m.comissoes.total) > 0 ? fmt(m.saidas.total + m.comissoes.total) : ''}</span>
                    <div style={{ width: 18, height: Math.max(saiH, 2), background: '#cc0000', border: '1px solid #990000' }} />
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
                  <span style={{ color: isExpanded ? '#66ff66' : '#006600' }}>+{fmt(m.entradas.total)}</span>
                  <span style={{ color: isExpanded ? '#ff6666' : '#cc0000' }}>-{fmt(m.saidas.total + m.comissoes.total)}</span>
                  <span style={{ color: m.saldoProjetado >= 0 ? (isExpanded ? '#66ff66' : '#006600') : (isExpanded ? '#ff6666' : '#cc0000'), fontWeight: 900 }}>
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
                        <tr style={{ borderBottom: '1px solid #ddd', background: '#fff0f0' }}>
                          <td style={{ padding: '6px 8px', paddingLeft: 24, fontSize: 10, color: '#cc0000' }}>↳ Inadimplente</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#cc0000' }}>{fmt(m.entradas.overdue)}</td>
                          <td style={{ padding: '6px 8px' }} />
                          <td style={{ padding: '6px 8px' }} />
                        </tr>
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
    </div>
  )
}
