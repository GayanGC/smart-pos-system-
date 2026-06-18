/**
 * @file App.jsx
 * Root router. Wraps everything in AuthProvider.
 * Protected routes redirect to /login if the user is unauthenticated
 * or doesn't have the required role.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/common/ProtectedRoute'
import AppLayout     from './components/layout/AppLayout'
import LoginPage     from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PosPage       from './pages/PosPage'
import EmployeesPage from './pages/EmployeesPage'
import InventoryPage from './pages/InventoryPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public ──────────────────────────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Protected (requires auth + optional role check) ──────────── */}
          <Route element={<AppLayout />}>
            {/* Admin / Manager dashboard */}
            <Route
              element={
                <ProtectedRoute roles={['super_admin', 'admin', 'manager']} />
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
            </Route>

            {/* POS — all authenticated roles */}
            <Route
              element={
                <ProtectedRoute
                  roles={['super_admin', 'admin', 'manager', 'cashier']}
                />
              }
            >
              <Route path="/pos" element={<PosPage />} />
            </Route>
          </Route>

          {/* ── Fallback redirects ───────────────────────────────────────── */}
          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/login"    replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
