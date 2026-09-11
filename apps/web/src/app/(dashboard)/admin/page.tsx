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

const C = { ink: '#0f172a', mid: '#64748b', dim: '#94a3b8', line: '#e2e8f0', bg: '#f8fafc', neon: '#C7F900', green: '#16a34a', red: '#dc2626', amber: '#f59e0b', slate: '#475569' }
const num: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums' }

// Estilo de badge de perfil por papel
function roleBadge(role: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string }> = {
    admin: { bg: '#fef2f2', color: '#dc2626' },
    gestao: { bg: '#dcfce7', color: '#166534' },
    comercial: { bg: '#f1f5f9', color: '#475569' },
    analitico: { bg: 'rgba(199,249,0,0.18)', color: '#33520a' },
  }
  const s = map[role] ?? { bg: '#f1f5f9', color: '#64748b' }
  return { background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, letterSpacing: '0.3px', display: 'inline-block' }
}

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

  const label: React.CSSProperties = { display: 'block', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }
  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Administracao</h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: C.mid, margin: '2px 0 0' }}>Usuarios, perfis e modulos de acesso · GOON OS {SYSTEM_VERSION}</p>
        </div>
        <button onClick={() => { setEditId(null); setForm(emptyForm); setShowModal(true) }} style={{ background: C.ink, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 }}>+ Novo usuario</button>
      </div>

      {/* Users Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.bg, color: C.mid }}>
                {[
                  { h: 'Nome', a: 'left' as const },
                  { h: 'Email', a: 'left' as const },
                  { h: 'Perfil', a: 'center' as const },
                  { h: 'Modulos', a: 'center' as const },
                  { h: 'Status', a: 'center' as const },
                  { h: 'Acoes', a: 'right' as const },
                ].map(c => (
                  <th key={c.h} style={{ padding: '10px 16px', textAlign: c.a, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, borderBottom: `1px solid ${C.line}` }}>{c.h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                let mods: string[] = []
                try { mods = JSON.parse(u.allowedModules ?? '[]') } catch { /* */ }
                return (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${C.bg}`, opacity: u.isActive ? 1 : 0.55 }}>
                    <td style={{ padding: '11px 16px', fontWeight: 600, color: C.ink }}>{u.name}</td>
                    <td style={{ padding: '11px 16px', color: C.mid }}>{u.email}</td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      <span style={roleBadge(u.role)}>{ROLE_PRESETS[u.role]?.label ?? u.role}</span>
                    </td>
                    <td style={{ ...num, padding: '11px 16px', textAlign: 'center', fontSize: 12, color: C.mid }}>
                      {mods.length > 0 ? `${mods.length} modulos` : 'Todos'}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                      <span style={{ background: u.isActive ? '#dcfce7' : '#f1f5f9', color: u.isActive ? '#166534' : C.mid, padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, letterSpacing: '0.3px', display: 'inline-block' }}>
                        {u.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => handleEdit(u)} style={{ background: '#fff', color: C.slate, border: `1px solid ${C.line}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600 }}>Editar</button>
                        <button onClick={() => handleToggleActive(u)} style={{ background: '#fff', color: u.isActive ? C.amber : C.green, border: `1px solid ${C.line}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600 }}>{u.isActive ? 'Desativar' : 'Ativar'}</button>
                        <button onClick={() => handleDelete(u)} title="Excluir" style={{ background: '#fff', color: C.red, border: `1px solid ${C.line}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700 }}>✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {users.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.dim, fontSize: 13 }}>Nenhum usuario</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.25)', padding: 24, width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 18px' }}>{editId ? 'Editar usuario' : 'Novo usuario'}</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Nome *</label>
                  <input className="goon-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={label}>Email *</label>
                  <input className="goon-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Senha {editId ? '(vazio p/ manter)' : '*'}</label>
                  <input className="goon-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                </div>
                <div>
                  <label style={label}>Perfil Padrao</label>
                  <select className="goon-select" value={form.role} onChange={e => applyPreset(e.target.value)}>
                    {Object.entries(ROLE_PRESETS).map(([key, val]) => (
                      <option key={key} value={key}>{val.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modules Checkboxes */}
              <div>
                <label style={label}>Modulos com Acesso ({form.modules.length}/{ALL_MODULES.length})</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {ALL_MODULES.map(m => {
                    const on = form.modules.includes(m.href)
                    return (
                      <label key={m.href} style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: on ? 600 : 500, cursor: 'pointer', padding: '8px 10px', background: on ? C.ink : '#fff', color: on ? '#fff' : C.slate, border: `1px solid ${on ? C.ink : C.line}`, borderRadius: 8, transition: 'all 0.12s ease' }}>
                        <input type="checkbox" checked={on} onChange={() => toggleModule(m.href)} style={{ accentColor: C.neon, width: 14, height: 14 }} />
                        {m.label}
                      </label>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, modules: ALL_MODULES.map(m => m.href) }))} style={{ padding: '6px 12px', border: `1px solid ${C.line}`, background: '#fff', color: C.slate, borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600 }}>Marcar todos</button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, modules: [] }))} style={{ padding: '6px 12px', border: `1px solid ${C.line}`, background: '#fff', color: C.slate, borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600 }}>Desmarcar todos</button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditId(null) }} style={{ padding: '9px 18px', border: `1px solid ${C.line}`, background: '#fff', color: C.slate, borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600 }}>Cancelar</button>
              <button onClick={handleSave} style={{ background: C.neon, color: C.ink, padding: '9px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 700 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
