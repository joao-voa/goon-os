'use client'

import { Menu } from 'lucide-react'

interface MobileHeaderProps {
  onMenuClick: () => void
  userName?: string
}

export function MobileHeader({ onMenuClick, userName }: MobileHeaderProps) {
  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: 56,
      background: 'var(--goon-header-bg)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--goon-border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', zIndex: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onMenuClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <Menu size={22} color="var(--goon-text-primary)" />
        </button>
        <span style={{ color: 'var(--goon-primary)', fontWeight: 900, fontSize: 16, fontFamily: 'Arial Black' }}>GOON</span>
        <span style={{ color: 'var(--goon-text-muted)', fontSize: 11, fontWeight: 600 }}>OS</span>
      </div>
      {userName && (
        <span style={{ color: 'var(--goon-text-secondary)', fontSize: 12 }}>{userName}</span>
      )}
    </header>
  )
}
