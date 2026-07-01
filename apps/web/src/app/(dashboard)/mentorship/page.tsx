'use client'

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface Mentee {
  clientId: string
  company: string
  responsible: string | null
  segment: string | null
  tier: string | null
  mentorName: string | null
  status: string
  openActions: number
  overdueActions: number
  daysSinceContact: number | null
  attention: boolean
  lastMetrics: { faturamentoAno: number | null; numVendas: number | null; ticketMedio: number | null; roas: number | null; seguidoresIg: number | null; sessionDate: string } | null
}
interface Kpis { ativos: number; total: number; emAtencao: number; acoesPendentes: number; acoesAtrasadas: number }
interface CaseStudy { id: string; sessionDate: string; mentorName: string | null; faturamentoAno: number | null; numVendas: number | null; ticketMedio: number | null; investimentoTrafego: number | null; roas: number | null; seguidoresIg: number | null; situacaoAtual: string | null; oQueTrabalhou: string | null; proximosPassos: string | null }
interface ActionItem { id: string; what: string; who: string | null; dueDate: string | null; done: boolean }
interface Detail {
  profile: { mentorName: string | null; status: string; notes: string | null; mainPains: string | null; goal: string | null }
  client: { companyName: string; responsible: string | null; email: string | null; whatsapp: string | null; plans: { product: { code: string; name: string } }[] } | null
  attention: boolean
  caseStudies: CaseStudy[]
  actionItems: ActionItem[]
  meetings: { id: string; title: string; type: string; date: string; status: string }[]
}

const fmtBRL = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const fmtN = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR')
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

const card: CSSProperties = { border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', background: 'white' }
const inp: CSSProperties = { padding: '6px 10px', border: '1px solid #e2e8f0', fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%' }
const btn: CSSProperties = { padding: '6px 12px', border: '1px solid #e2e8f0', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }

export default function MentorshipPage() {
  const [data, setData] = useState<Mentee[]>([])
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [q, setQ] = useState('')
  const [onlyAttention, setOnlyAttention] = useState(false)
  const [mentorFilter, setMentorFilter] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (q) p.set('q', q)
      if (onlyAttention) p.set('attention', 'true')
      if (mentorFilter) p.set('mentor', mentorFilter)
      const [c, k] = await Promise.all([
        apiFetch<{ mentees: Mentee[] }>(`/api/mentorship/cockpit?${p}`),
        apiFetch<Kpis>('/api/mentorship/kpis'),
      ])
      setData(c.mentees); setKpis(k)
    } catch { toast.error('Erro ao carregar') } finally { setLoading(false) }
  }, [q, onlyAttention, mentorFilter])

  useEffect(() => { load() }, [load])

  const mentors = [...new Set(data.map(m => m.mentorName).filter(Boolean))] as string[]

  return (
    <div style={{ padding: '16px 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 20, margin: '0 0 2px' }}>MENTORADOS</h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888', margin: 0 }}>Acompanhamento por sessão — estudo de caso, ações e sinais de atenção.</p>
        </div>
        <button onClick={() => setEnrollOpen(true)} style={{ ...btn, background: 'black', color: 'white' }}>+ INSCREVER CLIENTE</button>
      </div>

      {/* KPIs */}
      {kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, margin: '14px 0' }}>
          {[
            { label: 'Em acompanhamento', value: kpis.ativos, color: '#4A78FF' },
            { label: 'Em atenção', value: kpis.emAtencao, color: kpis.emAtencao > 0 ? '#dc2626' : '#16a34a' },
            { label: 'Ações pendentes', value: kpis.acoesPendentes, color: '#0d9488' },
            { label: 'Ações atrasadas', value: kpis.acoesAtrasadas, color: kpis.acoesAtrasadas > 0 ? '#dc2626' : '#888' },
          ].map(k => (
            <div key={k.label} style={{ ...card, padding: '12px 14px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: '#666' }}>{k.label}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 22, color: k.color, marginTop: 2 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} style={{ ...inp, width: 200 }} />
        <select value={mentorFilter} onChange={e => setMentorFilter(e.target.value)} style={{ ...inp, width: 'auto' }}>
          <option value="">Todos mentores</option>
          {mentors.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={() => setOnlyAttention(v => !v)} style={{ ...btn, background: onlyAttention ? '#dc2626' : 'white', color: onlyAttention ? 'white' : 'black' }}>🔴 Só em atenção</button>
      </div>

      {/* Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {data.map(m => (
          <div key={m.clientId} onClick={() => setSelected(m.clientId)} style={{ ...card, padding: 14, cursor: 'pointer', borderLeft: `4px solid ${m.attention ? '#dc2626' : '#16a34a'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>{m.company}</div>
              {m.tier && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700, background: '#0A0A0C', color: 'white', padding: '2px 5px' }}>{m.tier}</span>}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888', marginTop: 2 }}>Mentor: {m.mentorName ?? '—'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              <span style={{ background: m.overdueActions > 0 ? '#fee2e2' : '#f1f5f9', color: m.overdueActions > 0 ? '#dc2626' : '#555', padding: '2px 6px', fontWeight: 700 }}>{m.openActions} ações{m.overdueActions > 0 ? ` · ${m.overdueActions} atras.` : ''}</span>
              <span style={{ background: '#f1f5f9', color: '#555', padding: '2px 6px' }}>{m.daysSinceContact == null ? 'sem contato' : `${m.daysSinceContact}d atrás`}</span>
            </div>
            {m.lastMetrics && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#666', marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 6 }}>
                Fat/ano {fmtBRL(m.lastMetrics.faturamentoAno)} · ROAS {m.lastMetrics.roas ?? '—'}x · IG {fmtN(m.lastMetrics.seguidoresIg)}
              </div>
            )}
          </div>
        ))}
        {!loading && data.length === 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#888', padding: 20 }}>Nenhum cliente em acompanhamento. Clique em &quot;Inscrever cliente&quot;.</div>}
      </div>

      {selected && <Drawer clientId={selected} onClose={() => setSelected(null)} onChange={load} />}
      {enrollOpen && <EnrollModal onClose={() => setEnrollOpen(false)} onDone={() => { setEnrollOpen(false); load() }} />}
    </div>
  )
}

// ============ DRAWER (detalhe / jornada) ============
function Drawer({ clientId, onClose, onChange }: { clientId: string; onClose: () => void; onChange: () => void }) {
  const [d, setD] = useState<Detail | null>(null)
  const [tab, setTab] = useState<'acoes' | 'dados' | 'reunioes'>('acoes')
  const load = useCallback(() => { apiFetch<Detail>(`/api/mentorship/clients/${clientId}`).then(setD).catch(() => {}) }, [clientId])
  useEffect(() => { load() }, [load])

  // contexto (dores / objetivo)
  const [ctx, setCtx] = useState<{ mainPains: string; goal: string } | null>(null)
  useEffect(() => { if (d) setCtx({ mainPains: d.profile.mainPains ?? '', goal: d.profile.goal ?? '' }) }, [d])
  async function saveCtx() {
    if (!ctx) return
    await apiFetch(`/api/mentorship/profile/${clientId}`, { method: 'PATCH', body: JSON.stringify(ctx) })
    toast.success('Contexto salvo'); load()
  }

  // nova ação
  const [aWhat, setAWhat] = useState(''); const [aWho, setAWho] = useState(''); const [aWhen, setAWhen] = useState('')
  async function addAction() {
    if (!aWhat.trim()) return
    await apiFetch('/api/mentorship/action-items', { method: 'POST', body: JSON.stringify({ clientId, what: aWhat, who: aWho || undefined, dueDate: aWhen || undefined }) })
    setAWhat(''); setAWho(''); setAWhen(''); load(); onChange()
  }
  async function toggleAction(a: ActionItem) {
    await apiFetch(`/api/mentorship/action-items/${a.id}`, { method: 'PATCH', body: JSON.stringify({ done: !a.done }) }); load(); onChange()
  }

  // novo estudo de caso
  const [showCase, setShowCase] = useState(false)
  const [cs, setCs] = useState<Record<string, string>>({})
  async function addCase() {
    const num = (k: string) => cs[k] ? Number(cs[k].replace(/[^\d.,-]/g, '').replace(',', '.')) : undefined
    await apiFetch('/api/mentorship/case-studies', { method: 'POST', body: JSON.stringify({
      clientId, sessionDate: cs.sessionDate || undefined,
      faturamentoAno: num('faturamentoAno'), numVendas: num('numVendas'), ticketMedio: num('ticketMedio'),
      investimentoTrafego: num('investimentoTrafego'), roas: num('roas'), seguidoresIg: num('seguidoresIg'),
      situacaoAtual: cs.situacaoAtual || undefined, oQueTrabalhou: cs.oQueTrabalhou || undefined, proximosPassos: cs.proximosPassos || undefined,
    }) })
    toast.success('Estudo de caso salvo'); setCs({}); setShowCase(false); load(); onChange()
  }

  const now = Date.now()
  const M = [
    ['faturamentoAno', 'Faturamento (ano) R$'], ['numVendas', 'Nº vendas'], ['ticketMedio', 'Ticket médio R$'],
    ['investimentoTrafego', 'Invest. tráfego R$'], ['roas', 'ROAS (x)'], ['seguidoresIg', 'Seguidores IG'],
  ] as const

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(560px, 100%)', height: '100%', background: '#f8fafc', overflowY: 'auto', padding: 18 }}>
        {!d ? <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>Carregando...</div> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 18, margin: 0 }}>{d.client?.companyName}</h2>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888' }}>{d.client?.responsible} · Mentor: {d.profile.mentorName ?? '—'} · {d.profile.status}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <a href={`/mentorship-print/${clientId}`} target="_blank" style={{ ...btn, textDecoration: 'none', color: 'black', display: 'inline-block' }}>📄 PDF</a>
                <button onClick={onClose} style={btn}>✕</button>
              </div>
            </div>
            {d.attention && <div style={{ background: '#fee2e2', color: '#dc2626', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, padding: '6px 10px', marginTop: 10 }}>🔴 Em atenção — ação atrasada ou tempo sem sessão</div>}

            {/* Contexto: dores + objetivo */}
            {ctx && (
              <div style={{ ...card, padding: 12, marginTop: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: '#666', marginBottom: 6 }}>CONTEXTO DA MENTORIA</div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888' }}>Principais dores</label>
                <textarea value={ctx.mainPains} onChange={e => setCtx({ ...ctx, mainPains: e.target.value })} style={{ ...inp, minHeight: 40, resize: 'vertical', marginBottom: 6 }} />
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888' }}>Objetivo com a mentoria</label>
                <textarea value={ctx.goal} onChange={e => setCtx({ ...ctx, goal: e.target.value })} style={{ ...inp, minHeight: 40, resize: 'vertical', marginBottom: 6 }} />
                <button onClick={saveCtx} style={{ ...btn, background: '#0A0A0C', color: 'white' }}>Salvar contexto</button>
              </div>
            )}

            {/* tabs */}
            <div style={{ display: 'flex', gap: 8, margin: '14px 0' }}>
              {([['acoes', `AÇÕES (${d.actionItems.filter(a => !a.done).length})`], ['dados', `DADOS DO NEGÓCIO (${d.caseStudies.length})`], ['reunioes', `REUNIÕES (${d.meetings.length})`]] as const).map(([t, label]) => (
                <button key={t} onClick={() => setTab(t)} style={{ ...btn, background: tab === t ? 'black' : 'white', color: tab === t ? 'white' : 'black' }}>{label}</button>
              ))}
            </div>

            {tab === 'acoes' && (
              <div>
                {/* nova ação: O QUE / QUEM / QUANDO */}
                <div style={{ ...card, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: '#666', marginBottom: 6 }}>NOVA AÇÃO</div>
                  <input placeholder="O QUE" value={aWhat} onChange={e => setAWhat(e.target.value)} style={{ ...inp, marginBottom: 6 }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input placeholder="QUEM" value={aWho} onChange={e => setAWho(e.target.value)} style={inp} />
                    <input type="date" placeholder="QUANDO" value={aWhen} onChange={e => setAWhen(e.target.value)} style={inp} />
                    <button onClick={addAction} style={{ ...btn, background: '#16a34a', color: 'white' }}>+</button>
                  </div>
                </div>
                {d.actionItems.map(a => {
                  const overdue = !a.done && a.dueDate && new Date(a.dueDate).getTime() < now
                  return (
                    <div key={a.id} style={{ ...card, padding: '8px 10px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, opacity: a.done ? 0.55 : 1 }}>
                      <input type="checkbox" checked={a.done} onChange={() => toggleAction(a)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textDecoration: a.done ? 'line-through' : 'none' }}>{a.what}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: overdue ? '#dc2626' : '#888' }}>{a.who ?? '—'} · {a.dueDate ? fmtDate(a.dueDate) : 'sem prazo'}{overdue ? ' · ATRASADA' : ''}</div>
                      </div>
                    </div>
                  )
                })}
                {d.actionItems.length === 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888' }}>Nenhuma ação ainda.</div>}
              </div>
            )}

            {tab === 'dados' && (
              <div>
                <button onClick={() => setShowCase(s => !s)} style={{ ...btn, background: showCase ? '#888' : '#4A78FF', color: 'white', marginBottom: 12 }}>{showCase ? 'Cancelar' : '+ REGISTRAR DADOS DA SESSÃO'}</button>
                {showCase && (
                  <div style={{ ...card, padding: 12, marginBottom: 12 }}>
                    <input type="date" value={cs.sessionDate ?? ''} onChange={e => setCs({ ...cs, sessionDate: e.target.value })} style={{ ...inp, marginBottom: 8 }} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                      {M.map(([k, label]) => <input key={k} placeholder={label} value={cs[k] ?? ''} onChange={e => setCs({ ...cs, [k]: e.target.value })} style={inp} />)}
                    </div>
                    {['situacaoAtual', 'oQueTrabalhou', 'proximosPassos'].map((k, i) => (
                      <textarea key={k} placeholder={['O que foi falado na reunião', 'O que foi passado ao cliente', 'Próximos passos'][i]} value={cs[k] ?? ''} onChange={e => setCs({ ...cs, [k]: e.target.value })} style={{ ...inp, marginBottom: 6, minHeight: 44, resize: 'vertical' }} />
                    ))}
                    <button onClick={addCase} style={{ ...btn, background: '#16a34a', color: 'white' }}>SALVAR</button>
                  </div>
                )}
                {d.caseStudies.map(s => (
                  <div key={s.id} style={{ ...card, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>{fmtDate(s.sessionDate)} {s.mentorName ? `· ${s.mentorName}` : ''}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      <Metric l="Fat/ano" v={fmtBRL(s.faturamentoAno)} /><Metric l="Vendas" v={fmtN(s.numVendas)} /><Metric l="Ticket" v={fmtBRL(s.ticketMedio)} />
                      <Metric l="Tráfego" v={fmtBRL(s.investimentoTrafego)} /><Metric l="ROAS" v={s.roas != null ? s.roas + 'x' : '—'} /><Metric l="IG" v={fmtN(s.seguidoresIg)} />
                    </div>
                    {s.situacaoAtual && <Note l="O que foi falado" v={s.situacaoAtual} />}
                    {s.oQueTrabalhou && <Note l="O que foi passado" v={s.oQueTrabalhou} />}
                    {s.proximosPassos && <Note l="Próximos passos" v={s.proximosPassos} />}
                  </div>
                ))}
                {d.caseStudies.length === 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888' }}>Nenhum dado de negócio registrado ainda.</div>}
              </div>
            )}

            {tab === 'reunioes' && (
              <div>
                {d.meetings.map(m => (
                  <div key={m.id} style={{ ...card, padding: 10, marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                      <span style={{ fontWeight: 700 }}>{fmtDate(m.date)} · {m.title}</span>
                      <span style={{ fontSize: 9, background: m.status === 'DONE' ? '#dcfce7' : m.status === 'SCHEDULED' ? '#dbeafe' : '#f1f5f9', color: m.status === 'DONE' ? '#16a34a' : m.status === 'SCHEDULED' ? '#2563eb' : '#888', padding: '2px 6px', fontWeight: 700 }}>{m.status}</span>
                    </div>
                  </div>
                ))}
                {d.meetings.length === 0 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888' }}>Nenhuma reunião registrada.</div>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Metric({ l, v }: { l: string; v: string }) {
  return <div><span style={{ color: '#888' }}>{l}: </span><span style={{ fontWeight: 700 }}>{v}</span></div>
}
function Note({ l, v }: { l: string; v: string }) {
  return <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, marginTop: 4 }}><span style={{ color: '#888', fontWeight: 700 }}>{l}: </span>{v}</div>
}

// ============ MODAL inscrever ============
function EnrollModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [list, setList] = useState<{ id: string; company: string; responsible: string | null; tier: string | null }[]>([])
  const [sel, setSel] = useState(''); const [mentor, setMentor] = useState('')
  useEffect(() => { apiFetch<typeof list>('/api/mentorship/available-clients').then(setList).catch(() => {}) }, [])
  async function go() {
    if (!sel) return
    try { await apiFetch('/api/mentorship/enroll', { method: 'POST', body: JSON.stringify({ clientId: sel, mentorName: mentor || undefined }) }); toast.success('Inscrito'); onDone() }
    catch { toast.error('Erro ao inscrever') }
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, padding: 20, width: 'min(420px, 90%)' }}>
        <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 15, margin: '0 0 12px' }}>Inscrever cliente no acompanhamento</h3>
        <select value={sel} onChange={e => setSel(e.target.value)} style={{ ...inp, marginBottom: 8 }}>
          <option value="">Selecione um cliente ativo...</option>
          {list.map(c => <option key={c.id} value={c.id}>{c.company}{c.tier ? ` (${c.tier})` : ''}</option>)}
        </select>
        <input placeholder="Mentor (opcional — puxa do plano se vazio)" value={mentor} onChange={e => setMentor(e.target.value)} style={{ ...inp, marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn}>Cancelar</button>
          <button onClick={go} style={{ ...btn, background: 'black', color: 'white' }}>Inscrever</button>
        </div>
      </div>
    </div>
  )
}
