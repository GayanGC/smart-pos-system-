/**
 * @file AuthContext.jsx
 * Provides authentication state + actions (login, logout) throughout the app.
 * Also initialises the offline-sync module once a valid token is available.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { initOfflineSync, updateAuthToken } from '../utils/offlineSync'

const AuthContext = createContext(null)

/** Hook — use inside any child of <AuthProvider> */
export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [token,   setToken]   = useState(() => localStorage.getItem('erp_token'))
  const [loading, setLoading] = useState(true)

  // ── Sanitizer to enforce corporate operator branding ────────────────────────
  const sanitizeUser = useCallback((u) => {
    if (!u) return null
    const lowName = (u.name || '').toLowerCase()
    if (
      lowName.includes('gayan') ||
      lowName.includes('chanuka') ||
      lowName.includes('chiran')
    ) {
      return { ...u, name: 'kinship27' }
    }
    return u
  }, [])

  // ── Verify existing token on mount ────────────────────────────────────────
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) { setLoading(false); return }
      try {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`
        const { data } = await api.get('/auth/me')
        setUser(sanitizeUser(data.data.user))
        initOfflineSync(token)          // boot offline sync after auth confirmed
      } catch {
        // Token is invalid or expired — clear it
        localStorage.removeItem('erp_token')
        delete api.defaults.headers.common['Authorization']
        setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    verifyToken()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only on mount

  // ── Login with email + password ───────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    const { token: newToken, user: newUser } = data.data
    localStorage.setItem('erp_token', newToken)
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    setToken(newToken)
    const sanitized = sanitizeUser(newUser)
    setUser(sanitized)
    initOfflineSync(newToken)
    return sanitized
  }, [sanitizeUser])

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout') } catch { /* ignore */ }
    localStorage.removeItem('erp_token')
    delete api.defaults.headers.common['Authorization']
    setToken(null)
    setUser(null)
  }, [])

  // ── Update token (e.g. after refresh) ────────────────────────────────────
  const refreshToken = useCallback((newToken) => {
    localStorage.setItem('erp_token', newToken)
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    setToken(newToken)
    updateAuthToken(newToken)
  }, [])

  // ── Convenience role helpers ──────────────────────────────────────────────
  const isAdmin    = !!user && ['super_admin', 'admin', 'manager'].includes(user.role)
  const isCashier  = user?.role === 'cashier'
  const isSuperAdmin = user?.role === 'super_admin'

  const hasRole = useCallback(
    (...roles) => !!user && roles.includes(user.role),
    [user]
  )

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, logout, refreshToken,
      isAdmin, isCashier, isSuperAdmin, hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
