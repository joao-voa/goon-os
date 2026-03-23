'use client'

import { type LucideIcon, LayoutDashboard, Building2, Package, FileText, GitBranch, DollarSign, AlertTriangle, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

interface SidebarProps {
  navItems: NavItem[]
  collapsed: boolean
  isMobile: boolean
  mobileOpen: boolean
  onToggle: () => void
  onCloseMobile: () => void
  onLogout: () => void
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/clients',    label: 'Clientes',   icon: Building2 },
  { href: '/products',   label: 'Produtos',   icon: Package },
  { href: '/contracts',  label: 'Contratos',  icon: FileText },
  { href: '/onboarding', label: 'Onboarding', icon: GitBranch },
  { href: '/payments',   label: 'Financeiro', icon: DollarSign },
  { href: '/pendencies', label: 'Pendências', icon: AlertTriangle },
]

export function Sidebar({
  navItems,
  collapsed,
  isMobile,
  mobileOpen,
  onToggle,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname()

  const sidebarWidth = isMobile ? 240 : collapsed ? 56 : 240
  const isVisible = isMobile ? mobileOpen : true

  const sidebarStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    width: sidebarWidth,
    background: 'var(--retro-gray)',
    borderRight: '2px solid black',
    boxShadow: '4px 0 0 black',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 51,
    transition: 'transform 0.2s ease, width 0.2s ease',
    transform: isVisible ? 'translateX(0)' : 'translateX(-100%)',
    overflow: 'hidden',
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 50,
          }}
        />
      )}

      <nav style={sidebarStyle}>
        {/* Logo + toggle */}
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
          padding: collapsed && !isMobile ? '0' : '0 12px 0 16px',
          borderBottom: '2px solid black',
          flexShrink: 0,
          background: 'black',
        }}>
          {(!collapsed || isMobile) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                color: 'white',
                fontWeight: 900,
                fontSize: 16,
                fontFamily: 'var(--font-pixel)',
                letterSpacing: '0.05em',
              }}>GOON</span>
              <span style={{
                color: 'var(--retro-gray)',
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.05em',
              }}>OS</span>
            </div>
          )}
          {collapsed && !isMobile && (
            <span style={{
              color: 'white',
              fontWeight: 900,
              fontSize: 14,
              fontFamily: 'var(--font-pixel)',
            }}>G</span>
          )}
          {!isMobile && (
            <button
              onClick={onToggle}
              title={collapsed ? 'Expandir' : 'Recolher'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--retro-gray)',
                transition: 'color 0.1s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = 'white'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--retro-gray)'
              }}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <a
                key={item.href}
                href={item.href}
                title={collapsed && !isMobile ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: collapsed && !isMobile ? '12px 0' : '12px 16px',
                  justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                  textDecoration: 'none',
                  color: isActive ? 'white' : 'black',
                  background: isActive ? 'var(--retro-blue)' : 'transparent',
                  boxShadow: isActive ? 'inset 3px 0 0 white' : 'none',
                  borderBottom: '1px solid rgba(0,0,0,0.15)',
                  borderLeft: isActive ? '3px solid #ccff00' : 'none',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: 12,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.1s',
                  paddingLeft: isActive && !collapsed && !isMobile ? '13px' : undefined,
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.background = '#b0b0b0'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                  }
                }}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {(!collapsed || isMobile) && <span>{item.label}</span>}
              </a>
            )
          })}
        </div>

        {/* Bottom actions */}
        <div style={{
          borderTop: '2px solid black',
          flexShrink: 0,
        }}>
          {/* Logout */}
          <button
            onClick={onLogout}
            title="Sair"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: collapsed && !isMobile ? '12px 0' : '12px 16px',
              justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'black',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--danger)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'white'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'none'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'black'
            }}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {(!collapsed || isMobile) && <span>Sair</span>}
          </button>
        </div>
      </nav>
    </>
  )
}
