import React, { useEffect, useState } from 'react';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  HardHat,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { api } from '../api/client';
import type { DashboardMetrics } from '../types';
import { useToast } from '../context/ToastContext';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { showToast } = useToast();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await api.dashboard.getDashboard();
      setMetrics(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load dashboard metrics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading executive dashboard metrics...
      </div>
    );
  }

  // Calculate maximum for 8-week chart scaling
  const maxWeeklyResolved = Math.max(5, ...metrics.resolved_per_week.map(w => w.count));

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Portfolio &amp; Operations Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Live status of rental revenue, overdue alerts, and maintenance lifecycle activity ({metrics.current_month})
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadDashboard}>
          Refresh Metrics
        </button>
      </div>

      {/* 4 Headline Stat Cards */}
      <div className="stats-grid">
        {/* Metric 1: Open Maintenance Requests */}
        <div
          className="stat-card"
          style={{ '--accent-bar': 'var(--primary)', cursor: 'pointer' } as any}
          onClick={() => onNavigate('maintenance')}
        >
          <div>
            <div className="stat-title">Open Maintenance Requests</div>
            <div className="stat-value">{metrics.open_maintenance_requests}</div>
            <div className="stat-subtext">
              <Clock size={14} style={{ color: 'var(--primary)' }} />
              Active in Reported, Triaged or Scheduled
            </div>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Wrench size={24} />
          </div>
        </div>

        {/* Metric 2: Units with Rent Overdue This Month */}
        <div
          className="stat-card"
          style={{ '--accent-bar': metrics.units_with_rent_overdue > 0 ? 'var(--danger)' : 'var(--success)', cursor: 'pointer' } as any}
          onClick={() => onNavigate('alerts')}
        >
          <div>
            <div className="stat-title">Units Overdue This Month</div>
            <div className="stat-value" style={{ color: metrics.units_with_rent_overdue > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
              {metrics.units_with_rent_overdue}
            </div>
            <div className="stat-subtext">
              <AlertTriangle size={14} style={{ color: metrics.units_with_rent_overdue > 0 ? 'var(--danger)' : 'var(--success)' }} />
              Past grace period with unpaid rent
            </div>
          </div>
          <div
            className="stat-icon-wrapper"
            style={{
              background: metrics.units_with_rent_overdue > 0 ? 'var(--danger-light)' : 'var(--success-light)',
              color: metrics.units_with_rent_overdue > 0 ? 'var(--danger)' : 'var(--success)',
            }}
          >
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* Metric 3: Requests Resolved This Week */}
        <div className="stat-card" style={{ '--accent-bar': 'var(--success)' } as any}>
          <div>
            <div className="stat-title">Resolved This Week</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {metrics.requests_resolved_this_week}
            </div>
            <div className="stat-subtext">
              <TrendingUp size={14} style={{ color: 'var(--success)' }} />
              Completed in past 7 rolling days
            </div>
          </div>
          <div className="stat-icon-wrapper" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Metric 4: Total Rent Collected This Month */}
        <div
          className="stat-card"
          style={{ '--accent-bar': '#0ea5e9', cursor: 'pointer' } as any}
          onClick={() => onNavigate('rent')}
        >
          <div>
            <div className="stat-title">Rent Collected ({metrics.current_month})</div>
            <div className="stat-value">
              ${metrics.total_rent_collected_this_month.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="stat-subtext">
              <DollarSign size={14} style={{ color: '#0ea5e9' }} />
              Recorded in ledger this month
            </div>
          </div>
          <div className="stat-icon-wrapper" style={{ background: '#f0f9ff', color: '#0ea5e9' }}>
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* 8-Week Trend Chart Card */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="card-header">
          <div>
            <h2 className="card-title">Maintenance Requests Resolved per Week</h2>
            <div className="card-description">
              Rolling 8-week historical completion rate across the portfolio
            </div>
          </div>
          <span className="badge badge-resolved">8-Week Performance Trend</span>
        </div>
        <div className="card-body">
          {/* Custom Responsive SVG Chart */}
          <div style={{ width: '100%', height: '220px', position: 'relative' }}>
            <svg viewBox="0 0 800 200" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Grid lines */}
              <line x1="0" y1="30" x2="800" y2="30" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="80" x2="800" y2="80" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="130" x2="800" y2="130" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="170" x2="800" y2="170" stroke="#cbd5e1" strokeWidth="1.5" />

              {/* Weekly Bars & Points */}
              {metrics.resolved_per_week.map((item, idx) => {
                const barWidth = 44;
                const x = 45 + idx * 95;
                const height = (item.count / maxWeeklyResolved) * 130;
                const y = 170 - height;

                return (
                  <g key={idx} className="chart-bar-group">
                    {/* Bar Background Glow */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={height}
                      rx="6"
                      fill="url(#barGradient)"
                      style={{ transition: 'all 0.3s ease' }}
                    />
                    {/* Value Badge */}
                    <text
                      x={x + barWidth / 2}
                      y={y - 8}
                      textAnchor="middle"
                      fill="#0f172a"
                      fontSize="12"
                      fontWeight="700"
                    >
                      {item.count}
                    </text>
                    {/* Week Label */}
                    <text
                      x={x + barWidth / 2}
                      y={190}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="11"
                      fontWeight="500"
                    >
                      {item.week_label.length > 10 ? item.week_label.split(' - ')[0] : item.week_label}
                    </text>
                  </g>
                );
              })}

              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#34d399" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>

      {/* Two Column Section: Status Breakdown & Contractor Workload */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Breakdown by Status */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Maintenance by Lifecycle Status</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('maintenance')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Reported */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.86rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--status-reported)' }}>● Reported (Intake)</span>
                  <span style={{ fontWeight: 700 }}>{metrics.requests_by_status.Reported} requests</span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: 'var(--status-reported)',
                      width: `${Math.min(100, (metrics.requests_by_status.Reported / Math.max(1, metrics.open_maintenance_requests + metrics.requests_by_status.Resolved)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Triaged */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.86rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--status-triaged)' }}>● Triaged (Evaluated)</span>
                  <span style={{ fontWeight: 700 }}>{metrics.requests_by_status.Triaged} requests</span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: 'var(--status-triaged)',
                      width: `${Math.min(100, (metrics.requests_by_status.Triaged / Math.max(1, metrics.open_maintenance_requests + metrics.requests_by_status.Resolved)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Scheduled */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.86rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--status-scheduled)' }}>● Scheduled (Assigned)</span>
                  <span style={{ fontWeight: 700 }}>{metrics.requests_by_status.Scheduled} requests</span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: 'var(--status-scheduled)',
                      width: `${Math.min(100, (metrics.requests_by_status.Scheduled / Math.max(1, metrics.open_maintenance_requests + metrics.requests_by_status.Resolved)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Resolved */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.86rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--status-resolved)' }}>● Resolved (Closed)</span>
                  <span style={{ fontWeight: 700 }}>{metrics.requests_by_status.Resolved} requests</span>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: 'var(--status-resolved)',
                      width: `${Math.min(100, (metrics.requests_by_status.Resolved / Math.max(1, metrics.open_maintenance_requests + metrics.requests_by_status.Resolved)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown by Contractor */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Active Workload by Contractor</h2>
            <span className="badge badge-medium">Contractor Roster</span>
          </div>
          <div className="card-body" style={{ padding: '0.5rem 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {metrics.requests_by_contractor.map(contractor => (
                <div
                  key={contractor.contractor_id}
                  style={{
                    padding: '0.9rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-md)',
                        background: '#e0f2fe',
                        color: '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <HardHat size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{contractor.contractor_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {contractor.specialty || 'General Maintenance'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                      {contractor.assigned_count}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Active Assigned
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
