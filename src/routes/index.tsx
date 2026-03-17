import { Routes, Route, Navigate } from 'react-router'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleGuard } from './RoleGuard'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { AppShell } from '@/features/shell/AppShell'
import { AdminLayout } from '@/features/admin/components/AdminLayout'
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage'
import { TenantsPage } from '@/features/admin/pages/TenantsPage'
import { TenantDetailPage } from '@/features/admin/pages/TenantDetailPage'
import { UsersPage as AdminUsersPage } from '@/features/admin/pages/UsersPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { PatientsPage } from '@/features/patients/pages/PatientsPage'
import { PatientDetailPage } from '@/features/patients/pages/PatientDetailPage'
import { UsersPage } from '@/features/users/pages/UsersPage'
import { StaffPage } from '@/features/staff/pages/StaffPage'
import { AppointmentsPage } from '@/features/appointments/pages/AppointmentsPage'
import { useAuthStore } from '@/features/auth/store/authStore'

function RootRedirect() {
  const isSuperAdmin = useAuthStore((s) => s.user?.roles?.includes('SuperAdmin') ?? false)
  return <Navigate to={isSuperAdmin ? '/admin' : '/dashboard'} replace />
}


export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        {/* Admin area — SuperAdmin only */}
        <Route element={<RoleGuard allowedRoles={['SuperAdmin']} />}>
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="tenants/:id" element={<TenantDetailPage />} />
            <Route path="users" element={<AdminUsersPage />} />
          </Route>
        </Route>

        {/* Regular app shell */}
        <Route element={<AppShell />}>
          {/* Root index: redirect SuperAdmin → /admin, everyone else → /dashboard */}
          <Route index element={<RootRedirect />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="patients/:id" element={<PatientDetailPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="settings/users" element={<UsersPage />} />
        </Route>
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

