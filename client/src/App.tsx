import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { DashboardView } from './components/DashboardView';
import { UnitsView } from './components/UnitsView';
import { MaintenanceView } from './components/MaintenanceView';
import { RentView } from './components/RentView';
import { AlertsView } from './components/AlertsView';

const MainApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Enforce contractor role restriction in UI as well
  useEffect(() => {
    if (user && user.role === 'contractor') {
      // Contractors only have access to maintenance
      if (currentTab !== 'maintenance') {
        setCurrentTab('maintenance');
      }
    }
  }, [user, currentTab]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '1rem',
          background: 'var(--bg-app)',
        }}
      >
        Initializing Apex Property Management...
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="app-container">
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <main className="main-content">
        {currentTab === 'dashboard' && user.role === 'property_manager' && (
          <DashboardView onNavigate={setCurrentTab} />
        )}

        {currentTab === 'units' && user.role === 'property_manager' && (
          <UnitsView />
        )}

        {currentTab === 'maintenance' && (
          <MaintenanceView />
        )}

        {currentTab === 'rent' && user.role === 'property_manager' && (
          <RentView />
        )}

        {currentTab === 'alerts' && user.role === 'property_manager' && (
          <AlertsView onNavigateToRent={() => setCurrentTab('rent')} />
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
