import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  BellOff,
  Info,
  Clock,
} from 'lucide-react';
import { api } from '../api/client';
import type { OverdueAlert } from '../types';
import { useToast } from '../context/ToastContext';

interface AlertsViewProps {
  onNavigateToRent: () => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ onNavigateToRent }) => {
  const { showToast } = useToast();
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [alerts, setAlerts] = useState<OverdueAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  useEffect(() => {
    loadAlerts();
  }, [selectedMonth]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.alerts.list(selectedMonth);
      setAlerts(res.alerts);
    } catch (err: any) {
      showToast(err.message || 'Failed to load overdue alerts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDismissAlert = async (unitId: number) => {
    setDismissingId(unitId);
    try {
      const res = await api.alerts.dismiss(unitId, selectedMonth);
      showToast(res.message, 'success');
      loadAlerts();
    } catch (err: any) {
      showToast(err.message || 'Failed to dismiss alert.', 'error');
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Overdue Rent Alerts
            </h1>
            {alerts.length > 0 && (
              <span className="nav-badge" style={{ fontSize: '0.85rem', padding: '0.2rem 0.6rem' }}>
                {alerts.length} Active
              </span>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Units whose monthly rent has not been fully matched after the designated grace period
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Check Month:</label>
          <input
            id="alerts-month-select"
            type="month"
            className="form-input"
            style={{ width: 'auto' }}
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      {/* Info Banner explaining Goal 10 rules */}
      <div className="alert-banner alert-banner-warning">
        <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.86rem', lineHeight: 1.5 }}>
          <strong>Rent Alert &amp; Dismissal Policy:</strong> Rent is due on the 1st of each month. Units appear here once their grace period (default: 5 days) expires without full payment.
          Dismissing an alert suppresses it for <strong>{selectedMonth}</strong>. If rent remains unpaid in subsequent months past the grace period, <em>the alert will automatically return</em>.
        </div>
      </div>

      {/* Alerts Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Delinquent Units ({alerts.length})</h2>
          <button className="btn btn-secondary btn-sm" onClick={onNavigateToRent}>
            Open Rent Ledger
          </button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Unit #</th>
                <th>Address</th>
                <th>Tenant Name</th>
                <th>Monthly Rent</th>
                <th>Amount Paid</th>
                <th>Outstanding Balance</th>
                <th>Days Overdue</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    Checking rent payments against grace period...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={36} style={{ color: 'var(--success)' }} />
                      <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)' }}>
                        All rents settled or within grace period!
                      </div>
                      <div style={{ fontSize: '0.85rem' }}>
                        No overdue rent alerts found for {selectedMonth}.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                alerts.map(alert => (
                  <tr key={alert.unit_id}>
                    <td>
                      <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Unit {alert.unit_number}</span>
                    </td>
                    <td>{alert.address}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{alert.tenant_name}</div>
                    </td>
                    <td>${alert.monthly_rent.toFixed(2)}</td>
                    <td style={{ fontWeight: 600, color: alert.amount_paid > 0 ? '#b45309' : 'inherit' }}>
                      ${alert.amount_paid.toFixed(2)}
                    </td>
                    <td>
                      <span style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '0.95rem' }}>
                        ${alert.amount_due.toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-urgent">
                        <Clock size={12} /> {alert.days_overdue} days past grace
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDismissAlert(alert.unit_id)}
                        disabled={dismissingId === alert.unit_id}
                        title="Dismiss alert for this month"
                      >
                        <BellOff size={14} /> Dismiss Alert
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
