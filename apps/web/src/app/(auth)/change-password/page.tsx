'use client'

import { useState, FormEvent } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Senha deve ter no minimo 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('As senhas nao coincidem')
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword: password }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Erro ao alterar senha')
      }

      window.location.href = '/home'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar senha')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--retro-bg)', padding: 16,
    }}>
      <form onSubmit={handleSubmit} style={{
        width: '100%', maxWidth: 380, background: 'white',
        border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
      }}>
        <div style={{
          background: '#0f172a', color: 'white', padding: '14px 20px',
          fontFamily: 'var(--font-sans)', fontSize: 12,
        }}>
          PRIMEIRO ACESSO — DEFINA SUA SENHA
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#555', margin: 0 }}>
            Bem-vindo ao GOON — Operacional System! Crie uma senha segura para acessar o sistema.
          </p>

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              Nova Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
                fontFamily: 'var(--font-mono)', fontSize: 13,
              }}
            />
          </div>

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
              Confirmar Senha
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
                fontFamily: 'var(--font-mono)', fontSize: 13,
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#fff0f0', border: '1px solid #fecaca', padding: '8px 12px',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: '#cc0000',
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px', border: '1px solid #e2e8f0',
            background: '#0f172a', color: 'white', fontFamily: 'var(--font-sans)',
            fontSize: 11, cursor: loading ? 'wait' : 'pointer',
            boxShadow: '4px 4px 0 #888',
          }}>
            {loading ? 'SALVANDO...' : 'DEFINIR SENHA E ENTRAR'}
          </button>
        </div>
      </form>
    </div>
  )
}
