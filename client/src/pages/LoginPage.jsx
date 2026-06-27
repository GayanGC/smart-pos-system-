/**
 * @file LoginPage.jsx
 * Split-screen login: gradient brand panel (left) + auth form (right).
 * Supports email/password login. Redirects based on user role on success.
 */

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname || null

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await login(email.trim(), password)
      // Role-based redirect
      const dest = from
        ?? (['super_admin', 'admin', 'manager'].includes(user.role) ? '/dashboard' : '/pos')
      navigate(dest, { replace: true })
    } catch (err) {
      const status = err.response?.status ? `[HTTP ${err.response.status}]` : '[Network Error]';
      const msg = err.response?.data?.message || err.message || 'Unknown error';
      setError(`${status} ${msg} (API Base: ${api.defaults.baseURL})`);
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-950">

      {/* ── Left: Main Form Panel ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16 w-full lg:w-[55%] relative overflow-hidden">
        {/* Background ambient glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/50 border border-slate-800/60 p-8 sm:p-10 rounded-3xl backdrop-blur-xl shadow-2xl space-y-8 animate-fade-up z-10">
          
          {/* Logo & Branding */}
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_35px_rgba(99,102,241,0.4)] border border-violet-400/20">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-black text-white tracking-tight uppercase">Ai MANAGER</h1>
              <p className="text-[10px] text-violet-400 font-bold tracking-[0.2em] uppercase mt-1">
                SMART POS & SHOP MANAGEMENT SYSTEM
              </p>
            </div>
          </div>

          <div className="border-t border-slate-800/60 my-6" />

          {/* Heading */}
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-100">Welcome back</h2>
            <p className="text-slate-400 text-xs">Sign in to your manager account to continue.</p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-3 rounded-xl animate-fade-up flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Email address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="email"
                placeholder="admin@example.com"
                className="input-field h-12 bg-slate-950/80 border-slate-800 focus:border-violet-500/50"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="input-field h-12 pr-10 bg-slate-950/80 border-slate-800 focus:border-violet-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPwd ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              id="login-submit-btn"
              className="btn-primary w-full h-12 text-sm font-semibold tracking-wide uppercase transition-all duration-200 shadow-lg shadow-violet-950/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Hint */}
          <p className="text-center text-[10px] text-slate-500">
            Contact your system administrator if you cannot access your account.
          </p>
        </div>
      </div>

      {/* ── Right: Split-Pane Cinematic Image Panel ──────────────── */}
      <div className="hidden lg:block w-[45%] relative overflow-hidden bg-slate-900">
        <img
          src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1200&q=80"
          alt="Professional Corporate Manager"
          className="absolute inset-0 w-full h-full object-cover grayscale-[15%] contrast-110 brightness-[0.8]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/20 to-transparent" />
        
        {/* Decorative branding elements over the image */}
        <div className="absolute bottom-10 left-10 z-10 text-left">
          <p className="text-xs font-bold text-violet-400 tracking-[0.3em] uppercase">Ai MANAGER v0.1.0</p>
          <h2 className="text-2xl font-black text-white mt-1 leading-tight tracking-tight">Smart Cloud ERP Solutions</h2>
        </div>
      </div>

    </div>
  )
}
