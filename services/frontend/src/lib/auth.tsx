import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import i18n from 'i18next'
import { api } from './api'
import { useTheme } from './theme'

type Role = 'USER' | 'QUIZMASTER' | 'QUIZADMIN'

export interface User {
  id: string
  pseudo: string
  email: string
  role: Role
  language: string
  theme: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (pseudo: string, email: string, password: string, confirmPassword: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<User>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { setTheme } = useTheme()

  const applyPreferences = useCallback((u: User) => {
    if (u.language) {
      localStorage.setItem('i18nextLng', u.language)
      i18n.changeLanguage(u.language)
    }
    if (u.theme === 'dark' || u.theme === 'light') {
      setTheme(u.theme)
    }
  }, [setTheme])

  useEffect(() => {
    api('/auth/me')
      .then(d => {
        setUser(d.user)
        applyPreferences(d.user as User)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [applyPreferences])

  const login = useCallback(async (email: string, password: string) => {
    const d = await api('/auth/login', { method: 'POST', body: JSON.stringify({ login: email, password }) })
    setUser(d.user)
    applyPreferences(d.user as User)
    return d.user as User
  }, [applyPreferences])

  const register = useCallback(async (pseudo: string, email: string, password: string, confirmPassword: string) => {
    await api('/auth/register', { method: 'POST', body: JSON.stringify({ pseudo, email, password, confirmPassword }) })
  }, [])

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' })
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const d = await api('/auth/me')
    setUser(d.user as User)
    applyPreferences(d.user as User)
    return d.user as User
  }, [applyPreferences])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
