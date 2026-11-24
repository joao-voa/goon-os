'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

// Caixa: saldo dia a dia (realizado até hoje, projetado depois), entradas e
// saídas por dia e projeção dos próximos meses com necessidade de vendas e
// folga para investir. O saldo do banco é informado à mão e ancora tudo.

type Item = { date: string; kind: 'in' | 'out'; realized: boolean; name: string; detail: string; value: number; category: string; late?: boolean }
type View = {
  from: string; to: string; today: string
  balance: { date: string; value: number; note: string | null; at: string } | null
  items: Item[]
  overdueIn: { total: number; items: Array<{ date: string; name: string; detail: string; value: number }> }
}
type Stats = { salesLast6: number; avgTicket: number; avgCashPerSale: number; avgSalesPerMonth: number; avgMonthlyCost: number }

const C = {
  ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc', grid: '#eef2f6',
  green: '#0d9488', red: '#dc2626', amber: '#d97706', neon: '#C7F900',
}
const sans = 'var(--font-sans)'
const num: React.CSSProperties = { fontFamily: sans, fontVariantNumeric: 'tabular-nums' }
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MSHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const k = (v: number) => { const a = Math.abs(v); const s = v < 0 ? '−' : ''; return a >= 1e6 ? `${s}${(a / 1e6).toFixed(1).replace('.', ',')}M` : a >= 1000 ? `${s}${Math.round(a / 1000)}k` : `${s}${Math.round(a)}` }
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (s: string, n: number) => iso(new Date(Date.parse(`${s}T00:00:00Z`) + n * 864e5))
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
const lsGet = (key: string) => { try { return localStorage.getItem(key) } catch { return null } }
const lsSet = (key: string, v: string) => { try { localStorage.setItem(key, v) } catch { /* sem storage */ } }

/** Saldo no fim de cada dia, ancorado no saldo informado (para frente soma, para trás desconta). */
function balanceSeries(days: string[], items: Item[], anchor: { date: string; value: number }) {
  const net = new Map<string, number>()
  for (const it of items) net.set(it.date, (net.get(it.date) ?? 0) + (it.kind === 'in' ? it.value : -it.value))
  const all = [...new Set([...net.keys(), ...days, anchor.date])].sort()
  const out = new Map<string, number>()
  const ai = all.indexOf(anchor.date)
  let b = anchor.value
  out.set(anchor.date, b)
  for (let i = ai + 1; i < all.length; i++) { b += net.get(all[i]) ?? 0; out.set(all[i], b) }
  b = anchor.value
  for (let i = ai - 1; i >= 0; i--) { b -= net.get(all[i + 1]) ?? 0; out.set(all[i], b) }
  return days.map(d => out.get(d) ?? 0)
}

type Sim = { id: string; date: string; entrada: number; parcelas: number; valor: number }
type Horizon = 'mes' | 30 | 60 | 90 | 120 | 365
const HORIZONS: Array<[Horizon, string]> = [['mes', 'Mês'], [30, '30 dias'], [60, '60'], [90, '90'], [120, '120'], [365, 'Ano']]
const overdueKey = (o: { date: string; name: string; detail: string; value: number }) => `${o.date}|${o.name}|${o.detail}|${o.value}`
const addMonths = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`)
  const day = d.getUTCDate()
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
  return iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(day, last))))
}

/** Vendas simuladas viram itens de caixa: entrada no dia da venda, parcelas mês a mês depois (com imposto 6% se ligado). */
function simItems(sims: Sim[], withTax: boolean): Item[] {
  const out: Item[] = []
  sims.forEach((v, n) => {
    const name = `Venda simulada ${n + 1}`
    const push = (date: string, value: number, detail: string) => {
      if (value <= 0) return
      out.push({ date, kind: 'in', realized: false, name, detail, value, category: 'SIMULACAO' })
      if (withTax) out.push({ date, kind: 'out', realized: false, name: `Imposto 6% · ${name}`, detail, value: Math.round(value * 6) / 100, category: 'IMPOSTOS' })
    }
    push(v.date, v.entrada, 'entrada')
    for (let i = 1; i <= v.parcelas; i++) push(addMonths(v.date, i), v.valor, `parcela ${i}/${v.parcelas}`)
  })
  return out
}

export default function CashView() {
  const now = new Date()
  const todayLocal = iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [horizon, setHorizon] = useState<Horizon>(() => { const v = lsGet('goon.caixa.horizonte'); return v === 'mes' || !v ? 'mes' : (Number(v) as Horizon) })
  const [view, setView] = useState<View | null>(null)
  const [proj, setProj] = useState<View | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [includeLate, setIncludeLate] = useState(true)
  const [noTax, setNoTax] = useState(() => lsGet('goon.caixa.semImposto') === '1')
  const [overdueSel, setOverdueSel] = useState<string[]>([])
  const [overdueOpen, setOverdueOpen] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [selDay, setSelDay] = useState<string | null>(null)
  const [showLate, setShowLate] = useState(false)
  const [editBal, setEditBal] = useState(false)
  const [balInput, setBalInput] = useState('')
  const [cushion, setCushion] = useState<number | null>(null)
  const [sims, setSims] = useState<Sim[]>(() => { try { return JSON.parse(lsGet('goon.caixa.simulacoes') ?? '[]') as Sim[] } catch { return [] } })
  const [simInvest, setSimInvest] = useState(0)
  useEffect(() => { lsSet('goon.caixa.simulacoes', JSON.stringify(sims)) }, [sims])

  const rangeStart = horizon === 'mes' ? iso(new Date(Date.UTC(ym.y, ym.m, 1))) : todayLocal
  const rangeEnd = horizon === 'mes' ? iso(new Date(Date.UTC(ym.y, ym.m + 1, 0))) : addDays(todayLocal, horizon - 1)

  const load = useCallback(async () => {
    try {
      let v = await apiFetch<View>(`/api/cashflow/view?from=${rangeStart}&to=${rangeEnd}`)
      const b = v.balance
      // saldo informado fora do período: busca o intervalo até ele para levar o saldo até aqui
      if (b && (b.date < rangeStart || b.date > rangeEnd)) {
        const from = b.date < rangeStart ? b.date : rangeStart
        const to = b.date > rangeEnd ? b.date : rangeEnd
        v = await apiFetch<View>(`/api/cashflow/view?from=${from}&to=${to}`)
      }
      setView(v)
      const pFrom = b && b.date < v.today ? b.date : v.today
      const t = new Date(`${v.today}T00:00:00Z`)
      const pTo = iso(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 12, 0)))
      setProj(await apiFetch<View>(`/api/cashflow/view?from=${pFrom}&to=${pTo}`))
    } catch { toast.error('Erro ao carregar o caixa') }
  }, [rangeStart, rangeEnd])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    apiFetch<Stats>('/api/cashflow/stats').then(st => {
      setStats(st)
      const saved = Number(lsGet('goon.caixa.colchao'))
      setCushion(Number.isFinite(saved) && saved > 0 ? saved : st.avgMonthlyCost)
    }).catch(() => {})
  }, [])

  // filtros comuns: contas vencidas, impostos, parcelas atrasadas escolhidas, vendas simuladas
  const prepare = useCallback((v: View) => {
    let items = v.items.filter(i => (includeLate || !i.late) && (!noTax || i.category !== 'IMPOSTOS'))
    const chosen = v.overdueIn.items.filter(o => overdueSel.includes(overdueKey(o)))
    items = [...items, ...chosen.map(o => ({ date: v.today, kind: 'in' as const, realized: false, name: o.name, detail: `atrasada desde ${ddmm(o.date)}`, value: o.value, category: 'RECEITA', late: true }))]
    return [...items, ...simItems(sims, !noTax)]
  }, [includeLate, noTax, overdueSel, sims])

  // ===== período (mês ou N dias) =====
  const period = useMemo(() => {
    if (!view) return null
    const days: string[] = []
    for (let d = rangeStart; d <= rangeEnd; d = addDays(d, 1)) days.push(d)
    const items = prepare(view)
    const anchor = view.balance ? { date: view.balance.date, value: view.balance.value } : { date: addDays(rangeStart, -1), value: 0 }
    const bal = balanceSeries(days, items, anchor)
    const inRange = items.filter(i => i.date >= rangeStart && i.date <= rangeEnd)
    const byDay = new Map<string, { inn: number; out: number }>()
    for (const i of inRange) { const x = byDay.get(i.date) ?? { inn: 0, out: 0 }; if (i.kind === 'in') x.inn += i.value; else x.out += i.value; byDay.set(i.date, x) }
    const perDay = days.map(d => ({ d, ...(byDay.get(d) ?? { inn: 0, out: 0 }) }))
    const sum = (kind: 'in' | 'out', realized: boolean) => inRange.filter(i => i.kind === kind && i.realized === realized).reduce((acc, i) => acc + i.value, 0)
    const futureIdx = days.map((d, i) => ({ d, i })).filter(x => x.d >= view.today)
    const scope = futureIdx.length ? futureIdx : days.map((d, i) => ({ d, i }))
    const minI = scope.reduce((m, x) => (bal[x.i] < bal[m.i] ? x : m), scope[0])
    const todayIdx = days.indexOf(view.today)
    const lateAll = view.items.filter(i => i.late)
    return {
      days, bal, perDay, inRange,
      received: sum('in', true), toReceive: sum('in', false), paid: sum('out', true), toPay: sum('out', false),
      end: bal[bal.length - 1], min: { value: bal[minI.i], day: minI.d },
      todayBal: todayIdx >= 0 ? bal[todayIdx] : null,
      lateOut: lateAll.reduce((acc, i) => acc + i.value, 0), lateOutCount: lateAll.length,
      hasAnchor: !!view.balance,
    }
  }, [view, rangeStart, rangeEnd, prepare])

  // ===== projeção (12 meses a partir do mês atual) =====
  const projection = useMemo(() => {
    if (!proj || !stats || cushion == null) return null
    const items = prepare(proj)
    const start = proj.balance ? (proj.balance.date < proj.today ? proj.balance.date : proj.today) : addDays(proj.today, -1)
    let bal = proj.balance?.value ?? 0
    const t = new Date(`${proj.today}T00:00:00Z`)
    const rows: Array<{ key: string; label: string; inn: number; out: number; sim: number; end: number; need: number; needSales: number }> = []
    for (let i = 0; i < 12; i++) {
      const d0 = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + i, 1)), key = iso(d0).slice(0, 7)
      const its = items.filter(x => x.date.slice(0, 7) === key && x.date > start)
      const isSim = (x: Item) => x.category === 'SIMULACAO' || x.name.includes('Venda simulada')
      const inn = its.filter(x => x.kind === 'in' && !isSim(x)).reduce((acc, x) => acc + x.value, 0)
      const out = its.filter(x => x.kind === 'out' && !isSim(x)).reduce((acc, x) => acc + x.value, 0)
      const sim = its.filter(isSim).reduce((acc, x) => acc + (x.kind === 'in' ? x.value : -x.value), 0) - simInvest
      bal += inn - out + sim
      // falta vender: o que precisa entrar a mais para o saldo não ficar abaixo do colchão
      const need = Math.max(0, cushion - bal)
      if (need > 0) bal += need
      rows.push({ key, label: `${MSHORT[d0.getUTCMonth()]}/${String(d0.getUTCFullYear()).slice(2)}`, inn, out, sim, end: bal - need, need, needSales: stats.avgCashPerSale > 0 ? Math.ceil(need / stats.avgCashPerSale) : 0 })
    }
    const totalNeed = rows.reduce((acc, r) => acc + r.need, 0)
    const minEnd = Math.min(...rows.map(r => r.end))
    return { rows, totalNeed, canInvest: Math.max(0, minEnd - cushion) }
  }, [proj, stats, cushion, prepare, simInvest])

  async function saveBalance() {
    const v = Number(balInput.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
    if (!Number.isFinite(v)) { toast.error('Valor inválido'); return }
    try {
      await apiFetch('/api/cashflow/balance', { method: 'POST', body: JSON.stringify({ value: v }) })
      setEditBal(false); setBalInput('')
      toast.success('Saldo atualizado')
      load()
    } catch { toast.error('Erro ao salvar o saldo') }
  }

  if (!view || !period) return <div style={{ padding: 24, color: C.mid, fontFamily: sans }}>Carregando o caixa…</div>

  const hasToday = view.today >= rangeStart && view.today <= rangeEnd
  const dayItems = (d: string) => period.inRange.filter(i => i.date === d)
  const listDays = selDay ? [selDay] : period.days.filter(d => d >= (hasToday ? view.today : rangeStart)).slice(0, hasToday ? 7 : 31)
  const periodLabel = horizon === 'mes' ? MONTHS[ym.m].toLowerCase() : `${ddmm(rangeStart)} a ${ddmm(rangeEnd)}`
  const overdueChosenTotal = view.overdueIn.items.filter(o => overdueSel.includes(overdueKey(o))).reduce((acc, o) => acc + o.value, 0)
  const setH = (h: Horizon) => { setHorizon(h); setSelDay(null); lsSet('goon.caixa.horizonte', String(h)) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: sans, color: C.ink }}>
      {/* cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Caixa</h1>
          <p style={{ margin: '2px 0 0', color: C.mid, fontSize: 13 }}>Saldo dia a dia: realizado até hoje, projetado daqui para frente.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 2, border: `1px solid ${C.line}`, borderRadius: 100, padding: 3, background: '#fff' }}>
            {HORIZONS.map(([h, l]) => (
              <button key={String(h)} onClick={() => setH(h)} style={{ padding: '5px 11px', border: 'none', borderRadius: 100, cursor: 'pointer', fontFamily: sans, fontSize: 12, fontWeight: 600, background: horizon === h ? C.ink : 'transparent', color: horizon === h ? '#fff' : C.mid }}>{l}</button>
            ))}
          </div>
          {horizon === 'mes' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${C.line}`, borderRadius: 100, padding: 3, background: '#fff' }}>
              <button onClick={() => { setSelDay(null); setYm(p => (p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 })) }} style={navBtn}>‹</button>
              <span style={{ fontSize: 14, fontWeight: 700, minWidth: 140, textAlign: 'center' }}>{MONTHS[ym.m]} {ym.y}</span>
              <button onClick={() => { setSelDay(null); setYm(p => (p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 })) }} style={navBtn}>›</button>
            </div>
          )}
          <button onClick={() => { const v = !noTax; setNoTax(v); lsSet('goon.caixa.semImposto', v ? '1' : '0') }}
            style={{ ...btn, borderRadius: 100, background: noTax ? C.ink : '#fff', color: noTax ? '#fff' : C.ink }}>
            {noTax ? '✓ Sem impostos' : 'Sem impostos'}
          </button>
        </div>
      </div>

      {/* saldo informado */}
      <div style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderLeft: `4px solid ${period.hasAnchor ? C.neon : C.amber}` }}>
        {editBal ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Saldo no banco hoje:</span>
            <input autoFocus value={balInput} onChange={e => setBalInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveBalance()} placeholder="Ex.: 85.300,00" inputMode="decimal"
              style={{ padding: '7px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontSize: 14, width: 160, ...num }} />
            <button onClick={saveBalance} style={{ ...btn, background: C.ink, color: '#fff', border: 'none' }}>Salvar</button>
            <button onClick={() => setEditBal(false)} style={btn}>Cancelar</button>
          </>
        ) : view.balance ? (
          <>
            <span style={{ fontSize: 13, color: C.mid }}>Saldo informado: <strong style={{ color: C.ink, ...num }}>{brl(view.balance.value)}</strong> em {ddmm(view.balance.date)}</span>
            <button onClick={() => setEditBal(true)} style={btn}>Atualizar saldo</button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 13 }}><strong>Informe o saldo do banco</strong> <span style={{ color: C.mid }}>para o sistema calcular o saldo de cada dia. Sem ele, a curva parte de zero.</span></span>
            <button onClick={() => setEditBal(true)} style={{ ...btn, background: C.neon, border: 'none', fontWeight: 700 }}>Informar saldo</button>
          </>
        )}
      </div>

      {/* números do período */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        {hasToday && period.todayBal != null && <Tile label="Saldo hoje" value={brl(period.todayBal)} sub={period.hasAnchor ? 'com o que entrou e saiu desde o saldo informado' : 'sem saldo informado'} />}
        <Tile label={horizon === 'mes' ? `Saldo no fim de ${periodLabel}` : `Saldo em ${ddmm(rangeEnd)}`} value={brl(period.end)} tone={period.end < 0 ? 'bad' : undefined} sub="projetado" />
        <Tile label="Menor saldo do período" value={brl(period.min.value)} tone={period.min.value < (cushion ?? 0) ? 'bad' : undefined} sub={`dia ${ddmm(period.min.day)}${cushion && period.min.value < cushion ? ' · abaixo do colchão' : ''}`} />
        <Tile label="Entradas" value={brl(period.received + period.toReceive)} sub={`${brl(period.received)} recebido · ${brl(period.toReceive)} a receber`} />
        <Tile label="Saídas" value={brl(period.paid + period.toPay)} sub={`${brl(period.paid)} pago · ${brl(period.toPay)} a pagar`} />
      </div>

      {/* avisos */}
      {(view.overdueIn.total > 0 || period.lateOutCount > 0) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {view.overdueIn.total > 0 && (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setOverdueOpen(o => !o)} style={{ ...notice, fontFamily: sans }}>
                <span><strong>{brl(view.overdueIn.total)}</strong> em {view.overdueIn.items.length} parcelas atrasadas · contando {overdueSel.length ? <strong>{overdueSel.length} ({brl(overdueChosenTotal)})</strong> : 'nenhuma'} como entrada hoje</span>
                <span style={{ fontSize: 10, color: C.mid }}>▾</span>
              </button>
              {overdueOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 30, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: '4px 0', minWidth: 340, maxHeight: 340, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', gap: 8, padding: '6px 12px', borderBottom: `1px solid ${C.bg}` }}>
                    <button onClick={() => setOverdueSel(view.overdueIn.items.map(overdueKey))} style={btn}>Todas</button>
                    <button onClick={() => setOverdueSel([])} style={btn}>Nenhuma</button>
                    <button onClick={() => setOverdueOpen(false)} style={{ ...btn, marginLeft: 'auto' }}>Fechar</button>
                  </div>
                  {view.overdueIn.items.map(o => {
                    const key = overdueKey(o), on = overdueSel.includes(key)
                    return (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13 }}>
                        <input type="checkbox" checked={on} onChange={() => setOverdueSel(sel => on ? sel.filter(x => x !== key) : [...sel, key])} />
                        <span style={{ flex: 1, minWidth: 0 }}>{o.name}<span style={{ color: C.dim }}> · venceu {ddmm(o.date)}</span></span>
                        <span style={{ ...num, fontWeight: 600 }}>{brl(o.value)}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {period.lateOutCount > 0 && (
            <label style={notice}>
              <input type="checkbox" checked={includeLate} onChange={e => setIncludeLate(e.target.checked)} />
              <span><strong>{brl(period.lateOut)}</strong> em {period.lateOutCount} contas vencidas sem baixa. Contar como pagas hoje</span>
            </label>
          )}
        </div>
      )}

      {/* gráficos do período */}
      <div style={{ ...card, padding: '14px 16px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Saldo ao longo {horizon === 'mes' ? 'do mês' : `de ${periodLabel}`}</span>
          <Legend items={[['Realizado', C.ink, false], ['Projetado', C.ink, true], ...(cushion ? [['Colchão', C.amber, true] as [string, string, boolean]] : [])]} />
        </div>
        <BalanceChart days={period.days} bal={period.bal} today={view.today} cushion={cushion} hover={hover} setHover={setHover} onPick={d => setSelDay(selDay === d ? null : d)} sel={selDay} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Entradas e saídas por dia</span>
          <Legend items={[['Entradas', C.green, false], ['Saídas', C.red, false]]} />
        </div>
        <FlowChart perDay={period.perDay} today={view.today} hover={hover} setHover={setHover} onPick={d => setSelDay(selDay === d ? null : d)} sel={selDay} bal={period.bal} />
      </div>

      {/* lista do dia / próximos dias */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>
            {selDay ? `Dia ${ddmm(selDay)}` : hasToday ? 'Próximos 7 dias' : `Movimento de ${periodLabel}`}
          </span>
          {selDay && <button onClick={() => setSelDay(null)} style={btn}>Ver próximos dias</button>}
        </div>
        <div style={{ padding: '4px 16px 12px' }}>
          {listDays.every(d => dayItems(d).length === 0) && <div style={{ color: C.dim, fontSize: 13, padding: '16px 0', textAlign: 'center' }}>Nada previsto.</div>}
          {listDays.map(d => {
            const all = dayItems(d)
            if (!all.length) return null
            const idx = period.days.indexOf(d)
            // contas vencidas sem baixa caem todas em hoje: resume numa linha
            const late = all.filter(i => i.late && i.kind === 'out')
            const its = showLate ? all : all.filter(i => !(i.late && i.kind === 'out'))
            return (
              <div key={d} style={{ padding: '8px 0', borderBottom: `1px solid ${C.bg}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.mid, fontWeight: 700, marginBottom: 4 }}>
                  <span>{new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })}</span>
                  <span style={num}>saldo {brl(period.bal[idx])}</span>
                </div>
                {late.length > 0 && (
                  <button onClick={() => setShowLate(v => !v)} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 10, fontSize: 13, padding: '5px 8px', margin: '2px 0', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, cursor: 'pointer', fontFamily: sans, color: C.ink }}>
                    <span>{showLate ? '▾' : '▸'} {late.length} contas vencidas sem baixa</span>
                    <span style={{ ...num, fontWeight: 700 }}>−{brl(late.reduce((acc, i) => acc + i.value, 0))}</span>
                  </button>
                )}
                {its.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, padding: '3px 0' }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: it.kind === 'in' ? C.green : C.red, marginRight: 8, opacity: it.category === 'SIMULACAO' ? 0.5 : 1 }} />
                      {it.name}{it.detail ? <span style={{ color: C.dim }}> · {it.detail}</span> : null}
                      {!it.realized && <span style={{ color: C.dim, fontSize: 11 }}> · {it.kind === 'in' ? 'a receber' : 'a pagar'}</span>}
                    </span>
                    <span style={{ ...num, fontWeight: 700, color: C.ink, whiteSpace: 'nowrap' }}>{it.kind === 'in' ? '+' : '−'}{brl(it.value)}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* simulação de vendas */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Simular vendas</div>
            <div style={{ fontSize: 12, color: C.mid, marginTop: 2 }}>Cada venda entra no dia escolhido (entrada) e as parcelas nos meses seguintes, no mesmo dia{noTax ? '' : ', já com o imposto de 6%'}. Aparece no dia a dia e na projeção.</div>
          </div>
          <button onClick={() => setSims(s => [...s, { id: String(Date.now()), date: todayLocal, entrada: stats?.avgCashPerSale ?? 5000, parcelas: 10, valor: stats ? Math.round(Math.max(0, stats.avgTicket - stats.avgCashPerSale) / 10) : 2500 }])}
            style={{ ...btn, background: C.neon, border: 'none', fontWeight: 700 }}>+ Adicionar venda</button>
        </div>
        <div style={{ padding: '8px 16px 12px' }}>
          {sims.length === 0 && <div style={{ fontSize: 13, color: C.dim, padding: '8px 0' }}>Nenhuma venda simulada.</div>}
          {sims.map((v, n) => {
            const upd = (patch: Partial<Sim>) => setSims(s => s.map(x => (x.id === v.id ? { ...x, ...patch } : x)))
            return (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: 'auto repeat(4, minmax(110px, 1fr)) auto', gap: 8, alignItems: 'end', padding: '8px 0', borderBottom: `1px solid ${C.bg}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.mid, paddingBottom: 9 }}>#{n + 1}</span>
                <Field label="Dia da venda"><input type="date" value={v.date} onChange={e => e.target.value && upd({ date: e.target.value })} style={inp} /></Field>
                <Field label="Entrada"><MoneyInput value={v.entrada} onChange={x => upd({ entrada: x })} /></Field>
                <Field label="Parcelas"><input type="number" min={0} max={36} value={v.parcelas} onChange={e => upd({ parcelas: Math.max(0, Math.min(36, Number(e.target.value) || 0)) })} style={inp} /></Field>
                <Field label="Valor da parcela"><MoneyInput value={v.valor} onChange={x => upd({ valor: x })} /></Field>
                <button onClick={() => setSims(s => s.filter(x => x.id !== v.id))} title="Remover" style={{ ...btn, color: C.red, marginBottom: 1 }}>×</button>
                <div style={{ gridColumn: '2 / -1', fontSize: 11.5, color: C.mid, marginTop: -2 }}>
                  Total {brl(v.entrada + v.parcelas * v.valor)} · última parcela em {ddmm(addMonths(v.date, v.parcelas))}/{addMonths(v.date, v.parcelas).slice(2, 4)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* projeção */}
      {projection && stats && cushion != null && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.line}` }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Projeção dos próximos 12 meses</div>
            <div style={{ fontSize: 12, color: C.mid, marginTop: 2 }}>Com o que já está contratado e lançado{sims.length ? ' e as vendas simuladas' : ''}{noTax ? ', sem impostos' : ''}. As despesas que ainda não foram lançadas não entram (custo médio dos últimos 3 meses: {brl(stats.avgMonthlyCost)}).</div>
          </div>
          <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, background: C.bg, borderBottom: `1px solid ${C.line}` }}>
            <Field label="Colchão mínimo de caixa" hint="o saldo não deve ficar abaixo disso">
              <MoneyInput value={cushion} onChange={v => { setCushion(v); lsSet('goon.caixa.colchao', String(v)) }} />
            </Field>
            <Field label="Simular investimento por mês" hint="saída extra todo mês">
              <MoneyInput value={simInvest} onChange={setSimInvest} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, padding: '12px 16px' }}>
            <Tile label="Falta vender em 12 meses" value={brl(projection.totalNeed)} tone={projection.totalNeed > 0 ? 'bad' : 'good'}
              sub={projection.totalNeed > 0 ? `≈ ${Math.ceil(projection.totalNeed / Math.max(1, stats.avgCashPerSale))} vendas a mais (${brl(stats.avgCashPerSale)} de caixa por venda no 1º mês)` : 'o saldo fica acima do colchão em todos os meses'} />
            <Tile label="Pode investir sem furar o colchão" value={brl(projection.canInvest)} tone={projection.canInvest > 0 ? 'good' : undefined} sub="menor saldo da projeção menos o colchão" />
            <Tile label="Ritmo de vendas (6 meses)" value={`${stats.avgSalesPerMonth.toString().replace('.', ',')}/mês`} sub={`${stats.salesLast6} vendas, ticket médio ${brl(stats.avgTicket)}`} />
          </div>
          <ProjectionChart rows={projection.rows} cushion={cushion} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
              <thead>
                <tr style={{ background: C.bg, color: C.mid, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {['Mês', 'Entradas', 'Saídas', ...(sims.length || simInvest ? ['Simulação'] : []), 'Saldo no fim', 'Falta vender'].map((h, i) => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projection.rows.map(r => (
                  <tr key={r.key} style={{ borderTop: `1px solid ${C.bg}` }}>
                    <td style={{ padding: '8px 14px', fontWeight: 700, textTransform: 'capitalize' }}>{r.label}</td>
                    <td style={{ ...num, padding: '8px 14px', textAlign: 'right' }}>{brl(r.inn)}</td>
                    <td style={{ ...num, padding: '8px 14px', textAlign: 'right' }}>{brl(r.out)}</td>
                    {(sims.length || simInvest) ? <td style={{ ...num, padding: '8px 14px', textAlign: 'right' }}>{r.sim >= 0 ? '+' : ''}{brl(r.sim)}</td> : null}
                    <td style={{ ...num, padding: '8px 14px', textAlign: 'right', fontWeight: 700, color: r.end < cushion ? C.red : C.ink }}>{brl(r.end)}</td>
                    <td style={{ ...num, padding: '8px 14px', textAlign: 'right', color: r.need > 0 ? C.red : C.dim, fontWeight: r.need > 0 ? 700 : 400 }}>
                      {r.need > 0 ? `${brl(r.need)} · ${r.needSales} venda${r.needSales > 1 ? 's' : ''}` : 'nada'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = { border: 'none', background: 'transparent', color: C.mid, padding: '2px 12px', fontSize: 18, cursor: 'pointer' }
const btn: React.CSSProperties = { padding: '6px 12px', border: `1px solid ${C.line}`, borderRadius: 6, background: '#fff', color: C.ink, fontFamily: sans, fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const notice: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12.5, cursor: 'pointer', color: C.ink }
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: `1px solid ${C.line}`, borderRadius: 6, fontFamily: sans, fontSize: 14, background: '#fff', ...num }

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div style={{ ...card, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.mid }}>{label}</div>
      <div style={{ ...num, fontSize: 22, fontWeight: 700, marginTop: 4, color: tone === 'bad' ? C.red : tone === 'good' ? C.green : C.ink }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.mid, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: C.mid, marginBottom: 4 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{hint}</div>}
    </label>
  )
}

function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [txt, setTxt] = useState(value ? value.toLocaleString('pt-BR') : '')
  useEffect(() => { setTxt(value ? value.toLocaleString('pt-BR') : '') }, [value])
  return (
    <input value={txt} inputMode="decimal" placeholder="0" onChange={e => setTxt(e.target.value)}
      onBlur={() => { const v = Number(txt.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0; onChange(v) }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} style={inp} />
  )
}

function Legend({ items }: { items: Array<[string, string, boolean]> }) {
  return (
    <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: C.mid }}>
      {items.map(([l, c, dashed]) => (
        <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="18" height="8"><line x1="0" y1="4" x2="18" y2="4" stroke={c} strokeWidth="2" strokeDasharray={dashed ? '4 3' : undefined} /></svg>{l}
        </span>
      ))}
    </div>
  )
}

// ---- gráficos (SVG, eixo único cada) ----
const W = 1000, PADL = 52, PADR = 12
const labelStep = (n: number) => (n <= 31 ? 5 : Math.ceil(n / 9))

function niceTicks(min: number, max: number, n = 4) {
  if (min === max) { min -= 1; max += 1 }
  const step0 = (max - min) / n
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(s => s >= step0) ?? step0
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v))
  return { lo, hi, ticks }
}

function HoverLayer({ n, h, x, setHover, onPick }: { n: number; h: number; x: (i: number) => number; setHover: (i: number | null) => void; onPick: (i: number) => void }) {
  const step = n > 1 ? x(1) - x(0) : W
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={x(i) - step / 2} y={0} width={step} height={h} fill="transparent" style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onPick(i)} />
      ))}
    </>
  )
}

function BalanceChart({ days, bal, today, cushion, hover, setHover, onPick, sel }: {
  days: string[]; bal: number[]; today: string; cushion: number | null; hover: number | null; setHover: (i: number | null) => void; onPick: (d: string) => void; sel: string | null
}) {
  const H = 190, top = 12, bottom = 22
  const vals = [...bal, 0, ...(cushion ? [cushion] : [])]
  const { lo, hi, ticks } = niceTicks(Math.min(...vals), Math.max(...vals))
  const x = (i: number) => PADL + (i + 0.5) * ((W - PADL - PADR) / days.length)
  const y = (v: number) => top + (hi - v) / (hi - lo || 1) * (H - top - bottom)
  const ti = days.findIndex(d => d > today)
  const split = ti === -1 ? days.length : ti
  const path = (from: number, to: number) => bal.slice(from, to).map((v, j) => `${j ? 'L' : 'M'}${x(from + j).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Saldo diário do mês">
        {ticks.map(t => (
          <g key={t}>
            <line x1={PADL} x2={W - PADR} y1={y(t)} y2={y(t)} stroke={t === 0 ? C.dim : C.grid} strokeWidth={1} />
            <text x={PADL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={C.mid} style={num}>{k(t)}</text>
          </g>
        ))}
        {cushion ? <line x1={PADL} x2={W - PADR} y1={y(cushion)} y2={y(cushion)} stroke={C.amber} strokeWidth={1.5} strokeDasharray="5 4" /> : null}
        {split > 0 && <path d={path(0, split)} fill="none" stroke={C.ink} strokeWidth={2} strokeLinejoin="round" />}
        {split < days.length && <path d={path(Math.max(0, split - 1), days.length)} fill="none" stroke={C.ink} strokeWidth={2} strokeDasharray="5 4" strokeLinejoin="round" />}
        {days.map((d, i) => (i % labelStep(days.length) === 0 || i === days.length - 1) && <text key={d} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill={C.mid}>{days.length > 31 ? ddmm(d) : d.slice(8, 10)}</text>)}
        {sel && days.includes(sel) && <line x1={x(days.indexOf(sel))} x2={x(days.indexOf(sel))} y1={top} y2={H - bottom} stroke={C.neon} strokeWidth={3} />}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={top} y2={H - bottom} stroke={C.dim} strokeWidth={1} />
            <circle cx={x(hover)} cy={y(bal[hover])} r={4.5} fill={C.ink} stroke="#fff" strokeWidth={2} />
          </g>
        )}
        <HoverLayer n={days.length} h={H} x={x} setHover={setHover} onPick={i => onPick(days[i])} />
      </svg>
      {hover != null && (
        <Tip left={`${(x(hover) / W) * 100}%`}>
          <div style={{ fontWeight: 700 }}>{ddmm(days[hover])}{days[hover] > today ? ' · projetado' : ''}</div>
          <div style={num}>Saldo {brl(bal[hover])}</div>
        </Tip>
      )}
    </div>
  )
}

function FlowChart({ perDay, today, hover, setHover, onPick, sel, bal }: {
  perDay: Array<{ d: string; inn: number; out: number }>; today: string; hover: number | null; setHover: (i: number | null) => void; onPick: (d: string) => void; sel: string | null; bal: number[]
}) {
  const H = 150, top = 8, bottom = 22
  const maxV = Math.max(1, ...perDay.map(p => Math.max(p.inn, p.out)))
  const { hi } = niceTicks(0, maxV, 4)
  const n = perDay.length
  const bw = Math.max(1.5, ((W - PADL - PADR) / n) * 0.6)
  const x = (i: number) => PADL + (i + 0.5) * ((W - PADL - PADR) / n)
  const mid = top + (H - top - bottom) / 2
  const sc = (v: number) => (v / hi) * ((H - top - bottom) / 2)
  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Entradas e saídas por dia">
        {[hi, 0, -hi].map(t => (
          <g key={t}>
            <line x1={PADL} x2={W - PADR} y1={mid - sc(t)} y2={mid - sc(t)} stroke={t === 0 ? C.dim : C.grid} strokeWidth={1} />
            <text x={PADL - 8} y={mid - sc(t) + 4} textAnchor="end" fontSize="11" fill={C.mid} style={num}>{t === 0 ? '0' : k(Math.abs(t))}</text>
          </g>
        ))}
        {perDay.map((p, i) => {
          const future = p.d > today
          return (
            <g key={p.d} opacity={future ? 0.55 : 1}>
              {p.inn > 0 && <rect x={x(i) - bw / 2} y={mid - sc(p.inn)} width={bw} height={Math.max(1, sc(p.inn) - 1)} rx={2} fill={C.green} />}
              {p.out > 0 && <rect x={x(i) - bw / 2} y={mid + 1} width={bw} height={Math.max(1, sc(p.out) - 1)} rx={2} fill={C.red} />}
            </g>
          )
        })}
        {perDay.map((p, i) => (i % labelStep(n) === 0 || i === n - 1) && <text key={p.d} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill={C.mid}>{n > 31 ? ddmm(p.d) : p.d.slice(8, 10)}</text>)}
        {sel && perDay.some(p => p.d === sel) && <line x1={x(perDay.findIndex(p => p.d === sel))} x2={x(perDay.findIndex(p => p.d === sel))} y1={top} y2={H - bottom} stroke={C.neon} strokeWidth={3} opacity={0.6} />}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={H - bottom} stroke={C.dim} strokeWidth={1} />}
        <HoverLayer n={n} h={H} x={x} setHover={setHover} onPick={i => onPick(perDay[i].d)} />
      </svg>
      {hover != null && (
        <Tip left={`${(x(hover) / W) * 100}%`}>
          <div style={{ fontWeight: 700 }}>{ddmm(perDay[hover].d)}</div>
          <div style={num}>Entradas {brl(perDay[hover].inn)}</div>
          <div style={num}>Saídas {brl(perDay[hover].out)}</div>
          <div style={num}>Saldo {brl(bal[hover])}</div>
        </Tip>
      )}
    </div>
  )
}

function ProjectionChart({ rows, cushion }: { rows: Array<{ label: string; end: number; need: number }>; cushion: number }) {
  const H = 170, top = 12, bottom = 22
  const vals = [...rows.map(r => r.end), 0, cushion]
  const { lo, hi, ticks } = niceTicks(Math.min(...vals), Math.max(...vals))
  const n = rows.length
  const x = (i: number) => PADL + (i + 0.5) * ((W - PADL - PADR) / n)
  const y = (v: number) => top + (hi - v) / (hi - lo || 1) * (H - top - bottom)
  const bw = ((W - PADL - PADR) / n) * 0.5
  const [hv, setHv] = useState<number | null>(null)
  return (
    <div style={{ position: 'relative', padding: '0 16px 8px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Saldo projetado no fim de cada mês">
        {ticks.map(t => (
          <g key={t}>
            <line x1={PADL} x2={W - PADR} y1={y(t)} y2={y(t)} stroke={t === 0 ? C.dim : C.grid} strokeWidth={1} />
            <text x={PADL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={C.mid} style={num}>{k(t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y0 = y(0), y1 = y(r.end)
          return <rect key={r.label} x={x(i) - bw / 2} y={Math.min(y0, y1)} width={bw} height={Math.max(1, Math.abs(y1 - y0))} rx={3} fill={r.end < cushion ? C.red : C.ink} opacity={hv == null || hv === i ? 1 : 0.5} />
        })}
        <line x1={PADL} x2={W - PADR} y1={y(cushion)} y2={y(cushion)} stroke={C.amber} strokeWidth={1.5} strokeDasharray="5 4" />
        {rows.map((r, i) => <text key={r.label} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill={C.mid}>{r.label}</text>)}
        <HoverLayer n={n} h={H} x={x} setHover={setHv} onPick={() => {}} />
      </svg>
      {hv != null && (
        <Tip left={`${(x(hv) / W) * 100}%`}>
          <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{rows[hv].label}</div>
          <div style={num}>Saldo no fim {brl(rows[hv].end)}</div>
          {rows[hv].need > 0 && <div style={{ ...num, color: C.red }}>Falta vender {brl(rows[hv].need)}</div>}
        </Tip>
      )}
    </div>
  )
}

function Tip({ left, children }: { left: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', top: 4, left, transform: 'translateX(-50%)', pointerEvents: 'none', background: C.ink, color: '#fff', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: sans, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.18)', zIndex: 2 }}>
      {children}
    </div>
  )
}
