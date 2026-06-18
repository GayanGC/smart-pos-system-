/**
 * @file ProtectedRoute.jsx
 * Renders child routes only when:
 *  1. The user is authenticated (token verified → user object set)
 *  2. The user's role is in the allowed `roles` array (if provided)
 *
 * Shows a loading screen while token verification is in progress.
 * Redirects to /login on auth failure, or back to the previous page on role mismatch.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from './LoadingSpinner'

/**
 * @param {object}   props
 * @param {string[]} [props.roles]  Allowed role strings. If omitted, any authenticated user passes.
 */
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // ── While the auth module is verifying the stored token ────────────────
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // ── Not authenticated at all ───────────────────────────────────────────
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // ── Authenticated but wrong role ───────────────────────────────────────
  if (roles && !roles.includes(user.role)) {
    // Redirect cashiers to POS; everyone else to dashboard
    const fallback = user.role === 'cashier' ? '/pos' : '/dashboard'
    return <Navigate to={fallback} replace />
  }

  // ── All checks passed — render the nested route ────────────────────────
  return <Outlet />
}
