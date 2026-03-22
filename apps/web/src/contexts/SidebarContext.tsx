'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useSidebar } from '@/hooks/useSidebar'

type SidebarContextType = ReturnType<typeof useSidebar>
const SidebarContext = createContext<SidebarContextType | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const sidebar = useSidebar()
  return <SidebarContext.Provider value={sidebar}>{children}</SidebarContext.Provider>
}

export function useSidebarContext() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebarContext must be used within SidebarProvider')
  return ctx
}
