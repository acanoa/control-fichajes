export type CompanyStatus = 'active' | 'blocked';
export type WorkCenterStatus = 'active' | 'inactive';
export type ProfileRole = 'superadmin' | 'company_admin';
export type ProfileStatus = 'active' | 'blocked';
export type EmployeeStatus = 'active' | 'inactive';
export type DeviceStatus = 'pending' | 'active' | 'inactive' | 'blocked';
export type CameraValidationStatus = 'pending' | 'validated' | 'failed';
export type EntryType = 'entry' | 'break_start' | 'break_end' | 'exit';
export type TimeEntrySource = 'employee' | 'administrator' | 'approved_request';
export type TimeEntryStatus = 'active' | 'cancelled';
export type RequestType = 'modify_existing' | 'create_missing';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface Company {
  id: string;
  legal_name: string;
  commercial_name: string;
  tax_id: string;
  company_code: string;
  address?: string;
  email?: string;
  phone?: string;
  logo_path?: string;
  status: CompanyStatus;
  session_timeout_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface WorkCenter {
  id: string;
  company_id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  status: WorkCenterStatus;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  role: ProfileRole;
  company_id?: string;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  company_id: string;
  dni: string;
  full_name: string;
  employee_counter: number;
  employee_code: string;
  pin_hash: string;
  email?: string;
  phone?: string;
  job_title?: string;
  department?: string;
  hire_date: string;
  termination_date?: string;
  status: EmployeeStatus;
  failed_pin_attempts: number;
  locked_until?: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeWorkCenter {
  id: string;
  employee_id: string;
  work_center_id: string;
  created_at: string;
}

export interface WeeklySchedule {
  id: string;
  employee_id: string;
  day_of_week: number; // 1-7
  expected_entry_time?: string;
  expected_break_start_time?: string;
  expected_break_end_time?: string;
  expected_exit_time?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthorizedDevice {
  id: string;
  company_id: string;
  work_center_id: string;
  name: string;
  device_token: string;
  status: DeviceStatus;
  camera_validation_status: CameraValidationStatus;
  camera_validated_at?: string;
  camera_validation_error?: string;
  camera_validated_by?: string;
  registered_at: string;
  last_used_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceCameraTest {
  id: string;
  device_id: string;
  admin_id: string;
  status: 'success' | 'failed';
  error_type?: string;
  error_message?: string;
  tested_at: string;
}

export interface TimeEntry {
  id: string;
  company_id: string;
  work_center_id: string;
  employee_id: string;
  device_id?: string;
  entry_type: EntryType;
  registered_at: string;
  photo_path?: string;
  latitude?: number;
  longitude?: number;
  photo_status: 'success' | 'failed' | 'missing';
  gps_status: 'success' | 'failed' | 'missing';
  has_incident: boolean;
  source: TimeEntrySource;
  status: TimeEntryStatus;
  manual_reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryIncident {
  id: string;
  company_id: string;
  work_center_id: string;
  employee_id: string;
  device_id?: string;
  time_entry_id?: string;
  incident_type: string;
  description?: string;
  missing_photo: boolean;
  missing_gps: boolean;
  created_at: string;
}

export interface CorrectionRequest {
  id: string;
  company_id: string;
  employee_id: string;
  time_entry_id?: string;
  request_type: RequestType;
  requested_date: string;
  requested_time: string;
  requested_entry_type: EntryType;
  employee_reason: string;
  status: RequestStatus;
  admin_response?: string;
  resolved_by?: string;
  created_at: string;
  resolved_at?: string;
}

export interface AuditLog {
  id: string;
  company_id?: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values?: any;
  new_values?: any;
  reason?: string;
  performed_by?: string;
  performed_at: string;
}

export interface GlobalSetting {
  id: string;
  default_session_timeout_minutes: number;
  created_at: string;
  updated_at: string;
}
