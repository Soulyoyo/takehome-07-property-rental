import React, { useEffect, useState } from 'react';
import {
  Building2,
  LayoutDashboard,
  Home,
  Wrench,
  DollarSign,
  AlertTriangle,
  LogOut,
  HardHat,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab }) => {
  const { user, logout, switchDemoRole } = useAuth();
  const [alertCount, setAlertCount] = useState<number>(0);

  const fetchAlertCount = async () => {
    if (user?.role === 'property_manager') {
      try {
        const res = await api.alerts.getCount();
        setAlertCount(res.count);
      } catch (err) {
        // quiet
      }
    }
  };

  useEffect(() => {
    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 15000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;

  const isManager = user.role === 'property_manager';

  return (
    <header className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="brand-wrapper" onClick={() => setCurrentTab('dashboard')}>
          <div className="brand-icon">
            <Building2 size={22} />
          </div>
          <div>
            <div className="brand-title">Apex Property Management</div>
            <div className="brand-subtitle">Rental &amp; Maintenance Operations</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav>
          <ul className="nav-links">
            {isManager && (
              <li>
                <button
                  id="nav-dashboard-tab"
                  className={`nav-item ${currentTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('dashboard')}
                >
                  <LayoutDashboard size={16} />
                  Dashboard
                </button>
              </li>
            )}

            {isManager && (
              <li>
                <button
                  id="nav-units-tab"
                  className={`nav-item ${currentTab === 'units' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('units')}
                >
                  <Home size={16} />
                  Units
                </button>
              </li>
            )}

            <li>
              <button
                id="nav-maintenance-tab"
                className={`nav-item ${currentTab === 'maintenance' ? 'active' : ''}`}
                onClick={() => setCurrentTab('maintenance')}
              >
                <Wrench size={16} />
                Maintenance
              </button>
            </li>

            {isManager && (
              <li>
                <button
                  id="nav-rent-tab"
                  className={`nav-item ${currentTab === 'rent' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('rent')}
                >
                  <DollarSign size={16} />
                  Rent Ledger
                </button>
              </li>
            )}

            {isManager && (
              <li>
                <button
                  id="nav-alerts-tab"
                  className={`nav-item ${currentTab === 'alerts' ? 'active' : ''}`}
                  onClick={() => setCurrentTab('alerts')}
                >
                  <AlertTriangle size={16} />
                  Rent Alerts
                  {alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
                </button>
              </li>
            )}
          </ul>
        </nav>

        {/* User Info & Role Switcher */}
        <div className="user-profile-bar">
          {/* Quick Demo Switcher */}
          <div className="demo-switcher" title="Quickly switch accounts to test role enforcement">
            <button
              className={`demo-btn ${user.email === 'manager@apexpm.com' ? 'active' : ''}`}
              onClick={() => switchDemoRole('manager')}
            >
              Manager
            </button>
            <button
              className={`demo-btn ${user.email === 'dave@plumbingpros.com' ? 'active' : ''}`}
              onClick={() => {
                switchDemoRole('dave');
                setCurrentTab('maintenance');
              }}
            >
              Plumber
            </button>
            <button
              className={`demo-btn ${user.email === 'sarah@sparkyelec.com' ? 'active' : ''}`}
              onClick={() => {
                switchDemoRole('sarah');
                setCurrentTab('maintenance');
              }}
            >
              Electrician
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>{user.name}</span>
            <span className={`user-role-tag ${isManager ? 'role-pm' : 'role-contractor'}`}>
              {isManager ? <ShieldCheck size={12} /> : <HardHat size={12} />}
              {isManager ? 'Property Manager' : `Contractor (${user.specialty || 'General'})`}
            </span>
          </div>

          <button
            id="nav-logout-btn"
            className="btn btn-secondary btn-sm"
            onClick={logout}
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  );
};
