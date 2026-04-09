'use client'

import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  Package,
  GitBranch,
  DollarSign,
  FileText,
  Settings,
} from 'lucide-react'

const menuItems = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    description: 'Visao geral e KPIs',
    href: '/dashboard',
    color: '#2563eb',
  },
  {
    icon: Users,
    label: 'CRM',
    description: 'Pipeline de vendas e leads',
    href: '/crm',
    color: '#7c3aed',
  },
  {
    icon: Package,
    label: 'Programas',
    description: 'Produtos e programas',
    href: '/products',
    color: '#059669',
  },
  {
    icon: GitBranch,
    label: 'Onboarding',
    description: 'Pipeline de onboarding',
    href: '/onboarding',
    color: '#d97706',
  },
  {
    icon: DollarSign,
    label: 'Financeiro',
    description: 'Pagamentos, despesas e fluxo',
    href: '/payments',
    color: '#16a34a',
  },
  {
    icon: FileText,
    label: 'Contratos',
    description: 'Gestao de contratos',
    href: '/contracts',
    color: '#dc2626',
  },
  {
    icon: Settings,
    label: 'Admin',
    description: 'Usuarios e configuracoes',
    href: '/admin',
    color: '#475569',
  },
]

export default function HomePage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        minHeight: 'calc(100vh - 80px)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: '2.5rem',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: '4px',
        }}
      >
        GOON OS
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.95rem',
          color: '#555',
          textAlign: 'center',
          marginBottom: '40px',
        }}
      >
        Sistema de Gestao
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '16px',
          width: '100%',
          maxWidth: '800px',
        }}
      >
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div
                style={{
                  background: '#fff',
                  border: '2px solid #000',
                  borderRadius: '4px',
                  boxShadow: '4px 4px 0 black',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translate(-2px, -2px)'
                  e.currentTarget.style.boxShadow = '6px 6px 0 black'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translate(0, 0)'
                  e.currentTarget.style.boxShadow = '4px 4px 0 black'
                }}
              >
                <Icon size={28} color={item.color} strokeWidth={2} />
                <span
                  style={{
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '1rem',
                    fontWeight: 600,
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    color: '#666',
                  }}
                >
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
