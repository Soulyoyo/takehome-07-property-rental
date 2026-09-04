export type UserRole = 'property_manager' | 'contractor';

export interface User {
  id: number;
  email: string;
  password_hash?: string;
  name: string;
  role: UserRole;
  specialty?: string | null;
  created_at: string;
}

export interface AuthTokenPayload {
  userId: number;
  email: string;
  role: UserRole;
  name: string;
}

export interface Unit {
  id: number;
  unit_number: string;
  address: string;
  monthly_rent: number;
  tenant_name: string;
  tenant_email?: string | null;
  tenant_phone?: string | null;
  grace_days: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';
export type MaintenanceStatus = 'Reported' | 'Triaged' | 'Scheduled' | 'Resolved';

export interface MaintenanceRequest {
  id: number;
  unit_id: number;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  unit_number?: string;
  unit_address?: string;
  tenant_name?: string;
  creator_name?: string;
  contractors?: Array<{
    id: number;
    name: string;
    email: string;
    specialty?: string | null;
    assigned_at: string;
  }>;
}

export interface MaintenanceTimelineEvent {
  id: number;
  request_id: number;
  event_type: 'created' | 'status_change' | 'assignment' | 'unassignment' | 'note' | 'details_updated';
  old_value?: string | null;
  new_value?: string | null;
  user_id: number;
  user_name?: string;
  user_role?: UserRole;
  notes?: string | null;
  created_at: string;
}

export interface RentPayment {
  id: number;
  unit_id: number;
  amount: number;
  month: string;
  paid_at: string;
  payment_method: string;
  recorded_by_user_id: number;
  recorded_by_name?: string;
  notes?: string | null;
  created_at: string;
}

export type RentMatchClassification = 'matched' | 'underpaid' | 'overpaid' | 'unmatched';

export interface BulkRentRowInput {
  identifier: string; // unit_number or unit_id
  amount: number;
  notes?: string;
}

export interface BulkRentRowResult {
  row: number;
  identifier: string;
  unit_id?: number;
  unit_number?: string;
  tenant_name?: string;
  monthly_rent?: number;
  amount_received: number;
  classification: RentMatchClassification;
  message: string;
}

export interface BulkRentReport {
  month: string;
  total_processed: number;
  matched_count: number;
  underpaid_count: number;
  overpaid_count: number;
  unmatched_count: number;
  total_collected: number;
  results: BulkRentRowResult[];
}

export interface RentRollItem {
  unit_id: number;
  unit_number: string;
  address: string;
  tenant_name: string;
  monthly_rent: number;
  amount_paid: number;
  balance_due: number;
  status: 'paid' | 'underpaid' | 'overpaid' | 'unpaid';
  last_payment_date?: string | null;
}

export interface OverdueAlert {
  unit_id: number;
  unit_number: string;
  address: string;
  tenant_name: string;
  monthly_rent: number;
  amount_paid: number;
  amount_due: number;
  month: string;
  grace_days: number;
  days_overdue: number;
  is_dismissed: boolean;
}

export interface DashboardMetrics {
  open_maintenance_requests: number;
  units_with_rent_overdue: number;
  requests_resolved_this_week: number;
  total_rent_collected_this_month: number;
  current_month: string;
  requests_by_status: Record<MaintenanceStatus, number>;
  requests_by_contractor: Array<{
    contractor_id: number;
    contractor_name: string;
    specialty?: string | null;
    assigned_count: number;
  }>;
  resolved_per_week: Array<{
    week_label: string;
    week_start: string;
    week_end: string;
    count: number;
  }>;
}
