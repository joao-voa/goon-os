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
  GraduationCap,
  ScrollText,
  TrendingUp,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { GoonLogo } from '@/components/GoonLogo'
import { OWNER_EMAIL } from '@/lib/constants'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', description: 'Visao geral e KPIs', href: '/dashboard', color: 'var(--retro-blue)' },
  { icon: Users, label: 'CRM', description: 'Pipeline de vendas e leads', href: '/crm', color: '#4A78FF' },
  { icon: Building2, label: 'Clientes', description: 'Base de clientes e cadencia', href: '/clients', color: '#000080' },
  { icon: Calendar, label: 'Agenda', description: 'Reunioes e acompanhamento', href: '/agenda', color: '#7c3aed' },
  { icon: Package, label: 'Programas', description: 'Produtos e programas', href: '/products', color: 'var(--success)' },
  { icon: GitBranch, label: 'Onboarding', description: 'Fluxo de onboarding de clientes', href: '/onboarding', color: 'var(--warning)' },
  { icon: GraduationCap, label: 'Mentorados', description: 'Acompanhamento de mentorados', href: '/mentorship', color: '#7c3aed' },
  { icon: DollarSign, label: 'Financeiro', description: 'Pagamentos, despesas e fluxo', href: '/payments', color: '#22c55e' },
  { icon: CheckSquare, label: 'Tarefas', description: 'Gestao de tarefas e projetos', href: '/tasks', color: '#4A78FF' },
  { icon: AlertTriangle, label: 'Pendencias', description: 'Inadimplentes e contratos', href: '/pendencies', color: '#cc0000' },
  { icon: FileText, label: 'Contratos', description: 'Gestao de contratos', href: '/contracts', color: '#e6a800' },
  { icon: Settings, label: 'Admin', description: 'Usuarios e configuracoes', href: '/admin', color: 'var(--retro-blue)' },
]

// Itens exclusivos do dono (João) — igual à sidebar.
const SALES_ITEM = { icon: TrendingUp, label: 'Vendas', description: 'Contratos fechados por mes', href: '/sales', color: '#0A0A0C' }
const AUDIT_ITEM = { icon: ScrollText, label: 'Auditoria', description: 'Log de acoes por usuario', href: '/audit', color: '#0A0A0C' }

const comercialPaths = ['/crm', '/agenda', '/products']

export default function HomePage() {
  const [userRole, setUserRole] = useState<string>('')
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null)
  const [userName, setUserName] = useState('')
  const [isOwner, setIsOwner] = useState(false)

  useEffect(() => {
    apiFetch<{ role: string; allowedModules?: string | null; name: string; email: string }>('/api/auth/me')
      .then(user => {
        setUserRole(user.role)
        setUserName(user.name)
        setIsOwner(user.email === OWNER_EMAIL)
        if (user.allowedModules) {
          try { setAllowedModules(JSON.parse(user.allowedModules)) } catch { /* ignore */ }
        }
      })
      .catch(() => {})
  }, [])

  const visibleItems = (() => {
    const base = (() => {
      if (allowedModules && allowedModules.length > 0) {
        return menuItems.filter(item => allowedModules.includes(item.href))
      }
      if (userRole === 'admin') return menuItems
      if (userRole === 'comercial') return menuItems.filter(item => comercialPaths.includes(item.href))
      return menuItems
    })()
    // Vendas + Auditoria: só o dono vê (independente de role/módulos).
    return isOwner ? [...base, SALES_ITEM, AUDIT_ITEM] : base
  })()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '20px 0', minHeight: 'calc(100vh - 140px)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><GoonLogo height={52} fill="#0A0A0C" /></div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: '#6E6E78', textTransform: 'uppercase', letterSpacing: '0.42em', paddingLeft: '0.42em', fontWeight: 600, marginBottom: 18 }}>
          Advisor
        </p>
        <div style={{ width: 32, height: 3, background: '#C7F900', borderRadius: 2, margin: '0 auto 20px' }} />
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: '#334155', fontWeight: 500 }}>
          Seja bem-vindo ao Sistema Operacional GOON{userName ? `, ${userName}` : ''}.
        </p>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: '#9ca3af', letterSpacing: '0.32em', fontWeight: 700, marginTop: 10, textTransform: 'uppercase' }}>
          Global <span style={{ color: '#8fb800' }}>or</span> Nothing
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
                  background: 'white', border: '1px solid #e2e8f0',
                  borderLeft: '4px solid #C7F900',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)', padding: '16px 14px',
                  cursor: 'pointer', transition: 'transform 0.1s, box-shadow 0.1s',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translate(-2px, -2px)'
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.08)'
                  e.currentTarget.style.background = '#0A0A0C'
                  e.currentTarget.style.color = 'white'
                  e.currentTarget.style.borderColor = '#0A0A0C'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translate(0, 0)'
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.07)'
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.color = 'inherit'
                  e.currentTarget.style.borderColor = '#e2e8f0'
                }}
              >
                <Icon size={20} color="currentColor" strokeWidth={2.2} />
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
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
