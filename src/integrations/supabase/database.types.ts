import type {
  AuditLog,
  AuthorizedDevice,
  CalendarDay,
  CalendarDayTypeSetting,
  CalendarImportConflict,
  CalendarImportRun,
  Company,
  CorrectionRequest,
  DailyWorkSummary,
  Employee,
  EmployeeWeeklyContract,
  EmployeeWorkCenter,
  LaborCalendar,
  OvertimeAdjustment,
  Profile,
  TimeEntry,
  TimeEntryIncident,
  WeeklyWorkSummary,
  WorkCenter,
} from '../../types';

type Copy<Row> = { [Key in keyof Row]: Row[Key] };

type Table<Row> = {
  Row: Copy<Row>;
  Insert: Partial<Copy<Row>>;
  Update: Partial<Copy<Row>>;
  Relationships: [];
};

type FunctionContract<Args, Returns> = {
  Args: Args & Record<string, unknown>;
  Returns: Returns;
};

export interface Database {
  Gestion_Fichajes: {
    Tables: {
      audit_logs: Table<AuditLog>;
      authorized_devices: Table<AuthorizedDevice>;
      calendar_day_type_settings: Table<CalendarDayTypeSetting>;
      calendar_days: Table<CalendarDay>;
      calendar_import_conflicts: Table<CalendarImportConflict>;
      calendar_import_runs: Table<CalendarImportRun>;
      companies: Table<Company>;
      correction_requests: Table<CorrectionRequest>;
      daily_work_summaries: Table<DailyWorkSummary>;
      employee_weekly_contracts: Table<EmployeeWeeklyContract>;
      employee_work_centers: Table<EmployeeWorkCenter>;
      employees: Table<Employee>;
      labor_calendars: Table<LaborCalendar>;
      overtime_adjustments: Table<OvertimeAdjustment>;
      profiles: Table<Profile>;
      time_entries: Table<TimeEntry>;
      time_entry_incidents: Table<TimeEntryIncident>;
      weekly_work_summaries: Table<WeeklyWorkSummary>;
      work_centers: Table<WorkCenter>;
    };
    Views: Record<never, never>;
    Functions: {
      add_overtime_adjustment: FunctionContract<{
        p_weekly_summary_id: string;
        p_employee_id: string;
        p_adjustment_minutes: number;
        p_reason: string;
      }, OvertimeAdjustment>;
      approve_device_registration: FunctionContract<{
        p_device_id: string;
      }, AuthorizedDevice>;
      authenticate_employee: FunctionContract<{
        p_device_token: string;
        p_pin: string;
      }, {
        employee: Employee;
        employee_session_token: string;
        company: Company;
        work_center: WorkCenter;
        time_entries: TimeEntry[];
        correction_requests: CorrectionRequest[];
      }>;
      list_device_registration_options: FunctionContract<Record<never, never>, {
        companies: Company[];
        work_centers: WorkCenter[];
      }>;
      recalculate_company_hours: FunctionContract<{
        p_company_id: string;
      }, { employees_recalculated: number }>;
      recalculate_employee_hours: FunctionContract<{
        p_employee_id: string;
      }, {
        daily: DailyWorkSummary[];
        weekly: WeeklyWorkSummary[];
      }>;
      register_time_entry: FunctionContract<{
        p_employee_session_token: string;
        p_device_token: string;
        p_entry_type: string;
        p_photo_data: string | null;
        p_latitude: number | null;
        p_longitude: number | null;
        p_camera_error: string | null;
        p_gps_error: string | null;
        p_manual_reason: string | null;
      }, TimeEntry>;
      request_device_registration: FunctionContract<{
        p_name: string;
        p_company_id: string;
        p_work_center_id: string;
        p_camera_working: boolean;
      }, {
        device: AuthorizedDevice;
        device_token: string;
      }>;
      set_employee_pin: FunctionContract<{
        p_employee_id: string;
        p_new_pin: string;
      }, boolean>;
      submit_correction_request: FunctionContract<{
        p_employee_session_token: string;
        p_device_token: string;
        p_request_type: string;
        p_requested_date: string;
        p_requested_time: string;
        p_entry_type: string;
        p_reason: string;
        p_time_entry_id: string | null;
      }, CorrectionRequest>;
      validate_device: FunctionContract<{
        p_device_token: string;
      }, AuthorizedDevice>;
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
