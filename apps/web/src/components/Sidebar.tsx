'use client'

import { type LucideIcon, LayoutDashboard, Building2, Package, FileText, GitBranch, Sun, Moon, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'
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
  theme: 'dark' | 'light'
  onToggle: () => void
  onCloseMobile: () => void
  onThemeToggle: () => void
  onLogout: () => void
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/clients',    label: 'Clientes',   icon: Building2 },
  { href: '/products',   label: 'Produtos',   icon: Package },
  { href: '/contracts',  label: 'Contratos',  icon: FileText },
  { href: '/onboarding', label: 'Onboarding', icon: GitBranch },
]

export function Sidebar({
  navItems,
  collapsed,
  isMobile,
  mobileOpen,
  theme,
  onToggle,
  onCloseMobile,
  onThemeToggle,
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
    background: 'var(--goon-sidebar-bg)',
    borderRight: '1px solid var(--goon-border-subtle)',
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
            backdropFilter: 'blur(2px)',
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
          borderBottom: '1px solid var(--goon-border-subtle)',
          flexShrink: 0,
        }}>
          {(!collapsed || isMobile) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                color: 'var(--goon-primary)',
                fontWeight: 900,
                fontSize: 18,
                fontFamily: 'Arial Black, Arial, sans-serif',
                letterSpacing: '-0.02em',
              }}>GOON</span>
              <span style={{
                color: 'var(--goon-text-muted)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.05em',
              }}>OS</span>
            </div>
          )}
          {collapsed && !isMobile && (
            <span style={{
              color: 'var(--goon-primary)',
              fontWeight: 900,
              fontSize: 18,
              fontFamily: 'Arial Black, Arial, sans-serif',
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
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--goon-text-muted)',
                transition: 'color 0.15s ease, background 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--goon-text-primary)'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--goon-primary-muted)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--goon-text-muted)'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
              }}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
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
                  padding: collapsed && !isMobile ? '10px 0' : '10px 16px',
                  justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                  textDecoration: 'none',
                  color: isActive ? 'var(--goon-text-primary)' : 'var(--goon-text-muted)',
                  background: isActive ? 'var(--goon-primary-muted)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--goon-primary)' : '3px solid transparent',
                  margin: '2px 0',
                  transition: 'color 0.15s ease, background 0.15s ease',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--goon-text-primary)'
                    ;(e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--goon-text-muted)'
                    ;(e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
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
          borderTop: '1px solid var(--goon-border-subtle)',
          padding: '8px 0',
          flexShrink: 0,
        }}>
          {/* Theme toggle */}
          <button
            onClick={onThemeToggle}
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: collapsed && !isMobile ? '10px 0' : '10px 16px',
              justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--goon-text-muted)',
              fontSize: 14,
              fontWeight: 400,
              transition: 'color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--goon-text-primary)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--goon-text-muted)'
            }}
          >
            {theme === 'dark'
              ? <Sun size={18} style={{ flexShrink: 0 }} />
              : <Moon size={18} style={{ flexShrink: 0 }} />
            }
            {(!collapsed || isMobile) && (
              <span>{theme === 'dark' ? 'Modo claro' : 'Modo escuro'}</span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            title="Sair"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: collapsed && !isMobile ? '10px 0' : '10px 16px',
              justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--goon-text-muted)',
              fontSize: 14,
              fontWeight: 400,
              transition: 'color 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = '#f87171'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--goon-text-muted)'
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
