'use client'

import { useState } from 'react'
import { GoonLogo } from '@/components/GoonLogo'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const NEON = '#C7F900'
const sans = 'var(--font-sans)', disp = 'var(--font-display)'
const INTEREST = 'TikTok Scale — Social Commerce'
// origem = {canal}_tiktok. canal vem de ?c= (default "story") → ex.: story_tiktok
const leadSourceFor = () => {
  const c = (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('c') : null) || 'story'
  return `${c.replace(/[^a-z0-9]/gi, '').toLowerCase()}_tiktok`
}

const REVENUE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Ainda não faturo', value: '' },
  { label: 'Até R$ 50 mil/mês', value: 'até 50 mil/mês' },
  { label: 'R$ 50 mil a R$ 100 mil/mês', value: 'entre 50 mil e 100 mil/mês' },
  { label: 'R$ 100 mil a R$ 500 mil/mês', value: 'entre 100 mil e 500 mil/mês' },
  { label: 'R$ 500 mil a R$ 1 milhão/mês', value: 'entre 500 mil e 1 milhao/mês' },
  { label: 'Acima de R$ 1 milhão/mês', value: 'acima de 1 milhao/mês' },
]

export default function TiktokPage() {
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
  const label3 = (t: React.ReactNode) => <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>{t}</span>

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0C', color: '#fff', fontFamily: sans }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 20px 56px' }}>
        {/* topo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <a href="https://www.goon-global.com/" target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}><GoonLogo height={24} fill="#F2F2F2" /></a>
          <a href="https://www.goon-global.com/" target="_blank" rel="noreferrer" style={{ color: NEON, textDecoration: 'none', fontSize: 12.5, fontWeight: 600 }}>goon-global.com ↗</a>
        </div>

        {/* GRID — TikTok Scale (esquerda) + form (direita) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32, alignItems: 'start', marginTop: 34 }}>
          <div>
            <div style={{ fontFamily: disp, fontSize: 26, color: NEON, lineHeight: 1, fontWeight: 800 }}>∞</div>
            <h1 style={{ fontFamily: disp, fontSize: 'clamp(40px, 8vw, 58px)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 0.9, margin: '8px 0 0' }}>TIKTOK<br />SCALE</h1>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.62)', marginTop: 14, lineHeight: 1.55, maxWidth: 440 }}>
              Estratégia, operação e escala do TikTok Shop de ponta a ponta. Uma máquina de vendas online com awareness de marca.
            </p>

            {/* modelo operacional */}
            <div style={{ marginTop: 18, padding: '14px 18px', border: '1px solid #1c1c22', borderRadius: 14, background: '#0e0e12' }}>
              <div style={{ fontFamily: disp, fontSize: 15, fontWeight: 800, lineHeight: 1.4 }}>
                <span style={{ color: NEON }}>Nosso modelo é operacional, não consultivo.</span>{' '}
                <span style={{ color: '#fff' }}>A GOON estrutura, executa e otimiza.</span>
              </div>
            </div>

            {/* stats */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              {[['3', 'Fases operacionais'], ['360°', 'Gestão do canal'], ['✔', 'Agência TikTok Shop Oficial']].map(([n, t]) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', border: '1px solid #1c1c22', borderRadius: 100, background: '#141418' }}>
                  <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 800, color: NEON }}>{n}</span>
                  <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{t}</span>
                </div>
              ))}
            </div>

            {/* FOMO */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18, padding: '7px 14px', borderRadius: 100, background: 'rgba(199,249,0,0.14)', border: '1px solid rgba(199,249,0,0.3)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: NEON }} />
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Vagas limitadas · seleção por perfil</span>
            </div>
          </div>

          {/* Form / confirmação */}
          <div>
            {done ? (
              <div style={{ background: '#141418', border: `1px solid ${NEON}`, borderRadius: 16, padding: '32px 26px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: NEON, color: '#0A0A0C', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 28, fontWeight: 800 }}>✓</div>
                <h2 style={{ fontFamily: disp, fontSize: 22, fontWeight: 700, margin: 0 }}>Recebemos seus dados!</h2>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14.5, lineHeight: 1.55, marginTop: 10 }}>
                  Nosso time da <b style={{ color: '#fff' }}>GOON</b> vai avaliar seu perfil e te chamar no <b style={{ color: NEON }}>WhatsApp</b>. As vagas são limitadas — fica de olho! 🚀
                </p>
              </div>
            ) : (
              <div style={{ background: '#141418', border: '1px solid #1c1c22', borderRadius: 16, padding: '24px 22px' }}>
                <h2 style={{ fontFamily: disp, fontSize: 19, fontWeight: 700, margin: '0 0 18px' }}>Quero escalar minhas vendas</h2>
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
                    <label style={lbl}>O que você quer resolver? <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>(opcional)</span></label>
                    <textarea value={f.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Seu maior objetivo ou gargalo de vendas hoje…" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} onFocus={focus} onBlur={blur} />
                  </div>

                  {error && <div style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid #dc2626', color: '#fca5a5', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{error}</div>}

                  <button type="submit" disabled={sending} style={{
                    background: NEON, color: '#0A0A0C', border: 'none', borderRadius: 12, padding: '15px', fontFamily: sans,
                    fontSize: 15.5, fontWeight: 800, cursor: sending ? 'wait' : 'pointer', marginTop: 4,
                    boxShadow: '0 6px 20px rgba(199,249,0,0.35)', opacity: sending ? 0.7 : 1,
                  }}>{sending ? 'Enviando…' : 'Quero escalar minhas vendas'}</button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* RODAPÉ — agência oficial (nativo) */}
        <div style={{ textAlign: 'center', marginTop: 44, paddingTop: 32, borderTop: '1px solid #1c1c22' }}>
          <h3 style={{ fontFamily: disp, fontSize: 'clamp(22px, 5vw, 30px)', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, lineHeight: 1.2 }}>
            Somos uma agência <span style={{ color: NEON }}>TikTok Shop</span> Oficial.
          </h3>
          <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.55)' }}>
            {label3(<>MARCA <span style={{ color: NEON }}>×</span> CONTEÚDO <span style={{ color: NEON }}>×</span> COMÉRCIO <span style={{ color: NEON }}>×</span> RESULTADOS</>)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 22 }}>
            <GoonLogo height={26} fill="#F2F2F2" />
            <span style={{ color: NEON, fontSize: 20, fontWeight: 800 }}>+</span>
            <span style={{ fontFamily: disp, fontSize: 16, fontWeight: 700 }}>agência TikTok Shop</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: NEON, border: `1px solid ${NEON}`, borderRadius: 100, padding: '2px 9px' }}>✔ Official</span>
          </div>
          <p style={{ fontFamily: disp, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.28em', fontWeight: 700, marginTop: 26, textTransform: 'uppercase' }}>
            Global <span style={{ color: '#8fb800' }}>or</span> Nothing
          </p>
        </div>
      </div>
    </div>
  )
}
