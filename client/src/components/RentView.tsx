import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import type { BulkRentReport, RentRollItem } from '../types';
import { useToast } from '../context/ToastContext';

export const RentView: React.FC = () => {
  const { showToast } = useToast();

  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [activeTab, setActiveTab] = useState<'bulk' | 'roll'>('bulk');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  // Bulk State
  const [bulkInputText, setBulkInputText] = useState<string>(
    '101, 1450.00\n102, 1000.00\n103, 1600.00\nOLD-99, 950.00\nNON-EXISTENT-UNIT, 1200.00'
  );
  const [bulkProcessing, setBulkProcessing] = useState<boolean>(false);
  const [bulkReport, setBulkReport] = useState<BulkRentReport | null>(null);

  // Rent Roll State
  const [rentRoll, setRentRoll] = useState<RentRollItem[]>([]);
  const [rollSummary, setRollSummary] = useState<any>(null);
  const [rollLoading, setRollLoading] = useState<boolean>(false);

  useEffect(() => {
    if (activeTab === 'roll') {
      loadRentRoll();
    }
  }, [activeTab, selectedMonth]);

  const loadRentRoll = async () => {
    setRollLoading(true);
    try {
      const res = await api.rent.getRentRoll(selectedMonth);
      setRentRoll(res.items);
      setRollSummary(res.summary);
    } catch (err: any) {
      showToast(err.message || 'Failed to load rent roll.', 'error');
    } finally {
      setRollLoading(false);
    }
  };

  const handleProcessBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInputText.trim()) {
      showToast('Please provide at least one row of rent data.', 'warning');
      return;
    }

    // Parse input lines (accepts "101, 1450.00" or "101 1450.00" or tab-separated)
    const lines = bulkInputText.trim().split('\n');
    const rows = lines
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Split by comma or whitespace
        const parts = line.includes(',') ? line.split(',') : line.split(/\s+/);
        return {
          identifier: parts[0]?.trim() || '',
          amount: parseFloat(parts[1]?.trim() || '0'),
          notes: parts.slice(2).join(' ').trim() || undefined,
        };
      });

    setBulkProcessing(true);
    try {
      const res = await api.rent.processBulk(selectedMonth, rows);
      setBulkReport(res.report);
      showToast(`Processed ${res.report.total_processed} rent payment rows!`, 'success');
      // If on rent roll, refresh
      if (activeTab === 'roll') {
        loadRentRoll();
      }
    } catch (err: any) {
      showToast(err.message || 'Bulk processing failed.', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      await api.rent.downloadRentRollCsv(selectedMonth);
      showToast(`Rent roll CSV for ${selectedMonth} downloaded!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to download CSV.', 'error');
    }
  };

  const handlePreloadSampleBatch = () => {
    setBulkInputText(
      `101, 1450.00, Full ACH Payment\n102, 1100.00, Partial check payment\n103, 1500.00, Overpayment credit\n201, 1850.00, Bank transfer\n302, 2150.00, Full payment\nUNKNOWN-404, 1500.00, Mystery deposit`
    );
    showToast('Loaded sample bank reconciliation batch!', 'success');
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Rent Management &amp; Ledger
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Batch bank reconciliation, automated match classification, and portfolio rent roll export
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Target Month:</label>
          <input
            id="rent-target-month-select"
            type="month"
            className="form-input"
            style={{ width: 'auto' }}
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-nav">
        <button
          id="tab-btn-bulk-rent"
          className={`tab-btn ${activeTab === 'bulk' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <Upload size={16} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: '-2px' }} />
          Bulk Rent Reconciliation
        </button>
        <button
          id="tab-btn-rent-roll"
          className={`tab-btn ${activeTab === 'roll' ? 'active' : ''}`}
          onClick={() => setActiveTab('roll')}
        >
          <FileSpreadsheet size={16} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: '-2px' }} />
          Current Rent Roll &amp; CSV Export
        </button>
      </div>

      {/* TAB 1: BULK RENT RECORDING & CLASSIFICATION REPORT (Goal 7) */}
      {activeTab === 'bulk' && (
        <div>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div className="card-header">
              <div>
                <h2 className="card-title">Bulk-Record Rent Payments</h2>
                <div className="card-description">
                  Paste or input rows with <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-alt)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>UnitIdentifier, Amount</code> to process all at once.
                </div>
              </div>

              <button className="btn btn-secondary btn-sm" onClick={handlePreloadSampleBatch}>
                <Sparkles size={14} /> Load Demo Batch
              </button>
            </div>

            <form onSubmit={handleProcessBulk}>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="bulk-rent-input-area">
                    Batch Rent Input (One payment per line: <em>UnitNumber, Amount</em>)
                  </label>
                  <textarea
                    id="bulk-rent-input-area"
                    className="form-textarea"
                    rows={6}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}
                    value={bulkInputText}
                    onChange={e => setBulkInputText(e.target.value)}
                    placeholder="101, 1450.00&#10;102, 1000.00&#10;103, 1600.00"
                    required
                  />
                  <div className="form-hint">
                    Format: <strong>[Unit Number or Unit ID], [Amount Received]</strong>. The system will atomically classify each row as matched, underpaid, overpaid, or unmatched.
                  </div>
                </div>
              </div>

              <div className="card-footer">
                <button
                  id="btn-process-bulk-rent"
                  type="submit"
                  className="btn btn-primary"
                  disabled={bulkProcessing}
                >
                  <Upload size={16} />
                  {bulkProcessing ? 'Processing Batch...' : `Reconcile & Record for ${selectedMonth}`}
                </button>
              </div>
            </form>
          </div>

          {/* CLASSIFICATION REPORT (Goal 7) */}
          {bulkReport && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h2 className="card-title">Reconciliation Report — {bulkReport.month}</h2>
                  <div className="card-description">
                    Per-unit match status and recorded ledger entries
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--primary)' }}>
                  Total Collected: ${bulkReport.total_collected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="card-body">
                {/* Summary Pills */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'var(--surface-alt)', padding: '0.85rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Processed</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{bulkReport.total_processed}</div>
                  </div>

                  <div style={{ background: 'var(--success-light)', border: '1px solid var(--success-border)', padding: '0.85rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--success)', textTransform: 'uppercase', fontWeight: 700 }}>Matched</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>{bulkReport.matched_count}</div>
                  </div>

                  <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning-border)', padding: '0.85rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: '#b45309', textTransform: 'uppercase', fontWeight: 700 }}>Underpaid</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309' }}>{bulkReport.underpaid_count}</div>
                  </div>

                  <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-border)', padding: '0.85rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--primary)', textTransform: 'uppercase', fontWeight: 700 }}>Overpaid</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{bulkReport.overpaid_count}</div>
                  </div>

                  <div style={{ background: 'var(--danger-light)', border: '1px solid var(--danger-border)', padding: '0.85rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger)', textTransform: 'uppercase', fontWeight: 700 }}>Unmatched</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)' }}>{bulkReport.unmatched_count}</div>
                  </div>
                </div>

                {/* Per-Row Detail Table */}
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        <th>Identifier Provided</th>
                        <th>Unit Matched</th>
                        <th>Tenant</th>
                        <th>Monthly Rent</th>
                        <th>Amount Received</th>
                        <th>Classification</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkReport.results.map(row => (
                        <tr key={row.row}>
                          <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>#{row.row}</td>
                          <td>
                            <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{row.identifier}</code>
                          </td>
                          <td>
                            {row.unit_number ? (
                              <span style={{ fontWeight: 700 }}>Unit {row.unit_number}</span>
                            ) : (
                              <span style={{ color: 'var(--danger)', fontStyle: 'italic' }}>None</span>
                            )}
                          </td>
                          <td>{row.tenant_name || '—'}</td>
                          <td>
                            {row.monthly_rent !== undefined ? (
                              `$${row.monthly_rent.toFixed(2)}`
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            ${row.amount_received.toFixed(2)}
                          </td>
                          <td>
                            <span className={`badge badge-${row.classification}`}>
                              {row.classification.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {row.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CURRENT RENT ROLL & CSV EXPORT (Goal 7) */}
      {activeTab === 'roll' && (
        <div>
          {/* Summary Cards */}
          {rollSummary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Expected Rent</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '0.3rem' }}>
                  ${rollSummary.total_expected_rent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Across {rollSummary.total_units} active units</div>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Rent Collected</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)', marginTop: '0.3rem' }}>
                  ${rollSummary.total_collected_rent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Collection Rate: {rollSummary.collection_rate.toFixed(1)}%
                </div>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Outstanding Balance Due</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: rollSummary.total_balance_due > 0 ? 'var(--danger)' : 'var(--success)', marginTop: '0.3rem' }}>
                  ${rollSummary.total_balance_due.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Uncollected rent for {selectedMonth}
                </div>
              </div>
            </div>
          )}

          {/* Rent Roll Table Card */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Portfolio Rent Roll — {selectedMonth}</h2>
                <div className="card-description">
                  Every unit with monthly rent, tenant name, and current payment status
                </div>
              </div>

              <button id="btn-export-rent-roll-csv" className="btn btn-secondary btn-sm" onClick={handleDownloadCsv}>
                <Download size={14} /> Export Rent Roll (CSV)
              </button>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Unit #</th>
                    <th>Property Address</th>
                    <th>Tenant Name</th>
                    <th>Monthly Rent</th>
                    <th>Amount Paid</th>
                    <th>Balance Due</th>
                    <th>Payment Status</th>
                    <th>Last Payment Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rollLoading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        Loading rent roll ledger...
                      </td>
                    </tr>
                  ) : rentRoll.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No active units found.
                      </td>
                    </tr>
                  ) : (
                    rentRoll.map(item => (
                      <tr key={item.unit_id}>
                        <td>
                          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{item.unit_number}</span>
                        </td>
                        <td>{item.address}</td>
                        <td style={{ fontWeight: 600 }}>{item.tenant_name}</td>
                        <td style={{ fontWeight: 600 }}>${item.monthly_rent.toFixed(2)}</td>
                        <td style={{ fontWeight: 700, color: item.amount_paid > 0 ? 'var(--success)' : 'inherit' }}>
                          ${item.amount_paid.toFixed(2)}
                        </td>
                        <td style={{ fontWeight: 700, color: item.balance_due > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          ${item.balance_due.toFixed(2)}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              item.status === 'paid'
                                ? 'badge-resolved'
                                : item.status === 'underpaid'
                                ? 'badge-underpaid'
                                : item.status === 'overpaid'
                                ? 'badge-overpaid'
                                : 'badge-urgent'
                            }`}
                          >
                            {item.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {item.last_payment_date ? new Date(item.last_payment_date).toLocaleDateString() : 'None'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
