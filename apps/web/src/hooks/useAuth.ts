'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'

export interface AuthUser {
  id: string
  name: string
  email: string
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      // Keep loading=true so no content flashes before redirect
      window.location.replace('/login')
      return
    }

    apiFetch<AuthUser>('/api/auth/me')
      .then(data => {
        setUser(data)
        setLoading(false)
      })
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        // Keep loading=true so no content flashes before redirect
        window.location.replace('/login')
      })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    window.location.replace('/login')
  }, [])

  return { user, loading, logout }
}
