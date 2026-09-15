'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { GoonLogo } from '@/components/GoonLogo'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc', card: '#fff', neon: '#C7F900', green: '#16a34a', greenDk: '#15803d', red: '#dc2626', amber: '#f59e0b', slate: '#475569' }
const disp = 'var(--font-display)', sans = 'var(--font-sans)'
const tnum: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' }

const brl = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const num = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR')

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
interface Task { id: string; what: string; dueDate: string | null; overdue: boolean }
interface PMeeting { id: string; title: string; date: string; status: string }
interface PortalData {
  mode: 'fill' | 'panel'
  company: string; responsible: string | null; mentorName: string | null; goal: string | null
  months: MonthData[]; tasks: Task[]; meetings: PMeeting[]; nextSteps: string | null; lastSessionDate: string | null
}

const ymNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const shiftYm = (ym: string, delta: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + delta, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const mesFull = (ym: string) => { const s = new Date(ym + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1) }
const mesShort = (ym: string) => new Date(ym + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
const numOr = (v: string) => { const t = v.trim(); if (!t) return null; const n = Number(t.replace(/[^\d.,-]/g, '').replace(',', '.')); return isNaN(n) ? null : n }
const dtFull = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

// ───────── gráfico de linha interativo ─────────
function Trend({ data, fmt, color = C.ink }: { data: { month: string; value: number }[]; fmt: (n: number) => string; color?: string }) {
  const [hi, setHi] = useState<number | null>(null)
  if (data.length < 2) return <div style={{ color: C.mid, fontSize: 13, padding: '40px 0', textAlign: 'center' }}>Preencha 2+ meses para ver sua evolução.</div>
  const W = 680, H = 220, padL = 50, padR = 12, padT = 16, padB = 28
  const ys = data.map(d => d.value)
  const maxYraw = Math.max(...ys), minY = Math.min(0, ...ys)
  const maxY = maxYraw === minY ? maxYraw + 1 : maxYraw
  const n = data.length
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - (v - minY) / (maxY - minY)) * (H - padT - padB)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)},${(H - padB).toFixed(1)} L${x(0).toFixed(1)},${(H - padB).toFixed(1)} Z`
  const grid = [0, 0.25, 0.5, 0.75, 1].map(f => minY + f * (maxY - minY))
  const compact = (v: number) => Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))
  const xStep = Math.ceil(n / 8)
  const sel = hi != null ? data[hi] : null
  const selPrev = hi != null && hi > 0 ? data[hi - 1] : null
  const selG = sel && selPrev && selPrev.value !== 0 ? Math.round(((sel.value - selPrev.value) / selPrev.value) * 100) : null
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} onMouseLeave={() => setHi(null)}>
      <defs><linearGradient id="pt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color === C.ink ? C.neon : color} stopOpacity="0.28" /><stop offset="100%" stopColor={color === C.ink ? C.neon : color} stopOpacity="0" /></linearGradient></defs>
      {grid.map((gv, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} stroke={C.line} strokeWidth="1" />
          <text x={padL - 8} y={y(gv) + 3} textAnchor="end" fill={C.dim} fontSize="10" fontFamily={sans}>{compact(gv)}</text>
        </g>
      ))}
      <path d={area} fill="url(#pt)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (i % xStep === 0 || i === n - 1) && <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fill={C.mid} fontSize="10" fontFamily={sans}>{mesShort(d.month)}</text>)}
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.value)} r={hi === i ? 4.5 : 2.5} fill={hi === i ? (color === C.ink ? C.neon : color) : C.card} stroke={color} strokeWidth="1.6" />)}
      {data.map((d, i) => <rect key={i} x={x(i) - (W - padL - padR) / (n - 1) / 2} y={0} width={(W - padL - padR) / (n - 1)} height={H} fill="transparent" onMouseEnter={() => setHi(i)} />)}
      {sel && (() => {
        const bx = Math.min(Math.max(x(hi!) - 64, padL), W - padR - 130)
        return (
          <g pointerEvents="none">
            <line x1={x(hi!)} x2={x(hi!)} y1={padT} y2={H - padB} stroke={C.dim} strokeWidth="1" strokeDasharray="3 3" />
            <rect x={bx} y={padT} width="130" height={selG != null ? 48 : 34} rx="7" fill={C.ink} opacity="0.96" />
            <text x={bx + 10} y={padT + 15} fill="#fff" fontSize="10.5" fontFamily={sans} opacity="0.8">{mesFull(sel.month)}</text>
            <text x={bx + 10} y={padT + 29} fill="#fff" fontSize="12.5" fontFamily={sans} fontWeight="700">{fmt(sel.value)}</text>
            {selG != null && <text x={bx + 10} y={padT + 43} fill={selG >= 0 ? C.neon : '#fca5a5'} fontSize="10.5" fontFamily={sans} fontWeight="700">{selG >= 0 ? '▲' : '▼'} {Math.abs(selG)}% vs mês ant.</text>}
          </g>
        )
      })()}
    </svg>
  )
}

function DeltaChip({ pct }: { pct: number | null }) {
  if (pct == null) return null
  const up = pct >= 0
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: up ? C.green : C.red, background: up ? '#dcfce7' : '#fee2e2', borderRadius: 100, padding: '2px 9px', ...tnum }}>{up ? '▲' : '▼'} {Math.abs(pct)}%</span>
}

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState('')
  const [month, setMonth] = useState(ymNow())
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [savedMonth, setSavedMonth] = useState<string | null>(null)
  const [metric, setMetric] = useState('faturamento')

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
  const setFieldVal = (ym: string, key: string, v: string) => setDrafts(d => ({ ...d, [ym]: { ...valuesFor(ym), [key]: v } }))

  async function save() {
    if (!data) return
    setSaving(true)
    const vals = valuesFor(month)
    const body: Record<string, unknown> = { month }
    for (const f of FIELDS) body[f.key] = numOr(vals[f.key] ?? '')
    try {
      const r = await fetch(`${API_URL}/api/portal/${token}/monthly`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!r.ok) throw new Error()
      setSavedMonth(month); setTimeout(() => setSavedMonth(null), 2500); load()
    } catch { setError('Não foi possível salvar. Tente novamente.') } finally { setSaving(false) }
  }

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0A0A0C', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: C.card, borderRadius: 16, padding: 32, maxWidth: 380, textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><GoonLogo height={26} fill="#0A0A0C" /></div>
        <div style={{ fontFamily: sans, fontSize: 14, color: C.mid, lineHeight: 1.5 }}>{error}</div>
      </div>
    </div>
  )
  if (!data) return <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: sans, color: C.mid }}>Carregando…</div>

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: sans, color: C.ink }}>
      {/* topo escuro */}
      <div style={{ background: '#0A0A0C', padding: '22px 20px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <GoonLogo height={22} fill="#F2F2F2" />
            {data.mentorName && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Mentor: {data.mentorName}</span>}
          </div>
          <div style={{ width: 30, height: 3, background: C.neon, borderRadius: 2, margin: '14px 0 12px' }} />
          <h1 style={{ fontFamily: disp, fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>{data.company}</h1>
          {data.goal && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>🎯 {data.goal}</p>}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 18, padding: '5px 12px', borderRadius: 100, background: 'rgba(199,249,0,0.14)', border: '1px solid rgba(199,249,0,0.3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.neon }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{data.mode === 'panel' ? 'Meu painel' : 'Preencher meus dados'}</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 60px' }}>
        {data.mode === 'panel' ? <PanelView data={data} metric={metric} setMetric={setMetric} /> : (
          <FillView data={data} month={month} setMonth={setMonth} valuesFor={valuesFor} setFieldVal={setFieldVal} save={save} saving={saving} savedMonth={savedMonth} />
        )}
        <p style={{ textAlign: 'center', marginTop: 26, fontSize: 11, color: C.dim }}>
          GOON &copy; 2026 · <span style={{ letterSpacing: '0.08em' }}>GLOBAL <span style={{ color: '#a3cc00' }}>OR</span> NOTHING</span>
        </p>
      </div>
    </div>
  )
}

// ───────── ABA: Meu painel (read-only) ─────────
function PanelView({ data, metric, setMetric }: { data: PortalData; metric: string; setMetric: (m: string) => void }) {
  const asc = data.months.slice().sort((a, b) => a.month.localeCompare(b.month))
  const withFat = asc.filter(m => m.faturamento != null) as { month: string; faturamento: number }[]
  const lastFat = withFat.length ? withFat[withFat.length - 1].faturamento : null
  const prevFat = withFat.length > 1 ? withFat[withFat.length - 2].faturamento : null
  const growth = lastFat != null && prevFat != null && prevFat !== 0 ? Math.round(((lastFat - prevFat) / prevFat) * 100) : null
  const bestFat = withFat.length ? Math.max(...withFat.map(m => m.faturamento)) : null
  const lastMonthLabel = withFat.length ? mesShort(withFat[withFat.length - 1].month) : '—'

  const METRICS: [string, string, (n: number) => string, string][] = [
    ['faturamento', 'Faturamento', brl, C.ink],
    ['clientesAtivos', 'Clientes', (n) => num(n), C.slate],
    ['numVendas', 'Vendas', (n) => num(n), C.green],
    ['ticketMedio', 'Ticket', brl, C.amber],
  ]
  const mCfg = METRICS.find(m => m[0] === metric)!
  const chartData = asc.filter(m => m[metric] != null).map(m => ({ month: m.month, value: m[metric] as number }))

  const upcoming = data.meetings.filter(m => new Date(m.date).getTime() >= Date.now() - 86400000).sort((a, b) => a.date.localeCompare(b.date))
  const past = data.meetings.filter(m => new Date(m.date).getTime() < Date.now() - 86400000)
  const nextMeeting = upcoming[0] ?? null
  const stLabel: Record<string, string> = { SCHEDULED: 'Agendada', DONE: 'Realizada', CANCELLED: 'Cancelada', RESCHEDULED: 'Reagendada', NO_SHOW: 'Não compareceu' }
  const stColor: Record<string, string> = { SCHEDULED: C.slate, DONE: C.green, CANCELLED: C.red, RESCHEDULED: C.amber, NO_SHOW: C.red }

  const empty = withFat.length === 0
  const card: React.CSSProperties = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }
  const kpis = [
    { l: `Faturamento · ${lastMonthLabel}`, v: brl(lastFat), delta: growth },
    { l: 'Melhor mês', v: brl(bestFat) },
    { l: 'Meses acompanhados', v: String(withFat.length) },
    { l: 'Tarefas em aberto', v: String(data.tasks.length) },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {empty && (
        <div style={{ ...card, padding: 20, textAlign: 'center' }}>
          <div style={{ fontFamily: disp, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Seu painel está quase pronto 🚀</div>
          <div style={{ fontSize: 13.5, color: C.mid, lineHeight: 1.5 }}>Assim que seus números forem preenchidos, sua evolução aparece aqui.</div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {kpis.map((k, i) => (
          <div key={k.l} style={{ ...card, padding: '14px 16px', borderTop: i === 0 ? `3px solid ${C.neon}` : `1px solid ${C.line}` }}>
            <div style={{ fontSize: 10.5, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k.l}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
              <span style={{ ...tnum, fontFamily: disp, fontSize: 22, fontWeight: 700 }}>{k.v}</span>
              {k.delta != null && <DeltaChip pct={k.delta} />}
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Minha evolução</span>
          <div style={{ display: 'flex', gap: 4, border: `1px solid ${C.line}`, borderRadius: 100, padding: 3 }}>
            {METRICS.map(([key, label]) => (
              <button key={key} onClick={() => setMetric(key)} style={{ padding: '4px 10px', border: 'none', borderRadius: 100, fontFamily: sans, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: metric === key ? C.ink : 'transparent', color: metric === key ? '#fff' : C.mid }}>{label}</button>
            ))}
          </div>
        </div>
        <Trend data={chartData} fmt={mCfg[2]} color={mCfg[3]} />
      </div>

      {/* Tarefas + Reuniões */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Tarefas */}
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 12 }}>Minhas tarefas ({data.tasks.length})</div>
          {data.tasks.length === 0 ? <div style={{ fontSize: 13, color: C.dim }}>Nenhuma tarefa pendente. 🎉</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.tasks.map(t => (
                <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 11px', background: C.bg, borderRadius: 9, borderLeft: `3px solid ${t.overdue ? C.red : C.neon}` }}>
                  <span style={{ width: 15, height: 15, borderRadius: 5, border: `2px solid ${C.dim}`, flexShrink: 0, marginTop: 1 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, lineHeight: 1.4 }}>{t.what}</div>
                    {t.dueDate && <div style={{ fontSize: 11.5, color: t.overdue ? C.red : C.mid, fontWeight: t.overdue ? 700 : 400, marginTop: 2 }}>{t.overdue ? 'Atrasada · ' : 'Prazo: '}{dtFull(t.dueDate)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reuniões */}
        <div style={{ ...card, padding: 16 }}>
          <div style={{ fontSize: 11, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 12 }}>Minhas reuniões</div>
          {nextMeeting && (
            <div style={{ background: '#0A0A0C', borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, color: C.neon, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Próxima reunião</div>
              <div style={{ fontSize: 14.5, color: '#fff', fontWeight: 700, marginTop: 4 }}>{new Date(nextMeeting.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{new Date(nextMeeting.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {nextMeeting.title}</div>
            </div>
          )}
          {data.meetings.length === 0 ? <div style={{ fontSize: 13, color: C.dim }}>Nenhuma reunião registrada.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
              {[...upcoming.slice(nextMeeting ? 1 : 0), ...past].map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 4px', borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: C.mid, ...tnum }}>{dtFull(m.date)}</div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: stColor[m.status] ?? C.mid, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 100, padding: '2px 9px', whiteSpace: 'nowrap' }}>{stLabel[m.status] ?? m.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Próximos passos */}
      {data.nextSteps && (
        <div style={{ ...card, padding: 16, borderLeft: `3px solid ${C.neon}` }}>
          <div style={{ fontSize: 11, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 8 }}>
            Próximos passos {data.lastSessionDate && <span style={{ color: C.dim, fontWeight: 400 }}>· da sessão de {dtFull(data.lastSessionDate)}</span>}
          </div>
          <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{data.nextSteps}</div>
        </div>
      )}
    </div>
  )
}

// ───────── ABA: Preencher dados ─────────
function FillView({ data, month, setMonth: setM, valuesFor, setFieldVal, save, saving, savedMonth }: {
  data: PortalData; month: string; setMonth: React.Dispatch<React.SetStateAction<string>>
  valuesFor: (ym: string) => Record<string, string>; setFieldVal: (ym: string, k: string, v: string) => void
  save: () => void; saving: boolean; savedMonth: string | null
}) {
  const recent = Array.from({ length: 6 }, (_, i) => shiftYm(ymNow(), -i))
  const existing = data.months.map(m => m.month)
  const monthChips = [...new Set([...recent, ...existing])].sort((a, b) => b.localeCompare(a)).slice(0, 12)
  const preenchido = (ym: string) => data.months.some(m => m.month === ym && m.faturamento != null)
  const vals = valuesFor(month)
  const isSaved = savedMonth === month
  const navBtn: React.CSSProperties = { flexShrink: 0, width: 34, height: 34, borderRadius: 9, border: `1px solid ${C.line}`, background: C.card, color: C.mid, cursor: 'pointer', fontSize: 14 }

  return (
    <div>
      <p style={{ fontSize: 13.5, color: C.mid, margin: '0 0 14px', lineHeight: 1.5 }}>Preencha os números do seu negócio a cada mês. Isso ajuda seu mentor a acompanhar sua evolução e preparar as próximas sessões.</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={() => setM(m => shiftYm(m, -1))} style={navBtn}>◂</button>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flex: 1, paddingBottom: 2 }}>
          {monthChips.map(ym => {
            const active = ym === month
            return (
              <button key={ym} onClick={() => setM(ym)} style={{
                flexShrink: 0, padding: '7px 12px', borderRadius: 100, cursor: 'pointer', fontFamily: sans, fontSize: 12.5, fontWeight: 600,
                border: `1px solid ${active ? C.ink : C.line}`, background: active ? C.ink : C.card, color: active ? '#fff' : C.mid, display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>{mesShort(ym)}{preenchido(ym) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? C.neon : C.green }} />}</button>
            )
          })}
        </div>
        <button onClick={() => setM(m => shiftYm(m, 1))} style={navBtn}>▸</button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: '0 1px 2px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 700 }}>{mesFull(month)}</span>
          {preenchido(month) && <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>já preenchido</span>}
        </div>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {FIELDS.map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: C.mid, marginBottom: 5 }}>{f.label}{f.hint && <span style={{ color: C.dim, fontWeight: 400 }}> · {f.hint}</span>}</label>
              <div style={{ position: 'relative' }}>
                {f.money && <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.dim, fontSize: 13 }}>R$</span>}
                <input inputMode="decimal" value={vals[f.key] ?? ''} onChange={e => setFieldVal(month, f.key, e.target.value)} placeholder="—"
                  style={{ width: '100%', boxSizing: 'border-box', padding: f.money ? '10px 12px 10px 34px' : '10px 12px', border: `1px solid ${C.line}`, borderRadius: 9, fontFamily: sans, fontSize: 15, fontWeight: f.key === 'faturamento' ? 700 : 500, color: C.ink, outline: 'none', ...tnum }}
                  onFocus={e => { e.currentTarget.style.borderColor = C.neon; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(199,249,0,0.18)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.boxShadow = 'none' }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 18px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={save} disabled={saving} style={{ background: isSaved ? C.green : C.neon, color: isSaved ? '#fff' : C.ink, border: 'none', borderRadius: 10, padding: '12px 22px', fontFamily: sans, fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', boxShadow: isSaved ? 'none' : '0 4px 14px rgba(199,249,0,0.35)', opacity: saving ? 0.7 : 1 }}>{saving ? 'Salvando…' : isSaved ? '✓ Salvo!' : 'Salvar mês'}</button>
          <span style={{ fontSize: 12, color: C.dim }}>Você pode voltar e atualizar quando quiser.</span>
        </div>
      </div>
    </div>
  )
}
