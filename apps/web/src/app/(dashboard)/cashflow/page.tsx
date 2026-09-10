'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

interface Layers { impostos: number; custoOperacao: number; distribuicao: number; pessoalGiu: number }

interface MonthData {
  month: number
  year: number
  label: string
  entradas: { received: number; pending: number; overdue: number; total: number }
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

interface DayData { day: number; entradas: number; saidas: number; layers: Layers; items: Array<{ type: 'entrada' | 'saida'; description: string; value: number; category?: string; status?: string }> }

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
// Compacto para rótulos de gráfico: 147000 → "147k", 1231000 → "1,2M"
const fmtK = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace('.', ',')}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const C = {
  ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0',
  neon: '#C7F900', green: '#16a34a', greenDk: '#15803d', red: '#dc2626', amber: '#f59e0b', slate: '#475569', bg: '#f8fafc',
}
const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }

function layerFromCat(cat: string, desc: string): keyof Layers {
  if (cat === 'IMPOSTOS') return 'impostos'
  if (cat === 'MENTORIA') return 'distribuicao'
  if (cat === 'PESSOAL' && /giulliano/i.test(desc)) return 'pessoalGiu'
  return 'custoOperacao'
}

interface Scope { receita: number; recebido: number; aReceber: number; impostos: number; custo: number; distrib: number; giu: number }

export default function CashflowPage() {
  const [data, setData] = useState<CashflowData | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [level, setLevel] = useState<'ano' | 'mes' | 'dia'>('ano')
  const [selMonth, setSelMonth] = useState(new Date().getMonth())
  const [selDay, setSelDay] = useState<number | null>(null)
  const [dailyData, setDailyData] = useState<DayData[]>([])

  const loadData = useCallback(async () => {
    const result = await apiFetch<CashflowData>(`/api/cashflow?year=${year}`)
    setData(result)
  }, [year])
  useEffect(() => { loadData() }, [loadData])

  // Carrega dia-a-dia do mês selecionado quando desce de nível
  useEffect(() => {
    if (level === 'ano') return
    async function loadDaily() {
      try {
        const [payments, expenses] = await Promise.all([
          apiFetch<{ data: Array<{ dueDate: string; paidAt?: string | null; value: number; status: string; client: { companyName: string } }> }>(`/api/payments?month=${selMonth + 1}&year=${year}&limit=400`),
          apiFetch<Array<{ dueDate: string; value: number; status: string; description: string; category: string }>>(`/api/expenses?month=${selMonth + 1}&year=${year}&limit=400`),
        ])
        const daysInMonth = new Date(year, selMonth + 1, 0).getDate()
        const expArray = Array.isArray(expenses) ? expenses : (expenses as any).data ?? []
        const days: DayData[] = []
        for (let d = 1; d <= daysInMonth; d++) {
          const layers: Layers = { impostos: 0, custoOperacao: 0, distribuicao: 0, pessoalGiu: 0 }
          const items: DayData['items'] = []
          let entradas = 0, saidas = 0
          for (const p of (payments.data ?? [])) {
            const dt = new Date(p.status === 'PAID' && p.paidAt ? p.paidAt : p.dueDate)
            if (dt.getUTCDate() === d && dt.getUTCMonth() === selMonth) {
              entradas += p.value; items.push({ type: 'entrada', description: p.client?.companyName ?? '', value: p.value, status: p.status })
            }
          }
          for (const e of expArray) {
            const dt = new Date(e.dueDate)
            const skip = e.category === 'MENTORIA' && e.description?.includes('Giulliano')
            if (!skip && dt.getUTCDate() === d && dt.getUTCMonth() === selMonth) {
              saidas += e.value; items.push({ type: 'saida', description: e.description, value: e.value, category: e.category, status: e.status })
              layers[layerFromCat(e.category ?? 'OUTRO', e.description ?? '')] += e.value
            }
          }
          days.push({ day: d, entradas, saidas, layers, items })
        }
        setDailyData(days)
      } catch { /* ignore */ }
    }
    loadDaily()
  }, [level, selMonth, year])

  if (!data) return <div style={{ padding: 24, color: C.mid }}>Carregando fluxo de caixa…</div>

  // ---- Monta o scope conforme o nível ----
  let scope: Scope
  if (level === 'ano') {
    const t = data.totals
    scope = { receita: t.entradas, recebido: t.entradasReceived, aReceber: t.entradas - t.entradasReceived, impostos: t.impostos, custo: t.custoOperacao, distrib: t.distribuicao, giu: t.pessoalGiu }
  } else if (level === 'mes') {
    const m = data.months[selMonth]
    scope = { receita: m.entradas.total, recebido: m.entradas.received, aReceber: m.entradas.pending + m.entradas.overdue, impostos: m.layers.impostos, custo: m.layers.custoOperacao, distrib: m.layers.distribuicao, giu: m.layers.pessoalGiu }
  } else {
    const d = dailyData.find(x => x.day === selDay)
    const l = d?.layers ?? { impostos: 0, custoOperacao: 0, distribuicao: 0, pessoalGiu: 0 }
    scope = { receita: d?.entradas ?? 0, recebido: d?.entradas ?? 0, aReceber: 0, impostos: l.impostos, custo: l.custoOperacao, distrib: l.distribuicao, giu: l.pessoalGiu }
  }

  const lucro = scope.receita - scope.impostos - scope.custo
  const resultado = lucro - scope.distrib

  const steps = [
    { label: 'Faturamento', value: scope.receita, kind: 'base' as const, hint: level === 'dia' ? 'Entrou no dia' : `Recebido ${fmt(scope.recebido)}` },
    { label: 'Impostos', value: -scope.impostos, kind: 'out' as const, hint: '6% sobre a receita' },
    { label: 'Custo da operação', value: -scope.custo, kind: 'out' as const, hint: 'Time, contabilidade, sistemas, comissões' },
    { label: 'Lucro da operação', value: lucro, kind: 'sub' as const, hint: 'Receita − impostos − custo' },
    { label: 'Distribuição', value: -scope.distrib, kind: 'out' as const, hint: 'Repasses aos sócios / mentores' },
    { label: 'Resultado da empresa', value: resultado, kind: 'result' as const, hint: 'O que a operação gera (o pessoal do Giu fica na aba dele)' },
  ]

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
  const scopeLabel = level === 'ano' ? `Ano de ${year}` : level === 'mes' ? `${MONTH_FULL[selMonth]} de ${year}` : `${selDay} de ${MONTH_FULL[selMonth]}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header + breadcrumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Fluxo de Caixa</h1>
          {/* Breadcrumb macro → micro */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 14, flexWrap: 'wrap' }}>
            <button onClick={() => { setLevel('ano'); setSelDay(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)', fontWeight: level === 'ano' ? 700 : 500, color: level === 'ano' ? C.ink : C.mid, fontSize: 14 }}>{year}</button>
            {level !== 'ano' && <>
              <span style={{ color: C.dim }}>›</span>
              <button onClick={() => { setLevel('mes'); setSelDay(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-sans)', fontWeight: level === 'mes' ? 700 : 500, color: level === 'mes' ? C.ink : C.mid, fontSize: 14 }}>{MONTH_FULL[selMonth]}</button>
            </>}
            {level === 'dia' && <>
              <span style={{ color: C.dim }}>›</span>
              <span style={{ fontWeight: 700, color: C.ink }}>Dia {selDay}</span>
            </>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {level === 'ano' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${C.line}`, borderRadius: 100, padding: 4 }}>
              <button onClick={() => setYear(y => y - 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.mid, padding: '2px 8px', fontSize: 14 }}>‹</button>
              <span style={{ ...num, fontWeight: 700, minWidth: 42, textAlign: 'center', fontSize: 14 }}>{year}</span>
              <button onClick={() => setYear(y => y + 1)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.mid, padding: '2px 8px', fontSize: 14 }}>›</button>
            </div>
          )}
          {level === 'mes' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1px solid ${C.line}`, borderRadius: 100, padding: 4 }}>
              <button onClick={() => setSelMonth(m => m > 0 ? m - 1 : m)} disabled={selMonth === 0} style={{ border: 'none', background: 'transparent', cursor: selMonth === 0 ? 'default' : 'pointer', color: selMonth === 0 ? C.dim : C.mid, padding: '2px 8px', fontSize: 14 }}>‹</button>
              <span style={{ fontWeight: 700, minWidth: 78, textAlign: 'center', fontSize: 13 }}>{MONTH_NAMES[selMonth]} {year}</span>
              <button onClick={() => setSelMonth(m => m < 11 ? m + 1 : m)} disabled={selMonth === 11} style={{ border: 'none', background: 'transparent', cursor: selMonth === 11 ? 'default' : 'pointer', color: selMonth === 11 ? C.dim : C.mid, padding: '2px 8px', fontSize: 14 }}>›</button>
            </div>
          )}
        </div>
      </div>

      {/* WATERFALL — igual em todos os níveis */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Resultado — {scopeLabel}</span>
          <span style={{ ...num, fontSize: 13, color: resultado >= 0 ? C.greenDk : C.red, fontWeight: 700 }}>{resultado >= 0 ? 'Positivo' : 'Negativo'}</span>
        </div>
        <div style={{ padding: '8px 0' }}>
          {steps.map((s, i) => {
            const isTotal = s.kind === 'sub' || s.kind === 'result' || s.kind === 'base'
            const valColor = s.kind === 'result' ? (s.value >= 0 ? C.greenDk : C.red) : s.kind === 'out' ? C.red : s.kind === 'sub' ? (s.value >= 0 ? C.ink : C.red) : C.ink
            return (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                padding: s.kind === 'result' ? '16px 22px' : '11px 22px',
                background: s.kind === 'result' ? (resultado >= 0 ? 'rgba(199,249,0,0.10)' : 'rgba(220,38,38,0.05)') : 'transparent',
                borderTop: isTotal && i > 0 ? `1px solid ${C.line}` : 'none',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: s.kind === 'result' ? 16 : 14, fontWeight: isTotal ? 700 : 500, color: s.kind === 'out' ? C.mid : C.ink }}>{s.label}</span>
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

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Faturamento', value: scope.receita, color: C.ink, sub: `Recebido ${fmt(scope.recebido)}` },
          { label: 'A receber', value: scope.aReceber, color: C.amber, sub: 'Pendente + vencido' },
          { label: 'Lucro da operação', value: lucro, color: C.greenDk, sub: 'Antes de distribuir' },
          { label: 'Resultado da empresa', value: resultado, color: resultado >= 0 ? C.greenDk : C.red, sub: 'O que a operação gera', hero: true },
        ].map(k => (
          <div key={k.label} style={{ ...card, padding: '16px 18px', borderTop: k.hero ? `3px solid ${C.neon}` : `1px solid ${C.line}` }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.mid, fontWeight: 600 }}>{k.label}</div>
            <div style={{ ...num, fontSize: 24, fontWeight: 700, color: k.color, marginTop: 6 }}>{fmt(k.value)}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* DRILL-DOWN: lista do nível atual */}
      {level === 'ano' && (
        <>
          {/* Comparativo mensal */}
          <div style={{ ...card, padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Comparativo mensal</span>
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: C.mid, flexWrap: 'wrap' }}>
                <span><i style={{ display: 'inline-block', width: 9, height: 9, background: C.green, borderRadius: 2, marginRight: 5 }} />Entra</span>
                <span><i style={{ display: 'inline-block', width: 9, height: 9, background: '#e57373', borderRadius: 2, marginRight: 5 }} />Imposto</span>
                <span><i style={{ display: 'inline-block', width: 9, height: 9, background: C.slate, borderRadius: 2, marginRight: 5 }} />Custo</span>
                <span><i style={{ display: 'inline-block', width: 9, height: 9, background: C.neon, borderRadius: 2, marginRight: 5 }} />Distribuição</span>
              </div>
            </div>
            {(() => {
              // Saída total do resultado = imposto + custo + distribuição (o que reduz o resultado)
              const barMax = Math.max(...data.months.map(m => Math.max(m.entradas.total, m.layers.impostos + m.layers.custoOperacao + m.layers.distribuicao)), 1)
              return (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', minHeight: 170, overflowX: 'auto', paddingBottom: 4 }}>
                  {data.months.map(m => {
                    const entH = (m.entradas.total / barMax) * 140
                    const impH = (m.layers.impostos / barMax) * 140
                    const custoH = (m.layers.custoOperacao / barMax) * 140
                    const distH = (m.layers.distribuicao / barMax) * 140
                    const isCur = m.month === new Date().getMonth() + 1 && year === new Date().getFullYear()
                    const saidaTotal = m.layers.impostos + m.layers.custoOperacao + m.layers.distribuicao
                    const result = m.entradas.total - saidaTotal
                    return (
                      <button key={m.month} onClick={() => { setSelMonth(m.month - 1); setLevel('mes') }} title={`Entra ${fmt(m.entradas.total)} · Imposto ${fmt(m.layers.impostos)} · Custo ${fmt(m.layers.custoOperacao)} · Distribuição ${fmt(m.layers.distribuicao)} · Resultado ${fmt(result)}`} style={{ flex: 1, minWidth: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0', borderRadius: 6 }}>
                        <span style={{ ...num, fontSize: 9.5, fontWeight: 700, color: m.entradas.total > 0 ? C.greenDk : 'transparent', minHeight: 12 }}>{m.entradas.total > 0 ? fmtK(m.entradas.total) : ''}</span>
                        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 145 }}>
                          <div style={{ width: 14, height: Math.max(entH, m.entradas.total > 0 ? 2 : 0), background: C.green, borderRadius: '3px 3px 0 0' }} />
                          <div style={{ display: 'flex', flexDirection: 'column-reverse', height: 145, justifyContent: 'flex-start' }}>
                            <div style={{ width: 14, height: Math.max(impH, m.layers.impostos > 0 ? 2 : 0), background: '#e57373', borderRadius: (custoH + distH) > 0 ? 0 : '3px 3px 0 0' }} />
                            <div style={{ width: 14, height: Math.max(custoH, m.layers.custoOperacao > 0 ? 2 : 0), background: C.slate, borderRadius: distH > 0 ? 0 : '3px 3px 0 0' }} />
                            <div style={{ width: 14, height: Math.max(distH, m.layers.distribuicao > 0 ? 2 : 0), background: C.neon, borderRadius: '3px 3px 0 0' }} />
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

          {/* Lista de meses — clicável */}
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Meses <span style={{ color: C.dim, fontSize: 12, fontWeight: 400 }}>— clique para abrir</span></div>
            {data.months.map(m => {
              const mLucro = m.entradas.total - m.layers.impostos - m.layers.custoOperacao
              const mResult = mLucro - m.layers.distribuicao
              const has = m.entradas.total > 0 || m.saidas.total > 0
              return (
                <button key={m.month} onClick={() => { setSelMonth(m.month - 1); setLevel('mes') }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px',
                  background: 'transparent', border: 'none', borderTop: `1px solid ${C.bg}`, cursor: 'pointer', opacity: has ? 1 : 0.5, textAlign: 'left',
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.slate, minWidth: 90 }}>{MONTH_FULL[m.month - 1]}</span>
                  <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span style={{ ...num, fontSize: 12, color: C.green }}>+{fmt(m.entradas.total)}</span>
                    <span style={{ ...num, fontSize: 12, color: C.slate }}>−{fmt(m.layers.custoOperacao + m.layers.impostos)}</span>
                    <span style={{ ...num, fontSize: 12, color: '#7a9a00' }}>−{fmt(m.layers.distribuicao)}</span>
                    <span style={{ ...num, fontSize: 13, fontWeight: 800, color: mResult >= 0 ? C.greenDk : C.red, minWidth: 80, textAlign: 'right' }}>{fmt(mResult)}</span>
                    <span style={{ color: C.dim }}>›</span>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}

      {level === 'mes' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15 }}>Dia a dia <span style={{ color: C.dim, fontSize: 12, fontWeight: 400 }}>— clique para o detalhe</span></div>
          {dailyData.filter(d => d.entradas > 0 || d.saidas > 0).length === 0 && (
            <div style={{ padding: '24px 20px', color: C.dim, fontSize: 13 }}>Sem movimento neste mês.</div>
          )}
          {dailyData.filter(d => d.entradas > 0 || d.saidas > 0).map(d => {
            const isToday = d.day === new Date().getDate() && selMonth === new Date().getMonth() && year === new Date().getFullYear()
            const saldo = d.entradas - d.saidas
            return (
              <button key={d.day} onClick={() => { setSelDay(d.day); setLevel('dia') }} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 20px',
                background: isToday ? 'rgba(199,249,0,0.08)' : 'transparent', border: 'none', borderTop: `1px solid ${C.bg}`, cursor: 'pointer', textAlign: 'left',
              }}>
                <span style={{ ...num, fontWeight: isToday ? 800 : 700, fontSize: 13, color: C.ink, minWidth: 60 }}>{String(d.day).padStart(2, '0')} {MONTH_NAMES[selMonth]}</span>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  {d.entradas > 0 && <span style={{ ...num, fontSize: 12, color: C.green }}>+{fmt(d.entradas)}</span>}
                  {d.saidas > 0 && <span style={{ ...num, fontSize: 12, color: C.red }}>−{fmt(d.saidas)}</span>}
                  <span style={{ ...num, fontSize: 13, fontWeight: 800, color: saldo >= 0 ? C.greenDk : C.red, minWidth: 78, textAlign: 'right' }}>{fmt(saldo)}</span>
                  <span style={{ color: C.dim }}>›</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {level === 'dia' && (() => {
        const d = dailyData.find(x => x.day === selDay)
        if (!d) return <div style={{ ...card, padding: 20, color: C.dim }}>Sem dados para o dia.</div>
        const entradas = d.items.filter(i => i.type === 'entrada')
        const saidas = d.items.filter(i => i.type === 'saida')
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: C.greenDk }}>Entradas ({entradas.length})</div>
              {entradas.length === 0 && <div style={{ padding: '16px 18px', color: C.dim, fontSize: 13 }}>Nenhuma.</div>}
              {entradas.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 18px', borderTop: `1px solid ${C.bg}` }}>
                  <span style={{ fontSize: 12.5, color: C.ink }}>{it.description || '—'}</span>
                  <span style={{ ...num, fontSize: 12.5, color: C.greenDk, fontWeight: 600 }}>{fmt(it.value)}</span>
                </div>
              ))}
            </div>
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.line}`, fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, color: C.red }}>Saídas ({saidas.length})</div>
              {saidas.length === 0 && <div style={{ padding: '16px 18px', color: C.dim, fontSize: 13 }}>Nenhuma.</div>}
              {saidas.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 18px', borderTop: `1px solid ${C.bg}` }}>
                  <span style={{ fontSize: 12.5, color: C.ink }}>{it.description || '—'}</span>
                  <span style={{ ...num, fontSize: 12.5, color: C.red, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(it.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
