'use client'

import { useEffect, useState } from 'react'
import { GoonLogo } from '@/components/GoonLogo'

// Captação por CTA de post: a pessoa comenta a palavra, recebe no direct o link
// /material?m=<material>, se cadastra e cai no CRM com o material a enviar.
// ?m= nome do material/post (opcional; sem ele o time preenche no CRM) · ?c= canal (padrão "cta").
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const NEON = '#C7F900'
const sans = 'var(--font-sans)', disp = 'var(--font-display)'

export default function MaterialPage() {
  const [f, setF] = useState<Record<string, string>>({})
  const [material, setMaterial] = useState('')
  const [channel, setChannel] = useState('cta')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setMaterial((q.get('m') ?? '').trim().slice(0, 120))
    setChannel((q.get('c') ?? 'cta').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'cta')
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!f.responsible?.trim()) { setError('Preencha seu nome.'); return }
    if (!f.companyName?.trim()) { setError('Preencha o nome da marca.'); return }
    if (!f.whatsapp?.trim() && !f.email?.trim()) { setError('Preencha o WhatsApp ou o e-mail para receber o material.'); return }
    setSending(true)
    try {
      const r = await fetch(`${API_URL}/api/public/event-lead`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responsible: f.responsible, companyName: f.companyName, instagram: f.instagram,
          whatsapp: f.whatsapp, email: f.email,
          eventName: 'Material (CTA)', material: material || undefined,
          leadSource: `${channel}_instagram`,
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
  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = NEON; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(199,249,0,0.15)' }
  const blur = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#2a2a30'; e.currentTarget.style.boxShadow = 'none' }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0C', color: '#fff', fontFamily: sans }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 16px 60px' }}>
        <a href="https://www.goon-global.com/" target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}><GoonLogo height={28} fill="#F2F2F2" /></a>
        <div style={{ width: 30, height: 3, background: NEON, borderRadius: 2, margin: '18px 0 16px' }} />
        <div style={{ fontFamily: disp, fontSize: 12, fontWeight: 700, letterSpacing: '0.32em', color: NEON, textTransform: 'uppercase' }}>GOON Global · Material</div>
        <h1 style={{ fontFamily: disp, fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.08, margin: '14px 0 0' }}>
          Receba o seu material
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.62)', lineHeight: 1.6, margin: '12px 0 24px' }}>
          Preencha abaixo e a gente envia o conteúdo no seu WhatsApp ou e-mail.
        </p>

        {done ? (
          <div style={{ background: '#141418', border: `1px solid ${NEON}`, borderRadius: 16, padding: '32px 26px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: NEON, color: '#0A0A0C', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 28, fontWeight: 800 }}>✓</div>
            <h2 style={{ fontFamily: disp, fontSize: 22, fontWeight: 700, margin: 0 }}>Cadastro recebido!</h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14.5, lineHeight: 1.55, marginTop: 10 }}>
              Em breve o material chega no seu <b style={{ color: NEON }}>WhatsApp</b> ou <b style={{ color: '#fff' }}>e-mail</b>.
            </p>
          </div>
        ) : (
          <div style={{ background: '#141418', border: '1px solid #1c1c22', borderRadius: 16, padding: '24px 20px' }}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={lbl}>Seu nome *</label>
                <input value={f.responsible ?? ''} onChange={e => set('responsible', e.target.value)} placeholder="Seu nome" autoComplete="name" style={inp} onFocus={focus} onBlur={blur} />
              </div>
              <div>
                <label style={lbl}>Nome da marca *</label>
                <input value={f.companyName ?? ''} onChange={e => set('companyName', e.target.value)} placeholder="Nome da sua marca" style={inp} onFocus={focus} onBlur={blur} />
              </div>
              <div>
                <label style={lbl}>@ do Instagram da marca</label>
                <input value={f.instagram ?? ''} onChange={e => set('instagram', e.target.value)} placeholder="@suamarca" autoCapitalize="none" style={inp} onFocus={focus} onBlur={blur} />
              </div>
              <div>
                <label style={lbl}>WhatsApp</label>
                <input value={f.whatsapp ?? ''} onChange={e => set('whatsapp', e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" style={inp} onFocus={focus} onBlur={blur} />
              </div>
              <div>
                <label style={lbl}>E-mail</label>
                <input value={f.email ?? ''} onChange={e => set('email', e.target.value)} inputMode="email" autoComplete="email" placeholder="voce@email.com" style={inp} onFocus={focus} onBlur={blur} />
              </div>

              {error && <div style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid #dc2626', color: '#fca5a5', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{error}</div>}

              <button type="submit" disabled={sending} style={{
                background: NEON, color: '#0A0A0C', border: 'none', borderRadius: 12, padding: '15px', fontFamily: sans,
                fontSize: 15.5, fontWeight: 800, cursor: sending ? 'wait' : 'pointer', marginTop: 4,
                boxShadow: '0 6px 20px rgba(199,249,0,0.35)', opacity: sending ? 0.7 : 1,
              }}>{sending ? 'Enviando…' : 'Quero receber o material'}</button>
              <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: 0 }}>
                GOON Global · <span style={{ letterSpacing: '0.06em' }}>GLOBAL <span style={{ color: '#a3cc00' }}>OR</span> NOTHING</span>
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
