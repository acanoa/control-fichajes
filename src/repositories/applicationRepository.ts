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
} from '../types';
import { AppError } from '../lib/errors';
import { supabase } from '../integrations/supabase/client';

const EMPLOYEE_PUBLIC_COLUMNS =
  'id, company_id, dni, full_name, employee_counter, employee_code, email, phone, job_title, department, hire_date, termination_date, status, created_at, updated_at';
const DEVICE_PUBLIC_COLUMNS =
  'id, company_id, work_center_id, name, status, camera_validation_status, camera_validated_at, camera_validation_error, camera_validated_by, registered_at, last_used_at, created_at, updated_at';

type QueryResult<T> = { data: T[] | null; error: { message: string } | null };

function unwrap<T>(result: QueryResult<T>, resource: string): T[] {
  if (result.error) {
    throw new AppError(`No se pudo cargar ${resource}.`, 'DATA_READ_FAILED', result.error);
  }
  return result.data ?? [];
}

export interface AdminSnapshot {
  companies: Company[];
  workCenters: WorkCenter[];
  profiles: Profile[];
  employees: Employee[];
  devices: AuthorizedDevice[];
  timeEntries: TimeEntry[];
  incidents: TimeEntryIncident[];
  requests: CorrectionRequest[];
  auditLogs: AuditLog[];
  employeeWorkCenters: EmployeeWorkCenter[];
  laborCalendars: LaborCalendar[];
  dayTypeSettings: CalendarDayTypeSetting[];
  calendarDays: CalendarDay[];
  calendarImportRuns: CalendarImportRun[];
  calendarImportConflicts: CalendarImportConflict[];
  employeeWeeklyContracts: EmployeeWeeklyContract[];
  dailyWorkSummaries: DailyWorkSummary[];
  weeklyWorkSummaries: WeeklyWorkSummary[];
  overtimeAdjustments: OvertimeAdjustment[];
}

export async function loadAdminSnapshot(): Promise<AdminSnapshot> {
  const [
    companies, workCenters, profiles, employees, devices, timeEntries, incidents, requests,
    auditLogs, employeeWorkCenters, laborCalendars, dayTypeSettings, calendarDays,
    calendarImportRuns, calendarImportConflicts, employeeWeeklyContracts,
    dailyWorkSummaries, weeklyWorkSummaries, overtimeAdjustments,
  ] = await Promise.all([
    supabase.from('companies').select('*'),
    supabase.from('work_centers').select('*'),
    supabase.from('profiles').select('*'),
    supabase.from('employees').select(EMPLOYEE_PUBLIC_COLUMNS),
    supabase.from('authorized_devices').select(DEVICE_PUBLIC_COLUMNS),
    supabase.from('time_entries').select('*'),
    supabase.from('time_entry_incidents').select('*'),
    supabase.from('correction_requests').select('*'),
    supabase.from('audit_logs').select('*'),
    supabase.from('employee_work_centers').select('*'),
    supabase.from('labor_calendars').select('*'),
    supabase.from('calendar_day_type_settings').select('*'),
    supabase.from('calendar_days').select('*'),
    supabase.from('calendar_import_runs').select('*'),
    supabase.from('calendar_import_conflicts').select('*'),
    supabase.from('employee_weekly_contracts').select('*'),
    supabase.from('daily_work_summaries').select('*'),
    supabase.from('weekly_work_summaries').select('*'),
    supabase.from('overtime_adjustments').select('*'),
  ]);

  return {
    companies: unwrap(companies as QueryResult<Company>, 'empresas'),
    workCenters: unwrap(workCenters as QueryResult<WorkCenter>, 'centros'),
    profiles: unwrap(profiles as QueryResult<Profile>, 'perfiles'),
    employees: unwrap(employees as QueryResult<Employee>, 'empleados'),
    devices: unwrap(devices as QueryResult<AuthorizedDevice>, 'dispositivos'),
    timeEntries: unwrap(timeEntries as QueryResult<TimeEntry>, 'fichajes'),
    incidents: unwrap(incidents as QueryResult<TimeEntryIncident>, 'incidencias'),
    requests: unwrap(requests as QueryResult<CorrectionRequest>, 'correcciones'),
    auditLogs: unwrap(auditLogs as QueryResult<AuditLog>, 'auditoría'),
    employeeWorkCenters: unwrap(employeeWorkCenters as QueryResult<EmployeeWorkCenter>, 'asignaciones'),
    laborCalendars: unwrap(laborCalendars as QueryResult<LaborCalendar>, 'calendarios'),
    dayTypeSettings: unwrap(dayTypeSettings as QueryResult<CalendarDayTypeSetting>, 'tipos de día'),
    calendarDays: unwrap(calendarDays as QueryResult<CalendarDay>, 'días de calendario'),
    calendarImportRuns: unwrap(calendarImportRuns as QueryResult<CalendarImportRun>, 'importaciones'),
    calendarImportConflicts: unwrap(calendarImportConflicts as QueryResult<CalendarImportConflict>, 'conflictos'),
    employeeWeeklyContracts: unwrap(employeeWeeklyContracts as QueryResult<EmployeeWeeklyContract>, 'contratos'),
    dailyWorkSummaries: unwrap(dailyWorkSummaries as QueryResult<DailyWorkSummary>, 'resúmenes diarios'),
    weeklyWorkSummaries: unwrap(weeklyWorkSummaries as QueryResult<WeeklyWorkSummary>, 'resúmenes semanales'),
    overtimeAdjustments: unwrap(overtimeAdjustments as QueryResult<OvertimeAdjustment>, 'ajustes'),
  };
}
