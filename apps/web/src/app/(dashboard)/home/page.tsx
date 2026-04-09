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
    bg: '#eff6ff',
    border: '#93c5fd',
  },
  {
    icon: Users,
    label: 'CRM',
    description: 'Pipeline de vendas e leads',
    href: '/crm',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#c4b5fd',
  },
  {
    icon: Package,
    label: 'Programas',
    description: 'Produtos e programas',
    href: '/products',
    color: '#059669',
    bg: '#ecfdf5',
    border: '#6ee7b7',
  },
  {
    icon: GitBranch,
    label: 'Acompanhamento CX',
    description: 'Acompanhamento e cadencia de clientes',
    href: '/onboarding',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fcd34d',
  },
  {
    icon: DollarSign,
    label: 'Financeiro',
    description: 'Pagamentos, despesas e fluxo',
    href: '/payments',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#86efac',
  },
  {
    icon: FileText,
    label: 'Contratos',
    description: 'Gestao de contratos',
    href: '/contracts',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fca5a5',
  },
  {
    icon: Settings,
    label: 'Admin',
    description: 'Usuarios e configuracoes',
    href: '/admin',
    color: '#475569',
    bg: '#f8fafc',
    border: '#cbd5e1',
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
        padding: '20px 0',
        minHeight: 'calc(100vh - 140px)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: '2.5rem',
            fontWeight: 700,
            marginBottom: 4,
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          GOON OS
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: 2,
          }}
        >
          Sistema de Gestao
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          width: '100%',
          maxWidth: 800,
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
                  background: item.bg,
                  border: `2px solid ${item.border}`,
                  borderLeft: `5px solid ${item.color}`,
                  borderRadius: 6,
                  boxShadow: '3px 3px 0 rgba(0,0,0,0.1)',
                  padding: '20px 18px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  minHeight: 120,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translate(-2px, -2px)'
                  e.currentTarget.style.boxShadow = `5px 5px 0 ${item.color}33`
                  e.currentTarget.style.borderColor = item.color
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translate(0, 0)'
                  e.currentTarget.style.boxShadow = '3px 3px 0 rgba(0,0,0,0.1)'
                  e.currentTarget.style.borderColor = item.border
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: `${item.color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={22} color={item.color} strokeWidth={2.2} />
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-pixel)',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: '#666',
                    lineHeight: 1.4,
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
