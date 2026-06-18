/**
 * @file AppLayout.jsx
 * Main shell layout: Sidebar (left) + scrollable content area (right).
 * Also renders the global network-status banner when offline.
 */

import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

function NetworkBanner({ isOnline }) {
  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2
        py-1.5 text-xs font-semibold transition-all duration-500
        ${isOnline
          ? 'bg-emerald-500/90 text-emerald-950 translate-y-0'
          : 'bg-amber-500/90 text-amber-950 translate-y-0'}
      `}
    >
      <span
        className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-700' : 'bg-amber-700'} animate-pulse`}
      />
      {isOnline
        ? '✓ Back online — syncing offline invoices…'
        : '⚠ You are offline — sales will be saved locally and synced when connection returns.'}
    </div>
  )
}

export default function AppLayout() {
  const [collapsed,   setCollapsed]   = useState(false)
  const [isOnline,    setIsOnline]    = useState(navigator.onLine)
  const [showBanner,  setShowBanner]  = useState(!navigator.onLine)
  const [prevOnline,  setPrevOnline]  = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline  = () => { setIsOnline(true);  setShowBanner(true) }
    const handleOffline = () => { setIsOnline(false); setShowBanner(true) }

    window.addEventListener('online',  handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online',  handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Auto-hide the "back online" banner after 4 seconds
  useEffect(() => {
    if (isOnline && showBanner) {
      const timer = setTimeout(() => setShowBanner(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, showBanner])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Network banner */}
      {showBanner && <NetworkBanner isOnline={isOnline} />}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />

      {/* ── Main content area ────────────────────────────────────────── */}
      <main
        className={`
          flex-1 overflow-y-auto min-w-0
          transition-all duration-300
          ${showBanner ? 'pt-8' : 'pt-0'}
        `}
      >
        <Outlet />
      </main>
    </div>
  )
}
