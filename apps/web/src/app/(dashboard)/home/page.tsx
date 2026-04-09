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
  { icon: LayoutDashboard, label: 'Dashboard', description: 'Visao geral e KPIs', href: '/dashboard', color: 'var(--retro-blue)' },
  { icon: Users, label: 'CRM', description: 'Pipeline de vendas e leads', href: '/crm', color: '#4A78FF' },
  { icon: Package, label: 'Programas', description: 'Produtos e programas', href: '/products', color: 'var(--success)' },
  { icon: GitBranch, label: 'Acompanhamento CX', description: 'Acompanhamento e cadencia de clientes', href: '/onboarding', color: 'var(--warning)' },
  { icon: DollarSign, label: 'Financeiro', description: 'Pagamentos, despesas e fluxo', href: '/payments', color: '#22c55e' },
  { icon: FileText, label: 'Contratos', description: 'Gestao de contratos', href: '/contracts', color: '#e6a800' },
  { icon: Settings, label: 'Admin', description: 'Usuarios e configuracoes', href: '/admin', color: 'var(--retro-blue)' },
]

export default function HomePage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '20px 0', minHeight: 'calc(100vh - 140px)',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-pixel)', fontSize: 28, fontWeight: 700, marginBottom: 6 }}>
          GOON OS
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 3 }}>
          Sistema de Gestao
        </p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12, width: '100%', maxWidth: 750,
      }}>
        {menuItems.map((item) => {
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
                  e.currentTarget.style.boxShadow = `6px 6px 0 black`
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
