import React, { useEffect, useState } from 'react';
import {
  Plus,
  Archive,
  RotateCcw,
  Eye,
  Edit2,
  DollarSign,
  Wrench,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import type { Unit, MaintenanceRequest, RentPayment } from '../types';
import { useToast } from '../context/ToastContext';

export const UnitsView: React.FC = () => {
  const { showToast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [includeArchived, setIncludeArchived] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals state
  const [selectedUnit, setSelectedUnit] = useState<(Unit & { maintenance_requests: MaintenanceRequest[]; rent_payments: RentPayment[] }) | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Form state for Create / Edit
  const [formUnitNumber, setFormUnitNumber] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formMonthlyRent, setFormMonthlyRent] = useState('');
  const [formTenantName, setFormTenantName] = useState('');
  const [formTenantEmail, setFormTenantEmail] = useState('');
  const [formTenantPhone, setFormTenantPhone] = useState('');
  const [formGraceDays, setFormGraceDays] = useState('5');
  const [submitting, setSubmitting] = useState(false);

  // Single payment recording modal inside unit detail
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMonth, setPaymentMonth] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    loadUnits();
  }, [includeArchived]);

  const loadUnits = async () => {
    setLoading(true);
    try {
      const res = await api.units.list(includeArchived);
      setUnits(res.units);
    } catch (err: any) {
      showToast(err.message || 'Failed to load units.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (id: number) => {
    try {
      const res = await api.units.getById(id);
      setSelectedUnit(res.unit);
      const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      setPaymentMonth(currentMonth);
      setPaymentAmount(String(res.unit.monthly_rent));
    } catch (err: any) {
      showToast(err.message || 'Failed to load unit details.', 'error');
    }
  };

  const handleOpenCreate = () => {
    setEditingUnit(null);
    setFormUnitNumber('');
    setFormAddress('');
    setFormMonthlyRent('');
    setFormTenantName('');
    setFormTenantEmail('');
    setFormTenantPhone('');
    setFormGraceDays('5');
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormUnitNumber(unit.unit_number);
    setFormAddress(unit.address);
    setFormMonthlyRent(String(unit.monthly_rent));
    setFormTenantName(unit.tenant_name);
    setFormTenantEmail(unit.tenant_email || '');
    setFormTenantPhone(unit.tenant_phone || '');
    setFormGraceDays(String(unit.grace_days || 5));
    setIsCreateModalOpen(true);
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        unit_number: formUnitNumber,
        address: formAddress,
        monthly_rent: parseFloat(formMonthlyRent),
        tenant_name: formTenantName,
        tenant_email: formTenantEmail || undefined,
        tenant_phone: formTenantPhone || undefined,
        grace_days: parseInt(formGraceDays, 10),
      };

      if (editingUnit) {
        await api.units.update(editingUnit.id, payload);
        showToast(`Unit ${payload.unit_number} updated successfully!`, 'success');
      } else {
        await api.units.create(payload);
        showToast(`Unit ${payload.unit_number} created successfully!`, 'success');
      }

      setIsCreateModalOpen(false);
      loadUnits();
    } catch (err: any) {
      showToast(err.message || 'Failed to save unit.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: number, unitNumber: string) => {
    if (!confirm(`Are you sure you want to archive Unit ${unitNumber}? It will be hidden from the default view.`)) {
      return;
    }
    try {
      await api.units.archive(id);
      showToast(`Unit ${unitNumber} archived.`, 'success');
      loadUnits();
      if (selectedUnit?.id === id) {
        setSelectedUnit(prev => (prev ? { ...prev, is_archived: 1 } : null));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to archive unit.', 'error');
    }
  };

  const handleRestore = async (id: number, unitNumber: string) => {
    try {
      await api.units.restore(id);
      showToast(`Unit ${unitNumber} restored to active portfolio.`, 'success');
      loadUnits();
      if (selectedUnit?.id === id) {
        setSelectedUnit(prev => (prev ? { ...prev, is_archived: 0 } : null));
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to restore unit.', 'error');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;
    try {
      await api.rent.recordPayment({
        unit_id: selectedUnit.id,
        amount: parseFloat(paymentAmount),
        month: paymentMonth,
        payment_method: paymentMethod,
        notes: paymentNotes,
      });
      showToast(`Recorded payment of $${parseFloat(paymentAmount).toFixed(2)} for ${paymentMonth}!`, 'success');
      setIsPaymentModalOpen(false);
      // Refresh unit detail
      handleOpenDetail(selectedUnit.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to record rent payment.', 'error');
    }
  };

  return (
    <div>
      {/* Header and Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Rental Units Portfolio
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Manage rental properties, tenant leases, monthly rents, and grace periods
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', cursor: 'pointer', userSelect: 'none' }}>
            <input
              id="toggle-show-archived-units"
              type="checkbox"
              checked={includeArchived}
              onChange={e => setIncludeArchived(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            Show Archived Units
          </label>

          <button id="btn-add-unit" className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Add New Unit
          </button>
        </div>
      </div>

      {/* Units Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Unit #</th>
              <th>Property Address</th>
              <th>Current Tenant</th>
              <th>Monthly Rent</th>
              <th>Grace Period</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Loading portfolio units...
                </td>
              </tr>
            ) : units.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No units found. Click "Add New Unit" to create one.
                </td>
              </tr>
            ) : (
              units.map(unit => (
                <tr key={unit.id} style={{ opacity: unit.is_archived ? 0.65 : 1 }}>
                  <td>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                      {unit.unit_number}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{unit.address}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{unit.tenant_name}</div>
                    {(unit.tenant_email || unit.tenant_phone) && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {[unit.tenant_email, unit.tenant_phone].filter(Boolean).join(' • ')}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      ${unit.monthly_rent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> / mo</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem' }}>{unit.grace_days || 5} days</span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>overdue on day {(unit.grace_days || 5) + 1}</div>
                  </td>
                  <td>
                    {unit.is_archived ? (
                      <span className="badge badge-low">Archived</span>
                    ) : (
                      <span className="badge badge-resolved">Active</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenDetail(unit.id)}
                        title="View Unit Details, Maintenance & Rent History"
                      >
                        <Eye size={14} /> View
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenEdit(unit)}
                        title="Edit Unit"
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      {unit.is_archived ? (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => handleRestore(unit.id, unit.unit_number)}
                          title="Restore Unit"
                        >
                          <RotateCcw size={14} /> Restore
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleArchive(unit.id, unit.unit_number)}
                          title="Archive Unit"
                          style={{ color: 'var(--danger)' }}
                        >
                          <Archive size={14} /> Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE / EDIT UNIT MODAL */}
      {isCreateModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <h2 className="modal-title">
                {editingUnit ? `Edit Unit ${editingUnit.unit_number}` : 'Add New Rental Unit'}
              </h2>
              <button className="modal-close" onClick={() => setIsCreateModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveUnit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="unit-number-input">Unit Number *</label>
                    <input
                      id="unit-number-input"
                      className="form-input"
                      placeholder="e.g. 101, 204B"
                      value={formUnitNumber}
                      onChange={e => setFormUnitNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="unit-rent-input">Monthly Rent ($) *</label>
                    <input
                      id="unit-rent-input"
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="e.g. 1650.00"
                      value={formMonthlyRent}
                      onChange={e => setFormMonthlyRent(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="unit-address-input">Full Address *</label>
                  <input
                    id="unit-address-input"
                    className="form-input"
                    placeholder="e.g. 142 Elmwood Ave, Springfield"
                    value={formAddress}
                    onChange={e => setFormAddress(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="unit-tenant-input">Current Tenant Name *</label>
                    <input
                      id="unit-tenant-input"
                      className="form-input"
                      placeholder="e.g. Emma Watson"
                      value={formTenantName}
                      onChange={e => setFormTenantName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="unit-grace-input">Grace Period (Days)</label>
                    <input
                      id="unit-grace-input"
                      type="number"
                      min="0"
                      max="30"
                      className="form-input"
                      value={formGraceDays}
                      onChange={e => setFormGraceDays(e.target.value)}
                      required
                    />
                    <div className="form-hint">Rent due on 1st; overdue after day {parseInt(formGraceDays || '0')}.</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Tenant Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="tenant@example.com"
                      value={formTenantEmail}
                      onChange={e => setFormTenantEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tenant Phone</label>
                    <input
                      className="form-input"
                      placeholder="555-0101"
                      value={formTenantPhone}
                      onChange={e => setFormTenantPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button id="btn-save-unit" type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingUnit ? 'Update Unit' : 'Create Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UNIT DETAIL MODAL (Opening a unit shows its maintenance requests and rent history) */}
      {selectedUnit && (
        <div className="modal-backdrop">
          <div className="modal-container modal-container-lg">
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2 className="modal-title">Unit {selectedUnit.unit_number}</h2>
                  {selectedUnit.is_archived ? (
                    <span className="badge badge-low">Archived</span>
                  ) : (
                    <span className="badge badge-resolved">Active</span>
                  )}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {selectedUnit.address}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  id="btn-record-unit-payment"
                  className="btn btn-primary btn-sm"
                  onClick={() => setIsPaymentModalOpen(true)}
                >
                  <DollarSign size={14} /> Record Rent Payment
                </button>
                <button className="modal-close" onClick={() => setSelectedUnit(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              {/* Unit Specs Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                <div style={{ background: 'var(--surface-alt)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Tenant</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.2rem' }}>{selectedUnit.tenant_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {[selectedUnit.tenant_email, selectedUnit.tenant_phone].filter(Boolean).join(' • ') || 'No contact provided'}
                  </div>
                </div>

                <div style={{ background: 'var(--surface-alt)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monthly Rent</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--primary)' }}>
                    ${selectedUnit.monthly_rent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Grace: {selectedUnit.grace_days || 5} days after the 1st
                  </div>
                </div>
              </div>

              {/* Maintenance Requests belonging to this Unit */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Wrench size={16} /> Maintenance Requests for this Unit ({selectedUnit.maintenance_requests.length})
                  </h3>
                </div>

                {selectedUnit.maintenance_requests.length === 0 ? (
                  <div style={{ padding: '1rem', background: 'var(--surface-alt)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    No maintenance requests recorded for this unit.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Priority</th>
                          <th>Status</th>
                          <th>Title / Issue</th>
                          <th>Assigned Contractors</th>
                          <th>Reported</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUnit.maintenance_requests.map(req => (
                          <tr key={req.id}>
                            <td>
                              <span className={`badge badge-${req.priority}`}>{req.priority}</span>
                            </td>
                            <td>
                              <span className={`badge badge-${req.status.toLowerCase()}`}>{req.status}</span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{req.title}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{req.description.slice(0, 70)}...</div>
                            </td>
                            <td>
                              {req.contractors && req.contractors.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                  {req.contractors.map(c => (
                                    <span key={c.id} className="badge badge-medium" style={{ fontSize: '0.72rem' }}>
                                      {c.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-subtle)', fontSize: '0.78rem' }}>Unassigned</span>
                              )}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {new Date(req.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Rent Payments History */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <DollarSign size={16} /> Rent Payment History ({selectedUnit.rent_payments.length})
                </h3>

                {selectedUnit.rent_payments.length === 0 ? (
                  <div style={{ padding: '1rem', background: 'var(--surface-alt)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    No payments recorded for this unit yet.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Amount Paid</th>
                          <th>Method</th>
                          <th>Paid At</th>
                          <th>Recorded By</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUnit.rent_payments.map(p => (
                          <tr key={p.id}>
                            <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{p.month}</td>
                            <td style={{ fontWeight: 700, color: 'var(--success)' }}>
                              ${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td>{p.payment_method}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {new Date(p.paid_at).toLocaleString()}
                            </td>
                            <td style={{ fontSize: '0.82rem' }}>{p.recorded_by_name || 'System'}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedUnit(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD SINGLE PAYMENT MODAL */}
      {isPaymentModalOpen && selectedUnit && (
        <div className="modal-backdrop" style={{ zIndex: 110 }}>
          <div className="modal-container" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Record Rent Payment — Unit {selectedUnit.unit_number}</h2>
              <button className="modal-close" onClick={() => setIsPaymentModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRecordPayment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="rent-payment-month">Coverage Month (YYYY-MM) *</label>
                  <input
                    id="rent-payment-month"
                    className="form-input"
                    type="month"
                    value={paymentMonth}
                    onChange={e => setPaymentMonth(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="rent-payment-amount">Payment Amount Received ($) *</label>
                  <input
                    id="rent-payment-amount"
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    required
                  />
                  <div className="form-hint">Expected monthly rent: ${selectedUnit.monthly_rent.toFixed(2)}</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Method</label>
                  <select
                    className="form-select"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                  >
                    <option value="Bank Transfer">Bank Transfer / ACH</option>
                    <option value="Check">Paper Check</option>
                    <option value="Wire Transfer">Wire Transfer</option>
                    <option value="Cash / Money Order">Cash / Money Order</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes / Reference</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Check #1049, full monthly rent"
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsPaymentModalOpen(false)}>
                  Cancel
                </button>
                <button id="btn-submit-payment" type="submit" className="btn btn-primary">
                  Confirm &amp; Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
