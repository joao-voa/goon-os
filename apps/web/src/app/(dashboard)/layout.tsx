'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { queryClient } from '@/lib/query-client'
import { useAuth } from '@/hooks/useAuth'
import { useSidebar } from '@/hooks/useSidebar'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { Sidebar, NAV_ITEMS } from '@/components/Sidebar'
import { MobileHeader } from '@/components/MobileHeader'
import { apiFetch } from '@/lib/api'

// ---- useTheme ----
function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('goon-theme') as 'dark' | 'light' | null
    if (saved === 'light' || saved === 'dark') setTheme(saved)
  }, [])

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('goon-theme', next)
      document.documentElement.classList.remove('dark', 'light')
      document.documentElement.classList.add(next)
      return next
    })
  }

  return { theme, toggleTheme }
}

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
  const { theme, toggleTheme } = useTheme()
  const { state, isMobile, mobileOpen, toggle, closeMobile, sidebarWidth } = useSidebar()
  useKeepAlive()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--goon-deep-dark)',
      }}>
        <div style={{
          width: 36,
          height: 36,
          border: '3px solid var(--goon-border)',
          borderTopColor: 'var(--goon-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--goon-deep-dark)' }}>
      <Sidebar
        navItems={NAV_ITEMS}
        collapsed={state === 'collapsed'}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        theme={theme}
        onToggle={toggle}
        onCloseMobile={closeMobile}
        onThemeToggle={toggleTheme}
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
          background: 'var(--goon-header-bg)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--goon-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 24px',
          zIndex: 30,
          transition: 'left 0.2s ease',
        }}>
          {user && (
            <span style={{ color: 'var(--goon-text-secondary)', fontSize: 13 }}>
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
