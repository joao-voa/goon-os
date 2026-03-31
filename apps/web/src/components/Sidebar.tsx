'use client'

import { type LucideIcon, LayoutDashboard, Building2, Package, FileText, GitBranch, DollarSign, AlertTriangle, LogOut, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'

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
  { href: '/crm',        label: 'CRM',        icon: Users },
  { href: '/clients',    label: 'Clientes',   icon: Building2 },
  { href: '/products',   label: 'Programas',  icon: Package },
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
  const [openPendenciesCount, setOpenPendenciesCount] = useState(0)

  useEffect(() => {
    apiFetch<{ total: number }>('/api/pendencies?status=OPEN&limit=1')
      .then(r => setOpenPendenciesCount(r.total ?? 0))
      .catch(() => {})
  }, [])

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
      <style>{`
        @keyframes badgePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }
      `}</style>
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
                  position: 'relative',
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
                {item.href === '/pendencies' && openPendenciesCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: collapsed && !isMobile ? 4 : 10,
                      background: '#cc0000',
                      color: 'white',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      fontWeight: 700,
                      minWidth: 16,
                      height: 16,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 3px',
                      border: '1px solid white',
                      lineHeight: 1,
                      animation: 'badgePulse 2s ease-in-out infinite',
                    }}
                  >
                    {openPendenciesCount > 99 ? '99+' : openPendenciesCount}
                  </span>
                )}
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
