'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import MultiSelect from '@/components/MultiSelect'

interface Item { id: string; date: string; name: string; detail: string; value: number; status: string; clientId?: string }
interface Bucket { total: number; count: number; items: Item[] }
interface Summary {
  period: { start: string; end: string }
  entradas: { recebido: Bucket; aReceber: Bucket; vencido: Bucket }
  saidas: { pago: Bucket; aPagar: Bucket; atrasado: Bucket; comissoes: Bucket & { pago: number; pendente: number } }
  standby: Bucket
  saldoRealizado: number
  saldoProjetado: number
  totalEntradas: number
  totalSaidas: number
}

type CardKey = 'recebido' | 'aReceber' | 'vencido' | 'pago' | 'aPagar' | 'atrasado' | 'comissoes' | 'standby'

const PLAN_OPTIONS = [
  { value: 'GE', label: 'GOON ELITE' }, { value: 'GI', label: 'GOON INFINITY' }, { value: 'TTS', label: 'TIK TOK SCALE' },
  { value: 'TTSG', label: 'TIKTOK SCALE GRUPO' }, { value: 'GA', label: 'GOON ADVISOR' }, { value: 'GS', label: 'GOON SCALE' }, { value: 'AURA', label: 'AURA 360' },
]
const CATEGORY_OPTIONS = [
  { value: 'PESSOAL', label: 'Pessoal Giu' }, { value: 'MENTORIA', label: 'Mentoria' }, { value: 'COMISSAO', label: 'Comissão' },
  { value: 'IMPOSTOS', label: 'Impostos' }, { value: 'MARKETING', label: 'Marketing' }, { value: 'PESSOAS', label: 'Pessoas' },
  { value: 'SISTEMAS', label: 'Sistemas' }, { value: 'ESTRUTURA', label: 'Estrutura' }, { value: 'DEVOLUCAO', label: 'Devolução' }, { value: 'OUTRO', label: 'Outro' },
]
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2000, i).toLocaleString('pt-BR', { month: 'long' }) }))
const CENTER_OPTIONS = [{ value: 'GLOBAL', label: 'GOON Global' }, { value: 'INFINITY', label: 'GOON Infinity' }, { value: 'TIKTOK', label: 'GOON TikTok' }]
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORY_OPTIONS.map(o => [o.value, o.label]))
const CENTER_LABEL: Record<string, string> = Object.fromEntries(CENTER_OPTIONS.map(o => [o.value, o.label]))
const STATUS_LABEL: Record<string, string> = { PAID: 'Pago', PENDING: 'Pendente', OVERDUE: 'Vencido', SCHEDULED: 'Agendado', PAGO: 'Pago', PREVISTO: 'Previsto', PARCIAL: 'Parcial' }

const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }
const selStyle: React.CSSProperties = { height: 36, padding: '0 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', fontFamily: 'var(--font-sans)', fontSize: 13, color: '#0f172a', cursor: 'pointer' }

const CARDS: Record<CardKey, { label: string; accent: string; side: 'entrada' | 'saida'; empty: string }> = {
  standby: { label: 'Congelado em standby', accent: '#d97706', side: 'entrada', empty: 'Nenhuma parcela congelada no período.' },
  recebido: { label: 'Recebido', accent: '#16a34a', side: 'entrada', empty: 'Nenhum recebimento no período.' },
  aReceber: { label: 'A receber', accent: '#2563eb', side: 'entrada', empty: 'Nada a receber no período.' },
  vencido: { label: 'Vencido (clientes)', accent: '#dc2626', side: 'entrada', empty: 'Nenhuma parcela vencida. Tudo em dia.' },
  pago: { label: 'Pago', accent: '#0f172a', side: 'saida', empty: 'Nenhuma despesa paga no período.' },
  aPagar: { label: 'A pagar', accent: '#d97706', side: 'saida', empty: 'Nenhuma despesa a pagar no período.' },
  atrasado: { label: 'Despesas atrasadas', accent: '#b91c1c', side: 'saida', empty: 'Nenhuma despesa atrasada.' },
  comissoes: { label: 'Comissões', accent: '#7c3aed', side: 'saida', empty: 'Nenhuma comissão no período.' },
}

function Card({ k, bucket, sub, active, onClick }: { k: CardKey; bucket: Bucket; sub?: string; active: boolean; onClick: () => void }) {
  const c = CARDS[k]
  return (
    <div onClick={onClick} style={{
      background: 'white', border: '1px solid #e2e8f0', borderTop: `3px solid ${c.accent}`, borderRadius: 12,
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)', padding: '14px 16px', cursor: 'pointer', minWidth: 0,
      outline: active ? `2px solid ${c.accent}` : 'none',
    }}>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
      <div style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700, color: c.accent, marginTop: 4 }}>{fmtBRL(bucket.total)}</div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sub ?? `${bucket.count} ${bucket.count === 1 ? 'item' : 'itens'}`} · ver</div>
    </div>
  )
}

export default function FinanceSummary() {
  const now = new Date()
  const [mode, setMode] = useState<'filtro' | 'total'>('filtro')
  const [months, setMonths] = useState<string[]>([String(now.getMonth() + 1)]) // vazio = ano inteiro
  const [year, setYear] = useState(now.getFullYear())
  const [plans, setPlans] = useState<string[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [centers, setCenters] = useState<string[]>([])
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<CardKey | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams()
    if (mode === 'filtro') {
      if (year) q.set('year', String(year))
      if (year && months.length) q.set('months', months.join(','))
      if (plans.length) q.set('product', plans.join(','))
      if (cats.length) q.set('category', cats.join(','))
      if (centers.length) q.set('costCenter', centers.join(','))
    }
    try { setData(await apiFetch<Summary>(`/api/cashflow/summary?${q.toString()}`)) } catch { setData(null) } finally { setLoading(false) }
  }, [mode, months, year, plans, cats, centers])
  useEffect(() => { load() }, [load])

  const isFiltro = mode === 'filtro'
  const periodLabel = !isFiltro
    ? new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
    : !year ? 'mês corrente'
    : months.length === 0 ? `todo o ano de ${year}`
    : `${[...months].sort((a, b) => +a - +b).map(m => MONTH_OPTIONS[+m - 1].label).join(', ')} de ${year}`
  const toggle = (k: CardKey) => setOpen(o => (o === k ? null : k))

  const bucketOf = (k: CardKey): Bucket | null => {
    if (!data) return null
    if (k === 'standby') return data.standby
    if (k === 'recebido' || k === 'aReceber' || k === 'vencido') return data.entradas[k]
    return data.saidas[k]
  }
  const openBucket = open ? bucketOf(open) : null

  const sectionTitle = (t: string, total: number, color: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '18px 0 10px' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{t}</span>
      <span style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600, color }}>{fmtBRL(total)}</span>
    </div>
  )
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Modo + período */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          {(['filtro', 'total'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, background: mode === m ? '#0f172a' : '#fff', color: mode === m ? '#fff' : '#64748b' }}>
              {m === 'filtro' ? 'Pelo filtro' : 'Visão total'}
            </button>
          ))}
        </div>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#64748b' }}>
          {isFiltro ? `Resumo de ${periodLabel}` : `Resumo geral de ${periodLabel}, sem filtros`}
        </span>
      </div>

      {/* Filtros */}
      {isFiltro && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Meses</label>
            <MultiSelect options={MONTH_OPTIONS} selected={months} onChange={setMonths} allLabel="Ano inteiro" style={selStyle} />
          </div>
          <div>
            <label style={labelStyle}>Ano</label>
            <input type="number" className="goon-input" style={{ width: 84 }} value={year} onChange={e => setYear(parseInt(e.target.value, 10))} />
          </div>
          <div>
            <label style={labelStyle}>Plano (entradas)</label>
            <MultiSelect options={PLAN_OPTIONS} selected={plans} onChange={setPlans} allLabel="Todos os planos" style={selStyle} />
          </div>
          <div>
            <label style={labelStyle}>Categoria (saídas)</label>
            <MultiSelect options={CATEGORY_OPTIONS} selected={cats} onChange={setCats} allLabel="Todas categorias" style={selStyle} />
          </div>
          <div>
            <label style={labelStyle}>Centro de custo (saídas)</label>
            <MultiSelect options={CENTER_OPTIONS} selected={centers} onChange={setCenters} allLabel="Todos centros" style={selStyle} />
          </div>
        </div>
      )}

      {loading && !data && <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-sans)', color: '#94a3b8' }}>Carregando…</div>}
      {!loading && !data && <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-sans)', color: '#b91c1c' }}>Não foi possível carregar o resumo.</div>}

      {data && (
        <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
          {/* Resultado */}
          <div style={{ ...grid, marginTop: 12 }}>
            {[
              { label: 'Saldo realizado', v: data.saldoRealizado, hint: 'Recebido menos despesas e comissões pagas' },
              { label: 'Saldo projetado', v: data.saldoProjetado, hint: 'Todas as entradas menos todas as saídas do período' },
              { label: 'Total de entradas', v: data.totalEntradas, hint: 'Recebido + a receber + vencido' },
              { label: 'Total de saídas', v: data.totalSaidas, hint: 'Pago + a pagar + atrasado + comissões' },
            ].map(x => (
              <div key={x.label} style={{ background: '#0f172a', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{x.label}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums', fontSize: 22, fontWeight: 700, marginTop: 4, color: x.label.startsWith('Saldo') ? (x.v >= 0 ? '#C7F900' : '#f87171') : '#fff' }}>{fmtBRL(x.v)}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{x.hint}</div>
              </div>
            ))}
          </div>

          {sectionTitle('Entradas', data.totalEntradas, '#16a34a')}
          <div style={grid}>
            {(['recebido', 'aReceber', 'vencido'] as const).map(k => (
              <Card key={k} k={k} bucket={data.entradas[k]} active={open === k} onClick={() => toggle(k)}
                sub={`${data.entradas[k].count} ${k === 'recebido' ? 'pagamentos' : 'parcelas'}`} />
            ))}
          </div>

          {sectionTitle('Saídas', data.totalSaidas, '#b91c1c')}
          <div style={grid}>
            {(['pago', 'aPagar', 'atrasado'] as const).map(k => (
              <Card key={k} k={k} bucket={data.saidas[k]} active={open === k} onClick={() => toggle(k)} />
            ))}
            <Card k="comissoes" bucket={data.saidas.comissoes} active={open === 'comissoes'} onClick={() => toggle('comissoes')}
              sub={`${fmtBRL(data.saidas.comissoes.pago)} pagas · ${fmtBRL(data.saidas.comissoes.pendente)} pendentes`} />
          </div>

          {/* Standby: informativo, fora dos totais */}
          {sectionTitle('Clientes em standby', data.standby.total, '#d97706')}
          <div style={grid}>
            <Card k="standby" bucket={data.standby} active={open === 'standby'} onClick={() => toggle('standby')}
              sub={`${data.standby.count} parcelas congeladas, fora dos totais`} />
          </div>

          {/* Detalhe do card clicado */}
          {open && openBucket && (
            <div style={{ marginTop: 18, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', borderLeft: `3px solid ${CARDS[open].accent}` }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  {CARDS[open].label} · {openBucket.count} {openBucket.count === 1 ? 'item' : 'itens'} · {fmtBRL(openBucket.total)}
                </span>
                <button className="goon-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setOpen(null)}>Fechar</button>
              </div>
              {openBucket.items.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', fontFamily: 'var(--font-sans)', fontSize: 13, color: '#94a3b8' }}>{CARDS[open].empty}</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="goon-table">
                    <thead>
                      <tr><th>Data</th><th>{CARDS[open].side === 'entrada' || open === 'comissoes' ? 'Cliente' : 'Despesa'}</th><th>Detalhe</th><th style={{ textAlign: 'right' }}>Valor</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {openBucket.items.map(i => (
                        <tr key={i.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(i.date)}</td>
                          <td>{i.clientId ? <a href={`/clients/${i.clientId}`} style={{ color: '#0f172a', fontWeight: 600, textDecoration: 'underline' }}>{i.name}</a> : i.name}</td>
                          <td style={{ color: '#64748b', fontSize: 12.5 }}>{i.detail.split(' · ').map(d => CATEGORY_LABEL[d] ?? CENTER_LABEL[d] ?? d).join(' · ')}</td>
                          <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmtBRL(i.value)}</td>
                          <td style={{ fontSize: 12.5 }}>{STATUS_LABEL[i.status] ?? i.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {isFiltro && (plans.length > 0 || cats.length > 0 || centers.length > 0) && (
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#94a3b8', marginTop: 14 }}>
              O filtro de Plano vale para as entradas e comissões. Categoria e Centro de custo valem para as despesas.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
