'use client'

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { OWNER_EMAIL } from '@/lib/constants'

interface AuditLog {
  id: string
  userEmail: string | null
  userRole: string | null
  method: string
  path: string
  action: string
  statusCode: number | null
  ip: string | null
  durationMs: number | null
  createdAt: string
}

const METHOD_COLORS: Record<string, string> = { POST: '#16a34a', PATCH: '#2563eb', PUT: '#2563eb', DELETE: '#dc2626' }

export default function AuditPage() {
  const { user, loading: authLoading } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [users, setUsers] = useState<Array<{ userEmail: string | null; count: number }>>([])
  const [userFilter, setUserFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)

  const limit = 50
  const isOwner = user?.email === OWNER_EMAIL

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (userFilter) p.set('userEmail', userFilter)
      if (methodFilter) p.set('method', methodFilter)
      if (search) p.set('search', search)
      if (from) p.set('from', from)
      if (to) p.set('to', to)
      p.set('page', String(page))
      p.set('limit', String(limit))
      const res = await apiFetch<{ data: AuditLog[]; total: number }>(`/api/audit-logs?${p}`)
      setLogs(res.data)
      setTotal(res.total)
    } catch { /* 403 se não for dono */ } finally { setLoading(false) }
  }, [userFilter, methodFilter, search, from, to, page])

  useEffect(() => { if (isOwner) load() }, [isOwner, load])
  useEffect(() => {
    if (isOwner) apiFetch<typeof users>('/api/audit-logs/users').then(setUsers).catch(() => {})
  }, [isOwner])

  if (authLoading) return null
  if (!isOwner) {
    return (
      <div style={{ padding: 40, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        🔒 Acesso restrito. Esta página é exclusiva do dono do sistema.
      </div>
    )
  }

  const totalPages = Math.ceil(total / limit)
  const inputStyle: CSSProperties = { padding: '6px 10px', border: '1px solid #e2e8f0', fontFamily: 'var(--font-mono)', fontSize: 12 }
  const th: CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 9, textTransform: 'uppercase', color: '#666', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc' }

  return (
    <div style={{ padding: '16px 4px' }}>
      <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 20, margin: '0 0 4px' }}>AUDITORIA</h1>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#888', margin: '0 0 16px' }}>
        Log de ações por usuário — acesso exclusivo seu. {total} registros.
      </p>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <select value={userFilter} onChange={e => { setUserFilter(e.target.value); setPage(1) }} style={inputStyle}>
          <option value="">Todos os usuários</option>
          {users.map(u => <option key={u.userEmail ?? '—'} value={u.userEmail ?? ''}>{u.userEmail ?? '(sem usuário)'} ({u.count})</option>)}
        </select>
        <select value={methodFilter} onChange={e => { setMethodFilter(e.target.value); setPage(1) }} style={inputStyle}>
          <option value="">Toda ação</option>
          <option value="POST">Criação (POST)</option>
          <option value="PATCH">Edição (PATCH)</option>
          <option value="PUT">Edição (PUT)</option>
          <option value="DELETE">Exclusão (DELETE)</option>
        </select>
        <input placeholder="Buscar ação/rota..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} style={{ ...inputStyle, width: 200 }} />
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#666' }}>De <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }} style={inputStyle} /></label>
        <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#666' }}>Até <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }} style={inputStyle} /></label>
        {(userFilter || methodFilter || search || from || to) && (
          <button onClick={() => { setUserFilter(''); setMethodFilter(''); setSearch(''); setFrom(''); setTo(''); setPage(1) }}
            style={{ ...inputStyle, cursor: 'pointer', fontWeight: 700 }}>Limpar</button>
        )}
      </div>

      {/* Tabela */}
      <div style={{ border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', background: 'white', overflowX: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={th}>Data / Hora</th>
              <th style={th}>Usuário</th>
              <th style={th}>Ação</th>
              <th style={th}>Método</th>
              <th style={th}>Rota</th>
              <th style={{ ...th, textAlign: 'right' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: '#555' }}>{new Date(l.createdAt).toLocaleString('pt-BR')}</td>
                <td style={{ padding: '7px 10px' }}>
                  <div style={{ fontWeight: 700 }}>{l.userEmail ?? '—'}</div>
                  {l.userRole && <div style={{ fontSize: 9, color: '#888' }}>{l.userRole}</div>}
                </td>
                <td style={{ padding: '7px 10px', fontWeight: 700 }}>{l.action}</td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={{ background: METHOD_COLORS[l.method] ?? '#888', color: 'white', padding: '2px 6px', fontSize: 9, fontWeight: 700 }}>{l.method}</span>
                </td>
                <td style={{ padding: '7px 10px', fontSize: 10, color: '#666', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.path}>{l.path}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', color: (l.statusCode ?? 0) >= 400 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{l.statusCode ?? '-'}</td>
              </tr>
            ))}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#888' }}>Nenhuma ação registrada nesse filtro.</td></tr>
            )}
            {loading && (
              <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center', color: '#888' }}>Carregando...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14, alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ ...inputStyle, cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>Anterior</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ ...inputStyle, cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>Próximo</button>
        </div>
      )}
    </div>
  )
}
