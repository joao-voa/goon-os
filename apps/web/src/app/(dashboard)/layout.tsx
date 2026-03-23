'use client'

import { type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { useAuth } from '@/hooks/useAuth'
import { useSidebar } from '@/hooks/useSidebar'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { Sidebar, NAV_ITEMS } from '@/components/Sidebar'
import { MobileHeader } from '@/components/MobileHeader'
import { apiFetch } from '@/lib/api'
import { useEffect } from 'react'

// ---- useKeepAlive ----
function useKeepAlive() {
  useEffect(() => {
    const ping = () => apiFetch('/health').catch(() => {})
    const id = setInterval(ping, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])
}

// ---- DashboardLayoutInner ----
function DashboardLayoutInner({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth()
  const { state, isMobile, mobileOpen, toggle, closeMobile, sidebarWidth } = useSidebar()
  useKeepAlive()

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
      />

      {/* Mobile header */}
      {isMobile && (
        <MobileHeader onMenuClick={toggle} userName={user?.name} />
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
        marginTop: 56,
        padding: isMobile ? 16 : 28,
        transition: 'margin-left 0.2s ease',
        minHeight: 'calc(100vh - 56px)',
      }}>
        {children}
      </main>
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
