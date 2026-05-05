'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
  Package,
  GitBranch,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckSquare,
  Settings,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', description: 'Visao geral e KPIs', href: '/dashboard', color: 'var(--retro-blue)' },
  { icon: Users, label: 'CRM', description: 'Pipeline de vendas e leads', href: '/crm', color: '#4A78FF' },
  { icon: Building2, label: 'Clientes', description: 'Base de clientes e cadencia', href: '/clients', color: '#000080' },
  { icon: Calendar, label: 'Agenda', description: 'Reunioes e acompanhamento', href: '/agenda', color: '#7c3aed' },
  { icon: Package, label: 'Programas', description: 'Produtos e programas', href: '/products', color: 'var(--success)' },
  { icon: GitBranch, label: 'Onboarding', description: 'Fluxo de onboarding de clientes', href: '/onboarding', color: 'var(--warning)' },
  { icon: DollarSign, label: 'Financeiro', description: 'Pagamentos, despesas e fluxo', href: '/payments', color: '#22c55e' },
  { icon: CheckSquare, label: 'Tarefas', description: 'Gestao de tarefas e projetos', href: '/tasks', color: '#4A78FF' },
  { icon: AlertTriangle, label: 'Pendencias', description: 'Inadimplentes e contratos', href: '/pendencies', color: '#cc0000' },
  { icon: FileText, label: 'Contratos', description: 'Gestao de contratos', href: '/contracts', color: '#e6a800' },
  { icon: Settings, label: 'Admin', description: 'Usuarios e configuracoes', href: '/admin', color: 'var(--retro-blue)' },
]

const comercialPaths = ['/crm', '/agenda', '/products']

export default function HomePage() {
  const [userRole, setUserRole] = useState<string>('')
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    apiFetch<{ role: string; allowedModules?: string | null; name: string }>('/api/auth/me')
      .then(user => {
        setUserRole(user.role)
        setUserName(user.name)
        if (user.allowedModules) {
          try { setAllowedModules(JSON.parse(user.allowedModules)) } catch { /* ignore */ }
        }
      })
      .catch(() => {})
  }, [])

  const visibleItems = (() => {
    if (allowedModules && allowedModules.length > 0) {
      return menuItems.filter(item => allowedModules.includes(item.href))
    }
    if (userRole === 'admin') return menuItems
    if (userRole === 'comercial') return menuItems.filter(item => comercialPaths.includes(item.href))
    return menuItems
  })()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '20px 0', minHeight: 'calc(100vh - 140px)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
          GOON OS
        </h1>
        {userName && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#333', marginBottom: 4 }}>
            Ola, {userName}
          </p>
        )}
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 3 }}>
          Sistema de Gestao
        </p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12, width: '100%', maxWidth: 750,
      }}>
        {visibleItems.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div
                style={{
                  background: 'white', border: '2px solid black',
                  borderLeft: `4px solid ${item.color}`,
                  boxShadow: '4px 4px 0 black', padding: '16px 14px',
                  cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translate(-2px, -2px)'
                  e.currentTarget.style.boxShadow = '6px 6px 0 black'
                  e.currentTarget.style.background = item.color
                  e.currentTarget.style.color = 'white'
                  e.currentTarget.style.borderColor = item.color
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translate(0, 0)'
                  e.currentTarget.style.boxShadow = '4px 4px 0 black'
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.color = 'inherit'
                  e.currentTarget.style.borderColor = 'black'
                }}
              >
                <Icon size={20} color={item.color} strokeWidth={2.2} />
                <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                  {item.label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.7, lineHeight: 1.3 }}>
                  {item.description}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
