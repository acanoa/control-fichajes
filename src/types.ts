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
  country: string;
  country_code: string;
  autonomous_community?: string;
  autonomous_community_code?: string;
  province?: string;
  province_code?: string;
  municipality?: string;
  municipality_code?: string;
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
  /** Write-only compatibility field. Never returned by secure reads. */
  pin_hash?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  department?: string;
  hire_date: string;
  termination_date?: string;
  status: EmployeeStatus;
  failed_pin_attempts?: number;
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
  /** The raw token is returned only once during registration. */
  device_token?: string;
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

export type LaborCalendarStatus = 'draft' | 'pending_review' | 'active' | 'archived';
export type WorkingWeekModel = 'monday_to_friday' | 'monday_to_saturday';

export interface LaborCalendar {
  id: string;
  company_id: string;
  work_center_id: string;
  year: number;
  working_week_model: WorkingWeekModel;
  status: LaborCalendarStatus;
  source_summary?: string;
  last_imported_at?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  activated_by?: string;
  activated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarDayTypeSetting {
  id: string;
  company_id: string;
  code: string;
  name: string;
  classification: string;
  is_working_day: boolean;
  reduces_weekly_target: boolean;
  special_target_minutes?: number;
  work_multiplier: number;
  color: string;
  is_system_type: boolean;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CalendarDay {
  id: string;
  calendar_id: string;
  date: string;
  day_type_setting_id: string;
  name: string;
  classification: string;
  source_type: 'official_import' | 'manual';
  source_url?: string;
  source_reference?: string;
  import_run_id?: string;
  is_manual: boolean;
  manually_modified: boolean;
  review_status: 'pending' | 'confirmed' | 'conflict' | 'rejected';
  notes?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarImportRun {
  id: string;
  calendar_id: string;
  requested_by?: string;
  status: 'pending' | 'processing' | 'completed' | 'completed_with_conflicts' | 'failed';
  source_name?: string;
  source_url?: string;
  source_reference?: string;
  requested_at: string;
  completed_at?: string;
  days_found: number;
  days_created: number;
  days_modified: number;
  conflicts_found: number;
  error_message?: string;
  created_at: string;
}

export interface CalendarImportConflict {
  id: string;
  import_run_id: string;
  calendar_id: string;
  date: string;
  existing_values?: any;
  imported_values?: any;
  conflict_reason?: string;
  resolution: 'pending' | 'keep_existing' | 'apply_imported' | 'merge_manually';
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
}

export interface EmployeeWeeklyContract {
  id: string;
  employee_id: string;
  weekly_minutes: number;
  effective_from: string; // DATE
  effective_to?: string;  // DATE
  reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DailyWorkSummary {
  id: string;
  company_id: string;
  employee_id: string;
  work_center_id?: string;
  work_date: string;
  calendar_id?: string;
  calendar_day_id?: string;
  raw_worked_minutes: number;
  break_minutes: number;
  rounded_worked_minutes: number;
  effective_multiplier: number;
  weighted_minutes: number;
  is_complete: boolean;
  has_incident: boolean;
  calculated_at: string;
  calculation_version: number;
}

export interface WeeklyWorkSummary {
  id: string;
  company_id: string;
  employee_id: string;
  week_start: string;
  week_end: string;
  contracted_weekly_minutes: number;
  working_days_divisor: number;
  reference_daily_minutes: number;
  target_reduction_minutes: number;
  special_target_adjustment_minutes: number;
  adjusted_target_minutes: number;
  actual_worked_minutes: number;
  weighted_worked_minutes: number;
  automatic_overtime_minutes: number;
  manual_adjustment_minutes: number;
  final_overtime_minutes: number;
  has_incomplete_days: boolean;
  calculated_at: string;
  calculation_version: number;
}

export interface OvertimeAdjustment {
  id: string;
  weekly_summary_id: string;
  employee_id: string;
  adjustment_minutes: number;
  reason: string;
  created_by: string;
  created_at: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
}
