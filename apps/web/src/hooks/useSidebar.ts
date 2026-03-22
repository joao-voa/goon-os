'use client'

import { useState, useEffect, useCallback } from 'react'
import { useIsMobile } from './useMediaQuery'

type SidebarState = 'expanded' | 'collapsed'
const STORAGE_KEY = 'goon-sidebar-state'

export function useSidebar() {
  const isMobile = useIsMobile()
  const [state, setState] = useState<SidebarState>('expanded')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as SidebarState | null
    if (saved === 'collapsed' || saved === 'expanded') setState(saved)
  }, [])

  useEffect(() => {
    if (!isMobile) setMobileOpen(false)
  }, [isMobile])

  const toggle = useCallback(() => {
    if (isMobile) {
      setMobileOpen(prev => !prev)
    } else {
      setState(prev => {
        const next = prev === 'expanded' ? 'collapsed' : 'expanded'
        localStorage.setItem(STORAGE_KEY, next)
        return next
      })
    }
  }, [isMobile])

  const closeMobile = useCallback(() => setMobileOpen(false), [])
  const sidebarWidth = isMobile ? 0 : state === 'expanded' ? 240 : 56

  return { state, isMobile, mobileOpen, toggle, closeMobile, sidebarWidth }
}
