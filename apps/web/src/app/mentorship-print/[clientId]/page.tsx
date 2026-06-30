'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { apiFetch } from '@/lib/api'

interface Detail {
  profile: { mentorName: string | null; status: string; mainPains: string | null; goal: string | null }
  client: { companyName: string; responsible: string | null } | null
  caseStudies: { id: string; sessionDate: string; mentorName: string | null; faturamentoAno: number | null; numVendas: number | null; ticketMedio: number | null; investimentoTrafego: number | null; roas: number | null; seguidoresIg: number | null; situacaoAtual: string | null; oQueTrabalhou: string | null; proximosPassos: string | null }[]
  actionItems: { id: string; what: string; who: string | null; dueDate: string | null; done: boolean }[]
}

const brl = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const num = (v: number | null) => v == null ? '—' : v.toLocaleString('pt-BR')
const dt = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—'

export default function PrintPage() {
  const clientId = useParams().clientId as string
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    apiFetch<Detail>(`/api/mentorship/clients/${clientId}`).then(data => {
      setD(data)
      setTimeout(() => window.print(), 600)
    }).catch(() => setErr(true))
  }, [clientId])

  if (err) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Não foi possível carregar. Abra a partir do sistema (logado).</div>
  if (!d) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Gerando relatório...</div>

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 32, fontFamily: 'Inter, sans-serif', color: '#111', background: 'white' }}>
      <style>{`@media print { @page { margin: 16mm } button { display: none } }`}</style>
      <div style={{ borderBottom: '2px solid #111', paddingBottom: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#888', letterSpacing: 1 }}>ACOMPANHAMENTO DE MENTORADO · AURA360</div>
        <h1 style={{ fontSize: 26, margin: '4px 0 0' }}>{d.client?.companyName}</h1>
        <div style={{ fontSize: 13, color: '#555' }}>{d.client?.responsible} · Mentor: {d.profile.mentorName ?? '—'} · {d.profile.status}</div>
      </div>

      {(d.profile.mainPains || d.profile.goal) && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, textTransform: 'uppercase', color: '#888', borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Contexto</h2>
          {d.profile.mainPains && <p style={{ fontSize: 13, margin: '8px 0 4px' }}><b>Principais dores:</b> {d.profile.mainPains}</p>}
          {d.profile.goal && <p style={{ fontSize: 13, margin: '4px 0' }}><b>Objetivo com a mentoria:</b> {d.profile.goal}</p>}
        </section>
      )}

      {d.caseStudies[0] && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, textTransform: 'uppercase', color: '#888', borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Dados do negócio ({dt(d.caseStudies[0].sessionDate)})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 10 }}>
            {[['Faturamento/ano', brl(d.caseStudies[0].faturamentoAno)], ['Nº vendas', num(d.caseStudies[0].numVendas)], ['Ticket médio', brl(d.caseStudies[0].ticketMedio)], ['Invest. tráfego', brl(d.caseStudies[0].investimentoTrafego)], ['ROAS', d.caseStudies[0].roas != null ? d.caseStudies[0].roas + 'x' : '—'], ['Seguidores IG', num(d.caseStudies[0].seguidoresIg)]].map(([l, v]) => (
              <div key={l} style={{ border: '1px solid #eee', padding: '8px 10px' }}><div style={{ fontSize: 10, color: '#888' }}>{l}</div><div style={{ fontSize: 16, fontWeight: 700 }}>{v}</div></div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, textTransform: 'uppercase', color: '#888', borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Plano de ação</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
          <thead><tr style={{ textAlign: 'left', color: '#888', fontSize: 11 }}><th style={{ padding: 4 }}>✓</th><th style={{ padding: 4 }}>O QUE</th><th style={{ padding: 4 }}>QUEM</th><th style={{ padding: 4 }}>QUANDO</th></tr></thead>
          <tbody>
            {d.actionItems.map(a => (
              <tr key={a.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: 4 }}>{a.done ? '☑' : '☐'}</td>
                <td style={{ padding: 4, textDecoration: a.done ? 'line-through' : 'none' }}>{a.what}</td>
                <td style={{ padding: 4 }}>{a.who ?? '—'}</td>
                <td style={{ padding: 4 }}>{dt(a.dueDate)}</td>
              </tr>
            ))}
            {d.actionItems.length === 0 && <tr><td colSpan={4} style={{ padding: 8, color: '#888' }}>Sem ações.</td></tr>}
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={{ fontSize: 14, textTransform: 'uppercase', color: '#888', borderBottom: '1px solid #ddd', paddingBottom: 4 }}>Histórico de sessões</h2>
        {d.caseStudies.map(s => (
          <div key={s.id} style={{ borderLeft: '3px solid #111', paddingLeft: 12, margin: '12px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{dt(s.sessionDate)} {s.mentorName ? `· ${s.mentorName}` : ''}</div>
            {s.situacaoAtual && <p style={{ fontSize: 12, margin: '4px 0' }}><b>O que foi falado:</b> {s.situacaoAtual}</p>}
            {s.oQueTrabalhou && <p style={{ fontSize: 12, margin: '4px 0' }}><b>O que foi passado:</b> {s.oQueTrabalhou}</p>}
            {s.proximosPassos && <p style={{ fontSize: 12, margin: '4px 0' }}><b>Próximos passos:</b> {s.proximosPassos}</p>}
          </div>
        ))}
        {d.caseStudies.length === 0 && <p style={{ fontSize: 12, color: '#888' }}>Sem estudos de caso.</p>}
      </section>

      <button onClick={() => window.print()} style={{ marginTop: 24, padding: '8px 16px', background: '#111', color: 'white', border: 0, cursor: 'pointer', borderRadius: 4 }}>Imprimir / Salvar PDF</button>
    </div>
  )
}
