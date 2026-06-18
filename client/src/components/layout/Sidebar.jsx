/**
 * @file Sidebar.jsx
 * Responsive navigation sidebar.
 * - Admin/Manager: Full nav (Dashboard, POS, Inventory, Employees, Analytics)
 * - Cashier: POS only
 * Collapses to icon-only on small screens with a toggle button.
 */

import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

/* ── Inline SVG Icons ─────────────────────────────────────────────────── */
const icons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  pos: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  inventory: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  employees: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  analytics: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
    </svg>
  ),
  logout: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  chevron: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  ),
}

/* ── Nav items per role ───────────────────────────────────────────────── */
const adminNavItems = [
  { label: 'Dashboard', to: '/dashboard', icon: icons.dashboard },
  { label: 'POS Terminal', to: '/pos',       icon: icons.pos },
  { label: 'Inventory',   to: '/inventory',  icon: icons.inventory,  comingSoon: true },
  { label: 'Employees',   to: '/employees',  icon: icons.employees,  comingSoon: true },
  { label: 'Analytics',   to: '/analytics',  icon: icons.analytics,  comingSoon: true },
]

const cashierNavItems = [
  { label: 'POS Terminal', to: '/pos', icon: icons.pos },
]

/* ── Component ────────────────────────────────────────────────────────── */
export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const navItems = isAdmin ? adminNavItems : cashierNavItems

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside
      className={`
        flex flex-col h-screen bg-slate-950 border-r border-slate-800/80
        transition-all duration-300 ease-in-out flex-shrink-0
        ${collapsed ? 'w-[72px]' : 'w-60'}
      `}
    >
      {/* ── Brand / Logo ─────────────────────────────────────────────── */}
      <div className={`flex items-center h-16 px-4 border-b border-slate-800/80 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        {/* Logo mark */}
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-900/40">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        {!collapsed && (
          <div className="leading-tight overflow-hidden">
            <p className="font-bold text-slate-100 text-sm truncate">Smart ERP</p>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest">Cloud POS</p>
          </div>
        )}
      </div>

      {/* ── Navigation ──────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map((item) => (
          item.comingSoon ? (
            /* Coming-soon — disabled link */
            <div
              key={item.label}
              title={collapsed ? item.label : undefined}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl
                text-slate-600 cursor-not-allowed select-none
                ${collapsed ? 'justify-center' : ''}
              `}
            >
              <span className="flex-shrink-0 opacity-40">{item.icon}</span>
              {!collapsed && (
                <>
                  <span className="text-sm font-medium flex-1 opacity-40">{item.label}</span>
                  <span className="text-[9px] bg-slate-800 text-slate-600 px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wide">
                    Soon
                  </span>
                </>
              )}
            </div>
          ) : (
            /* Active nav link */
            <NavLink
              key={item.label}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150 group relative
                ${collapsed ? 'justify-center' : ''}
                ${isActive
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-400 rounded-r-full" />
                  )}
                  <span className={`flex-shrink-0 ${isActive ? 'text-violet-400' : ''}`}>
                    {item.icon}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          )
        ))}
      </nav>

      {/* ── User info + logout ───────────────────────────────────────── */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        {/* Avatar + name */}
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 capitalize truncate">{user.role?.replace('_', ' ')}</p>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium
            text-slate-500 hover:text-rose-400 hover:bg-rose-500/10
            transition-all duration-150
            ${collapsed ? 'justify-center' : ''}
          `}
        >
          <span className="flex-shrink-0">{icons.logout}</span>
          {!collapsed && <span>Logout</span>}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm
            text-slate-600 hover:text-slate-300 hover:bg-slate-800/40
            transition-all duration-150
            ${collapsed ? 'justify-center' : 'justify-between'}
          `}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {!collapsed && <span className="text-xs">Collapse</span>}
          <span className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}>
            {icons.chevron}
          </span>
        </button>
      </div>
    </aside>
  )
}
