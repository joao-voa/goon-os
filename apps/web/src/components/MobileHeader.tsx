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
      background: 'var(--retro-gray)',
      borderBottom: '2px solid black',
      boxShadow: '0 4px 0 black',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', zIndex: 30,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onMenuClick}
          style={{
            background: 'black',
            border: '2px solid black',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '2px 2px 0 black',
          }}
        >
          <Menu size={18} color="white" />
        </button>
        <span style={{
          color: 'black',
          fontWeight: 900,
          fontSize: 14,
          fontFamily: 'var(--font-pixel)',
          letterSpacing: '0.05em',
        }}>GOON</span>
        <span style={{
          color: '#555',
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
        }}>OS</span>
      </div>
      {userName && (
        <span style={{
          color: 'black',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          textTransform: 'uppercase',
        }}>{userName}</span>
      )}
    </header>
  )
}
