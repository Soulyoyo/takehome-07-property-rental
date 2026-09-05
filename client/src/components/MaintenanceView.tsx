import React, { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  UserMinus,
  MessageSquare,
  X,
  History,
  ShieldCheck,
  HardHat,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { api } from '../api/client';
import type {
  MaintenanceRequest,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceTimelineEvent,
  Unit,
  User,
} from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const MaintenanceView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isManager = user?.role === 'property_manager';

  // Search & Filter State (server-side!)
  const [search, setSearch] = useState('');
  const [filterUnitId, setFilterUnitId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterContractorId, setFilterContractorId] = useState<string>('');
  const [sortBy, setSortBy] = useState<'created_at' | 'priority' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);

  // Data state
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  // Aux data for dropdowns
  const [units, setUnits] = useState<Unit[]>([]);
  const [contractors, setContractors] = useState<User[]>([]);

  // Selected Request & Timeline
  const [activeRequest, setActiveRequest] = useState<MaintenanceRequest | null>(null);
  const [timeline, setTimeline] = useState<MaintenanceTimelineEvent[]>([]);

  // Action Modals & Forms
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createUnitId, setCreateUnitId] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createPriority, setCreatePriority] = useState<MaintenancePriority>('medium');

  // Edit details inside modal
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPriority, setEditPriority] = useState<MaintenancePriority>('medium');

  // Assign contractor inside modal
  const [selectedContractorToAssign, setSelectedContractorToAssign] = useState('');

  // Add note form
  const [newNote, setNewNote] = useState('');

  // Status transition notes modal
  const [statusNote, setStatusNote] = useState('');

  useEffect(() => {
    api.maintenance.getUnitOptions().then(res => setUnits(res.units as any)).catch(() => {});
    if (isManager) {
      api.auth.listContractors().then(res => setContractors(res.contractors)).catch(() => {});
    }
  }, [isManager]);

  useEffect(() => {
    loadRequests();
  }, [search, filterUnitId, filterStatus, filterPriority, filterContractorId, sortBy, sortOrder, page]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await api.maintenance.list({
        search,
        unit_id: filterUnitId || undefined,
        status: filterStatus || undefined,
        priority: filterPriority || undefined,
        contractor_id: filterContractorId || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        limit,
      });
      setRequests(res.items);
      setTotalMatches(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      showToast(err.message || 'Failed to load maintenance requests.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = async (reqId: number) => {
    try {
      const [reqRes, timeRes] = await Promise.all([
        api.maintenance.getById(reqId),
        api.maintenance.getTimeline(reqId),
      ]);
      setActiveRequest(reqRes.request);
      setTimeline(timeRes.timeline);
      setEditTitle(reqRes.request.title);
      setEditDesc(reqRes.request.description);
      setEditPriority(reqRes.request.priority);
      setIsEditingDetails(false);
      setNewNote('');
    } catch (err: any) {
      showToast(err.message || 'Failed to load request details.', 'error');
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUnitId || !createTitle || !createDesc) {
      showToast('Please fill in all required fields.', 'warning');
      return;
    }
    try {
      const res = await api.maintenance.create({
        unit_id: parseInt(createUnitId, 10),
        title: createTitle,
        description: createDesc,
        priority: createPriority,
      });
      showToast(
        isManager
          ? 'Maintenance request reported successfully!'
          : 'Maintenance request reported successfully! Forwarded to Property Manager for triage and assignment.',
        'success'
      );
      setIsCreateModalOpen(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateUnitId('');
      loadRequests();
      if (isManager) {
        handleOpenDetail(res.request.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create request.', 'error');
    }
  };

  const handleSaveDetails = async () => {
    if (!activeRequest) return;
    try {
      const res = await api.maintenance.updateDetails(activeRequest.id, {
        title: editTitle,
        description: editDesc,
        priority: editPriority,
      });
      setActiveRequest(res.request);
      setIsEditingDetails(false);
      showToast('Request details updated.', 'success');
      // Refresh timeline
      const timeRes = await api.maintenance.getTimeline(activeRequest.id);
      setTimeline(timeRes.timeline);
      loadRequests();
    } catch (err: any) {
      showToast(err.message || 'Failed to update details.', 'error');
    }
  };

  const handleTransitionStatus = async (targetStatus: MaintenanceStatus) => {
    if (!activeRequest) return;

    // Client-side quick hint for Goal 4: Cannot schedule without contractor
    if (targetStatus === 'Scheduled' && (!activeRequest.contractors || activeRequest.contractors.length === 0)) {
      showToast('Cannot move into "Scheduled" status without an assigned contractor.', 'error');
      return;
    }

    try {
      const res = await api.maintenance.updateStatus(activeRequest.id, targetStatus, statusNote);
      setActiveRequest(res.request);
      setStatusNote('');
      showToast(`Request transitioned to "${targetStatus}"!`, 'success');
      const timeRes = await api.maintenance.getTimeline(activeRequest.id);
      setTimeline(timeRes.timeline);
      loadRequests();
    } catch (err: any) {
      showToast(err.message || 'Illegal transition.', 'error');
    }
  };

  const handleAssignContractor = async () => {
    if (!activeRequest || !selectedContractorToAssign) return;
    try {
      const res = await api.maintenance.assignContractor(activeRequest.id, parseInt(selectedContractorToAssign, 10));
      setActiveRequest(res.request);
      setSelectedContractorToAssign('');
      showToast('Contractor assigned.', 'success');
      const timeRes = await api.maintenance.getTimeline(activeRequest.id);
      setTimeline(timeRes.timeline);
      loadRequests();
    } catch (err: any) {
      showToast(err.message || 'Failed to assign contractor.', 'error');
    }
  };

  const handleUnassignContractor = async (contractorId: number) => {
    if (!activeRequest) return;
    try {
      const res = await api.maintenance.unassignContractor(activeRequest.id, contractorId);
      setActiveRequest(res.request);
      showToast('Contractor removed.', 'success');
      const timeRes = await api.maintenance.getTimeline(activeRequest.id);
      setTimeline(timeRes.timeline);
      loadRequests();
    } catch (err: any) {
      showToast(err.message || 'Failed to unassign contractor.', 'error');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRequest || !newNote.trim()) return;
    try {
      await api.maintenance.addNote(activeRequest.id, newNote.trim());
      setNewNote('');
      showToast('Note appended to immutable audit timeline.', 'success');
      const timeRes = await api.maintenance.getTimeline(activeRequest.id);
      setTimeline(timeRes.timeline);
    } catch (err: any) {
      showToast(err.message || 'Failed to append note.', 'error');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Maintenance Requests Ledger
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            {isManager
              ? 'Tracking repair tickets, contractor assignments, and strict lifecycle status across the portfolio'
              : 'Viewing and servicing maintenance requests assigned to your contractor account'}
          </p>
        </div>

        <button
          id="btn-report-request"
          className="btn btn-primary"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus size={16} /> Log New Request
        </button>
      </div>

      {/* Server-Side Search, Filter, and Sort Toolbar (Goal 6) */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          {/* Text Search over description and title */}
          <div className="search-input-wrapper" style={{ flex: '1 1 240px' }}>
            <Search size={16} className="search-icon" />
            <input
              id="maintenance-search-input"
              className="form-input search-input"
              placeholder="Search descriptions and titles..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Unit Filter */}
          {isManager && (
            <select
              id="filter-unit-select"
              className="form-select"
              style={{ width: 'auto', minWidth: '130px' }}
              value={filterUnitId}
              onChange={e => {
                setFilterUnitId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Units</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>
                  Unit {u.unit_number}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            id="filter-status-select"
            className="form-select"
            style={{ width: 'auto', minWidth: '140px' }}
            value={filterStatus}
            onChange={e => {
              setFilterStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="Reported">Reported</option>
            <option value="Triaged">Triaged</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Resolved">Resolved</option>
          </select>

          {/* Priority Filter */}
          <select
            id="filter-priority-select"
            className="form-select"
            style={{ width: 'auto', minWidth: '130px' }}
            value={filterPriority}
            onChange={e => {
              setFilterPriority(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Contractor Filter (PM only) */}
          {isManager && (
            <select
              id="filter-contractor-select"
              className="form-select"
              style={{ width: 'auto', minWidth: '160px' }}
              value={filterContractorId}
              onChange={e => {
                setFilterContractorId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Contractors</option>
              {contractors.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.specialty || 'General'})
                </option>
              ))}
            </select>
          )}

          {/* Sort Field */}
          <select
            id="sort-by-select"
            className="form-select"
            style={{ width: 'auto', minWidth: '140px' }}
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
          >
            <option value="created_at">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="status">Sort by Status</option>
          </select>

          {/* Sort Order Toggle */}
          <button
            id="sort-order-toggle-btn"
            className="btn btn-secondary btn-sm"
            onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
            title="Toggle ascending / descending order"
          >
            <ArrowUpDown size={14} /> {sortOrder.toUpperCase()}
          </button>
        </div>
      </div>

      {/* Requests Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Status</th>
              <th>Unit</th>
              <th>Issue Title &amp; Description</th>
              <th>Assigned Contractors</th>
              <th>Reported Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  Loading maintenance requests from server...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No maintenance requests matched your filters.
                </td>
              </tr>
            ) : (
              requests.map(req => (
                <tr key={req.id}>
                  <td>
                    <span className={`badge badge-${req.priority}`}>{req.priority}</span>
                  </td>
                  <td>
                    <span className={`badge badge-${req.status.toLowerCase()}`}>{req.status}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      Unit {req.unit_number}
                    </span>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{req.tenant_name}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{req.title}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {req.description}
                    </div>
                  </td>
                  <td>
                    {req.contractors && req.contractors.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {req.contractors.map(c => (
                          <span key={c.id} className="badge badge-medium" style={{ fontSize: '0.75rem' }}>
                            {c.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-subtle)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                        None assigned
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {new Date(req.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenDetail(req.id)}
                    >
                      View &amp; Manage
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Server-Side Pagination Bar */}
      <div className="pagination">
        <div>
          Showing <strong>{requests.length}</strong> of <strong>{totalMatches}</strong> matching requests (Page {page} of {totalPages})
        </div>
        <div className="pagination-controls">
          <button
            id="pagination-prev-btn"
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span style={{ padding: '0 0.5rem', fontWeight: 600 }}>{page} / {totalPages}</span>
          <button
            id="pagination-next-btn"
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* CREATE MAINTENANCE REQUEST MODAL */}
      {isCreateModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-container">
            <div className="modal-header">
              <h2 className="modal-title">Report New Maintenance Request</h2>
              <button className="modal-close" onClick={() => setIsCreateModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateRequest}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="create-req-unit">Rental Unit *</label>
                  <select
                    id="create-req-unit"
                    className="form-select"
                    value={createUnitId}
                    onChange={e => setCreateUnitId(e.target.value)}
                    required
                  >
                    <option value="">Select Unit</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>
                        Unit {u.unit_number} — {u.address}{u.tenant_name ? ` (${u.tenant_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="create-req-title">Issue Title *</label>
                  <input
                    id="create-req-title"
                    className="form-input"
                    placeholder="e.g. Water leak under kitchen sink"
                    value={createTitle}
                    onChange={e => setCreateTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="create-req-desc">Detailed Description *</label>
                  <textarea
                    id="create-req-desc"
                    className="form-textarea"
                    rows={4}
                    placeholder="Provide detailed description of the breakdown, symptoms, and severity..."
                    value={createDesc}
                    onChange={e => setCreateDesc(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="create-req-priority">Initial Priority *</label>
                  <select
                    id="create-req-priority"
                    className="form-select"
                    value={createPriority}
                    onChange={e => setCreatePriority(e.target.value as any)}
                  >
                    <option value="low">Low (Cosmetic / Non-urgent)</option>
                    <option value="medium">Medium (Standard repair)</option>
                    <option value="high">High (Impairs normal living)</option>
                    <option value="urgent">Urgent (Flooding, Heating failure, Electrical fire risk)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button id="btn-submit-req" type="submit" className="btn btn-primary">
                  Log Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST DETAIL & LIFECYCLE MANAGEMENT MODAL */}
      {activeRequest && (
        <div className="modal-backdrop">
          <div className="modal-container modal-container-lg">
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`badge badge-${activeRequest.priority}`}>{activeRequest.priority}</span>
                  <span className={`badge badge-${activeRequest.status.toLowerCase()}`}>{activeRequest.status}</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>Unit {activeRequest.unit_number}</span>
                </div>
                <h2 className="modal-title" style={{ marginTop: '0.35rem' }}>{activeRequest.title}</h2>
              </div>
              <button className="modal-close" onClick={() => setActiveRequest(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* STRICT LIFECYCLE ACTION CONTROLS (Goal 4) */}
              <div
                style={{
                  background: 'var(--surface-alt)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  marginBottom: '1.75rem',
                }}
              >
                <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Lifecycle Actions (Enforced State Machine)
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                  {activeRequest.status === 'Reported' && (
                    <button
                      id="btn-transition-triaged"
                      className="btn btn-primary"
                      onClick={() => handleTransitionStatus('Triaged')}
                    >
                      <CheckCircle2 size={16} /> Move to Triaged
                    </button>
                  )}

                  {activeRequest.status === 'Triaged' && (
                    <button
                      id="btn-transition-scheduled"
                      className="btn btn-primary"
                      onClick={() => handleTransitionStatus('Scheduled')}
                    >
                      <Clock size={16} /> Schedule Work
                    </button>
                  )}

                  {activeRequest.status === 'Scheduled' && (
                    <button
                      id="btn-transition-resolved"
                      className="btn btn-success"
                      onClick={() => handleTransitionStatus('Resolved')}
                    >
                      <CheckCircle2 size={16} /> Mark as Resolved
                    </button>
                  )}

                  {activeRequest.status === 'Resolved' && (
                    <button
                      id="btn-transition-reopen"
                      className="btn btn-secondary"
                      onClick={() => handleTransitionStatus('Triaged')}
                      style={{ color: 'var(--primary)' }}
                    >
                      <RotateCcw size={16} /> Reopen Request (Returns to Triaged)
                    </button>
                  )}

                  {activeRequest.status === 'Triaged' && (!activeRequest.contractors || activeRequest.contractors.length === 0) && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--warning-hover)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <AlertTriangle size={15} />
                      Cannot transition to Scheduled until at least one contractor is assigned.
                    </div>
                  )}
                </div>
              </div>

              {/* Description & Priority Section (Editable by Manager or Contractor) */}
              <div style={{ marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Request Details</h3>
                  {!isEditingDetails ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingDetails(true)}>
                      Edit Details
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingDetails(false)}>Cancel</button>
                      <button id="btn-save-details" className="btn btn-primary btn-sm" onClick={handleSaveDetails}>Save</button>
                    </div>
                  )}
                </div>

                {!isEditingDetails ? (
                  <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                    <p style={{ fontSize: '0.92rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                      {activeRequest.description}
                    </p>
                    <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Reported by {activeRequest.creator_name} on {new Date(activeRequest.created_at).toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Title</label>
                      <input
                        className="form-input"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Description</label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Priority</label>
                      <select
                        className="form-select"
                        value={editPriority}
                        onChange={e => setEditPriority(e.target.value as any)}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Assigned Contractors Section (Multi-contractor, Manager-controlled) */}
              <div style={{ marginBottom: '1.75rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <HardHat size={16} /> Assigned Contractors ({activeRequest.contractors?.length || 0})
                </h3>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  {activeRequest.contractors && activeRequest.contractors.length > 0 ? (
                    activeRequest.contractors.map(c => (
                      <div
                        key={c.id}
                        style={{
                          background: 'var(--surface-alt)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.5rem 0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.specialty || 'General'}</div>
                        </div>
                        {isManager && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.2rem 0.4rem', color: 'var(--danger)' }}
                            onClick={() => handleUnassignContractor(c.id)}
                            title="Remove contractor assignment"
                          >
                            <UserMinus size={13} />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No contractors assigned yet.
                    </div>
                  )}
                </div>

                {/* Property Manager Assign Dropdown */}
                {isManager && (
                  <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '400px' }}>
                    <select
                      id="assign-contractor-select"
                      className="form-select"
                      value={selectedContractorToAssign}
                      onChange={e => setSelectedContractorToAssign(e.target.value)}
                    >
                      <option value="">Select Contractor to Assign...</option>
                      {contractors
                        .filter(c => !activeRequest.contractors?.some(ac => ac.id === c.id))
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} — {c.specialty || 'General'}
                          </option>
                        ))}
                    </select>
                    <button
                      id="btn-assign-contractor"
                      className="btn btn-primary btn-sm"
                      onClick={handleAssignContractor}
                      disabled={!selectedContractorToAssign}
                    >
                      <UserPlus size={14} /> Assign
                    </button>
                  </div>
                )}
              </div>

              {/* IMMUTABLE AUDIT TIMELINE (Goal 9) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <History size={16} /> Immutable Audit Timeline
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ShieldCheck size={13} style={{ color: 'var(--success)' }} /> Tamper-Proof Audit Log
                  </span>
                </div>

                {/* Timeline Entries */}
                <div className="timeline" style={{ marginBottom: '1.25rem' }}>
                  {timeline.map(event => (
                    <div key={event.id} className="timeline-item">
                      <div className={`timeline-marker ${event.event_type}`} />
                      <div className="timeline-content">
                        <div className="timeline-meta">
                          <span className="timeline-author">
                            {event.user_name} ({event.user_role === 'property_manager' ? 'Manager' : 'Contractor'})
                          </span>
                          <span>{new Date(event.created_at).toLocaleString()}</span>
                        </div>

                        {event.event_type === 'created' && (
                          <div>Request created in <strong>Reported</strong> state.</div>
                        )}

                        {event.event_type === 'status_change' && (
                          <div>
                            Status moved from <span className="badge badge-low" style={{ fontSize: '0.72rem' }}>{event.old_value}</span> to <span className="badge badge-resolved" style={{ fontSize: '0.72rem' }}>{event.new_value}</span>
                          </div>
                        )}

                        {event.event_type === 'assignment' && (
                          <div>Assigned contractor: <strong>{event.new_value}</strong></div>
                        )}

                        {event.event_type === 'unassignment' && (
                          <div>Removed contractor: <strong>{event.old_value}</strong></div>
                        )}

                        {event.event_type === 'note' && (
                          <div style={{ fontStyle: 'italic', color: 'var(--text-main)' }}>
                            "{event.notes}"
                          </div>
                        )}

                        {event.event_type === 'details_updated' && (
                          <div>{event.notes}</div>
                        )}

                        {event.notes && event.event_type !== 'note' && event.event_type !== 'details_updated' && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Note: {event.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Append-Only Note Form */}
                <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    id="timeline-note-input"
                    className="form-input"
                    placeholder="Append an audit note or contractor update..."
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                  />
                  <button id="btn-add-timeline-note" type="submit" className="btn btn-secondary" disabled={!newNote.trim()}>
                    <MessageSquare size={14} /> Add Note
                  </button>
                </form>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveRequest(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
