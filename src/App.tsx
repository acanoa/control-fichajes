import React, { Suspense, lazy } from 'react';
import { useApp } from './context/useApp';
import { PortalPage } from './pages/Portal/PortalPage';
import { EmployeePage } from './pages/Employee/EmployeePage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VersionBadge } from './components/VersionBadge';

const AdminPage = lazy(async () => {
  const module = await import('./pages/Admin/AdminPage');
  return { default: module.AdminPage };
});

function App() {
  const { currentUser, authLoading } = useApp();

  return (
    <>
      {authLoading ? (
        <div className="min-h-screen grid place-items-center bg-brand-cream/10">Verificando sesión…</div>
      ) : (
        <div className="flex-1 flex flex-col min-h-screen bg-brand-cream/10">
          {currentUser.role === 'none' && <PortalPage />}
          {currentUser.role === 'employee' && <EmployeePage />}
          {(currentUser.role === 'company_admin' || currentUser.role === 'superadmin') && (
            <ErrorBoundary>
              <Suspense fallback={<div className="min-h-screen grid place-items-center">Cargando panel…</div>}>
                <AdminPage />
              </Suspense>
            </ErrorBoundary>
          )}
        </div>
      )}
      <VersionBadge />
    </>
  );
}

export default App;
