import type {
  User,
  Unit,
  MaintenanceRequest,
  MaintenanceTimelineEvent,
  RentPayment,
  BulkRentReport,
  RentRollItem,
  OverdueAlert,
  DashboardMetrics,
} from '../types';

const API_BASE = '/api';

function getAuthToken(): string | null {
  return localStorage.getItem('apex_auth_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Request failed (${response.status})`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // fallback
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    getMe: () => request<{ user: User }>('/auth/me'),
    listContractors: () => request<{ contractors: User[] }>('/auth/contractors'),
  },

  units: {
    list: (includeArchived: boolean = false) =>
      request<{ units: Unit[] }>(`/units?include_archived=${includeArchived}`),
    getById: (id: number) =>
      request<{ unit: Unit & { maintenance_requests: MaintenanceRequest[]; rent_payments: RentPayment[] } }>(`/units/${id}`),
    create: (data: Partial<Unit>) =>
      request<{ unit: Unit; message: string }>('/units', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: Partial<Unit>) =>
      request<{ unit: Unit; message: string }>(`/units/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    archive: (id: number) =>
      request<{ unit: Unit; message: string }>(`/units/${id}/archive`, {
        method: 'POST',
      }),
    restore: (id: number) =>
      request<{ unit: Unit; message: string }>(`/units/${id}/restore`, {
        method: 'POST',
      }),
  },

  maintenance: {
    list: (params: Record<string, any> = {}) => {
      const query = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          query.set(k, String(v));
        }
      }
      return request<{
        items: MaintenanceRequest[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      }>(`/maintenance?${query.toString()}`);
    },
    getById: (id: number) =>
      request<{ request: MaintenanceRequest }>(`/maintenance/${id}`),
    getTimeline: (id: number) =>
      request<{ timeline: MaintenanceTimelineEvent[] }>(`/maintenance/${id}/timeline`),
    create: (data: { unit_id: number; title: string; description: string; priority: string }) =>
      request<{ request: MaintenanceRequest; message: string }>('/maintenance', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateDetails: (id: number, data: { title?: string; description?: string; priority?: string }) =>
      request<{ request: MaintenanceRequest; message: string }>(`/maintenance/${id}/details`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    updateStatus: (id: number, status: string, notes?: string) =>
      request<{ request: MaintenanceRequest; message: string }>(`/maintenance/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, notes }),
      }),
    assignContractor: (id: number, contractor_id: number) =>
      request<{ request: MaintenanceRequest; message: string }>(`/maintenance/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ contractor_id }),
      }),
    unassignContractor: (id: number, contractor_id: number) =>
      request<{ request: MaintenanceRequest; message: string }>(`/maintenance/${id}/unassign`, {
        method: 'POST',
        body: JSON.stringify({ contractor_id }),
      }),
    addNote: (id: number, note: string) =>
      request<{ message: string }>(`/maintenance/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      }),
  },

  rent: {
    recordPayment: (data: { unit_id: number; amount: number; month: string; payment_method?: string; notes?: string }) =>
      request<{ payment: RentPayment; message: string }>('/rent/payments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    processBulk: (month: string, rows: Array<{ identifier: string; amount: number; notes?: string }>) =>
      request<{ report: BulkRentReport; message: string }>('/rent/bulk', {
        method: 'POST',
        body: JSON.stringify({ month, rows }),
      }),
    getRentRoll: (month?: string) =>
      request<{
        month: string;
        items: RentRollItem[];
        summary: {
          total_units: number;
          total_expected_rent: number;
          total_collected_rent: number;
          total_balance_due: number;
          collection_rate: number;
        };
      }>(`/rent/roll${month ? `?month=${month}` : ''}`),
    downloadRentRollCsv: async (month?: string) => {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/rent/roll/export${month ? `?month=${month}` : ''}`, {
        headers,
      });
      if (!res.ok) throw new Error('Failed to download CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rent-roll-${month || 'current'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    },
  },

  alerts: {
    list: (month?: string) =>
      request<{ alerts: OverdueAlert[]; count: number }>(`/alerts${month ? `?month=${month}` : ''}`),
    getCount: (month?: string) =>
      request<{ count: number }>(`/alerts/count${month ? `?month=${month}` : ''}`),
    dismiss: (unitId: number, month?: string) =>
      request<{ success: boolean; message: string; unit_id: number; month: string }>(`/alerts/${unitId}/dismiss`, {
        method: 'POST',
        body: JSON.stringify({ month }),
      }),
  },

  dashboard: {
    getDashboard: () => request<DashboardMetrics>('/dashboard'),
  },
};
