import React, { useState } from 'react';
import { Building2, Lock, Mail, ShieldCheck, HardHat, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please enter both email and password.', 'warning');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      showToast('Signed in successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Invalid credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setLoading(true);
    try {
      await login(userEmail, userPass);
      showToast('Signed in via demo preset!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Demo login failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      }}
    >
      <div style={{ maxWidth: '460px', width: '100%' }}>
        {/* Logo and Intro */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: 'white',
              borderRadius: '16px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 25px rgba(79, 70, 229, 0.4)',
              marginBottom: '1rem',
            }}
          >
            <Building2 size={32} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>
            Apex Property Management
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.35rem' }}>
            Rental Ledger, Portfolio &amp; Maintenance Operations
          </p>
        </div>

        {/* Main Card */}
        <div className="card" style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <div className="card-body" style={{ padding: '2rem' }}>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={18}
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                  />
                  <input
                    id="login-email"
                    type="email"
                    className="form-input"
                    style={{ paddingLeft: '2.4rem' }}
                    placeholder="name@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={18}
                    style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                  />
                  <input
                    id="login-password"
                    type="password"
                    className="form-input"
                    style={{ paddingLeft: '2.4rem' }}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.75rem' }}
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Quick Demo Presets */}
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.85rem', letterSpacing: '0.05em' }}>
                1-Click Demo Accounts
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button
                  id="login-demo-manager-btn"
                  type="button"
                  onClick={() => handleQuickLogin('manager@apexpm.com', 'manager123')}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '0.6rem 0.85rem', width: '100%' }}
                >
                  <ShieldCheck size={18} style={{ color: '#4f46e5' }} />
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Alex Sterling — Property Manager</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Full portfolio, rent roll, bulk reconciliation, assignments</div>
                  </div>
                </button>

                <button
                  id="login-demo-dave-btn"
                  type="button"
                  onClick={() => handleQuickLogin('dave@plumbingpros.com', 'contractor123')}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '0.6rem 0.85rem', width: '100%' }}
                >
                  <HardHat size={18} style={{ color: '#0ea5e9' }} />
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Dave Miller — Contractor (Plumbing)</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Assigned jobs only, status updates, notes</div>
                  </div>
                </button>

                <button
                  id="login-demo-sarah-btn"
                  type="button"
                  onClick={() => handleQuickLogin('sarah@sparkyelec.com', 'contractor123')}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '0.6rem 0.85rem', width: '100%' }}
                >
                  <HardHat size={18} style={{ color: '#f59e0b' }} />
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Sarah Chen — Contractor (Electrical)</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Assigned jobs only, status updates, notes</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
