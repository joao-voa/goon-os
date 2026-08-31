'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface Channel { canal: string; valor: number }
interface CustomField { label: string; value: string }
interface Material { label: string; url?: string }
interface CaseStudy {
  id: string; sessionDate: string; mentorName: string | null
  faturamentoAno: number | null; numVendas: number | null; ticketMedio: number | null
  investimentoTrafego: number | null; roas: number | null; seguidoresIg: number | null; numClientes: number | null
  vendasPorCanal: Channel[] | null; customFields: CustomField[] | null; materiais: Material[] | null
  situacaoAtual: string | null; oQueTrabalhou: string | null; proximosPassos: string | null
  transcricao: string | null; pontosPrincipais: string | null
}
interface Action { id: string; what: string; who: string | null; dueDate: string | null; done: boolean; status: string }
interface Detail {
  profile: { mentorName: string | null; status: string; mainPains: string | null; goal: string | null }
  client?: { companyName: string } | null
  attention: boolean
  caseStudies: CaseStudy[]
  actionItems: Action[]
  meetings?: { id: string; title: string; type: string; date: string; status: string }[]
}

const brl = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const num = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR')
const dt = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'
const mono = 'var(--font-mono)'
const KANBAN: [string, string, string][] = [['TODO', 'A Fazer', '#64748b'], ['DOING', 'Fazendo', '#e6a800'], ['DONE', 'Feito', '#16a34a']]

export function ClientMentorship({ clientId }: { clientId: string }) {
  const [d, setD] = useState<Detail | null>(null)
  const [enrolled, setEnrolled] = useState<boolean | null>(null)
  const [tab, setTab] = useState<'evolucao' | 'sessoes' | 'tarefas'>('evolucao')
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(() => {
    apiFetch<Detail>(`/api/mentorship/clients/${clientId}`)
      .then(data => { setD(data); setEnrolled(true) })
      .catch(() => setEnrolled(false))
  }, [clientId])
  useEffect(() => { load() }, [load])

  async function enroll() {
    try { await apiFetch('/api/mentorship/enroll', { method: 'POST', body: JSON.stringify({ clientId }) }); toast.success('Inscrito no acompanhamento'); load() }
    catch { toast.error('Erro ao inscrever') }
  }
  async function moveAction(id: string, status: string) {
    setD(prev => prev ? { ...prev, actionItems: prev.actionItems.map(a => a.id === id ? { ...a, status, done: status === 'DONE' } : a) } : prev)
    try { await apiFetch(`/api/mentorship/action-items/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }) } catch { toast.error('Erro'); load() }
  }

  if (enrolled === null) return <div style={{ fontFamily: mono, fontSize: 12, color: '#888' }}>Carregando...</div>
  if (!enrolled) {
    return (
      <div style={{ border: '1px solid #e2e8f0', padding: 24, textAlign: 'center', background: 'white' }}>
        <div style={{ fontFamily: mono, fontSize: 13, marginBottom: 12 }}>Este cliente não está em acompanhamento de mentoria.</div>
        <button onClick={enroll} style={{ background: '#0A0A0C', color: 'white', border: 0, padding: '8px 16px', fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Inscrever no acompanhamento</button>
      </div>
    )
  }
  if (!d) return null

  const last = d.caseStudies[0]
  const doneCount = d.caseStudies.length
  const h: React.CSSProperties = { fontFamily: mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: 8 }
  const card: React.CSSProperties = { border: '1px solid #e2e8f0', background: 'white', padding: 14, marginBottom: 14 }
  const allChannels = [...new Set(d.caseStudies.flatMap(cs => (cs.vendasPorCanal ?? []).map(c => c.canal)))]

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: mono, fontSize: 12 }}>
          Mentor: <b>{d.profile.mentorName ?? '—'}</b> · {d.profile.status} · <b>{doneCount}</b> sessões
          {d.attention && <span style={{ marginLeft: 8, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', fontWeight: 700 }}>🔴 Em atenção</span>}
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: '#0A0A0C', color: 'white', border: 0, padding: '7px 14px', fontFamily: mono, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Registrar sessão</button>
      </div>

      {/* Contexto */}
      <div style={card}>
        <div style={h}>Contexto</div>
        <div style={{ fontFamily: mono, fontSize: 12, marginBottom: 4 }}><b>Dores:</b> {d.profile.mainPains || <span style={{ color: '#aaa' }}>—</span>}</div>
        <div style={{ fontFamily: mono, fontSize: 12 }}><b>Objetivo:</b> {d.profile.goal || <span style={{ color: '#aaa' }}>—</span>}</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {(['evolucao', 'sessoes', 'tarefas'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', border: '1px solid #e2e8f0', cursor: 'pointer', fontFamily: mono, fontSize: 11, fontWeight: 700,
            background: tab === t ? '#0A0A0C' : 'white', color: tab === t ? 'white' : '#666',
          }}>{t === 'evolucao' ? 'EVOLUÇÃO' : t === 'sessoes' ? 'SESSÕES' : `TAREFAS (${d.actionItems.filter(a => a.status !== 'DONE').length})`}</button>
        ))}
      </div>

      {/* ── EVOLUÇÃO (trackrecord) ── */}
      {tab === 'evolucao' && (
        <div style={{ ...card, overflowX: 'auto' }}>
          <div style={h}>Evolução do negócio</div>
          {d.caseStudies.length === 0 ? <div style={{ fontFamily: mono, fontSize: 11, color: '#888' }}>Nenhuma sessão registrada.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#0A0A0C', color: 'white', textTransform: 'uppercase', fontSize: 9 }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>Data</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Faturamento</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Ticket</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Clientes</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>Vendas</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>ROAS</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right' }}>IG</th>
                  {allChannels.map(c => <th key={c} style={{ padding: '6px 8px', textAlign: 'right' }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {d.caseStudies.slice().reverse().map(cs => (
                  <tr key={cs.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700 }}>{dt(cs.sessionDate)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{brl(cs.faturamentoAno)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{brl(cs.ticketMedio)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{num(cs.numClientes)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{num(cs.numVendas)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{cs.roas != null ? cs.roas + 'x' : '—'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{num(cs.seguidoresIg)}</td>
                    {allChannels.map(c => <td key={c} style={{ padding: '6px 8px', textAlign: 'right' }}>{brl((cs.vendasPorCanal ?? []).find(x => x.canal === c)?.valor ?? null)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {last?.customFields && last.customFields.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {last.customFields.map((f, i) => <div key={i} style={{ border: '1px solid #f1f5f9', padding: '4px 8px', fontFamily: mono, fontSize: 10 }}><span style={{ color: '#888' }}>{f.label}:</span> <b>{f.value}</b></div>)}
            </div>
          )}
        </div>
      )}

      {/* ── SESSÕES (timeline) ── */}
      {tab === 'sessoes' && (
        <div>
          {d.caseStudies.length === 0 && <div style={{ ...card, fontFamily: mono, fontSize: 11, color: '#888' }}>Nenhuma sessão registrada.</div>}
          {d.caseStudies.map(cs => (
            <div key={cs.id} style={card}>
              <div onClick={() => setExpanded(expanded === cs.id ? null : cs.id)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontFamily: mono, fontSize: 12, fontWeight: 700 }}>
                <span>{expanded === cs.id ? '▾' : '▸'} Sessão {dt(cs.sessionDate)}{cs.mentorName ? ` · ${cs.mentorName}` : ''}</span>
                <span style={{ color: '#888', fontWeight: 400 }}>{brl(cs.faturamentoAno)}</span>
              </div>
              {expanded === cs.id && (
                <div style={{ marginTop: 10, fontFamily: mono, fontSize: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cs.pontosPrincipais && <div><b>Principais pontos:</b><div style={{ whiteSpace: 'pre-wrap', color: '#333' }}>{cs.pontosPrincipais}</div></div>}
                  {cs.oQueTrabalhou && <div><b>O que foi passado:</b> {cs.oQueTrabalhou}</div>}
                  {cs.proximosPassos && <div><b>Próximos passos:</b> {cs.proximosPassos}</div>}
                  {cs.materiais && cs.materiais.length > 0 && <div><b>Materiais:</b> {cs.materiais.map((m, i) => m.url ? <a key={i} href={m.url} target="_blank" rel="noreferrer" style={{ color: '#4A78FF', marginRight: 8 }}>{m.label}</a> : <span key={i} style={{ marginRight: 8 }}>{m.label}</span>)}</div>}
                  {cs.transcricao && <details><summary style={{ cursor: 'pointer', color: '#666' }}>Transcrição</summary><div style={{ whiteSpace: 'pre-wrap', color: '#555', marginTop: 4, maxHeight: 200, overflowY: 'auto', background: '#fafafa', padding: 8 }}>{cs.transcricao}</div></details>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── TAREFAS (mini-kanban) ── */}
      {tab === 'tarefas' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {KANBAN.map(([st, label, color]) => {
            const items = d.actionItems.filter(a => (a.status || (a.done ? 'DONE' : 'TODO')) === st)
            const order = ['TODO', 'DOING', 'DONE']
            return (
              <div key={st} style={{ border: '1px solid #e2e8f0', background: '#fafafa', minHeight: 120 }}>
                <div style={{ background: color, color: 'white', padding: '6px 10px', fontFamily: mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{label} ({items.length})</div>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map(a => {
                    const overdue = a.status !== 'DONE' && a.dueDate && new Date(a.dueDate).getTime() < Date.now()
                    const idx = order.indexOf(st)
                    return (
                      <div key={a.id} style={{ background: 'white', border: '1px solid #e2e8f0', padding: 8, fontFamily: mono, fontSize: 11 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.what}</div>
                        <div style={{ fontSize: 9, color: overdue ? '#dc2626' : '#888', marginBottom: 4 }}>{a.who ?? '—'} · {a.dueDate ? dt(a.dueDate) : 'sem prazo'}{overdue ? ' · ATRASADA' : ''}</div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {idx > 0 && <button onClick={() => moveAction(a.id, order[idx - 1])} style={{ border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontFamily: mono, fontSize: 9, padding: '2px 6px' }}>←</button>}
                          {idx < 2 && <button onClick={() => moveAction(a.id, order[idx + 1])} style={{ border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontFamily: mono, fontSize: 9, padding: '2px 6px', marginLeft: 'auto' }}>→</button>}
                        </div>
                      </div>
                    )
                  })}
                  {items.length === 0 && <div style={{ fontFamily: mono, fontSize: 10, color: '#bbb', textAlign: 'center', padding: 8 }}>—</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && <SessionForm clientId={clientId} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
    </div>
  )
}

// ───────── Form "Registrar sessão" (pós-call) ─────────
function SessionForm({ clientId, onClose, onSaved }: { clientId: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ sessionDate: new Date().toISOString().slice(0, 10) })
  const [channels, setChannels] = useState<Channel[]>([])
  const [customs, setCustoms] = useState<CustomField[]>([])
  const [materiais, setMateriais] = useState<Material[]>([])
  const [tasks, setTasks] = useState<{ what: string; who: string }[]>([])
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))
  const numOr = (v?: string) => v && v.trim() ? Number(v.replace(/[^\d.,-]/g, '').replace(',', '.')) : undefined

  async function save() {
    setSaving(true)
    try {
      const study = await apiFetch<{ id: string }>('/api/mentorship/case-studies', {
        method: 'POST',
        body: JSON.stringify({
          clientId, sessionDate: f.sessionDate,
          faturamentoAno: numOr(f.faturamentoAno), ticketMedio: numOr(f.ticketMedio), numVendas: numOr(f.numVendas),
          numClientes: numOr(f.numClientes), investimentoTrafego: numOr(f.investimentoTrafego), roas: numOr(f.roas), seguidoresIg: numOr(f.seguidoresIg),
          vendasPorCanal: channels.filter(c => c.canal), customFields: customs.filter(c => c.label), materiais: materiais.filter(m => m.label),
          pontosPrincipais: f.pontosPrincipais, oQueTrabalhou: f.oQueTrabalhou, proximosPassos: f.proximosPassos, transcricao: f.transcricao,
        }),
      })
      for (const t of tasks.filter(t => t.what.trim())) {
        await apiFetch('/api/mentorship/action-items', { method: 'POST', body: JSON.stringify({ clientId, what: t.what, who: t.who || undefined, caseStudyId: study.id }) })
      }
      toast.success('Sessão registrada')
      onSaved()
    } catch { toast.error('Erro ao salvar') } finally { setSaving(false) }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid #e2e8f0', fontFamily: mono, fontSize: 12 }
  const lbl: React.CSSProperties = { fontFamily: mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#666', display: 'block', marginBottom: 3 }
  const sec: React.CSSProperties = { fontFamily: mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#0A0A0C', margin: '14px 0 6px', borderBottom: '1px solid #eee', paddingBottom: 4 }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: 'white', width: '100%', maxWidth: 560, marginTop: 20 }}>
        <div style={{ background: '#0A0A0C', color: 'white', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13 }}>REGISTRAR SESSÃO / FINALIZAR MENTORIA</span>
          <button onClick={onClose} style={{ background: '#dc2626', color: 'white', border: 0, borderRadius: 5, width: 22, height: 22, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: 16 }}>
          <div><label style={lbl}>Data da sessão</label><input type="date" value={f.sessionDate} onChange={e => set('sessionDate', e.target.value)} style={inp} /></div>

          <div style={sec}>Métricas do negócio</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><label style={lbl}>Faturamento (R$)</label><input value={f.faturamentoAno ?? ''} onChange={e => set('faturamentoAno', e.target.value)} style={inp} placeholder="ex: 80000" /></div>
            <div><label style={lbl}>Ticket médio (R$)</label><input value={f.ticketMedio ?? ''} onChange={e => set('ticketMedio', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Nº de clientes</label><input value={f.numClientes ?? ''} onChange={e => set('numClientes', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Nº de vendas</label><input value={f.numVendas ?? ''} onChange={e => set('numVendas', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Invest. tráfego (R$)</label><input value={f.investimentoTrafego ?? ''} onChange={e => set('investimentoTrafego', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>ROAS (x)</label><input value={f.roas ?? ''} onChange={e => set('roas', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Seguidores IG</label><input value={f.seguidoresIg ?? ''} onChange={e => set('seguidoresIg', e.target.value)} style={inp} /></div>
          </div>

          <div style={sec}>Vendas por canal</div>
          {channels.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <input value={c.canal} onChange={e => setChannels(ch => ch.map((x, j) => j === i ? { ...x, canal: e.target.value } : x))} placeholder="Canal (IG, TikTok, Site...)" style={{ ...inp, flex: 1 }} />
              <input value={c.valor || ''} onChange={e => setChannels(ch => ch.map((x, j) => j === i ? { ...x, valor: Number(e.target.value) } : x))} placeholder="R$" style={{ ...inp, width: 100 }} />
              <button onClick={() => setChannels(ch => ch.filter((_, j) => j !== i))} style={{ border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', padding: '0 8px' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setChannels(ch => [...ch, { canal: '', valor: 0 }])} style={{ border: '1px dashed #ccc', background: 'white', cursor: 'pointer', fontFamily: mono, fontSize: 10, padding: '4px 10px' }}>+ canal</button>

          <div style={sec}>Campos extras</div>
          {customs.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <input value={c.label} onChange={e => setCustoms(cs => cs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Campo" style={{ ...inp, flex: 1 }} />
              <input value={c.value} onChange={e => setCustoms(cs => cs.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} placeholder="Valor" style={{ ...inp, flex: 1 }} />
              <button onClick={() => setCustoms(cs => cs.filter((_, j) => j !== i))} style={{ border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', padding: '0 8px' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setCustoms(cs => [...cs, { label: '', value: '' }])} style={{ border: '1px dashed #ccc', background: 'white', cursor: 'pointer', fontFamily: mono, fontSize: 10, padding: '4px 10px' }}>+ campo</button>

          <div style={sec}>Registro da reunião</div>
          <div><label style={lbl}>Principais pontos discutidos</label><textarea value={f.pontosPrincipais ?? ''} onChange={e => set('pontosPrincipais', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} /></div>
          <div style={{ marginTop: 6 }}><label style={lbl}>O que foi passado ao cliente</label><textarea value={f.oQueTrabalhou ?? ''} onChange={e => set('oQueTrabalhou', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
          <div style={{ marginTop: 6 }}><label style={lbl}>Próximos passos</label><textarea value={f.proximosPassos ?? ''} onChange={e => set('proximosPassos', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
          <div style={{ marginTop: 6 }}><label style={lbl}>Transcrição da reunião</label><textarea value={f.transcricao ?? ''} onChange={e => set('transcricao', e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' }} placeholder="Cole a transcrição aqui..." /></div>

          <div style={sec}>Tarefas (o que ficou / pra quem)</div>
          {tasks.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <input value={t.what} onChange={e => setTasks(ts => ts.map((x, j) => j === i ? { ...x, what: e.target.value } : x))} placeholder="O que" style={{ ...inp, flex: 2 }} />
              <input value={t.who} onChange={e => setTasks(ts => ts.map((x, j) => j === i ? { ...x, who: e.target.value } : x))} placeholder="Quem" style={{ ...inp, flex: 1 }} />
              <button onClick={() => setTasks(ts => ts.filter((_, j) => j !== i))} style={{ border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', padding: '0 8px' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setTasks(ts => [...ts, { what: '', who: '' }])} style={{ border: '1px dashed #ccc', background: 'white', cursor: 'pointer', fontFamily: mono, fontSize: 10, padding: '4px 10px' }}>+ tarefa</button>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={{ flex: 1, border: '1px solid #e2e8f0', background: 'white', padding: 10, fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
            <button onClick={save} disabled={saving} style={{ flex: 1, border: 0, background: '#16a34a', color: 'white', padding: 10, fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>{saving ? 'Salvando...' : 'Registrar sessão'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
