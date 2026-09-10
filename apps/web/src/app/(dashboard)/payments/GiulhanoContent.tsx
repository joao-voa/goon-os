'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface Layers { impostos: number; custoOperacao: number; distribuicao: number; pessoalGiu: number }
interface MonthData { month: number; year: number; entradas: { total: number }; layers: Layers }
interface Totals { entradas: number; impostos: number; custoOperacao: number; distribuicao: number; pessoalGiu: number }
interface CashflowData { year: number; months: MonthData[]; totals: Totals }
interface Mentor { mentorName: string; monthlyBreakdown: Record<string, number>; inCarteira?: boolean }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', neon: '#C7F900', green: '#16a34a', greenDk: '#15803d', red: '#dc2626', slate: '#475569', bg: '#f8fafc' }
const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }

// Rateio 50/50 só a partir de 08/08/2026. Antes, custo é 100% do Giulliano.
const RATEIO_YEAR = 2026, RATEIO_MONTH = 8, RATEIO_DAY = 8
function layerCusto(cat: string, desc: string): boolean {
  if (cat === 'IMPOSTOS' || cat === 'MENTORIA') return false
  if (cat === 'PESSOAL' && /giulliano/i.test(desc)) return false
  return true
}

export default function GiulhanoContent() {
  const [data, setData] = useState<CashflowData | null>(null)
  const [mentors, setMentors] = useState<Mentor[] | null>(null)
  const [augSplit, setAugSplit] = useState<{ pre: number; pos: number } | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [openMonth, setOpenMonth] = useState<number | null>(null)
  const [items, setItems] = useState<Record<number, Array<{ description: string; value: number; status: string }>>>({})

  const load = useCallback(async () => {
    const [cf, mt] = await Promise.all([
      apiFetch<CashflowData>(`/api/cashflow?year=${year}`),
      apiFetch<Mentor[]>('/api/mentors').catch(() => [] as Mentor[]),
    ])
    setData(cf); setMentors(mt)
  }, [year])
  useEffect(() => { load() }, [load])

  // Agosto/2026: divide o custo por dia (antes vs a partir do 08)
  useEffect(() => {
    if (year !== RATEIO_YEAR) { setAugSplit(null); return }
    (async () => {
      try {
        const exps = await apiFetch<any>(`/api/expenses?month=${RATEIO_MONTH}&year=${year}&limit=400`)
        const arr = (Array.isArray(exps) ? exps : exps.data ?? []) as Array<{ dueDate: string; value: number; category: string; description: string }>
        let pre = 0, pos = 0
        for (const e of arr) {
          if (!layerCusto(e.category ?? 'OUTRO', e.description ?? '')) continue
          const day = new Date(e.dueDate).getUTCDate()
          if (day < RATEIO_DAY) pre += Number(e.value); else pos += Number(e.value)
        }
        setAugSplit({ pre, pos })
      } catch { setAugSplit(null) }
    })()
  }, [year])

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

  // Parte do Giu no custo da operação, respeitando o corte de 08/08/2026
  const custoShare = (m: MonthData): number => {
    const custo = m.layers.custoOperacao
    if (year < RATEIO_YEAR) return custo              // tudo antes do corte: 100%
    if (year > RATEIO_YEAR) return custo / 2           // tudo depois: 50%
    if (m.month < RATEIO_MONTH) return custo           // Jan–Jul/2026: 100%
    if (m.month > RATEIO_MONTH) return custo / 2        // Set–Dez/2026: 50%
    return augSplit ? augSplit.pre + augSplit.pos / 2 : custo // Agosto: por dia
  }

  // Repasse do Giulliano por mês (fatia de receita — exclui carteira/churn)
  const repasseByMonth: Record<number, number> = {}
  for (const m of (mentors ?? [])) {
    if (!/giulliano/i.test(m.mentorName) || m.inCarteira) continue
    for (const [key, val] of Object.entries(m.monthlyBreakdown)) {
      const [y, mo] = key.split('-')
      if (parseInt(y) !== year) continue
      repasseByMonth[parseInt(mo)] = (repasseByMonth[parseInt(mo)] ?? 0) + val
    }
  }
  const rendaMes = (m: MonthData) => (repasseByMonth[m.month] ?? 0) - custoShare(m)

  const repasseAno = Object.values(repasseByMonth).reduce((s, v) => s + v, 0)
  const custoShareAno = data.months.reduce((s, m) => s + custoShare(m), 0)
  const rendaAno = repasseAno - custoShareAno
  const gastosAno = data.totals.pessoalGiu
  const sobraAno = rendaAno - gastosAno

  const custoHint = year < RATEIO_YEAR ? '100% do custo (antes do rateio 08/08)'
    : year > RATEIO_YEAR ? '50% do custo (rateio com a Carol)'
    : '100% até 07/08, 50% de 08/08 em diante'

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Fluxo de Caixa · Giulliano</h1>
          <p style={{ margin: '2px 0 0', color: C.mid, fontSize: 13 }}>Seu repasse, menos sua parte das despesas comuns, menos seus gastos pessoais.</p>
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
          { l: 'Repasse (sua fatia da receita)', v: repasseAno, hint: 'Da aba Repasses — exclui carteira', kind: 'base' },
          { l: 'Sua parte das despesas comuns', v: -custoShareAno, hint: custoHint, kind: 'out' },
          { l: 'Renda da operação', v: rendaAno, hint: 'O que sobra pra você da empresa', kind: 'sub' },
          { l: 'Gastos pessoais', v: -gastosAno, hint: 'Cartão, aluguel, luz, Edu Caduro…', kind: 'out' },
          { l: 'Sobra pra você', v: sobraAno, hint: 'Depois de tudo', kind: 'result' },
        ].map((r, i) => (
          <div key={r.l} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
            padding: r.kind === 'result' ? '16px 22px' : '12px 22px',
            background: r.kind === 'result' ? (sobraAno >= 0 ? 'rgba(199,249,0,0.10)' : 'rgba(220,38,38,0.05)') : 'transparent',
            borderTop: (i > 0 && (r.kind === 'sub' || r.kind === 'result' || r.kind === 'base')) ? `1px solid ${C.line}` : i > 0 ? `1px solid ${C.bg}` : 'none',
          }}>
            <div>
              <div style={{ fontSize: r.kind === 'result' ? 16 : 14, fontWeight: r.kind === 'out' ? 500 : 700, color: r.kind === 'out' ? C.mid : C.ink }}>{r.l}</div>
              <div style={{ fontSize: 11, color: C.dim }}>{r.hint}</div>
            </div>
            <span style={{ ...num, fontSize: r.kind === 'result' ? 22 : 15, fontWeight: r.kind === 'out' ? 600 : 800, color: r.kind === 'result' ? (sobraAno >= 0 ? C.greenDk : C.red) : r.kind === 'out' ? C.red : C.ink }}>{r.v < 0 ? '−' : ''}{fmt(Math.abs(r.v))}</span>
          </div>
        ))}
      </div>

      {/* Meses */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Mês a mês <span style={{ color: C.dim, fontSize: 12, fontWeight: 400 }}>— renda − gastos pessoais</span></div>
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
                <span style={{ fontWeight: 700, fontSize: 13, color: C.slate, minWidth: 90 }}>{MONTH_FULL[m.month - 1]}</span>
                <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span style={{ ...num, fontSize: 12, color: C.green }} title="Repasse − sua parte do custo">+{fmt(renda)}</span>
                  <span style={{ ...num, fontSize: 12, color: C.red }} title="Gastos pessoais">−{fmt(gasto)}</span>
                  <span style={{ ...num, fontSize: 13, fontWeight: 800, color: (renda - gasto) >= 0 ? C.greenDk : C.red, minWidth: 84, textAlign: 'right' }}>{fmt(renda - gasto)}</span>
                  <span style={{ color: C.dim, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
                </div>
              </button>
              {open && (
                <div style={{ padding: '2px 20px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: C.mid }}>
                    <span>Repasse da operação</span><span style={{ ...num }}>{fmt(repasseByMonth[m.month] ?? 0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: C.mid, borderBottom: `1px solid ${C.bg}`, marginBottom: 6 }}>
                    <span>− Sua parte das despesas comuns</span><span style={{ ...num }}>−{fmt(custoShare(m))}</span>
                  </div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.dim, fontWeight: 600, margin: '6px 0' }}>Gastos pessoais</div>
                  {!items[m.month] && <div style={{ color: C.dim, fontSize: 12, padding: '4px 0' }}>Carregando…</div>}
                  {items[m.month]?.length === 0 && <div style={{ color: C.dim, fontSize: 12, padding: '4px 0' }}>Sem gastos pessoais neste mês.</div>}
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
