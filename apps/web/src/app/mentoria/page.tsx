'use client'

import { useState } from 'react'
import { GoonLogo } from '@/components/GoonLogo'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const NEON = '#C7F900'
const sans = 'var(--font-sans)', disp = 'var(--font-display)'
const INTEREST = 'Mentoria — GOON Global'
// origem = {canal}_mentoria. canal vem de ?c= (default "story") → ex.: story_mentoria
const leadSourceFor = () => {
  const c = (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('c') : null) || 'story'
  return `${c.replace(/[^a-z0-9]/gi, '').toLowerCase()}_mentoria`
}

const REVENUE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Ainda não faturo', value: '' },
  { label: 'Até R$ 50 mil/mês', value: 'até 50 mil/mês' },
  { label: 'R$ 50 mil a R$ 100 mil/mês', value: 'entre 50 mil e 100 mil/mês' },
  { label: 'R$ 100 mil a R$ 500 mil/mês', value: 'entre 100 mil e 500 mil/mês' },
  { label: 'R$ 500 mil a R$ 1 milhão/mês', value: 'entre 500 mil e 1 milhao/mês' },
  { label: 'Acima de R$ 1 milhão/mês', value: 'acima de 1 milhao/mês' },
]

export default function MentoriaPage() {
  const [f, setF] = useState<Record<string, string>>({ estimatedRevenue: '' })
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!f.responsible?.trim()) { setError('Preencha seu nome.'); return }
    if (!f.whatsapp?.trim()) { setError('Preencha seu WhatsApp.'); return }
    setSending(true)
    try {
      const r = await fetch(`${API_URL}/api/public/event-lead`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responsible: f.responsible, companyName: f.companyName, whatsapp: f.whatsapp, email: f.email,
          instagram: f.instagram, segment: f.segment, estimatedRevenue: f.estimatedRevenue,
          notes: f.notes, eventName: INTEREST, leadSource: leadSourceFor(),
        }),
      })
      if (!r.ok) throw new Error()
      setDone(true)
    } catch { setError('Não foi possível enviar. Tente novamente.') } finally { setSending(false) }
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '13px 14px', borderRadius: 11,
    border: '1px solid #2a2a30', background: '#141418', color: '#fff', fontFamily: sans, fontSize: 15, outline: 'none',
  }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)', marginBottom: 6 }
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = NEON; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(199,249,0,0.15)' }
  const blur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = '#2a2a30'; e.currentTarget.style.boxShadow = 'none' }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0C', color: '#fff', fontFamily: sans }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 20px 60px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32, alignItems: 'start' }}>
        {/* Hero / marca */}
        <div>
          <a href="https://www.goon-global.com/" target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}><GoonLogo height={30} fill="#F2F2F2" /></a>
          <div style={{ width: 30, height: 3, background: NEON, borderRadius: 2, margin: '18px 0 16px' }} />
          <div style={{ fontFamily: disp, fontSize: 12, fontWeight: 700, letterSpacing: '0.32em', color: NEON, textTransform: 'uppercase' }}>GOON Global · Mentoria</div>
          <h1 style={{ fontFamily: disp, fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05, margin: '14px 0 0' }}>
            Aplique para a<br />mentoria da GOON
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6, marginTop: 16, maxWidth: 420 }}>
            Mentoria de marca, direção criativa e escala para quem quer construir algo grande. Preencha abaixo pra saber mais. Nosso time entra em contato com você.
          </p>

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['Direção criativa e mix de produtos', 'Estratégia de marca e escala', 'Acompanhamento de perto, sem fórmula pronta'].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: NEON, flexShrink: 0 }} />{t}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 22 }}>
            <a href="https://www.goon-global.com/" target="_blank" rel="noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 16px', borderRadius: 100,
              border: `1px solid rgba(199,249,0,0.35)`, color: NEON, textDecoration: 'none', fontSize: 13.5, fontWeight: 600,
            }}>Conheça a GOON Global <span style={{ fontSize: 15 }}>↗</span></a>
          </div>

          <p style={{ fontFamily: disp, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.28em', fontWeight: 700, marginTop: 26, textTransform: 'uppercase' }}>
            Global <span style={{ color: '#8fb800' }}>or</span> Nothing
          </p>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mentoria.png" alt="Giulliano Puga" style={{ width: '100%', maxWidth: 460, height: 'auto', display: 'block', marginTop: 8 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        </div>

        {/* Form / confirmação */}
        <div>
          {done ? (
            <div style={{ background: '#141418', border: `1px solid ${NEON}`, borderRadius: 16, padding: '32px 26px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: NEON, color: '#0A0A0C', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 28, fontWeight: 800 }}>✓</div>
              <h2 style={{ fontFamily: disp, fontSize: 22, fontWeight: 700, margin: 0 }}>Candidatura recebida!</h2>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14.5, lineHeight: 1.55, marginTop: 10 }}>
                Recebemos seus dados. Nosso time da <b style={{ color: '#fff' }}>GOON Global</b> vai te chamar no <b style={{ color: NEON }}>WhatsApp</b> pra conversar. Fica de olho! 🚀
              </p>
            </div>
          ) : (
            <div style={{ background: '#141418', border: '1px solid #1c1c22', borderRadius: 16, padding: '24px 22px' }}>
              <h2 style={{ fontFamily: disp, fontSize: 19, fontWeight: 700, margin: '0 0 18px' }}>Preencha pra saber mais</h2>
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={lbl}>Nome completo *</label>
                  <input value={f.responsible ?? ''} onChange={e => set('responsible', e.target.value)} placeholder="Seu nome" style={inp} onFocus={focus} onBlur={blur} />
                </div>
                <div>
                  <label style={lbl}>WhatsApp *</label>
                  <input value={f.whatsapp ?? ''} onChange={e => set('whatsapp', e.target.value)} inputMode="tel" placeholder="(00) 00000-0000" style={inp} onFocus={focus} onBlur={blur} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
                  <div>
                    <label style={lbl}>E-mail</label>
                    <input value={f.email ?? ''} onChange={e => set('email', e.target.value)} inputMode="email" placeholder="voce@email.com" style={inp} onFocus={focus} onBlur={blur} />
                  </div>
                  <div>
                    <label style={lbl}>Instagram</label>
                    <input value={f.instagram ?? ''} onChange={e => set('instagram', e.target.value)} placeholder="@suamarca" style={inp} onFocus={focus} onBlur={blur} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Empresa / marca</label>
                  <input value={f.companyName ?? ''} onChange={e => set('companyName', e.target.value)} placeholder="Nome da sua marca" style={inp} onFocus={focus} onBlur={blur} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
                  <div>
                    <label style={lbl}>Segmento / nicho</label>
                    <input value={f.segment ?? ''} onChange={e => set('segment', e.target.value)} placeholder="Ex.: moda, beauty, pet…" style={inp} onFocus={focus} onBlur={blur} />
                  </div>
                  <div>
                    <label style={lbl}>Faturamento mensal</label>
                    <select value={f.estimatedRevenue ?? ''} onChange={e => set('estimatedRevenue', e.target.value)} style={{ ...inp, cursor: 'pointer' }} onFocus={focus} onBlur={blur}>
                      {REVENUE_OPTIONS.map(o => <option key={o.label} value={o.value} style={{ background: '#141418' }}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={lbl}>O que você busca com a mentoria? <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>(opcional)</span></label>
                  <textarea value={f.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Seu maior objetivo ou desafio hoje…" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} onFocus={focus} onBlur={blur} />
                </div>

                {error && <div style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid #dc2626', color: '#fca5a5', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{error}</div>}

                <button type="submit" disabled={sending} style={{
                  background: NEON, color: '#0A0A0C', border: 'none', borderRadius: 12, padding: '15px', fontFamily: sans,
                  fontSize: 15.5, fontWeight: 800, cursor: sending ? 'wait' : 'pointer', marginTop: 4,
                  boxShadow: '0 6px 20px rgba(199,249,0,0.35)', opacity: sending ? 0.7 : 1,
                }}>{sending ? 'Enviando…' : 'Aplicar para a mentoria'}</button>
                <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: 0 }}>
                  GOON Global · <span style={{ letterSpacing: '0.06em' }}>GLOBAL <span style={{ color: '#a3cc00' }}>OR</span> NOTHING</span>
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
