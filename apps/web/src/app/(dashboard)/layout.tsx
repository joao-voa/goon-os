'use client'

import { type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { useAuth } from '@/hooks/useAuth'
import { useSidebar } from '@/hooks/useSidebar'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { Sidebar, NAV_ITEMS } from '@/components/Sidebar'
import { apiFetch } from '@/lib/api'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Building2, Package, FileText, DollarSign, AlertTriangle, GitBranch, Users } from 'lucide-react'

// ---- useKeepAlive ----
function useKeepAlive() {
  useEffect(() => {
    const ping = () => apiFetch('/health').catch(() => {})
    const id = setInterval(ping, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])
}

// ---- Bottom Nav Items (max 6 most important) ----
const BOTTOM_NAV = [
  { href: '/dashboard',  label: 'Home',    Icon: LayoutDashboard },
  { href: '/crm',        label: 'CRM',     Icon: Users },
  { href: '/clients',    label: 'Clientes', Icon: Building2 },
  { href: '/products',   label: 'Progr.',  Icon: Package },
  { href: '/contracts',  label: 'Contr.',  Icon: FileText },
  { href: '/payments',   label: 'Financ.', Icon: DollarSign },
  { href: '/pendencies', label: 'Pend.',   Icon: AlertTriangle },
]

// ---- Mobile Bottom Nav ----
function MobileBottomNav({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 56,
      background: 'var(--retro-gray)',
      borderTop: '2px solid black',
      boxShadow: '0 -4px 0 black',
      display: 'flex',
      alignItems: 'stretch',
      zIndex: 40,
    }}>
      {BOTTOM_NAV.map(({ href, label, Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <a
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              textDecoration: 'none',
              background: isActive ? 'var(--retro-blue)' : 'transparent',
              color: isActive ? 'white' : 'black',
              borderRight: '1px solid rgba(0,0,0,0.15)',
              padding: '4px 2px',
              minHeight: 44,
            }}
          >
            <Icon size={16} style={{ flexShrink: 0 }} />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 7,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.3,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}>
              {label}
            </span>
          </a>
        )
      })}
      {/* Menu button for full sidebar */}
      <button
        onClick={onMenuClick}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          background: 'none',
          border: 'none',
          borderLeft: '1px solid rgba(0,0,0,0.15)',
          cursor: 'pointer',
          padding: '4px 2px',
          minHeight: 44,
          color: 'black',
        }}
        title="Menu"
      >
        <GitBranch size={16} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 7,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
          lineHeight: 1,
        }}>
          Menu
        </span>
      </button>
    </nav>
  )
}

// ---- DashboardLayoutInner ----
function DashboardLayoutInner({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth()
  const { state, isMobile, mobileOpen, toggle, closeMobile, sidebarWidth } = useSidebar()
  const pathname = usePathname()
  useKeepAlive()

  // Route protection: check if user has access to current module
  const isBlocked = (() => {
    if (!user || !user.allowedModules) return false
    if (user.role === 'admin') return false
    if (pathname === '/home') return false // home always allowed
    try {
      const mods: string[] = JSON.parse(user.allowedModules)
      if (mods.length === 0) return false
      // Check if current path starts with any allowed module
      return !mods.some(m => pathname === m || pathname.startsWith(m + '/'))
    } catch { return false }
  })()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--retro-bg)',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 12,
          color: 'black',
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}>
          CARREGANDO...
        </div>
        <div style={{
          width: 40,
          height: 8,
          background: 'black',
          animation: 'blink 0.8s step-end infinite',
        }} />
        <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--retro-bg)' }}>
      <Sidebar
        navItems={NAV_ITEMS}
        collapsed={state === 'collapsed'}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onToggle={toggle}
        onCloseMobile={closeMobile}
        onLogout={logout}
        userRole={user?.role}
        userAllowedModules={user?.allowedModules}
      />

      {/* Mobile top bar — simplified, no hamburger (bottom nav handles navigation) */}
      {isMobile && (
        <header style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 48,
          background: 'black',
          borderBottom: '2px solid black',
          boxShadow: '0 4px 0 black',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 30,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              color: 'white',
              fontWeight: 900,
              fontSize: 14,
              fontFamily: 'var(--font-pixel)',
              letterSpacing: '0.05em',
            }}>GOON</span>
            <span style={{
              color: 'var(--retro-gray)',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
            }}>OS</span>
          </div>
          {user && (
            <span style={{
              color: 'var(--retro-gray)',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              {user.name}
            </span>
          )}
        </header>
      )}

      {/* Desktop header */}
      {!isMobile && (
        <header style={{
          position: 'fixed',
          top: 0,
          left: sidebarWidth,
          right: 0,
          height: 56,
          background: 'var(--retro-gray)',
          borderBottom: '2px solid black',
          boxShadow: '0 4px 0 black',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 24px',
          zIndex: 30,
          transition: 'left 0.2s ease',
        }}>
          {user && (
            <span style={{
              color: 'black',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              {user.name}
            </span>
          )}
        </header>
      )}

      {/* Main content */}
      <main style={{
        marginLeft: isMobile ? 0 : sidebarWidth,
        marginTop: isMobile ? 48 : 56,
        padding: isMobile ? 12 : 28,
        paddingBottom: isMobile ? 72 : undefined,
        transition: 'margin-left 0.2s ease',
        minHeight: isMobile ? 'calc(100vh - 48px)' : 'calc(100vh - 56px)',
      }}>
        {isBlocked ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 16, color: '#cc0000', textTransform: 'uppercase' }}>ACESSO NEGADO</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#666' }}>Voce nao tem permissao para acessar este modulo.</div>
            <a href="/home" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#4A78FF', textDecoration: 'underline' }}>Voltar ao Inicio</a>
          </div>
        ) : children}
      </main>

      {/* Mobile bottom navigation */}
      {isMobile && <MobileBottomNav onMenuClick={toggle} />}
    </div>
  )
}

// ---- DashboardLayout (root export) ----
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <DashboardLayoutInner>{children}</DashboardLayoutInner>
        <Toaster richColors position="top-right" />
      </SidebarProvider>
    </QueryClientProvider>
  )
}
