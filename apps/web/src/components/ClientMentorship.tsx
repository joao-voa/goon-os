'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface Detail {
  profile: { mentorName: string | null; status: string; mainPains: string | null; goal: string | null }
  attention: boolean
  caseStudies: { id: string; sessionDate: string; faturamentoAno: number | null; numVendas: number | null; ticketMedio: number | null; investimentoTrafego: number | null; roas: number | null; seguidoresIg: number | null; situacaoAtual: string | null; oQueTrabalhou: string | null; proximosPassos: string | null }[]
  actionItems: { id: string; what: string; who: string | null; dueDate: string | null; done: boolean }[]
}

const brl = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const num = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR')
const dt = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'
const mono = 'var(--font-mono)'

export function ClientMentorship({ clientId }: { clientId: string }) {
  const [d, setD] = useState<Detail | null>(null)
  const [enrolled, setEnrolled] = useState<boolean | null>(null)

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

  if (enrolled === null) return <div style={{ fontFamily: mono, fontSize: 12, color: '#888' }}>Carregando...</div>

  if (!enrolled) {
    return (
      <div style={{ border: '1px solid #e2e8f0', padding: 24, textAlign: 'center', background: 'white' }}>
        <div style={{ fontFamily: mono, fontSize: 13, marginBottom: 12 }}>Este cliente não está em acompanhamento de mentoria.</div>
        <button onClick={enroll} style={{ background: 'black', color: 'white', border: 0, padding: '8px 16px', fontFamily: mono, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Inscrever no acompanhamento</button>
      </div>
    )
  }
  if (!d) return null

  const last = d.caseStudies[0]
  const open = d.actionItems.filter(a => !a.done)
  const now = Date.now()
  const card: React.CSSProperties = { border: '1px solid #e2e8f0', background: 'white', padding: 14, marginBottom: 14 }
  const h: React.CSSProperties = { fontFamily: mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: 8 }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: mono, fontSize: 12 }}>
          Mentor: <b>{d.profile.mentorName ?? '—'}</b> · {d.profile.status}
          {d.attention && <span style={{ marginLeft: 8, background: '#fee2e2', color: '#dc2626', padding: '2px 8px', fontWeight: 700 }}>🔴 Em atenção</span>}
        </div>
        <a href="/mentorship" style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: '#4A78FF', textDecoration: 'none' }}>Abrir no módulo Mentorados →</a>
      </div>

      {/* Contexto */}
      <div style={card}>
        <div style={h}>Contexto da mentoria</div>
        <div style={{ fontFamily: mono, fontSize: 12, marginBottom: 6 }}><b>Principais dores:</b> {d.profile.mainPains || <span style={{ color: '#aaa' }}>não preenchido</span>}</div>
        <div style={{ fontFamily: mono, fontSize: 12 }}><b>Objetivo com a mentoria:</b> {d.profile.goal || <span style={{ color: '#aaa' }}>não preenchido</span>}</div>
      </div>

      {/* Últimos dados do negócio */}
      <div style={card}>
        <div style={h}>Dados do negócio {last ? `· última sessão ${dt(last.sessionDate)}` : ''}</div>
        {last ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 8, marginBottom: 10, fontFamily: mono, fontSize: 11 }}>
              {[['Fat/ano', brl(last.faturamentoAno)], ['Vendas', num(last.numVendas)], ['Ticket', brl(last.ticketMedio)], ['Tráfego', brl(last.investimentoTrafego)], ['ROAS', last.roas != null ? last.roas + 'x' : '—'], ['IG', num(last.seguidoresIg)]].map(([l, v]) => (
                <div key={l} style={{ border: '1px solid #f1f5f9', padding: '6px 8px' }}><div style={{ fontSize: 9, color: '#888' }}>{l}</div><div style={{ fontWeight: 700 }}>{v}</div></div>
              ))}
            </div>
            {last.situacaoAtual && <p style={{ fontFamily: mono, fontSize: 11, margin: '4px 0' }}><b>O que foi falado:</b> {last.situacaoAtual}</p>}
            {last.oQueTrabalhou && <p style={{ fontFamily: mono, fontSize: 11, margin: '4px 0' }}><b>O que foi passado ao cliente:</b> {last.oQueTrabalhou}</p>}
            {last.proximosPassos && <p style={{ fontFamily: mono, fontSize: 11, margin: '4px 0' }}><b>Próximos passos:</b> {last.proximosPassos}</p>}
          </>
        ) : <div style={{ fontFamily: mono, fontSize: 11, color: '#888' }}>Nenhum dado registrado ainda.</div>}
      </div>

      {/* Plano de ação */}
      <div style={card}>
        <div style={h}>Plano de ação ({open.length} em aberto)</div>
        {d.actionItems.map(a => {
          const overdue = !a.done && a.dueDate && new Date(a.dueDate).getTime() < now
          return (
            <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', opacity: a.done ? 0.55 : 1, borderBottom: '1px solid #f5f5f5' }}>
              <span>{a.done ? '☑' : '☐'}</span>
              <div style={{ flex: 1, fontFamily: mono, fontSize: 12, textDecoration: a.done ? 'line-through' : 'none' }}>{a.what}</div>
              <div style={{ fontFamily: mono, fontSize: 9, color: overdue ? '#dc2626' : '#888' }}>{a.who ?? '—'} · {a.dueDate ? dt(a.dueDate) : 'sem prazo'}{overdue ? ' · ATRASADA' : ''}</div>
            </div>
          )
        })}
        {d.actionItems.length === 0 && <div style={{ fontFamily: mono, fontSize: 11, color: '#888' }}>Nenhuma ação.</div>}
      </div>
    </div>
  )
}
