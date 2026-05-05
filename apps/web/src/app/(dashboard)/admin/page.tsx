'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'

interface UserItem {
  id: string
  name: string
  email: string
  role: string
  allowedModules: string | null
  isActive: boolean
  createdAt: string
}

const ALL_MODULES = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/crm', label: 'CRM' },
  { href: '/clients', label: 'Clientes' },
  { href: '/products', label: 'Programas' },
  { href: '/contracts', label: 'Contratos' },
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/agenda', label: 'Agenda' },
  { href: '/tasks', label: 'Tarefas' },
  { href: '/payments', label: 'Financeiro' },
  { href: '/commissions', label: 'Comissoes' },
  { href: '/expenses', label: 'Despesas' },
  { href: '/cashflow', label: 'Fluxo Caixa' },
  { href: '/pendencies', label: 'Pendencias' },
  { href: '/admin', label: 'Admin' },
]

const ROLE_PRESETS: Record<string, { label: string; modules: string[] }> = {
  admin: {
    label: 'Administrador',
    modules: ALL_MODULES.map(m => m.href),
  },
  gestao: {
    label: 'Gestao',
    modules: ALL_MODULES.filter(m => m.href !== '/admin').map(m => m.href),
  },
  comercial: {
    label: 'Comercial',
    modules: ['/crm', '/clients'],
  },
  analitico: {
    label: 'Analitico',
    modules: ['/crm', '/clients', '/products', '/contracts', '/onboarding', '/pendencies'],
  },
}

const SYSTEM_VERSION = 'v2.0.0'

const emptyForm = { name: '', email: '', password: '', role: 'comercial', modules: [] as string[] }

export default function AdminPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiFetch<UserItem[]>('/api/admin/users')
      setUsers(data)
    } catch { toast.error('Erro ao carregar usuarios') }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  function applyPreset(role: string) {
    const preset = ROLE_PRESETS[role]
    if (preset) {
      setForm(f => ({ ...f, role, modules: [...preset.modules] }))
    }
  }

  function toggleModule(href: string) {
    setForm(f => ({
      ...f,
      modules: f.modules.includes(href) ? f.modules.filter(m => m !== href) : [...f.modules, href],
    }))
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.error('Nome e email sao obrigatorios')
      return
    }
    if (!editId && !form.password) {
      toast.error('Senha obrigatoria para novo usuario')
      return
    }

    const body: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      role: form.role,
      allowedModules: JSON.stringify(form.modules),
    }
    if (form.password) body.password = form.password

    try {
      if (editId) {
        await apiFetch(`/api/admin/users/${editId}`, { method: 'PUT', body: JSON.stringify(body) })
        toast.success('Usuario atualizado')
      } else {
        await apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(body) })
        toast.success('Usuario criado')
      }
      setShowModal(false)
      setEditId(null)
      setForm(emptyForm)
      loadUsers()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    }
  }

  function handleEdit(u: UserItem) {
    let mods: string[] = []
    try { mods = JSON.parse(u.allowedModules ?? '[]') } catch { /* */ }
    setEditId(u.id)
    setForm({ name: u.name, email: u.email, password: '', role: u.role, modules: mods })
    setShowModal(true)
  }

  async function handleToggleActive(u: UserItem) {
    try {
      await apiFetch(`/api/admin/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ isActive: !u.isActive }) })
      toast.success(u.isActive ? 'Usuario desativado' : 'Usuario ativado')
      loadUsers()
    } catch { toast.error('Erro') }
  }

  async function handleDelete(u: UserItem) {
    if (!confirm(`Excluir ${u.name} permanentemente?`)) return
    try {
      await apiFetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
      toast.success('Usuario excluido')
      loadUsers()
    } catch { toast.error('Erro ao excluir') }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '2px solid black', fontFamily: 'var(--font-mono)', fontSize: 12 }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 20, margin: 0 }}>ADMINISTRACAO</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#888', marginTop: 4 }}>GOON OS {SYSTEM_VERSION}</div>
        </div>
        <button onClick={() => { setEditId(null); setForm(emptyForm); setShowModal(true) }} style={{ background: 'black', color: 'white', border: '2px solid black', boxShadow: '4px 4px 0 black', padding: '8px 16px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>+ NOVO USUARIO</button>
      </div>

      {/* Users Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'black', color: 'white', textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Nome</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Email</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Perfil</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Modulos</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              let mods: string[] = []
              try { mods = JSON.parse(u.allowedModules ?? '[]') } catch { /* */ }
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #ccc', opacity: u.isActive ? 1 : 0.5 }}>
                  <td style={{ padding: '8px 12px', fontWeight: 700 }}>{u.name}</td>
                  <td style={{ padding: '8px 12px' }}>{u.email}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{ background: u.role === 'admin' ? '#cc0000' : u.role === 'gestao' ? '#006600' : '#4A78FF', color: 'white', padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                      {ROLE_PRESETS[u.role]?.label ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 10 }}>
                    {mods.length > 0 ? `${mods.length} modulos` : 'Todos'}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{ background: u.isActive ? '#006600' : '#cc0000', color: 'white', padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                      {u.isActive ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button onClick={() => handleEdit(u)} style={{ background: 'var(--retro-blue)', color: 'white', border: '2px solid black', padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700 }}>EDITAR</button>
                      <button onClick={() => handleToggleActive(u)} style={{ background: u.isActive ? '#e6a800' : '#006600', color: 'white', border: '2px solid black', padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700 }}>{u.isActive ? 'DESATIVAR' : 'ATIVAR'}</button>
                      <button onClick={() => handleDelete(u)} style={{ background: '#cc0000', color: 'white', border: '2px solid black', padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700 }}>X</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#888' }}>Nenhum usuario</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--retro-gray)', border: '3px solid black', boxShadow: '6px 6px 0 black', padding: 24, width: 480, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, marginBottom: 16 }}>{editId ? 'EDITAR' : 'NOVO'} USUARIO</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Nome *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Senha {editId ? '(deixe vazio p/ manter)' : '*'}</label>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Perfil Padrao</label>
                  <select value={form.role} onChange={e => applyPreset(e.target.value)} style={inputStyle}>
                    {Object.entries(ROLE_PRESETS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modules Checkboxes */}
              <div>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Modulos com Acesso ({form.modules.length}/{ALL_MODULES.length})</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {ALL_MODULES.map(m => (
                    <label key={m.href} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer', padding: '6px 8px', background: form.modules.includes(m.href) ? 'black' : 'white', color: form.modules.includes(m.href) ? 'white' : 'black', border: '2px solid black' }}>
                      <input type="checkbox" checked={form.modules.includes(m.href)} onChange={() => toggleModule(m.href)} style={{ accentColor: 'white' }} />
                      {m.label}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, modules: ALL_MODULES.map(m => m.href) }))} style={{ padding: '4px 10px', border: '1px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700 }}>MARCAR TODOS</button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, modules: [] }))} style={{ padding: '4px 10px', border: '1px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700 }}>DESMARCAR TODOS</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditId(null) }} style={{ padding: '8px 16px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700 }}>CANCELAR</button>
              <button onClick={handleSave} style={{ background: 'black', color: 'white', padding: '8px 16px', border: '2px solid black', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, boxShadow: '3px 3px 0 black' }}>SALVAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
