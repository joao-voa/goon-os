'use client'

import { useState, FormEvent } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

      if (!res.ok) {
        throw new Error(data.message ?? 'Credenciais inválidas')
      }

      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--retro-bg)',
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(0,0,0,0.05) 39px, rgba(0,0,0,0.05) 40px),
          repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(0,0,0,0.05) 39px, rgba(0,0,0,0.05) 40px)
        `,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'white',
          border: '2px solid black',
          boxShadow: '8px 8px 0px 0px #000',
          borderRadius: 0,
        }}
      >
        {/* Window title bar */}
        <div style={{
          background: 'black',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}>
          <span style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 10,
            color: 'white',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>GOON OS — LOGIN</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, background: '#cc0000', border: '1px solid black' }} />
            <div style={{ width: 12, height: 12, background: '#cc8800', border: '1px solid black' }} />
            <div style={{ width: 12, height: 12, background: '#006600', border: '1px solid black' }} />
          </div>
        </div>

        <div style={{ padding: '2rem 2rem 1.5rem' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: '18px',
                fontWeight: 900,
                color: 'black',
                letterSpacing: '0.05em',
                margin: 0,
                textTransform: 'uppercase',
                lineHeight: 1.4,
              }}
            >
              GOON OS
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                color: '#555',
                marginTop: '0.75rem',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              SISTEMA DE GESTÃO
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label
                htmlFor="email"
                className="goon-label"
              >
                E-MAIL
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="goon-input"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label
                htmlFor="password"
                className="goon-label"
              >
                SENHA
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="goon-input"
              />
            </div>

            {error && (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  margin: 0,
                  padding: '8px 12px',
                  background: '#fff0f0',
                  border: '2px solid var(--danger)',
                  boxShadow: '2px 2px 0 var(--danger)',
                  color: 'var(--danger)',
                  fontWeight: 700,
                }}
              >
                [ERRO] {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: '#ccff00',
                color: 'black',
                border: '2px solid black',
                boxShadow: '4px 4px 0px black',
                fontFamily: 'var(--font-pixel)',
                fontSize: '11px',
                textTransform: 'uppercase',
                padding: '14px',
                cursor: 'pointer',
                transition: 'transform 0.1s, box-shadow 0.1s',
                borderRadius: 0,
                letterSpacing: 0.5,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                textDecoration: 'none',
                marginTop: '0.5rem',
                width: '100%',
                fontWeight: 700,
              }}
            >
              {loading ? 'AGUARDE...' : 'ENTRAR NO SISTEMA'}
            </button>
          </form>

          {/* Footer */}
          <p
            style={{
              textAlign: 'center',
              marginTop: '1.5rem',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            GOON CONSULTORIA © 2026
          </p>
        </div>
      </div>
    </div>
  )
}
