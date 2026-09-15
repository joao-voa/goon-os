'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { GoonLogo } from '@/components/GoonLogo'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc', card: '#fff', neon: '#C7F900', green: '#16a34a', red: '#dc2626' }
const disp = 'var(--font-display)', sans = 'var(--font-sans)'

type Field = { key: string; label: string; money?: boolean; hint?: string }
const FIELDS: Field[] = [
  { key: 'faturamento', label: 'Faturamento do mês', money: true },
  { key: 'clientesAtivos', label: 'Clientes ativos' },
  { key: 'numVendas', label: 'Nº de vendas' },
  { key: 'ticketMedio', label: 'Ticket médio', money: true },
  { key: 'estoqueQtd', label: 'Estoque (peças)' },
  { key: 'estoqueValor', label: 'Estoque (R$)', money: true },
  { key: 'investimentoTrafego', label: 'Investimento em tráfego', money: true },
  { key: 'roas', label: 'ROAS', hint: 'retorno do tráfego (ex.: 3,5)' },
  { key: 'seguidoresIg', label: 'Seguidores no Instagram' },
]

interface MonthData { month: string; [k: string]: number | string | null }
interface PortalData { company: string; responsible: string | null; mentorName: string | null; months: MonthData[] }

const ymNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const shiftYm = (ym: string, delta: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const mesFull = (ym: string) => { const s = new Date(ym + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1) }
const mesShort = (ym: string) => new Date(ym + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
const numOr = (v: string) => { const t = v.trim(); if (!t) return null; const n = Number(t.replace(/[^\d.,-]/g, '').replace(',', '.')); return isNaN(n) ? null : n }

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(ymNow())
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [savedMonth, setSavedMonth] = useState<string | null>(null)

  const load = useCallback(() => {
    fetch(`${API_URL}/api/portal/${token}`)
      .then(async r => { if (!r.ok) throw new Error(); return r.json() })
      .then((d: PortalData) => setData(d))
      .catch(() => setError('Link inválido ou expirado. Peça um novo link ao seu mentor.'))
  }, [token])
  useEffect(() => { load() }, [load])

  const storedFor = (ym: string): Record<string, string> => {
    const row = data?.months.find(m => m.month === ym)
    const out: Record<string, string> = {}
    for (const f of FIELDS) { const v = row?.[f.key]; out[f.key] = (v == null || v === '') ? '' : String(v) }
    return out
  }
  const valuesFor = (ym: string) => drafts[ym] ?? storedFor(ym)
  const setField = (ym: string, key: string, v: string) =>
    setDrafts(d => ({ ...d, [ym]: { ...valuesFor(ym), [key]: v } }))

  async function save() {
    if (!data) return
    setSaving(true)
    const vals = valuesFor(month)
    const body: Record<string, unknown> = { month }
    for (const f of FIELDS) body[f.key] = numOr(vals[f.key] ?? '')
    try {
      const r = await fetch(`${API_URL}/api/portal/${token}/monthly`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error()
      setSavedMonth(month)
      setTimeout(() => setSavedMonth(null), 2500)
      load()
    } catch { setError('Não foi possível salvar. Tente novamente.') } finally { setSaving(false) }
  }

  // meses recentes (atual + 5 anteriores) + qualquer mês já preenchido
  const recent = Array.from({ length: 6 }, (_, i) => shiftYm(ymNow(), -i))
  const existing = (data?.months ?? []).map(m => m.month)
  const monthChips = [...new Set([...recent, ...existing])].sort((a, b) => b.localeCompare(a)).slice(0, 12)
  const preenchido = (ym: string) => data?.months.some(m => m.month === ym && m.faturamento != null)

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0A0A0C', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, borderRadius: 16, padding: 32, maxWidth: 380, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><GoonLogo height={26} fill="#0A0A0C" /></div>
        <div style={{ fontFamily: sans, fontSize: 14, color: C.mid, lineHeight: 1.5 }}>{error}</div>
      </div>
    </div>
  )
  if (!data) return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: sans, color: C.mid }}>Carregando…</div>

  const vals = valuesFor(month)
  const isSaved = savedMonth === month

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: sans, color: C.ink }}>
      {/* topo escuro */}
      <div style={{ background: '#0A0A0C', padding: '22px 20px 20px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <GoonLogo height={22} fill="#F2F2F2" />
            {data.mentorName && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Mentor: {data.mentorName}</span>}
          </div>
          <div style={{ width: 30, height: 3, background: C.neon, borderRadius: 2, margin: '14px 0 12px' }} />
          <h1 style={{ fontFamily: disp, fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>{data.company}</h1>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginTop: 6, lineHeight: 1.5 }}>
            Preencha os números do seu negócio a cada mês. Isso ajuda seu mentor a acompanhar sua evolução e preparar as próximas sessões.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '18px 20px 60px' }}>
        {/* seletor de mês */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setMonth(m => shiftYm(m, -1))} style={navBtn}>◂</button>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1, paddingBottom: 2 }}>
            {monthChips.map(ym => {
              const active = ym === month
              return (
                <button key={ym} onClick={() => setMonth(ym)} style={{
                  flexShrink: 0, padding: '7px 12px', borderRadius: 100, cursor: 'pointer', fontFamily: sans, fontSize: 12.5, fontWeight: 600,
                  border: `1px solid ${active ? C.ink : C.line}`, background: active ? C.ink : C.card, color: active ? '#fff' : C.mid,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  {mesShort(ym)}
                  {preenchido(ym) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? C.neon : C.green }} />}
                </button>
              )
            })}
          </div>
          <button onClick={() => setMonth(m => shiftYm(m, 1))} style={navBtn}>▸</button>
        </div>

        {/* card do mês */}
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 700 }}>{mesFull(month)}</span>
            {preenchido(month) && <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>já preenchido</span>}
          </div>
          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            {FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: C.mid, marginBottom: 5 }}>
                  {f.label}{f.hint && <span style={{ color: C.dim, fontWeight: 400 }}> · {f.hint}</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  {f.money && <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.dim, fontSize: 13 }}>R$</span>}
                  <input
                    inputMode="decimal"
                    value={vals[f.key] ?? ''}
                    onChange={e => setField(month, f.key, e.target.value)}
                    placeholder="—"
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: f.money ? '10px 12px 10px 34px' : '10px 12px',
                      border: `1px solid ${C.line}`, borderRadius: 9, fontFamily: sans, fontSize: 15, fontWeight: f.key === 'faturamento' ? 700 : 500,
                      color: C.ink, outline: 'none', fontVariantNumeric: 'tabular-nums',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = C.neon; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(199,249,0,0.18)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.boxShadow = 'none' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 18px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={save} disabled={saving} style={{
              background: isSaved ? C.green : C.neon, color: isSaved ? '#fff' : C.ink, border: 'none', borderRadius: 10,
              padding: '12px 22px', fontFamily: sans, fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
              boxShadow: isSaved ? 'none' : '0 4px 14px rgba(199,249,0,0.35)', opacity: saving ? 0.7 : 1,
            }}>{saving ? 'Salvando…' : isSaved ? '✓ Salvo!' : 'Salvar mês'}</button>
            <span style={{ fontSize: 12, color: C.dim }}>Você pode voltar e atualizar quando quiser.</span>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 26, fontSize: 11, color: C.dim }}>
          GOON &copy; 2026 · <span style={{ letterSpacing: '0.08em' }}>GLOBAL <span style={{ color: '#a3cc00' }}>OR</span> NOTHING</span>
        </p>
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = { flexShrink: 0, width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: C.card, color: C.mid, cursor: 'pointer', fontSize: 14 }
