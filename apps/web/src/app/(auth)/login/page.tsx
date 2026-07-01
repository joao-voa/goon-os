'use client'

import { useState, useEffect, FormEvent } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { setCheckingAuth(false); return }
    fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        if (res.ok) {
          const user = await res.json()
          window.location.replace(user.mustChangePassword ? '/change-password' : '/home')
        } else {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          setCheckingAuth(false)
        }
      })
      .catch(() => setCheckingAuth(false))
  }, [])

  if (checkingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: '#64748b', fontWeight: 500 }}>Verificando...</div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Credenciais invalidas')
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      window.location.href = data.user?.mustChangePassword ? '/change-password' : '/home'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0A0A0C',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{
        width: '100%', maxWidth: 400, background: 'white',
        borderRadius: 16, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '2.5rem 2rem 0', textAlign: 'center' }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 46, letterSpacing: '0.16em', color: '#0A0A0C', lineHeight: 1, paddingLeft: '0.16em' }}>GOON</div>
          </div>
          <p style={{ fontFamily: 'var(--font-sans)', color: '#94a3b8', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>
            Operacional System
          </p>
          <p style={{ fontFamily: 'var(--font-sans)', color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>
            Acesse sua conta
          </p>
        </div>

        <div style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>E-mail</label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none', transition: 'all 0.15s', color: '#0f172a' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#2A2A30'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(42,42,48,0.12)' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
            <div>
              <label htmlFor="password" style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Senha</label>
              <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="********" required
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 14, outline: 'none', transition: 'all 0.15s', color: '#0f172a' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#2A2A30'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(42,42,48,0.12)' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{
                background: '#0A0A0C', color: 'var(--goon-signal)', border: 'none',
                borderRadius: 8, padding: '12px', cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
                transition: 'all 0.15s', marginTop: 4, width: '100%',
                boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                opacity: loading ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#2A2A30' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#0A0A0C' }}
            >
              {loading ? 'Aguarde...' : 'Entrar'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, fontFamily: 'var(--font-sans)', color: '#cbd5e1' }}>
            GOON &copy; 2026
          </p>
        </div>
      </div>
    </div>
  )
}
