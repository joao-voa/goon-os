'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface Layers { impostos: number; custoOperacao: number; distribuicao: number; pessoalGiu: number }
interface MonthData { month: number; year: number; entradas: { total: number }; layers: Layers }
interface Totals { entradas: number; impostos: number; custoOperacao: number; distribuicao: number; pessoalGiu: number }
interface CashflowData { year: number; months: MonthData[]; totals: Totals }
interface Mentor { mentorName: string; client: string; product?: string; monthlyBreakdown: Record<string, number>; inCarteira?: boolean }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtK = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace('.', ',')}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', neon: '#C7F900', green: '#16a34a', greenDk: '#15803d', red: '#dc2626', slate: '#475569', bg: '#f8fafc' }
const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }

const RATEIO_YEAR = 2026, RATEIO_MONTH = 8, RATEIO_DAY = 8
function isCusto(cat: string, desc: string): boolean {
  if (cat === 'IMPOSTOS' || cat === 'MENTORIA') return false
  if (cat === 'PESSOAL' && /giulliano/i.test(desc)) return false
  return true
}

interface Cfg { name: string; regex: RegExp; custoPre: number; custoPost: number; personal: string | null; subtitle: string }
const CONFIG: Record<string, Cfg> = {
  giulliano: { name: 'Giulliano', regex: /giulliano/i, custoPre: 1, custoPost: 0.5, personal: 'Giulliano', subtitle: 'Seu repasse, menos sua parte das despesas comuns, menos seus gastos pessoais.' },
  carol: { name: 'Carol', regex: /carol/i, custoPre: 0, custoPost: 0.5, personal: null, subtitle: 'Seu repasse, menos sua parte das despesas comuns (a partir de 08/08).' },
  joao: { name: 'João', regex: /jo[aã]o/i, custoPre: 0, custoPost: 0, personal: null, subtitle: 'Seu repasse da operação (10% dos clientes novos, sem despesas).' },
}

export default function PartnerCashflow({ partnerKey }: { partnerKey: 'giulliano' | 'carol' | 'joao' }) {
  const cfg = CONFIG[partnerKey]
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

  // Agosto/2026: custo comum dividido por dia (antes vs a partir do 08)
  useEffect(() => {
    if (year !== RATEIO_YEAR) { setAugSplit(null); return }
    (async () => {
      try {
        const exps = await apiFetch<any>(`/api/expenses?month=${RATEIO_MONTH}&year=${year}&limit=400`)
        const arr = (Array.isArray(exps) ? exps : exps.data ?? []) as Array<{ dueDate: string; value: number; category: string; description: string }>
        let pre = 0, pos = 0
        for (const e of arr) {
          if (!isCusto(e.category ?? 'OUTRO', e.description ?? '')) continue
          const day = new Date(e.dueDate).getUTCDate()
          if (day < RATEIO_DAY) pre += Number(e.value); else pos += Number(e.value)
        }
        setAugSplit({ pre, pos })
      } catch { setAugSplit(null) }
    })()
  }, [year])

  async function loadItems(month: number) {
    if (!cfg.personal || items[month]) return
    try {
      const exps = await apiFetch<any>(`/api/expenses?month=${month}&year=${year}&limit=400`)
      const arr = (Array.isArray(exps) ? exps : exps.data ?? []) as Array<{ description: string; value: number; status: string; category: string }>
      const rx = new RegExp(cfg.personal!, 'i')
      const pessoal = arr.filter(e => e.category === 'PESSOAL' && rx.test(e.description ?? ''))
        .map(e => ({ description: (e.description ?? '').replace(new RegExp(`\\s*-\\s*${cfg.personal}\\s*$`, 'i'), ''), value: Number(e.value), status: e.status }))
        .sort((a, b) => b.value - a.value)
      setItems(prev => ({ ...prev, [month]: pessoal }))
    } catch { /* ignore */ }
  }

  if (!data) return <div style={{ padding: 24, color: C.mid }}>Carregando…</div>

  // Fator do custo comum por mês, respeitando o corte 08/08/2026
  const custoShare = (m: MonthData): number => {
    const custo = m.layers.custoOperacao
    if (year < RATEIO_YEAR) return custo * cfg.custoPre
    if (year > RATEIO_YEAR) return custo * cfg.custoPost
    if (m.month < RATEIO_MONTH) return custo * cfg.custoPre
    if (m.month > RATEIO_MONTH) return custo * cfg.custoPost
    return augSplit ? augSplit.pre * cfg.custoPre + augSplit.pos * cfg.custoPost : custo * cfg.custoPost
  }
  const personalMes = (m: MonthData): number => cfg.personal === 'Giulliano' ? m.layers.pessoalGiu : 0

  // Repasse (fatia de receita) por mês — exclui carteira/churn
  const repasseByMonth: Record<number, number> = {}
  for (const mt of (mentors ?? [])) {
    if (!cfg.regex.test(mt.mentorName) || mt.inCarteira) continue
    for (const [key, val] of Object.entries(mt.monthlyBreakdown)) {
      const [y, mo] = key.split('-')
      if (parseInt(y) !== year) continue
      repasseByMonth[parseInt(mo)] = (repasseByMonth[parseInt(mo)] ?? 0) + val
    }
  }
  const rendaMes = (m: MonthData) => (repasseByMonth[m.month] ?? 0) - custoShare(m)
  const saldoMes = (m: MonthData) => rendaMes(m) - personalMes(m)

  const repasseAno = Object.values(repasseByMonth).reduce((s, v) => s + v, 0)
  const custoShareAno = data.months.reduce((s, m) => s + custoShare(m), 0)
  const rendaAno = repasseAno - custoShareAno
  const gastosAno = cfg.personal === 'Giulliano' ? data.totals.pessoalGiu : 0
  const sobraAno = rendaAno - gastosAno

  const custoHint = cfg.custoPre === cfg.custoPost
    ? (cfg.custoPost === 0 ? 'Não participa das despesas comuns' : `${cfg.custoPost * 100}% do custo da operação`)
    : (year < RATEIO_YEAR ? `${cfg.custoPre * 100}% do custo (antes do rateio 08/08)`
      : year > RATEIO_YEAR ? `${cfg.custoPost * 100}% do custo (rateio)`
      : `${cfg.custoPre * 100}% até 07/08, ${cfg.custoPost * 100}% de 08/08 em diante`)

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }

  const statementRows = [
    { l: 'Repasse (sua fatia da receita)', v: repasseAno, hint: 'Da aba Repasses — exclui carteira', kind: 'base' },
    { l: 'Sua parte das despesas comuns', v: -custoShareAno, hint: custoHint, kind: 'out' },
    { l: 'Renda da operação', v: rendaAno, hint: 'O que sobra pra você da empresa', kind: 'sub' },
    ...(cfg.personal ? [{ l: 'Gastos pessoais', v: -gastosAno, hint: 'Cartão, aluguel, luz…', kind: 'out' as const }] : []),
    { l: 'Sobra pra você', v: sobraAno, hint: 'Depois de tudo', kind: 'result' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Fluxo de Caixa · {cfg.name}</h1>
          <p style={{ margin: '2px 0 0', color: C.mid, fontSize: 13 }}>{cfg.subtitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${C.line}`, borderRadius: 100, padding: 4 }}>
          <button onClick={() => setYear(y => y - 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.mid, padding: '2px 8px', fontSize: 14 }}>‹</button>
          <span style={{ ...num, fontWeight: 700, minWidth: 42, textAlign: 'center', fontSize: 14 }}>{year}</span>
          <button onClick={() => setYear(y => y + 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.mid, padding: '2px 8px', fontSize: 14 }}>›</button>
        </div>
      </div>

      {/* Statement */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Seu resultado em {year}</div>
        {statementRows.map((r, i) => (
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

      {/* Gráfico mensal — entrada (repasse) × saída (custo + pessoal) */}
      <div style={{ ...card, padding: '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Entrada × Saída por mês</span>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.mid, flexWrap: 'wrap' }}>
            <span><i style={{ display: 'inline-block', width: 9, height: 9, background: C.green, borderRadius: 2, marginRight: 5 }} />Repasse</span>
            <span><i style={{ display: 'inline-block', width: 9, height: 9, background: C.slate, borderRadius: 2, marginRight: 5 }} />Despesas comuns</span>
            {cfg.personal && <span><i style={{ display: 'inline-block', width: 9, height: 9, background: C.red, borderRadius: 2, marginRight: 5 }} />Pessoal</span>}
          </div>
        </div>
        {(() => {
          const barMax = Math.max(...data.months.map(m => Math.max(repasseByMonth[m.month] ?? 0, custoShare(m) + personalMes(m))), 1)
          return (
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', minHeight: 170, overflowX: 'auto', paddingBottom: 4 }}>
              {data.months.map(m => {
                const rep = repasseByMonth[m.month] ?? 0
                const cs = custoShare(m), pe = personalMes(m)
                const repH = (rep / barMax) * 140
                const csH = (cs / barMax) * 140
                const peH = (pe / barMax) * 140
                const isCur = m.month === new Date().getMonth() + 1 && year === new Date().getFullYear()
                return (
                  <button key={m.month} onClick={() => { const nx = openMonth === m.month ? null : m.month; setOpenMonth(nx); if (nx) loadItems(m.month) }} title={`Repasse ${fmt(rep)} · Despesas comuns ${fmt(cs)}${cfg.personal ? ` · Pessoal ${fmt(pe)}` : ''} · Sobra ${fmt(rep - cs - pe)}`} style={{ flex: 1, minWidth: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0', borderRadius: 6 }}>
                    <span style={{ ...num, fontSize: 9.5, fontWeight: 700, color: rep > 0 ? C.greenDk : 'transparent', minHeight: 12 }}>{rep > 0 ? fmtK(rep) : ''}</span>
                    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 145 }}>
                      <div style={{ width: 14, height: Math.max(repH, rep > 0 ? 2 : 0), background: C.green, borderRadius: '3px 3px 0 0' }} />
                      <div style={{ display: 'flex', flexDirection: 'column-reverse', height: 145, justifyContent: 'flex-start' }}>
                        <div style={{ width: 14, height: Math.max(csH, cs > 0 ? 2 : 0), background: C.slate, borderRadius: pe > 0 ? 0 : '3px 3px 0 0' }} />
                        {cfg.personal && <div style={{ width: 14, height: Math.max(peH, pe > 0 ? 2 : 0), background: C.red, borderRadius: '3px 3px 0 0' }} />}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: isCur ? 800 : 600, color: isCur ? C.ink : C.dim, textTransform: 'uppercase' }}>{MONTH_NAMES[m.month - 1]}</span>
                  </button>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Meses — explode em Entradas e Saídas */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Mês a mês <span style={{ color: C.dim, fontSize: 12, fontWeight: 400 }}>— clique para abrir entradas e saídas</span></div>
        {data.months.map(m => {
          const rep = repasseByMonth[m.month] ?? 0
          const cs = custoShare(m), pe = personalMes(m)
          const saldo = rep - cs - pe
          const has = rep !== 0 || cs > 0 || pe > 0
          const open = openMonth === m.month
          return (
            <div key={m.month} style={{ borderTop: `1px solid ${C.bg}`, opacity: has ? 1 : 0.5 }}>
              <button onClick={() => { const nx = open ? null : m.month; setOpenMonth(nx); if (nx) loadItems(m.month) }} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px',
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.slate, minWidth: 90 }}>{MONTH_FULL[m.month - 1]}</span>
                <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span style={{ ...num, fontSize: 12, color: C.green }} title="Entrada (repasse)">+{fmt(rep)}</span>
                  <span style={{ ...num, fontSize: 12, color: C.red }} title="Saídas">−{fmt(cs + pe)}</span>
                  <span style={{ ...num, fontSize: 13, fontWeight: 800, color: saldo >= 0 ? C.greenDk : C.red, minWidth: 84, textAlign: 'right' }}>{fmt(saldo)}</span>
                  <span style={{ color: C.dim, fontSize: 12 }}>{open ? '▲' : '▼'}</span>
                </div>
              </button>
              {open && (
                <div style={{ padding: '2px 20px 14px' }}>
                  {/* ENTRADA — repasse total + detalhe cliente a cliente */}
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.greenDk, fontWeight: 700, margin: '4px 0 2px' }}>Entrada</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.bg}` }}>
                    <span style={{ fontSize: 13, color: C.ink, fontWeight: 700 }}>Repasse da operação <span style={{ color: C.dim, fontSize: 11, fontWeight: 400 }}>(total do mês)</span></span>
                    <span style={{ ...num, fontSize: 13, color: C.greenDk, fontWeight: 700 }}>{fmt(rep)}</span>
                  </div>
                  {(() => {
                    const monthKey = `${year}-${String(m.month).padStart(2, '0')}`
                    const detalhe = (mentors ?? [])
                      .filter(mt => cfg.regex.test(mt.mentorName) && !mt.inCarteira && (mt.monthlyBreakdown[monthKey] ?? 0) !== 0)
                      .map(mt => ({ client: mt.client, product: mt.product, value: mt.monthlyBreakdown[monthKey] }))
                      .sort((a, b) => b.value - a.value)
                    if (detalhe.length === 0) return null
                    return detalhe.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0 5px 16px', borderBottom: `1px solid ${C.bg}` }}>
                        <span style={{ fontSize: 12, color: C.mid }}>{d.client}{d.product ? <span style={{ color: C.dim }}> · {d.product}</span> : null}</span>
                        <span style={{ ...num, fontSize: 12, color: C.greenDk }}>{fmt(d.value)}</span>
                      </div>
                    ))
                  })()}
                  {/* SAÍDAS — detalhadas */}
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.red, fontWeight: 700, margin: '12px 0 2px' }}>Saídas</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.bg}` }}>
                    <span style={{ fontSize: 13, color: C.ink }}>Sua parte das despesas comuns</span>
                    <span style={{ ...num, fontSize: 13, color: C.red, fontWeight: 600 }}>{cs > 0 ? '−' : ''}{fmt(cs)}</span>
                  </div>
                  {cfg.personal && <>
                    {!items[m.month] && <div style={{ color: C.dim, fontSize: 12, padding: '6px 0' }}>Carregando gastos pessoais…</div>}
                    {items[m.month]?.length === 0 && <div style={{ color: C.dim, fontSize: 12, padding: '6px 0' }}>Sem gastos pessoais neste mês.</div>}
                    {items[m.month]?.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: `1px solid ${C.bg}` }}>
                        <span style={{ fontSize: 12.5, color: C.mid }}>{it.description}</span>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 9, padding: '1px 7px', borderRadius: 100, background: it.status === 'PAGO' ? '#dcfce7' : '#fef3c7', color: it.status === 'PAGO' ? '#166534' : '#92400e' }}>{it.status}</span>
                          <span style={{ ...num, fontSize: 12.5, color: C.red, fontWeight: 600 }}>−{fmt(it.value)}</span>
                        </span>
                      </div>
                    ))}
                  </>}
                  {/* Sobra */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', marginTop: 4, borderTop: `1px solid ${C.line}` }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>Sobra do mês</span>
                    <span style={{ ...num, fontSize: 14, fontWeight: 800, color: saldo >= 0 ? C.greenDk : C.red }}>{fmt(saldo)}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
