'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface Layers { impostos: number; custoOperacao: number; distribuicao: number; pessoalGiu: number }
interface MonthData {
  month: number; year: number
  entradas: { total: number }
  layers: Layers
}
interface Totals { entradas: number; impostos: number; custoOperacao: number; distribuicao: number; pessoalGiu: number }
interface CashflowData { year: number; months: MonthData[]; totals: Totals }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', neon: '#C7F900', green: '#16a34a', greenDk: '#15803d', red: '#dc2626', bg: '#f8fafc' }
const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }

// Renda do Giulliano no mês = resultado da operação (o que sobra depois de custo e distribuição)
const rendaMes = (m: MonthData) => m.entradas.total - m.layers.impostos - m.layers.custoOperacao - m.layers.distribuicao

export default function GiulhanoContent() {
  const [data, setData] = useState<CashflowData | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [openMonth, setOpenMonth] = useState<number | null>(null)
  const [items, setItems] = useState<Record<number, Array<{ description: string; value: number; status: string }>>>({})

  const load = useCallback(async () => {
    const r = await apiFetch<CashflowData>(`/api/cashflow?year=${year}`)
    setData(r)
  }, [year])
  useEffect(() => { load() }, [load])

  async function loadItems(month: number) {
    if (items[month]) return
    try {
      const exps = await apiFetch<any>(`/api/expenses?month=${month}&year=${year}&limit=400`)
      const arr = (Array.isArray(exps) ? exps : exps.data ?? []) as Array<{ description: string; value: number; status: string; category: string }>
      const pessoal = arr.filter(e => e.category === 'PESSOAL' && /giulliano/i.test(e.description ?? ''))
        .map(e => ({ description: (e.description ?? '').replace(/\s*-\s*Giulliano\s*$/i, ''), value: Number(e.value), status: e.status }))
        .sort((a, b) => b.value - a.value)
      setItems(prev => ({ ...prev, [month]: pessoal }))
    } catch { /* ignore */ }
  }

  if (!data) return <div style={{ padding: 24, color: C.mid }}>Carregando…</div>

  const rendaAno = data.months.reduce((s, m) => s + rendaMes(m), 0)
  const gastosAno = data.totals.pessoalGiu
  const sobraAno = rendaAno - gastosAno

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Fluxo de Caixa · Giulliano</h1>
          <p style={{ margin: '2px 0 0', color: C.mid, fontSize: 13 }}>O que a operação te rende, menos seus gastos pessoais. Não aparece no fluxo geral.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${C.line}`, borderRadius: 100, padding: 4 }}>
          <button onClick={() => setYear(y => y - 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.mid, padding: '2px 8px', fontSize: 14 }}>‹</button>
          <span style={{ ...num, fontWeight: 700, minWidth: 42, textAlign: 'center', fontSize: 14 }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.mid, padding: '2px 8px', fontSize: 14 }}>›</button>
        </div>
      </div>

      {/* Statement pessoal */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Seu resultado em {year}</div>
        {[
          { l: 'Resultado da operação', v: rendaAno, hint: 'O que a empresa gera pra você', color: C.ink, kind: 'base' },
          { l: 'Gastos pessoais', v: -gastosAno, hint: 'Cartão, aluguel, luz, Edu Caduro…', color: C.red, kind: 'out' },
          { l: 'Sobra pra você', v: sobraAno, hint: 'Depois de tudo', color: sobraAno >= 0 ? C.greenDk : C.red, kind: 'result' },
        ].map((r, i) => (
          <div key={r.l} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
            padding: r.kind === 'result' ? '16px 22px' : '12px 22px',
            background: r.kind === 'result' ? (sobraAno >= 0 ? 'rgba(199,249,0,0.10)' : 'rgba(220,38,38,0.05)') : 'transparent',
            borderTop: i > 0 ? `1px solid ${C.line}` : 'none',
          }}>
            <div>
              <div style={{ fontSize: r.kind === 'result' ? 16 : 14, fontWeight: r.kind === 'out' ? 500 : 700, color: r.kind === 'out' ? C.mid : C.ink }}>{r.l}</div>
              <div style={{ fontSize: 11, color: C.dim }}>{r.hint}</div>
            </div>
            <span style={{ ...num, fontSize: r.kind === 'result' ? 22 : 15, fontWeight: r.kind === 'base' || r.kind === 'result' ? 800 : 600, color: r.color }}>{r.v < 0 ? '−' : ''}{fmt(Math.abs(r.v))}</span>
          </div>
        ))}
      </div>

      {/* Meses */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Gastos pessoais mês a mês</div>
        {data.months.map(m => {
          const gasto = m.layers.pessoalGiu
          const renda = rendaMes(m)
          const has = gasto > 0 || renda !== 0
          const open = openMonth === m.month
          return (
            <div key={m.month} style={{ borderTop: `1px solid ${C.bg}`, opacity: has ? 1 : 0.5 }}>
              <button onClick={() => { const nx = open ? null : m.month; setOpenMonth(nx); if (nx) loadItems(m.month) }} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#475569', minWidth: 90 }}>{MONTH_FULL[m.month - 1]}</span>
                <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span style={{ ...num, fontSize: 12, color: C.green }}>+{fmt(renda)}</span>
                  <span style={{ ...num, fontSize: 12, color: C.red }}>−{fmt(gasto)}</span>
                  <span style={{ ...num, fontSize: 13, fontWeight: 800, color: (renda - gasto) >= 0 ? C.greenDk : C.red, minWidth: 84, textAlign: 'right' }}>{fmt(renda - gasto)}</span>
                  <span style={{ color: C.dim, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
                </div>
              </button>
              {open && (
                <div style={{ padding: '2px 20px 14px' }}>
                  {!items[m.month] && <div style={{ color: C.dim, fontSize: 12, padding: '6px 0' }}>Carregando…</div>}
                  {items[m.month]?.length === 0 && <div style={{ color: C.dim, fontSize: 12, padding: '6px 0' }}>Sem gastos pessoais neste mês.</div>}
                  {items[m.month]?.map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderTop: i > 0 ? `1px solid ${C.bg}` : 'none' }}>
                      <span style={{ fontSize: 12.5, color: C.ink }}>{it.description}</span>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 100, background: it.status === 'PAGO' ? '#dcfce7' : '#fef3c7', color: it.status === 'PAGO' ? '#166534' : '#92400e' }}>{it.status}</span>
                        <span style={{ ...num, fontSize: 12.5, color: C.red, fontWeight: 600 }}>{fmt(it.value)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
