'use client'

import { type LucideIcon, LayoutDashboard, Building2, Package, FileText, GitBranch, DollarSign, AlertTriangle, LogOut, ChevronLeft, ChevronRight, Users, Percent, Receipt, ArrowLeftRight, Settings, Calendar, CheckSquare, ScrollText, GraduationCap } from 'lucide-react'
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
  userRole?: string
  userAllowedModules?: string | null
  isOwner?: boolean
}

// Item exclusivo do dono (João) — fora da lista normal de nav.
const AUDIT_ITEM: NavItem = { href: '/audit', label: 'Auditoria', icon: ScrollText }

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/crm',         label: 'CRM',         icon: Users },
  { href: '/clients',     label: 'Clientes',    icon: Building2 },
  { href: '/agenda',      label: 'Agenda',      icon: Calendar },
  { href: '/products',    label: 'Programas',   icon: Package },
  { href: '/onboarding',  label: 'Onboarding',  icon: GitBranch },
  { href: '/mentorship',  label: 'Mentorados',  icon: GraduationCap },
  { href: '/payments',    label: 'Financeiro',  icon: DollarSign },
  { href: '/tasks',       label: 'Tarefas',      icon: CheckSquare },
  { href: '/pendencies',  label: 'Pendencias',  icon: AlertTriangle },
  { href: '/contracts',   label: 'Contratos',   icon: FileText },
  { href: '/admin',       label: 'Admin',       icon: Settings },
]

export function Sidebar({
  navItems,
  collapsed,
  isMobile,
  mobileOpen,
  onToggle,
  onCloseMobile,
  onLogout,
  userRole,
  userAllowedModules,
  isOwner,
}: SidebarProps) {
  const pathname = usePathname()

  const visibleItems = (() => {
    const base = (() => {
      if (userAllowedModules) {
        try {
          const mods: string[] = JSON.parse(userAllowedModules)
          if (mods.length > 0) return navItems.filter(item => mods.includes(item.href))
        } catch { /* fall through */ }
      }
      if (userRole === 'admin') return navItems
      if (userRole === 'comercial') {
        const comercialPaths = ['/crm', '/agenda', '/products']
        return navItems.filter(item => comercialPaths.includes(item.href))
      }
      return navItems
    })()
    // Auditoria: só o dono vê (independente de role/módulos).
    return isOwner ? [...base, AUDIT_ITEM] : base
  })()
  const [openPendenciesCount, setOpenPendenciesCount] = useState(0)

  useEffect(() => {
    apiFetch<{ total: number }>('/api/pendencies?status=OPEN&limit=1')
      .then(r => setOpenPendenciesCount(r.total ?? 0))
      .catch(() => {})
  }, [])

  const sidebarWidth = isMobile ? 260 : collapsed ? 64 : 260
  const isVisible = isMobile ? mobileOpen : true

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 50,
          }}
        />
      )}

      <nav style={{
        position: 'fixed', top: 0, left: 0, height: '100vh', width: sidebarWidth,
        background: '#0A0A0C', borderRight: '1px solid #2A2A30',
        display: 'flex', flexDirection: 'column', zIndex: 51,
        transition: 'transform 0.25s ease, width 0.25s ease',
        transform: isVisible ? 'translateX(0)' : 'translateX(-100%)',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          minHeight: 64, display: 'flex', alignItems: 'center',
          justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
          padding: collapsed && !isMobile ? '12px 0' : '12px 16px 12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}>
          {(!collapsed || isMobile) && (
            <a href="/home" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, textDecoration: 'none' }}>
              <span style={{ color: 'var(--goon-signal)', fontSize: 26, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.18em', lineHeight: 1 }}>GOON</span>
              <span style={{ color: 'var(--goon-ash)', fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.28em', marginTop: 3 }}>OPERACIONAL SYSTEM</span>
            </a>
          )}
          {collapsed && !isMobile && (
            <a href="/home" style={{ textDecoration: 'none' }}>
              <span style={{ color: 'var(--goon-signal)', fontSize: 18, fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '0.08em' }}>G</span>
            </a>
          )}
          {!isMobile && (
            <button onClick={onToggle} title={collapsed ? 'Expandir' : 'Recolher'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', borderRadius: 6, transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'white'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
          {visibleItems.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <a key={item.href} href={item.href}
                title={collapsed && !isMobile ? item.label : undefined}
                style={{
                  position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
                  padding: collapsed && !isMobile ? '10px 0' : '10px 16px',
                  justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                  textDecoration: 'none',
                  color: isActive ? '#0A0A0C' : 'rgba(255,255,255,0.55)',
                  background: isActive ? 'var(--goon-chrome)' : 'transparent',
                  borderRadius: 6, margin: '1px 8px',
                  fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em',
                  whiteSpace: 'nowrap', transition: 'all 0.15s',
                  borderLeft: isActive ? '3px solid transparent' : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.85)' } }}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)' } }}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {(!collapsed || isMobile) && <span>{item.label}</span>}
                {item.href === '/pendencies' && openPendenciesCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 4,
                    right: collapsed && !isMobile ? 4 : 10,
                    background: '#ef4444', color: 'white',
                    fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 700,
                    minWidth: 18, height: 18, borderRadius: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', lineHeight: 1,
                  }}>
                    {openPendenciesCount > 99 ? '99+' : openPendenciesCount}
                  </span>
                )}
              </a>
            )
          })}
        </div>

        {/* Logout */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, padding: '8px' }}>
          <button onClick={onLogout} title="Sair"
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              padding: collapsed && !isMobile ? '10px 0' : '10px 16px',
              justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-sans)',
              fontSize: 13, fontWeight: 500, borderRadius: 8, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)' }}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {(!collapsed || isMobile) && <span>Sair</span>}
          </button>
        </div>
      </nav>
    </>
  )
}
