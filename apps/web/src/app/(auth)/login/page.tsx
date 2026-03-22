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
        throw new Error(data.message ?? 'Erro ao fazer login')
      }

      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err.message ?? 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--goon-deep-dark)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: 'var(--goon-dark-card)',
          border: '1px solid var(--goon-border)',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: 'var(--goon-shadow-modal)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              color: 'var(--goon-primary)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            GOON OS
          </h1>
          <p
            style={{
              color: 'var(--goon-text-muted)',
              marginTop: '0.5rem',
              fontSize: '0.95rem',
            }}
          >
            Sistema de Gestão
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label
              htmlFor="email"
              style={{
                fontSize: '0.85rem',
                color: 'var(--goon-text-secondary)',
                fontWeight: 500,
              }}
            >
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              style={{
                background: 'var(--goon-input-bg)',
                border: '1px solid var(--goon-border)',
                borderRadius: '8px',
                padding: '0.7rem 1rem',
                color: 'var(--goon-text-primary)',
                fontSize: '0.95rem',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label
              htmlFor="password"
              style={{
                fontSize: '0.85rem',
                color: 'var(--goon-text-secondary)',
                fontWeight: 500,
              }}
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                background: 'var(--goon-input-bg)',
                border: '1px solid var(--goon-border)',
                borderRadius: '8px',
                padding: '0.7rem 1rem',
                color: 'var(--goon-text-primary)',
                fontSize: '0.95rem',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <p
              style={{
                color: 'var(--goon-danger)',
                fontSize: '0.875rem',
                margin: 0,
                padding: '0.5rem 0.75rem',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '6px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              background: loading ? 'rgba(108, 63, 255, 0.5)' : 'var(--goon-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.8rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              width: '100%',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Footer */}
        <p
          style={{
            textAlign: 'center',
            marginTop: '2rem',
            fontSize: '0.75rem',
            color: 'var(--goon-text-muted)',
          }}
        >
          GOON CONSULTORIA © 2026
        </p>
      </div>
    </div>
  )
}
