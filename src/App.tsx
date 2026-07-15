import React from 'react';
import { useApp } from './context/AppContext';
import { PortalPage } from './pages/Portal/PortalPage';
import { EmployeePage } from './pages/Employee/EmployeePage';
import { AdminPage } from './pages/Admin/AdminPage';

function App() {
  const { currentUser } = useApp();

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-brand-cream/10">
      {currentUser.role === 'none' && <PortalPage />}
      {currentUser.role === 'employee' && <EmployeePage />}
      {(currentUser.role === 'company_admin' || currentUser.role === 'superadmin') && <AdminPage />}
    </div>
  );
}

export default App;
