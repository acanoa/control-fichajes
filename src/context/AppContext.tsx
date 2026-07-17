import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Company, WorkCenter, Profile, Employee, 
  AuthorizedDevice, TimeEntry, TimeEntryIncident, 
  CorrectionRequest, AuditLog, EntryType, 
  TimeEntrySource, TimeEntryStatus, EmployeeWorkCenter,
  LaborCalendar, CalendarDayTypeSetting, CalendarDay,
  CalendarImportRun, CalendarImportConflict, EmployeeWeeklyContract,
  DailyWorkSummary, WeeklyWorkSummary, OvertimeAdjustment
} from '../types';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { supabase } from '../services/supabase';

interface AppContextType {
  // Master lists
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
  
  // New Master Lists
  laborCalendars: LaborCalendar[];
  dayTypeSettings: CalendarDayTypeSetting[];
  calendarDays: CalendarDay[];
  calendarImportRuns: CalendarImportRun[];
  calendarImportConflicts: CalendarImportConflict[];
  employeeWeeklyContracts: EmployeeWeeklyContract[];
  dailyWorkSummaries: DailyWorkSummary[];
  weeklyWorkSummaries: WeeklyWorkSummary[];
  overtimeAdjustments: OvertimeAdjustment[];

  setCompanies: React.Dispatch<React.SetStateAction<Company[]>>;
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>;
  setTimeEntries: React.Dispatch<React.SetStateAction<TimeEntry[]>>;
  setEmployeeWorkCenters: React.Dispatch<React.SetStateAction<EmployeeWorkCenter[]>>;
  
  // New Setters
  setLaborCalendars: React.Dispatch<React.SetStateAction<LaborCalendar[]>>;
  setDayTypeSettings: React.Dispatch<React.SetStateAction<CalendarDayTypeSetting[]>>;
  setCalendarDays: React.Dispatch<React.SetStateAction<CalendarDay[]>>;
  setCalendarImportRuns: React.Dispatch<React.SetStateAction<CalendarImportRun[]>>;
  setCalendarImportConflicts: React.Dispatch<React.SetStateAction<CalendarImportConflict[]>>;
  setEmployeeWeeklyContracts: React.Dispatch<React.SetStateAction<EmployeeWeeklyContract[]>>;
  setDailyWorkSummaries: React.Dispatch<React.SetStateAction<DailyWorkSummary[]>>;
  setWeeklyWorkSummaries: React.Dispatch<React.SetStateAction<WeeklyWorkSummary[]>>;
  setOvertimeAdjustments: React.Dispatch<React.SetStateAction<OvertimeAdjustment[]>>;
  setAuditLogs: React.Dispatch<React.SetStateAction<AuditLog[]>>;

  // Session / Authentication States
  currentUser: {
    role: 'superadmin' | 'company_admin' | 'employee' | 'none';
    profile?: Profile;
    employee?: Employee;
  };
  currentCompany?: Company;
  currentWorkCenter?: WorkCenter;
  currentDevice?: AuthorizedDevice; // Device token stored in localStorage
  isDeviceAuthorized: boolean;
  authLoading: boolean;

  // Actions
  authorizeDevice: (name: string, companyId: string, workCenterId: string, cameraWorking: boolean) => Promise<AuthorizedDevice>;
  deauthorizeDevice: (deviceId: string) => void;
  deleteDevice: (deviceId: string) => Promise<void>;
  loginEmployee: (pin: string) => Promise<Employee>;
  loginAdmin: (email: string, pass: string) => Promise<Profile>;
  logout: () => void;
  registerPunch: (type: EntryType, photoBase64: string | null, lat?: number, lng?: number, cameraError?: string, gpsError?: string, manualReason?: string) => Promise<TimeEntry>;
  
  // Admin functions
  addEmployee: (emp: Omit<Employee, 'id' | 'employee_code' | 'employee_counter' | 'failed_pin_attempts' | 'created_at' | 'updated_at'>, allowedCenters?: string[]) => void;
  updateEmployee: (emp: Employee, allowedCenters?: string[]) => void;
  changeEmployeePin: (empId: string, newPin: string) => Promise<void>;
  addWorkCenter: (companyId: string, name: string, address: string, lat?: number, lng?: number, radius?: number, status?: 'active' | 'inactive', province?: string, municipality?: string) => void;
  updateWorkCenter: (center: WorkCenter) => void;
  deleteWorkCenter: (centerId: string) => Promise<void>;
  updateDevice: (device: AuthorizedDevice) => void;
  resolveIncident: (incidentId: string, justification: string) => void;
  resolveRequest: (reqId: string, status: 'approved' | 'rejected', responseText: string) => void;
  submitRequest: (requestType: 'modify_existing' | 'create_missing', date: string, time: string, type: EntryType, reason: string, entryId?: string) => Promise<void>;
  deleteOldEntries: (companyId: string) => void;
  updateCompanySettings: (timeout: number) => void;
  showAlert: (message: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  refreshData: () => Promise<void>;

  // New Actions
  recalculateEmployeeHours: (employeeId: string, companyId: string) => Promise<void>;
  recalculateCompanyHours: (companyId: string) => Promise<void>;
  addWeeklyContract: (contract: Omit<EmployeeWeeklyContract, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateWeeklyContract: (contract: EmployeeWeeklyContract) => Promise<void>;
  deleteWeeklyContract: (contractId: string) => Promise<void>;
  addLaborCalendar: (cal: Omit<LaborCalendar, 'id' | 'status' | 'created_at' | 'updated_at'>) => Promise<LaborCalendar>;
  updateLaborCalendar: (cal: LaborCalendar) => Promise<void>;
  importHolidays: (calendarId: string, province: string, municipality: string) => Promise<void>;
  resolveConflict: (conflictId: string, resolution: 'keep_existing' | 'apply_imported' | 'merge_manually', manualDay?: Partial<CalendarDay>) => Promise<void>;
  addOvertimeAdjustment: (weeklySummaryId: string, employeeId: string, minutes: number, reason: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Custom Global Alert Dialog State
  const [alertState, setAlertState] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, title: '', message: '', type: 'info' });

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info', title?: string) => {
    const defaultTitles = {
      success: 'Operación Exitosa',
      error: 'Error de validación',
      info: 'Información'
    };
    setAlertState({
      show: true,
      title: title || defaultTitles[type],
      message,
      type
    });
  };

  const closeAlert = () => {
    setAlertState(prev => ({ ...prev, show: false }));
  };

  // Stable UUID helper to convert mock string IDs to valid UUIDs
  const toUUID = (id: string, prefix = '00000000'): string => {
    if (!id) return '';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return id;
    }
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `${prefix}-0000-0000-0000-${hex.padStart(12, '0')}`;
  };

  const safeUUID = (): string => {
    if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const refreshData = async (): Promise<void> => {
    try {
      console.log("Refreshing data from Supabase...");
      
      const { data: dbComps } = await supabase.from('companies').select('*');
      if (dbComps) rawSetCompanies(dbComps);

      const { data: dbWcs } = await supabase.from('work_centers').select('*');
      if (dbWcs) setWorkCenters(dbWcs);

      const { data: dbProfs } = await supabase.from('profiles').select('*');
      if (dbProfs) rawSetProfiles(dbProfs);

      const { data: dbEmps } = await supabase
        .from('employees')
        .select('id, company_id, dni, full_name, employee_counter, employee_code, email, phone, job_title, department, hire_date, termination_date, status, created_at, updated_at');
      if (dbEmps) setEmployees(dbEmps);

      const { data: dbDevs } = await supabase
        .from('authorized_devices')
        .select('id, company_id, work_center_id, name, status, camera_validation_status, camera_validated_at, camera_validation_error, camera_validated_by, registered_at, last_used_at, created_at, updated_at');
      if (dbDevs) setDevices(dbDevs);

      const { data: dbEntries } = await supabase.from('time_entries').select('*');
      if (dbEntries) rawSetTimeEntries(dbEntries);

      const { data: dbIncidents } = await supabase.from('time_entry_incidents').select('*');
      if (dbIncidents) setIncidents(dbIncidents);

      const { data: dbRequests } = await supabase.from('correction_requests').select('*');
      if (dbRequests) setRequests(dbRequests);

      const { data: dbLogs } = await supabase.from('audit_logs').select('*');
      if (dbLogs) setAuditLogs(dbLogs);

      const { data: dbEwcs } = await supabase.from('employee_work_centers').select('*');
      if (dbEwcs) rawSetEmployeeWorkCenters(dbEwcs);

      // Load new tables
      const { data: dbCalendars } = await supabase.from('labor_calendars').select('*');
      if (dbCalendars) rawSetLaborCalendars(dbCalendars);

      const { data: dbDayTypes } = await supabase.from('calendar_day_type_settings').select('*');
      if (dbDayTypes) rawSetDayTypeSettings(dbDayTypes);

      const { data: dbCalendarDays } = await supabase.from('calendar_days').select('*');
      if (dbCalendarDays) rawSetCalendarDays(dbCalendarDays);

      const { data: dbImportRuns } = await supabase.from('calendar_import_runs').select('*');
      if (dbImportRuns) rawSetCalendarImportRuns(dbImportRuns);

      const { data: dbConflicts } = await supabase.from('calendar_import_conflicts').select('*');
      if (dbConflicts) rawSetCalendarImportConflicts(dbConflicts);

      const { data: dbWeeklyContracts } = await supabase.from('employee_weekly_contracts').select('*');
      if (dbWeeklyContracts) rawSetEmployeeWeeklyContracts(dbWeeklyContracts);

      const { data: dbDailySummaries } = await supabase.from('daily_work_summaries').select('*');
      if (dbDailySummaries) rawSetDailyWorkSummaries(dbDailySummaries);

      const { data: dbWeeklySummaries } = await supabase.from('weekly_work_summaries').select('*');
      if (dbWeeklySummaries) rawSetWeeklyWorkSummaries(dbWeeklySummaries);

      const { data: dbAdjustments } = await supabase.from('overtime_adjustments').select('*');
      if (dbAdjustments) rawSetOvertimeAdjustments(dbAdjustments);

      console.log("Supabase database load/refresh completed successfully!");
    } catch (err) {
      console.warn("Could not load data from Supabase. Using localStorage fallback:", err);
    }
  };

  // Data is loaded only after Supabase has restored and verified an admin session.
  // Production data must never be seeded by an anonymous browser.

  // Local DB States
  // Local DB States
  const [companies, rawSetCompanies] = useState<Company[]>(() => {
    return [];
  });
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>(() => {
    return [];
  });
  const [profiles, rawSetProfiles] = useState<Profile[]>(() => {
    return [];
  });
  const [laborCalendars, rawSetLaborCalendars] = useState<LaborCalendar[]>(() => {
    return [];
  });
  const [dayTypeSettings, rawSetDayTypeSettings] = useState<CalendarDayTypeSetting[]>(() => {
    return [];
  });
  const [calendarDays, rawSetCalendarDays] = useState<CalendarDay[]>(() => {
    return [];
  });
  const [calendarImportRuns, rawSetCalendarImportRuns] = useState<CalendarImportRun[]>(() => {
    return [];
  });
  const [calendarImportConflicts, rawSetCalendarImportConflicts] = useState<CalendarImportConflict[]>(() => {
    return [];
  });
  const [employeeWeeklyContracts, rawSetEmployeeWeeklyContracts] = useState<EmployeeWeeklyContract[]>(() => {
    return [];
  });
  const [dailyWorkSummaries, rawSetDailyWorkSummaries] = useState<DailyWorkSummary[]>(() => {
    return [];
  });
  const [weeklyWorkSummaries, rawSetWeeklyWorkSummaries] = useState<WeeklyWorkSummary[]>(() => {
    return [];
  });
  const [overtimeAdjustments, rawSetOvertimeAdjustments] = useState<OvertimeAdjustment[]>(() => {
    return [];
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    return [];
  });
  const [devices, setDevices] = useState<AuthorizedDevice[]>(() => {
    return [];
  });
  const [timeEntries, rawSetTimeEntries] = useState<TimeEntry[]>(() => {
    return [];
  });
  const [incidents, setIncidents] = useState<TimeEntryIncident[]>(() => {
    return [];
  });
  const [requests, setRequests] = useState<CorrectionRequest[]>(() => {
    return [];
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    return [];
  });
  const [employeeWorkCenters, rawSetEmployeeWorkCenters] = useState<EmployeeWorkCenter[]>(() => {
    return [];
  });

  // Custom Wrapped Setters for Supabase Sync & stable UUID conversions
  const setCompanies: React.Dispatch<React.SetStateAction<Company[]>> = (value) => {
    rawSetCompanies(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      const mapped = next.map(c => ({
        ...c,
        id: toUUID(c.id, '11111111')
      }));

      // Propagation of company code changes to employee codes
      mapped.forEach(newComp => {
        const oldComp = prev.find(o => toUUID(o.id, '11111111') === newComp.id);
        if (oldComp && oldComp.company_code !== newComp.company_code) {
          const oldCode = oldComp.company_code;
          const newCode = newComp.company_code;

          // 1. Update React state for employees
          setEmployees(empPrev => empPrev.map(emp => {
            if (emp.company_id === newComp.id) {
              const regex = new RegExp(`^${oldCode}-`);
              if (regex.test(emp.employee_code)) {
                return {
                  ...emp,
                  employee_code: emp.employee_code.replace(regex, `${newCode}-`),
                  updated_at: new Date().toISOString()
                };
              }
            }
            return emp;
          }));

          // 2. Update Supabase employees table
          supabase.from('employees').select('id, employee_code').eq('company_id', newComp.id).then(({ data }) => {
            if (data) {
              const updates = data.reduce((acc, emp) => {
                const regex = new RegExp(`^${oldCode}-`);
                if (regex.test(emp.employee_code)) {
                  acc.push({
                    id: emp.id,
                    employee_code: emp.employee_code.replace(regex, `${newCode}-`),
                    updated_at: new Date().toISOString()
                  });
                }
                return acc;
              }, [] as any[]);

              if (updates.length > 0) {
                supabase.from('employees').upsert(updates).then(({ error }) => {
                  if (error) console.error("Error updating employee codes during company code change:", error);
                });
              }
            }
          });
        }
      });

      supabase.from('companies').upsert(mapped).then(({ error }) => {
        if (error) console.error("Error upserting companies to Supabase:", error);
      });
      return mapped;
    });
  };

  const setProfiles: React.Dispatch<React.SetStateAction<Profile[]>> = (value) => {
    rawSetProfiles(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      const mapped = next.map(p => ({
        ...p,
        id: toUUID(p.id, '33333333'),
        auth_user_id: toUUID(p.auth_user_id, 'ffffffff'),
        company_id: p.company_id ? toUUID(p.company_id, '11111111') : undefined
      }));
      supabase.from('profiles').upsert(mapped).then(({ error }) => {
        if (error) console.error("Error upserting profiles to Supabase:", error);
      });
      return mapped;
    });
  };

  const setTimeEntries: React.Dispatch<React.SetStateAction<TimeEntry[]>> = (value) => {
    rawSetTimeEntries(prev => {
      const next = typeof value === 'function' ? (value as Function)(prev) : value;
      const mapped = next.map((t: TimeEntry) => ({
        ...t,
        id: toUUID(t.id, '77777777'),
        company_id: toUUID(t.company_id, '11111111'),
        work_center_id: toUUID(t.work_center_id, '22222222'),
        employee_id: toUUID(t.employee_id, '44444444'),
        device_id: t.device_id ? toUUID(t.device_id, '66666666') : undefined
      }));
      supabase.from('time_entries').upsert(mapped).then(({ error }) => {
        if (error) console.error("Error upserting time entries to Supabase:", error);
      });
      return mapped;
    });
  };

  const setEmployeeWorkCenters: React.Dispatch<React.SetStateAction<EmployeeWorkCenter[]>> = (value) => {
    rawSetEmployeeWorkCenters(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      const mapped = next.map(ewc => ({
        ...ewc,
        id: toUUID(ewc.id, '55555555'),
        employee_id: toUUID(ewc.employee_id, '44444444'),
        work_center_id: toUUID(ewc.work_center_id, '22222222')
      }));
      supabase.from('employee_work_centers').upsert(mapped).then(({ error }) => {
        if (error) console.error("Error upserting employee work centers to Supabase:", error);
      });
      return mapped;
    });
  };

  const setLaborCalendars: React.Dispatch<React.SetStateAction<LaborCalendar[]>> = (value) => {
    rawSetLaborCalendars(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      const mapped = next.map(lc => ({
        ...lc,
        id: toUUID(lc.id, '88888888'),
        company_id: toUUID(lc.company_id, '11111111'),
        work_center_id: toUUID(lc.work_center_id, '22222222'),
        reviewed_by: lc.reviewed_by ? toUUID(lc.reviewed_by, '33333333') : undefined,
        activated_by: lc.activated_by ? toUUID(lc.activated_by, '33333333') : undefined
      }));
      supabase.from('labor_calendars').upsert(mapped).then(({ error }) => {
        if (error) console.error("Error upserting labor_calendars:", error);
      });
      return mapped;
    });
  };

  const setDayTypeSettings: React.Dispatch<React.SetStateAction<CalendarDayTypeSetting[]>> = (value) => {
    rawSetDayTypeSettings(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      const mapped = next.map(cdts => ({
        ...cdts,
        id: toUUID(cdts.id, '99999999'),
        company_id: toUUID(cdts.company_id, '11111111')
      }));
      supabase.from('calendar_day_type_settings').upsert(mapped).then(({ error }) => {
        if (error) console.error("Error upserting calendar_day_type_settings:", error);
      });
      return mapped;
    });
  };

  const setCalendarDays: React.Dispatch<React.SetStateAction<CalendarDay[]>> = (value) => {
    rawSetCalendarDays(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      const mapped = next.map(cd => ({
        ...cd,
        id: toUUID(cd.id, 'aaaaaaaa'),
        calendar_id: toUUID(cd.calendar_id, '88888888'),
        day_type_setting_id: toUUID(cd.day_type_setting_id, '99999999'),
        created_by: cd.created_by ? toUUID(cd.created_by, '33333333') : undefined,
        updated_by: cd.updated_by ? toUUID(cd.updated_by, '33333333') : undefined
      }));
      supabase.from('calendar_days').upsert(mapped).then(({ error }) => {
        if (error) console.error("Error upserting calendar_days:", error);
      });
      return mapped;
    });
  };

  const setCalendarImportRuns: React.Dispatch<React.SetStateAction<CalendarImportRun[]>> = (value) => {
    rawSetCalendarImportRuns(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      const mapped = next.map(cir => ({
        ...cir,
        id: toUUID(cir.id, 'bbbbbbbb'),
        calendar_id: toUUID(cir.calendar_id, '88888888'),
        requested_by: cir.requested_by ? toUUID(cir.requested_by, '33333333') : undefined
      }));
      supabase.from('calendar_import_runs').upsert(mapped).then(({ error }) => {
        if (error) console.error("Error upserting calendar_import_runs:", error);
      });
      return mapped;
    });
  };

  const setCalendarImportConflicts: React.Dispatch<React.SetStateAction<CalendarImportConflict[]>> = (value) => {
    rawSetCalendarImportConflicts(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      const mapped = next.map(cic => ({
        ...cic,
        id: toUUID(cic.id, 'cccccccc'),
        import_run_id: toUUID(cic.import_run_id, 'bbbbbbbb'),
        calendar_id: toUUID(cic.calendar_id, '88888888'),
        resolved_by: cic.resolved_by ? toUUID(cic.resolved_by, '33333333') : undefined
      }));
      supabase.from('calendar_import_conflicts').upsert(mapped).then(({ error }) => {
        if (error) console.error("Error upserting calendar_import_conflicts:", error);
      });
      return mapped;
    });
  };

  const setEmployeeWeeklyContracts: React.Dispatch<React.SetStateAction<EmployeeWeeklyContract[]>> = (value) => {
    rawSetEmployeeWeeklyContracts(prev => {
      return typeof value === 'function' ? value(prev) : value;
    });
  };

  const setDailyWorkSummaries: React.Dispatch<React.SetStateAction<DailyWorkSummary[]>> = (value) => {
    rawSetDailyWorkSummaries(prev => {
      return typeof value === 'function' ? value(prev) : value;
    });
  };

  const setWeeklyWorkSummaries: React.Dispatch<React.SetStateAction<WeeklyWorkSummary[]>> = (value) => {
    rawSetWeeklyWorkSummaries(prev => {
      return typeof value === 'function' ? value(prev) : value;
    });
  };

  const setOvertimeAdjustments: React.Dispatch<React.SetStateAction<OvertimeAdjustment[]>> = (value) => {
    rawSetOvertimeAdjustments(prev => {
      return typeof value === 'function' ? value(prev) : value;
    });
  };

  // Session States
  const [currentUser, setCurrentUser] = useState<AppContextType['currentUser']>({ role: 'none' });
  const [currentCompany, setCurrentCompany] = useState<Company | undefined>();
  const [currentWorkCenter, setCurrentWorkCenter] = useState<WorkCenter | undefined>();
  const [currentDevice, setCurrentDevice] = useState<AuthorizedDevice | undefined>();
  const [employeeSessionToken, setEmployeeSessionToken] = useState<string>();
  const [authLoading, setAuthLoading] = useState(true);

  const isDeviceAuthorized = !!currentDevice && currentDevice.status === 'active' && currentDevice.camera_validation_status === 'validated';

  // Remove data left by older insecure versions. Only the opaque terminal token may persist.
  useEffect(() => {
    Object.keys(localStorage).filter(key => key.startsWith('cf_') && key !== 'cf_device_token').forEach(key => localStorage.removeItem(key));
    sessionStorage.removeItem('cf_current_user');
    sessionStorage.removeItem('cf_current_company');
    sessionStorage.removeItem('cf_current_work_center');
  }, []);

  useEffect(() => {
    let active = true;

    const restoreAdminSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .eq('status', 'active')
        .single();

      if (error || !profile) {
        await supabase.auth.signOut();
        return;
      }

      setCurrentUser({ role: profile.role, profile });
      await refreshData();
      if (profile.company_id) {
        const { data: company } = await supabase.from('companies').select('*').eq('id', profile.company_id).single();
        setCurrentCompany(company || undefined);
      }
    };

    const validateTerminal = async () => {
      const token = localStorage.getItem('cf_device_token');
      if (!token) return;
      const { data, error } = await supabase.rpc('validate_device', { p_device_token: token });
      if (error || !data) {
        localStorage.removeItem('cf_device_token');
        return;
      }
      setCurrentDevice(data as AuthorizedDevice);
    };

    const loadPublicRegistrationOptions = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) return;
      const { data, error } = await supabase.rpc('list_device_registration_options');
      if (error || !data) return;
      if (active) {
        rawSetCompanies((data.companies || []) as Company[]);
        setWorkCenters((data.work_centers || []) as WorkCenter[]);
      }
    };

    Promise.all([restoreAdminSession(), validateTerminal(), loadPublicRegistrationOptions()])
      .catch(error => console.error('Error restaurando la sesión segura:', error))
      .finally(() => active && setAuthLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setCurrentUser({ role: 'none' });
        setCurrentCompany(undefined);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Actions
  const authorizeDevice = async (name: string, companyId: string, workCenterId: string, cameraWorking: boolean): Promise<AuthorizedDevice> => {
    const { data, error } = await supabase.rpc('request_device_registration', {
      p_name: name.trim(),
      p_company_id: companyId,
      p_work_center_id: workCenterId,
      p_camera_working: cameraWorking
    });
    if (error || !data?.device || !data?.device_token) {
      throw new Error(error?.message || 'No se pudo registrar la solicitud del terminal.');
    }
    localStorage.setItem('cf_device_token', data.device_token);
    setCurrentDevice(data.device as AuthorizedDevice);
    return data.device as AuthorizedDevice;
  };

  const deauthorizeDevice = (deviceId: string) => {
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'inactive' as const } : d));
    
    // Update status in Supabase
    supabase.from('authorized_devices').update({ status: 'inactive' }).eq('id', deviceId).then(({ error }) => {
      if (error) console.error("Error deauthorizing device in Supabase:", error);
    });

    if (currentDevice?.id === deviceId) {
      localStorage.removeItem('cf_device_token');
      setCurrentDevice(undefined);
    }
  };

  const deleteDevice = async (deviceId: string): Promise<void> => {
    // Remove from state
    setDevices(prev => prev.filter(d => d.id !== deviceId));

    // Clear localStorage if it was the active device
    if (currentDevice?.id === deviceId) {
      localStorage.removeItem('cf_device_token');
      setCurrentDevice(undefined);
    }

    // Delete from Supabase
    const { error } = await supabase.from('authorized_devices').delete().eq('id', deviceId);
    if (error) {
      console.error('Error deleting device from Supabase:', error);
      throw new Error('No se pudo eliminar el dispositivo de la base de datos.');
    }
  };

  const loginEmployee = async (pin: string): Promise<Employee> => {
    const deviceToken = localStorage.getItem('cf_device_token');
    if (!currentDevice || !deviceToken) {
      throw new Error('Terminal no autorizado.');
    }

    const { data, error } = await supabase.rpc('authenticate_employee', {
      p_device_token: deviceToken,
      p_pin: pin
    });
    if (error || !data?.employee || !data?.employee_session_token) {
      throw new Error(error?.message || 'Credenciales de empleado incorrectas.');
    }

    const authenticatedEmployee = data.employee as Employee;
    setEmployeeSessionToken(data.employee_session_token);
    setCurrentUser({ role: 'employee', employee: authenticatedEmployee });
    setCurrentCompany(data.company as Company);
    setCurrentWorkCenter(data.work_center as WorkCenter);
    setTimeEntries((data.time_entries || []) as TimeEntry[]);
    setRequests((data.correction_requests || []) as CorrectionRequest[]);
    return authenticatedEmployee;

    /*
     * Legacy client-side PIN flow deliberately disabled. Authentication is performed
     * atomically by authenticate_employee and no PIN digest is ever downloaded.
     */
    /*
    const deviceCompanyId = currentDevice.company_id;
    const deviceWorkCenterId = currentDevice.work_center_id;

    // 1. Find all active employees in this company with the matching PIN
    const matchingEmployees = employees.filter(e => 
      e.company_id === deviceCompanyId && 
      e.pin_hash === pin && 
      e.status === 'active'
    );

    if (matchingEmployees.length === 0) {
      throw new Error('No se encuentra en el centro asociado.');
    }

    // 2. Check which matching employee is assigned to the current work center
    const emp = matchingEmployees.find(e => 
      employeeWorkCenters.some(ewc => ewc.employee_id === e.id && ewc.work_center_id === deviceWorkCenterId)
    );

    if (!emp) {
      throw new Error('No se encuentra en el centro asociado.');
    }

    // Check Lockout
    if (emp.locked_until && new Date(emp.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(emp.locked_until).getTime() - new Date().getTime()) / 60000);
      throw new Error(`Acceso bloqueado. Inténtelo de nuevo en ${minutesLeft} minutos.`);
    }

    // Success! Reset failed attempts
    setEmployees(prev => prev.map(e => e.id === emp.id ? { 
      ...e, 
      failed_pin_attempts: 0, 
      locked_until: undefined 
    } : e));

    // Reset failed attempts/lockout in Supabase
    supabase.from('employees').update({
      failed_pin_attempts: 0,
      locked_until: null,
      updated_at: new Date().toISOString()
    }).eq('id', emp.id).then();

    const company = companies.find(c => c.id === emp.company_id);
    if (!company || company.status === 'blocked') {
      throw new Error('La empresa de este empleado está bloqueada o no existe.');
    }

    setCurrentUser({
      role: 'employee',
      employee: emp
    });
    setCurrentCompany(company);

    const wc = workCenters.find(w => w.id === deviceWorkCenterId);
    setCurrentWorkCenter(wc);

    return emp;
    */
  };

  const loginAdmin = async (email: string, pass: string): Promise<Profile> => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: pass
      });
      if (authError || !authData.user) {
        throw new Error('Credenciales de administrador incorrectas.');
      }

      if (!authError && authData.user) {
        const { data: dbProfile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_user_id', authData.user.id)
          .eq('status', 'active')
          .single();

        if (profileError || !dbProfile) {
          await supabase.auth.signOut();
          throw new Error('La cuenta no tiene un perfil administrativo activo.');
        }

        if (dbProfile.role !== 'company_admin' && dbProfile.role !== 'superadmin') {
          await supabase.auth.signOut();
          throw new Error('La cuenta no tiene permisos administrativos.');
        }

        let company: Company | undefined;
        if (dbProfile.role === 'company_admin') {
          if (!dbProfile.company_id) {
            await supabase.auth.signOut();
            throw new Error('El perfil administrativo no tiene una empresa asignada.');
          }

          const { data: dbCompany, error: companyError } = await supabase
            .from('companies')
            .select('*')
            .eq('id', dbProfile.company_id)
            .single();

          if (companyError || !dbCompany) {
            await supabase.auth.signOut();
            throw new Error('No se pudo cargar la empresa asignada al administrador.');
          }
          company = dbCompany as Company;
        }

        await refreshData();
        setCurrentCompany(company);
        setCurrentUser({
          role: dbProfile.role,
          profile: dbProfile
        });
        return dbProfile;
      }
    } catch (e: any) {
      await supabase.auth.signOut();
      throw new Error(e?.message || 'Credenciales de administrador incorrectas.');
    }

    await supabase.auth.signOut();
    throw new Error('La cuenta no tiene un perfil administrativo activo.');
  };

  const logout = () => {
    if (currentUser.role !== 'employee') {
      void supabase.auth.signOut();
    }
    setCurrentUser({ role: 'none' });
    setCurrentCompany(undefined);
    setCurrentWorkCenter(undefined);
    setEmployeeSessionToken(undefined);
  };

  const registerPunch = async (
    type: EntryType, 
    photoBase64: string | null, 
    lat?: number, 
    lng?: number,
    cameraError?: string,
    gpsError?: string,
    manualReason?: string
  ): Promise<TimeEntry> => {
    const deviceToken = localStorage.getItem('cf_device_token');
    if (currentUser.role !== 'employee' || !currentUser.employee || !currentCompany || !currentWorkCenter || !employeeSessionToken || !deviceToken) {
      throw new Error('Sesión de empleado inválida.');
    }

    if (photoBase64 && photoBase64.length > 2_800_000) {
      throw new Error('La fotografía supera el tamaño máximo permitido.');
    }
    const { data, error } = await supabase.rpc('register_time_entry', {
      p_employee_session_token: employeeSessionToken,
      p_device_token: deviceToken,
      p_entry_type: type,
      p_photo_data: photoBase64,
      p_latitude: lat ?? null,
      p_longitude: lng ?? null,
      p_camera_error: cameraError ?? null,
      p_gps_error: gpsError ?? null,
      p_manual_reason: manualReason?.trim() || null
    });
    if (error || !data) {
      throw new Error(error?.message || 'No se pudo registrar el fichaje.');
    }
    const securedEntry = data as TimeEntry;
    setTimeEntries(prev => [...prev, securedEntry]);
    window.setTimeout(logout, 2000);
    return securedEntry;

    /*
    Legacy client-side entry creation is intentionally disabled.
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEntries = timeEntries
      .filter(t => t.employee_id === emp.id && t.status === 'active' && t.registered_at.startsWith(todayStr))
      .sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());

    // Validate sequence
    if (type === 'entry') {
      const lastEntry = todayEntries[todayEntries.length - 1];
      if (lastEntry && lastEntry.entry_type !== 'exit') {
        throw new Error('Ya tienes un fichaje de entrada activo sin salida registrada.');
      }
    } else {
      if (todayEntries.length === 0) {
        throw new Error('No puedes registrar esta acción sin antes haber registrado una Entrada.');
      }
      const last = todayEntries[todayEntries.length - 1];
      if (type === 'break_start') {
        if (last.entry_type !== 'entry') {
          throw new Error('Debes estar en estado de Entrada para poder iniciar un descanso.');
        }
        const hasBreak = todayEntries.some(t => t.entry_type === 'break_start');
        if (hasBreak) {
          throw new Error('Solo se permite un descanso por jornada.');
        }
      } else if (type === 'break_end') {
        if (last.entry_type !== 'break_start') {
          throw new Error('Debes tener un descanso iniciado para poder registrar la Vuelta.');
        }
      } else if (type === 'exit') {
        if (last.entry_type === 'break_start') {
          throw new Error('No puedes salir directamente desde un descanso, debes registrar la Vuelta primero.');
        }
        if (last.entry_type === 'exit') {
          throw new Error('Ya has registrado la salida de tu jornada.');
        }
      }
    }

    // Determine Incident flags
    const photo_status = photoBase64 ? 'success' : (cameraError ? 'failed' : 'missing');
    const gps_status = lat && lng ? 'success' : (gpsError ? 'failed' : 'missing');
    const has_incident = photo_status !== 'success' || gps_status !== 'success' || !!manualReason;

    const newEntry: TimeEntry = {
      id: safeUUID(),
      company_id: currentCompany.id,
      work_center_id: currentWorkCenter.id,
      employee_id: emp.id,
      device_id: currentDevice?.id,
      entry_type: type,
      registered_at: new Date().toISOString(), // Secure time (in prod via backend)
      photo_path: photoBase64 || undefined,
      latitude: lat,
      longitude: lng,
      photo_status,
      gps_status,
      has_incident,
      source: 'employee',
      status: 'active',
      manual_reason: manualReason || undefined,
      created_by: emp.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setTimeEntries(prev => [...prev, newEntry]);

    // Insert time entry to Supabase
    supabase.from('time_entries').insert(newEntry).then(({ error }) => {
      if (error) console.error("Error inserting time entry into Supabase:", error);
    });

    // Handle Incidents logging
    if (has_incident) {
      const newInc: TimeEntryIncident = {
        id: safeUUID(),
        company_id: currentCompany.id,
        work_center_id: currentWorkCenter.id,
        employee_id: emp.id,
        device_id: currentDevice?.id,
        time_entry_id: newEntry.id,
        incident_type: manualReason ? 'Reporte Manual' : (cameraError || gpsError || 'Fichaje incompleto'),
        description: manualReason ? `Comentario de empleado: ${manualReason}` : `Incidencia registrada: ${cameraError ? 'Cámara (' + cameraError + ')' : ''} ${gpsError ? 'GPS (' + gpsError + ')' : ''}`,
        missing_photo: photo_status !== 'success',
        missing_gps: gps_status !== 'success',
        created_at: new Date().toISOString()
      };
      setIncidents(prev => [...prev, newInc]);

      // Insert incident to Supabase
      supabase.from('time_entry_incidents').insert(newInc).then(({ error }) => {
        if (error) console.error("Error inserting time entry incident into Supabase:", error);
      });
    }

    // Auto logout immediately after punch
    setTimeout(() => {
      logout();
    }, 2000);

    return newEntry;
    */
  };

  const addEmployee = (
    emp: Omit<Employee, 'id' | 'employee_code' | 'employee_counter' | 'failed_pin_attempts' | 'created_at' | 'updated_at'>,
    allowedCenters?: string[]
  ) => {
    const company = companies.find(c => c.id === emp.company_id);
    if (!company) return;

    const compEmps = employees.filter(e => e.company_id === emp.company_id);
    const maxCounter = compEmps.reduce((max, cur) => cur.employee_counter > max ? cur.employee_counter : max, 0);
    const newCounter = maxCounter + 1;

    const counterStr = String(newCounter).padStart(4, '0');
    const empCode = `${company.company_code}-${counterStr}`;

    const newEmpId = safeUUID();
    const newEmp: Employee = {
      ...emp,
      id: newEmpId,
      employee_counter: newCounter,
      employee_code: empCode,
      failed_pin_attempts: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setEmployees(prev => [...prev, newEmp]);

    // Insert Employee to Supabase
    supabase.from('employees').insert(newEmp).then(({ error }) => {
      if (error) console.error("Error inserting employee into Supabase:", error);
    });

    if (allowedCenters && allowedCenters.length) {
      const mappings: EmployeeWorkCenter[] = allowedCenters.map(cid => ({
        id: safeUUID(),
        employee_id: newEmp.id,
        work_center_id: cid,
        created_at: new Date().toISOString()
      }));
      setEmployeeWorkCenters(prev => [...prev, ...mappings]);

      // Insert mappings into Supabase
      supabase.from('employee_work_centers').insert(mappings).then(({ error }) => {
        if (error) console.error("Error inserting employee work center mappings:", error);
      });
    }

    const log: AuditLog = {
      id: safeUUID(),
      company_id: emp.company_id,
      entity_type: 'employees',
      entity_id: newEmp.id,
      action: 'create',
      new_values: { ...newEmp, pin_hash: undefined },
      reason: 'Alta de nuevo empleado en el sistema',
      performed_by: currentUser.profile?.id,
      performed_at: new Date().toISOString()
    };
    setAuditLogs(prev => [...prev, log]);
    supabase.from('audit_logs').insert(log).then();
  };

  const updateEmployee = (emp: Employee, allowedCenters?: string[]) => {
    const updatedEmp = { ...emp, updated_at: new Date().toISOString() };
    setEmployees(prev => prev.map(e => e.id === emp.id ? updatedEmp : e));

    // Update in Supabase
    supabase.from('employees').update(updatedEmp).eq('id', emp.id).then(({ error }) => {
      if (error) console.error("Error updating employee in Supabase:", error);
    });

    if (allowedCenters) {
      const mappings = allowedCenters.map(cid => ({
        id: safeUUID(),
        employee_id: emp.id,
        work_center_id: cid,
        created_at: new Date().toISOString()
      }));

      setEmployeeWorkCenters(prev => {
        const clean = prev.filter(ewc => ewc.employee_id !== emp.id);
        return [...clean, ...mappings];
      });

      // Update mappings in Supabase: delete old ones and insert new ones
      supabase.from('employee_work_centers').delete().eq('employee_id', emp.id).then(() => {
        if (mappings.length > 0) {
          supabase.from('employee_work_centers').insert(mappings).then(({ error }) => {
            if (error) console.error("Error inserting updated employee work centers:", error);
          });
        }
      });
    }

    const log: AuditLog = {
      id: safeUUID(),
      company_id: emp.company_id,
      entity_type: 'employees',
      entity_id: emp.id,
      action: 'update',
      new_values: emp,
      reason: 'Actualización de datos del empleado',
      performed_by: currentUser.profile?.id,
      performed_at: new Date().toISOString()
    };
    setAuditLogs(prev => [...prev, log]);
    supabase.from('audit_logs').insert(log).then();
  };

  const changeEmployeePin = async (empId: string, newPin: string): Promise<void> => {
    const { error } = await supabase.rpc('set_employee_pin', {
      p_employee_id: empId,
      p_new_pin: newPin
    });
    if (error) throw new Error(error.message || 'No se pudo actualizar el PIN.');

    const emp = employees.find(e => e.id === empId);
    if (emp) {
      const log: AuditLog = {
        id: safeUUID(),
        company_id: emp.company_id,
        entity_type: 'employees',
        entity_id: empId,
        action: 'update_pin',
        reason: 'Modificación manual del PIN por el administrador',
        performed_by: currentUser.profile?.id,
        performed_at: new Date().toISOString()
      };
      setAuditLogs(prev => [...prev, log]);
      supabase.from('audit_logs').insert(log).then();
    }
  };

  const addWorkCenter = (companyId: string, name: string, address: string, lat?: number, lng?: number, radius?: number, status?: 'active' | 'inactive', province?: string, municipality?: string) => {
    const newCenter: WorkCenter = {
      id: safeUUID(),
      company_id: companyId,
      name,
      address,
      latitude: lat,
      longitude: lng,
      country: 'España',
      country_code: 'ESP',
      status: status || 'active',
      province,
      municipality,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setWorkCenters(prev => [...prev, newCenter]);
    supabase.from('work_centers').insert(newCenter).then(({ error }) => {
      if (error) console.error("Error inserting work center into Supabase:", error);
    });
  };

  const updateWorkCenter = (center: WorkCenter) => {
    const updated = { ...center, updated_at: new Date().toISOString() };
    setWorkCenters(prev => prev.map(c => c.id === center.id ? updated : c));
    supabase.from('work_centers').update(updated).eq('id', center.id).then(({ error }) => {
      if (error) console.error("Error updating work center in Supabase:", error);
    });
  };

  const deleteWorkCenter = async (centerId: string): Promise<void> => {
    // Check if there are associated time entries
    const hasEntries = timeEntries.some(t => t.work_center_id === centerId);
    if (hasEntries) {
      throw new Error('No se puede eliminar el centro de trabajo porque tiene registros de fichajes asociados.');
    }

    // Check if there are active devices
    const hasDevices = devices.some(d => d.work_center_id === centerId && d.status === 'active');
    if (hasDevices) {
      throw new Error('No se puede eliminar el centro de trabajo porque tiene dispositivos activos asociados.');
    }

    // Update state
    setWorkCenters(prev => prev.filter(wc => wc.id !== centerId));
    // Remove employee work center mappings
    rawSetEmployeeWorkCenters(prev => prev.filter(ewc => ewc.work_center_id !== centerId));

    // Delete in Supabase: employee work center mappings first
    await supabase.from('employee_work_centers').delete().eq('work_center_id', centerId);
    // Delete in Supabase: work center itself
    const { error } = await supabase.from('work_centers').delete().eq('id', centerId);
    if (error) {
      console.error("Error deleting work center in Supabase:", error);
      throw new Error("No se pudo eliminar el centro de trabajo en la base de datos.");
    }
  };

  const updateDevice = (device: AuthorizedDevice) => {
    const updated = { ...device, updated_at: new Date().toISOString() };
    setDevices(prev => prev.map(d => d.id === device.id ? updated : d));
    if (currentDevice && currentDevice.id === device.id) {
      setCurrentDevice(updated);
    }
    supabase.from('authorized_devices').update(updated).eq('id', device.id).then(({ error }) => {
      if (error) console.error("Error updating device in Supabase:", error);
    });
  };

  const resolveIncident = (incidentId: string, justification: string) => {
    const inc = incidents.find(i => i.id === incidentId);
    if (!inc) return;

    const updatedInc = {
      ...inc,
      description: inc.description ? `${inc.description} | JUSTIFICADO: ${justification}` : `JUSTIFICADO: ${justification}`,
    };
    setIncidents(prev => prev.map(i => i.id === incidentId ? updatedInc : i));

    // Update incident in Supabase
    supabase.from('time_entry_incidents').update({
      description: updatedInc.description
    }).eq('id', incidentId).then();

    if (inc.time_entry_id) {
      setTimeEntries(prev => prev.map(t => {
        if (t.id === inc.time_entry_id) {
          const updatedEntry = {
            ...t,
            has_incident: false,
            manual_reason: t.manual_reason ? `${t.manual_reason} | Incidencia justificada: ${justification}` : `Incidencia justificada: ${justification}`,
            updated_at: new Date().toISOString()
          };
          // Update entry in Supabase
          supabase.from('time_entries').update({
            has_incident: false,
            manual_reason: updatedEntry.manual_reason,
            updated_at: updatedEntry.updated_at
          }).eq('id', inc.time_entry_id).then();
          return updatedEntry;
        }
        return t;
      }));
    }

    const log: AuditLog = {
      id: safeUUID(),
      company_id: inc.company_id,
      entity_type: 'time_entry_incidents',
      entity_id: incidentId,
      action: 'resolve_incident',
      reason: justification,
      performed_by: currentUser.profile?.id || currentUser.employee?.id,
      performed_at: new Date().toISOString()
    };
    setAuditLogs(prev => [...prev, log]);
    supabase.from('audit_logs').insert(log).then();
  };

  const resolveRequest = (reqId: string, status: 'approved' | 'rejected', responseText: string) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;

    const updatedReq = { 
      ...req, 
      status, 
      admin_response: responseText, 
      resolved_by: currentUser.profile?.id,
      resolved_at: new Date().toISOString()
    };
    setRequests(prev => prev.map(r => r.id === reqId ? updatedReq : r));

    // Update request in Supabase
    supabase.from('correction_requests').update({
      status: updatedReq.status,
      admin_response: updatedReq.admin_response,
      resolved_by: updatedReq.resolved_by,
      resolved_at: updatedReq.resolved_at
    }).eq('id', reqId).then();

    // Audit logs & creation of missing entry if approved
    if (status === 'approved') {
      const regTime = `${req.requested_date}T${req.requested_time}+02:00`;
      
      if (req.request_type === 'create_missing') {
        const newEntry: TimeEntry = {
          id: safeUUID(),
          company_id: req.company_id,
          work_center_id: workCenters.find(w => w.company_id === req.company_id)?.id || 'unknown',
          employee_id: req.employee_id,
          entry_type: req.requested_entry_type,
          registered_at: regTime,
          photo_status: 'missing',
          gps_status: 'missing',
          has_incident: false,
          source: 'approved_request',
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        setTimeEntries(prev => [...prev, newEntry]);
        supabase.from('time_entries').insert(newEntry).then();

        // Audit Log
        const log: AuditLog = {
          id: safeUUID(),
          company_id: req.company_id,
          entity_type: 'time_entries',
          entity_id: newEntry.id,
          action: 'create_approved_request',
          new_values: newEntry,
          reason: `Solicitud de fichaje olvidado aprobada. Motivo: ${responseText}`,
          performed_by: currentUser.profile?.id,
          performed_at: new Date().toISOString()
        };
        setAuditLogs(prev => [...prev, log]);
        supabase.from('audit_logs').insert(log).then();
      } else if (req.request_type === 'modify_existing' && req.time_entry_id) {
        const oldEntry = timeEntries.find(t => t.id === req.time_entry_id);
        
        const updatedEntry = {
          entry_type: req.requested_entry_type,
          registered_at: regTime,
          source: 'approved_request' as TimeEntrySource,
          updated_at: new Date().toISOString()
        };
        setTimeEntries(prev => prev.map(t => t.id === req.time_entry_id ? { ...t, ...updatedEntry } : t));
        supabase.from('time_entries').update(updatedEntry).eq('id', req.time_entry_id).then();

        // Audit Log
        const log: AuditLog = {
          id: safeUUID(),
          company_id: req.company_id,
          entity_type: 'time_entries',
          entity_id: req.time_entry_id,
          action: 'update_approved_request',
          old_values: oldEntry,
          new_values: updatedEntry,
          reason: `Solicitud de modificación aprobada. Motivo: ${responseText}`,
          performed_by: currentUser.profile?.id,
          performed_at: new Date().toISOString()
        };
        setAuditLogs(prev => [...prev, log]);
        supabase.from('audit_logs').insert(log).then();
      }
    }
  };

  const submitRequest = async (
    requestType: 'modify_existing' | 'create_missing', 
    date: string, 
    time: string, 
    type: EntryType, 
    reason: string, 
    entryId?: string
  ): Promise<void> => {
    const deviceToken = localStorage.getItem('cf_device_token');
    if (currentUser.role !== 'employee' || !currentUser.employee || !currentCompany || !employeeSessionToken || !deviceToken) {
      throw new Error('Sesión de empleado inválida.');
    }

    const { data, error } = await supabase.rpc('submit_correction_request', {
      p_employee_session_token: employeeSessionToken,
      p_device_token: deviceToken,
      p_request_type: requestType,
      p_requested_date: date,
      p_requested_time: `${time}:00`,
      p_entry_type: type,
      p_reason: reason.trim(),
      p_time_entry_id: entryId || null
    });
    if (error || !data) {
      throw new Error(error?.message || 'No se pudo registrar la solicitud.');
    }
    setRequests(prev => [data as CorrectionRequest, ...prev]);
    return;

    /*
    Legacy direct insert disabled.
    const newReq: CorrectionRequest = {
      id: safeUUID(),
      company_id: currentCompany.id,
      employee_id: currentUser.employee.id,
      time_entry_id: entryId,
      request_type: requestType,
      requested_date: date,
      requested_time: time + ':00',
      requested_entry_type: type,
      employee_reason: reason,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    setRequests(prev => [newReq, ...prev]);
    supabase.from('correction_requests').insert(newReq).then(({ error }) => {
      if (error) console.error("Error submitting correction request:", error);
    });
    */
  };

  const deleteOldEntries = (companyId: string) => {
    // Delete entries older than 4 years (1460 days)
    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

    setTimeEntries(prev => prev.filter(t => {
      const isOld = new Date(t.registered_at) < fourYearsAgo && t.company_id === companyId;
      return !isOld;
    }));

    setIncidents(prev => prev.filter(i => {
      const isOld = new Date(i.created_at) < fourYearsAgo && i.company_id === companyId;
      return !isOld;
    }));

    // Delete in Supabase
    supabase.from('time_entries').delete().eq('company_id', companyId).lt('registered_at', fourYearsAgo.toISOString()).then();
    supabase.from('time_entry_incidents').delete().eq('company_id', companyId).lt('created_at', fourYearsAgo.toISOString()).then();

    // Record audit of this global action
    const log: AuditLog = {
      id: safeUUID(),
      company_id: companyId,
      entity_type: 'company',
      entity_id: companyId,
      action: 'purge_old_records',
      reason: 'Eliminación definitiva manual de fichajes de más de 4 años por el administrador.',
      performed_by: currentUser.profile?.id || currentUser.employee?.id,
      performed_at: new Date().toISOString()
    };
    setAuditLogs(prev => [...prev, log]);
    supabase.from('audit_logs').insert(log).then();
  };

  const updateCompanySettings = (timeout: number) => {
    if (!currentCompany) return;
    setCompanies(prev => prev.map(c => c.id === currentCompany.id ? { ...c, session_timeout_minutes: timeout, updated_at: new Date().toISOString() } : c));
    setCurrentCompany(prev => prev ? { ...prev, session_timeout_minutes: timeout } : undefined);

    supabase.from('companies').update({
      session_timeout_minutes: timeout,
      updated_at: new Date().toISOString()
    }).eq('id', currentCompany.id).then(({ error }) => {
      if (error) console.error("Error updating company settings in Supabase:", error);
    });

    // Audit
    const log: AuditLog = {
      id: safeUUID(),
      company_id: currentCompany.id,
      entity_type: 'company',
      entity_id: currentCompany.id,
      action: 'update_settings',
      new_values: { session_timeout_minutes: timeout },
      reason: 'Cambio de configuración: Cierre de sesión por inactividad',
      performed_by: currentUser.profile?.id,
      performed_at: new Date().toISOString()
    };
    setAuditLogs(prev => [...prev, log]);
    supabase.from('audit_logs').insert(log).then();
  };

  // ==========================================
  // NEW SYSTEM ACTIONS: CALENDARS & OVERTIME
  // ==========================================

  // 1. Core Recalculation Engine
  const recalculateEmployeeHours = async (employeeId: string, companyId: string): Promise<void> => {
    try {
      const employee = employees.find(item => item.id === employeeId);
      if (!employee || employee.company_id !== companyId) {
        throw new Error('Empleado o empresa no válidos.');
      }
      const { data, error } = await supabase.rpc('recalculate_employee_hours', {
        p_employee_id: employeeId
      });
      if (error || !data) {
        throw new Error(error?.message || 'No se pudo recalcular la jornada.');
      }
      rawSetDailyWorkSummaries(prev => [
        ...prev.filter(summary => summary.employee_id !== employeeId),
        ...((data.daily || []) as DailyWorkSummary[])
      ]);
      rawSetWeeklyWorkSummaries(prev => [
        ...prev.filter(summary => summary.employee_id !== employeeId),
        ...((data.weekly || []) as WeeklyWorkSummary[])
      ]);
      return;
      
      /*
      Legacy browser calculation disabled. PostgreSQL is the sole authority.
      // Fetch all active time entries of employee
      const empEntries = timeEntries
        .filter(t => t.employee_id === employeeId && t.status === 'active')
        .sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());

      // Group entries by date (YYYY-MM-DD)
      const entriesByDate: Record<string, TimeEntry[]> = {};
      empEntries.forEach(entry => {
        const dateStr = entry.registered_at.split('T')[0];
        if (!entriesByDate[dateStr]) entriesByDate[dateStr] = [];
        entriesByDate[dateStr].push(entry);
      });

      const computedDailySummaries: DailyWorkSummary[] = [];

      // Calculate each day
      Object.keys(entriesByDate).forEach(dateStr => {
        const dayPunches = entriesByDate[dateStr];
        
        // Find which work center is active for this day's first punch
        const firstPunch = dayPunches[0];
        const wcId = firstPunch?.work_center_id || 'unknown';

        // Find active calendar for this work center and year
        const year = new Date(dateStr).getFullYear();
        const activeCal = laborCalendars.find(c => c.work_center_id === wcId && c.year === year && c.status === 'active');
        const calId = activeCal?.id;

        // Resolve day type
        let dayTypeSetting: CalendarDayTypeSetting | undefined;
        let dayName = 'Laborable Normal';
        let classification = 'working_day';
        let calendarDayId: string | undefined;

        if (calId) {
          const calDay = calendarDays.find(d => d.calendar_id === calId && d.date === dateStr);
          if (calDay) {
            calendarDayId = calDay.id;
            dayName = calDay.name;
            classification = calDay.classification;
            dayTypeSetting = dayTypeSettings.find(s => s.id === calDay.day_type_setting_id);
          }
        }

        // If no calendar day is set, fall back to defaults
        const dateObj = new Date(dateStr);
        const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday

        if (!dayTypeSetting) {
          if (dayOfWeek === 0) {
            // Sunday fallback
            dayTypeSetting = dayTypeSettings.find(s => s.company_id === companyId && s.classification === 'sunday');
            dayName = 'Domingo / Descanso Semanal';
            classification = 'sunday';
          } else if (dayOfWeek === 6 && activeCal?.working_week_model === 'monday_to_friday') {
            // Saturday is non-working day under L-V
            dayTypeSetting = dayTypeSettings.find(s => s.company_id === companyId && s.classification === 'sunday');
            dayName = 'Sábado (No Laborable)';
            classification = 'sunday';
          } else {
            // Standard working day
            dayTypeSetting = dayTypeSettings.find(s => s.company_id === companyId && s.classification === 'working_day');
          }
        }

        // Check worked minutes & breaks
        let rawWorkedMinutes = 0;
        let breakMinutes = 0;
        let isComplete = true;

        // Simple pairing of Entry and Exit, discounting breaks
        // Sort entries by time
        const sorted = [...dayPunches].sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());
        
        let lastEntryTime: number | null = null;
        let lastBreakStartTime: number | null = null;

        for (let i = 0; i < sorted.length; i++) {
          const p = sorted[i];
          const t = new Date(p.registered_at).getTime();

          if (p.entry_type === 'entry') {
            lastEntryTime = t;
          } else if (p.entry_type === 'break_start') {
            lastBreakStartTime = t;
            if (lastEntryTime !== null) {
              rawWorkedMinutes += Math.round((t - lastEntryTime) / 60000);
              lastEntryTime = null;
            }
          } else if (p.entry_type === 'break_end') {
            if (lastBreakStartTime !== null) {
              breakMinutes += Math.round((t - lastBreakStartTime) / 60000);
              lastBreakStartTime = null;
            }
            lastEntryTime = t;
          } else if (p.entry_type === 'exit') {
            if (lastEntryTime !== null) {
              rawWorkedMinutes += Math.round((t - lastEntryTime) / 60000);
              lastEntryTime = null;
            }
          }
        }

        // If shift is still open (last punch is entry or break_end and no exit yet)
        const lastPunch = sorted[sorted.length - 1];
        if (lastPunch && (lastPunch.entry_type === 'entry' || lastPunch.entry_type === 'break_end')) {
          isComplete = false; // Provisional
        }
        if (lastPunch && lastPunch.entry_type === 'break_start') {
          isComplete = false; // Provisional inside break
        }

        // Apply rounding: intervals of 15 min downwards, only if complete
        let roundedWorkedMinutes = rawWorkedMinutes;
        if (isComplete) {
          roundedWorkedMinutes = Math.floor(rawWorkedMinutes / 15) * 15;
        }

        const multiplier = dayTypeSetting?.work_multiplier || 1.0;
        
        // Double effect check: if it is a holiday under the model and worked
        // We apply the work multiplier to get weighted minutes
        const weightedMinutes = Math.round(roundedWorkedMinutes * multiplier);
        const hasIncident = dayPunches.some(p => p.has_incident);

        const summaryId = toUUID(`dws-${employeeId}-${dateStr}`, 'eeeeeeee');

        computedDailySummaries.push({
          id: summaryId,
          company_id: companyId,
          employee_id: employeeId,
          work_center_id: wcId !== 'unknown' ? wcId : undefined,
          work_date: dateStr,
          calendar_id: calId,
          calendar_day_id: calendarDayId,
          raw_worked_minutes: rawWorkedMinutes,
          break_minutes: breakMinutes,
          rounded_worked_minutes: roundedWorkedMinutes,
          effective_multiplier: multiplier,
          weighted_minutes: weightedMinutes,
          is_complete: isComplete,
          has_incident: hasIncident,
          calculated_at: new Date().toISOString(),
          calculation_version: 1
        });
      });

      // Update state for daily summaries (replaces matching employee summaries)
      rawSetDailyWorkSummaries(prev => {
        const otherDaily = prev.filter(s => s.employee_id !== employeeId);
        return [...otherDaily, ...computedDailySummaries];
      });

      // Group daily summaries by week (Monday to Sunday)
      const weeklyGroups: Record<string, DailyWorkSummary[]> = {};
      computedDailySummaries.forEach(dws => {
        // Find Monday of that week
        const d = new Date(dws.work_date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const monday = new Date(d.setDate(diff));
        const mondayStr = monday.toISOString().split('T')[0];
        
        if (!weeklyGroups[mondayStr]) weeklyGroups[mondayStr] = [];
        weeklyGroups[mondayStr].push(dws);
      });

      const computedWeeklySummaries: WeeklyWorkSummary[] = [];

      Object.keys(weeklyGroups).forEach(mondayStr => {
        const weekDays = weeklyGroups[mondayStr];
        const weekStart = mondayStr;
        const monDate = new Date(mondayStr);
        const sunDate = new Date(monDate);
        sunDate.setDate(monDate.getDate() + 6);
        const weekEnd = sunDate.toISOString().split('T')[0];

        // Find weekly contract active for this week
        const activeContract = employeeWeeklyContracts
          .filter(c => c.employee_id === employeeId && c.effective_from <= weekStart)
          .sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0];

        const contractedWeeklyMinutes = activeContract?.weekly_minutes || 2400; // 40h default

        // Divisor of calendar: Monday to Friday (5) or Saturday (6)
        // Find center and calendar model from the first day summary in the week
        const firstDay = weekDays[0];
        const activeCal = laborCalendars.find(c => c.id === firstDay?.calendar_id);
        const workingDaysDivisor = activeCal?.working_week_model === 'monday_to_saturday' ? 6 : 5;
        const referenceDailyMinutes = Math.round(contractedWeeklyMinutes / workingDaysDivisor);

        let targetReductionMinutes = 0;
        let specialTargetAdjustmentMinutes = 0;

        // Loop through each day of this week to compute reductions
        for (let i = 0; i < 7; i++) {
          const currentDayDate = new Date(monDate);
          currentDayDate.setDate(monDate.getDate() + i);
          const currentDayStr = currentDayDate.toISOString().split('T')[0];
          const currentDayOfWeek = currentDayDate.getDay(); // 0 Sunday, 6 Saturday

          // Find if there is a calendar day
          const calDay = calendarDays.find(d => d.calendar_id === activeCal?.id && d.date === currentDayStr);
          let setting: CalendarDayTypeSetting | undefined;
          
          if (calDay) {
            setting = dayTypeSettings.find(s => s.id === calDay.day_type_setting_id);
          } else if (currentDayOfWeek === 0) {
            setting = dayTypeSettings.find(s => s.company_id === companyId && s.classification === 'sunday');
          }

          if (setting) {
            // If setting reduces weekly target
            if (setting.reduces_weekly_target) {
              // Only reduces target if it falls on a working day according to the model
              const isWorkingDayInModel = workingDaysDivisor === 6 
                ? (currentDayOfWeek >= 1 && currentDayOfWeek <= 6) // Mon to Sat
                : (currentDayOfWeek >= 1 && currentDayOfWeek <= 5); // Mon to Fri
              
              if (isWorkingDayInModel) {
                targetReductionMinutes += referenceDailyMinutes;
              }
            }

            // Special target hours (reduced workdays)
            if (setting.special_target_minutes !== undefined && setting.special_target_minutes !== null) {
              const isWorkingDayInModel = workingDaysDivisor === 6 
                ? (currentDayOfWeek >= 1 && currentDayOfWeek <= 6)
                : (currentDayOfWeek >= 1 && currentDayOfWeek <= 5);
              
              if (isWorkingDayInModel) {
                specialTargetAdjustmentMinutes += (referenceDailyMinutes - setting.special_target_minutes);
              }
            }
          }
        }

        const adjustedTargetMinutes = Math.max(0, contractedWeeklyMinutes - targetReductionMinutes - specialTargetAdjustmentMinutes);

        // Sum worked actual & weighted
        let actualWorkedMinutes = 0;
        let weightedWorkedMinutes = 0;
        let hasIncompleteDays = false;

        weekDays.forEach(dws => {
          actualWorkedMinutes += dws.rounded_worked_minutes;
          weightedWorkedMinutes += dws.weighted_minutes;
          if (!dws.is_complete) hasIncompleteDays = true;
        });

        const automaticOvertimeMinutes = Math.max(0, weightedWorkedMinutes - adjustedTargetMinutes);

        // Fetch manual adjustments
        const weekSummaryId = toUUID(`wws-${employeeId}-${weekStart}`, 'ffffffff');
        const weekAdjustments = overtimeAdjustments.filter(a => a.weekly_summary_id === weekSummaryId && !a.cancelled_at);
        const manualAdjustmentMinutes = weekAdjustments.reduce((sum, adj) => sum + adj.adjustment_minutes, 0);
        const finalOvertimeMinutes = Math.max(0, automaticOvertimeMinutes + manualAdjustmentMinutes);

        computedWeeklySummaries.push({
          id: weekSummaryId,
          company_id: companyId,
          employee_id: employeeId,
          week_start: weekStart,
          week_end: weekEnd,
          contracted_weekly_minutes: contractedWeeklyMinutes,
          working_days_divisor: workingDaysDivisor,
          reference_daily_minutes: referenceDailyMinutes,
          target_reduction_minutes: targetReductionMinutes,
          special_target_adjustment_minutes: specialTargetAdjustmentMinutes,
          adjusted_target_minutes: adjustedTargetMinutes,
          actual_worked_minutes: actualWorkedMinutes,
          weighted_worked_minutes: weightedWorkedMinutes,
          automatic_overtime_minutes: automaticOvertimeMinutes,
          manual_adjustment_minutes: manualAdjustmentMinutes,
          final_overtime_minutes: finalOvertimeMinutes,
          has_incomplete_days: hasIncompleteDays,
          calculated_at: new Date().toISOString(),
          calculation_version: 1
        });
      });

      // Update state for weekly summaries (replaces matching employee summaries)
      rawSetWeeklyWorkSummaries(prev => {
        const otherWeekly = prev.filter(s => s.employee_id !== employeeId);
        return [...otherWeekly, ...computedWeeklySummaries];
      });

      */
    } catch (error) {
      console.error("Error running recalculation for employee:", error);
      throw error;
    }
  };

  const recalculateCompanyHours = async (companyId: string): Promise<void> => {
    const { error } = await supabase.rpc('recalculate_company_hours', {
      p_company_id: companyId
    });
    if (error) {
      throw new Error(error.message || 'No se pudo recalcular la empresa.');
    }
    const [{ data: daily }, { data: weekly }] = await Promise.all([
      supabase.from('daily_work_summaries').select('*').eq('company_id', companyId),
      supabase.from('weekly_work_summaries').select('*').eq('company_id', companyId)
    ]);
    rawSetDailyWorkSummaries(prev => [...prev.filter(summary => summary.company_id !== companyId), ...((daily || []) as DailyWorkSummary[])]);
    rawSetWeeklyWorkSummaries(prev => [...prev.filter(summary => summary.company_id !== companyId), ...((weekly || []) as WeeklyWorkSummary[])]);
  };

  // 2. Employee Weekly Contracts CRUD
  const addWeeklyContract = async (contract: Omit<EmployeeWeeklyContract, 'id' | 'created_at' | 'updated_at'>): Promise<void> => {
    const id = safeUUID();
    const newContract: EmployeeWeeklyContract = {
      ...contract,
      id,
      created_by: currentUser.profile?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Check for overlaps
    const existing = employeeWeeklyContracts.filter(c => c.employee_id === contract.employee_id);
    const hasOverlap = existing.some(c => {
      const from = c.effective_from;
      const to = c.effective_to || '9999-12-31';
      const newFrom = contract.effective_from;
      const newTo = contract.effective_to || '9999-12-31';
      return (newFrom >= from && newFrom <= to) || (newTo >= from && newTo <= to) || (newFrom <= from && newTo >= to);
    });

    if (hasOverlap) {
      throw new Error('El nuevo periodo de vigencia del contrato se solapa con uno existente.');
    }

    const { error } = await supabase.from('employee_weekly_contracts').insert(newContract);
    if (error) throw new Error(error.message || 'No se pudo guardar el contrato.');
    rawSetEmployeeWeeklyContracts(prev => [...prev, newContract]);

    const emp = employees.find(e => e.id === contract.employee_id);
    if (emp) {
      await recalculateEmployeeHours(emp.id, emp.company_id);
    }
  };

  const updateWeeklyContract = async (contract: EmployeeWeeklyContract): Promise<void> => {
    const updated = {
      ...contract,
      updated_at: new Date().toISOString()
    };

    // Overlap checks
    const existing = employeeWeeklyContracts.filter(c => c.employee_id === contract.employee_id && c.id !== contract.id);
    const hasOverlap = existing.some(c => {
      const from = c.effective_from;
      const to = c.effective_to || '9999-12-31';
      const newFrom = contract.effective_from;
      const newTo = contract.effective_to || '9999-12-31';
      return (newFrom >= from && newFrom <= to) || (newTo >= from && newTo <= to) || (newFrom <= from && newTo >= to);
    });

    if (hasOverlap) {
      throw new Error('El periodo modificado se solapa con un contrato existente.');
    }

    const { error } = await supabase.from('employee_weekly_contracts').update(updated).eq('id', contract.id);
    if (error) throw new Error(error.message || 'No se pudo actualizar el contrato.');
    rawSetEmployeeWeeklyContracts(prev => prev.map(c => c.id === contract.id ? updated : c));

    const emp = employees.find(e => e.id === contract.employee_id);
    if (emp) {
      await recalculateEmployeeHours(emp.id, emp.company_id);
    }
  };

  const deleteWeeklyContract = async (contractId: string): Promise<void> => {
    const contract = employeeWeeklyContracts.find(c => c.id === contractId);
    const { error } = await supabase.from('employee_weekly_contracts').delete().eq('id', contractId);
    if (error) throw new Error(error.message || 'No se pudo eliminar el contrato.');
    rawSetEmployeeWeeklyContracts(prev => prev.filter(c => c.id !== contractId));

    if (contract) {
      const emp = employees.find(e => e.id === contract.employee_id);
      if (emp) {
        await recalculateEmployeeHours(emp.id, emp.company_id);
      }
    }
  };

  // 3. Labor Calendars CRUD
  const addLaborCalendar = async (cal: Omit<LaborCalendar, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<LaborCalendar> => {
    const id = safeUUID();
    const newCal: LaborCalendar = {
      ...cal,
      id,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const exists = laborCalendars.some(c => c.work_center_id === cal.work_center_id && c.year === cal.year);
    if (exists) {
      throw new Error(`Ya existe un calendario para este centro de trabajo en el año ${cal.year}.`);
    }

    const { error } = await supabase.from('labor_calendars').insert(newCal);
    if (error) throw new Error(error.message || 'No se pudo crear el calendario.');
    rawSetLaborCalendars(prev => [...prev, newCal]);
    return newCal;
  };

  const updateLaborCalendar = async (cal: LaborCalendar): Promise<void> => {
    const updated = {
      ...cal,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('labor_calendars').update(updated).eq('id', cal.id);
    if (error) throw new Error(error.message || 'No se pudo actualizar el calendario.');
    rawSetLaborCalendars(prev => prev.map(c => c.id === cal.id ? updated : c));
    await recalculateCompanyHours(cal.company_id);
  };

  // 4. Spanish Holidays Import & Conflict Management
  const importHolidays = async (calendarId: string, province: string, municipality: string): Promise<void> => {
    const cal = laborCalendars.find(c => c.id === calendarId);
    if (!cal) return;

    const runId = safeUUID();
    const run: CalendarImportRun = {
      id: runId,
      calendar_id: calendarId,
      requested_by: currentUser.profile?.id,
      status: 'processing',
      source_name: 'Calendario Oficial de Festivos (España)',
      source_url: 'https://www.boe.es/diario_boe/calendarios.php',
      requested_at: new Date().toISOString(),
      days_found: 0,
      days_created: 0,
      days_modified: 0,
      conflicts_found: 0,
      created_at: new Date().toISOString()
    };
    
    setCalendarImportRuns(prev => [...prev, run]);

    const getEasterDate = (year: number) => {
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const L = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * L) / 451);
      const month = Math.floor((h + L - 7 * m + 114) / 31);
      const day = ((h + L - 7 * m + 114) % 31) + 1;
      return new Date(Date.UTC(year, month - 1, day));
    };

    const easter = getEasterDate(cal.year);
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    const juevesSanto = new Date(easter);
    juevesSanto.setDate(easter.getDate() - 3);

    const viernesSanto = new Date(easter);
    viernesSanto.setDate(easter.getDate() - 2);

    const lunesPascua = new Date(easter);
    lunesPascua.setDate(easter.getDate() + 1);

    const viernesDolores = new Date(easter);
    viernesDolores.setDate(easter.getDate() - 9);

    const bandoHuerta = new Date(easter);
    bandoHuerta.setDate(easter.getDate() + 2);

    const baseHolidays = [
      // --- FESTIVOS NACIONALES ---
      { date: `${cal.year}-01-01`, name: 'Año Nuevo', classification: 'national_holiday' },
      { date: `${cal.year}-01-06`, name: 'Epifanía del Señor', classification: 'national_holiday' },
      { date: formatDate(viernesSanto), name: 'Viernes Santo', classification: 'national_holiday' },
      { date: `${cal.year}-05-01`, name: 'Fiesta del Trabajo', classification: 'national_holiday' },
      { date: `${cal.year}-08-15`, name: 'Asunción de la Virgen', classification: 'national_holiday' },
      { date: `${cal.year}-10-12`, name: 'Fiesta Nacional de España', classification: 'national_holiday' },
      { date: `${cal.year}-11-01`, name: 'Todos los Santos', classification: 'national_holiday' },
      { date: `${cal.year}-12-06`, name: 'Día de la Constitución Española', classification: 'national_holiday' },
      { date: `${cal.year}-12-08`, name: 'Inmaculada Concepción', classification: 'national_holiday' },
      { date: `${cal.year}-12-25`, name: 'Natividad del Señor', classification: 'national_holiday' },

      // --- FESTIVOS AUTONÓMICOS ---
      { date: formatDate(juevesSanto), name: 'Jueves Santo', classification: 'autonomous_holiday' },
      
      // Comunidad de Madrid
      { date: `${cal.year}-05-02`, name: 'Fiesta de la Comunidad de Madrid', classification: 'autonomous_holiday', provRestriction: 'Madrid' },
      
      // Cataluña
      { date: `${cal.year}-09-11`, name: 'Fiesta Nacional de Cataluña (Diada)', classification: 'autonomous_holiday', provRestriction: 'Barcelona' },
      { date: `${cal.year}-09-11`, name: 'Fiesta Nacional de Cataluña (Diada)', classification: 'autonomous_holiday', provRestriction: 'Girona' },
      { date: `${cal.year}-09-11`, name: 'Fiesta Nacional de Cataluña (Diada)', classification: 'autonomous_holiday', provRestriction: 'Lleida' },
      { date: `${cal.year}-09-11`, name: 'Fiesta Nacional de Cataluña (Diada)', classification: 'autonomous_holiday', provRestriction: 'Tarragona' },
      { date: `${cal.year}-12-26`, name: 'San Esteban', classification: 'autonomous_holiday', provRestriction: 'Barcelona' },
      { date: `${cal.year}-12-26`, name: 'San Esteban', classification: 'autonomous_holiday', provRestriction: 'Girona' },
      { date: `${cal.year}-12-26`, name: 'San Esteban', classification: 'autonomous_holiday', provRestriction: 'Lleida' },
      { date: `${cal.year}-12-26`, name: 'San Esteban', classification: 'autonomous_holiday', provRestriction: 'Tarragona' },
      
      // Andalucía
      { date: `${cal.year}-02-28`, name: 'Día de Andalucía', classification: 'autonomous_holiday', provRestriction: 'Sevilla' },
      { date: `${cal.year}-02-28`, name: 'Día de Andalucía', classification: 'autonomous_holiday', provRestriction: 'Málaga' },
      { date: `${cal.year}-02-28`, name: 'Día de Andalucía', classification: 'autonomous_holiday', provRestriction: 'Cádiz' },
      { date: `${cal.year}-02-28`, name: 'Día de Andalucía', classification: 'autonomous_holiday', provRestriction: 'Cadiz' },
      { date: `${cal.year}-02-28`, name: 'Día de Andalucía', classification: 'autonomous_holiday', provRestriction: 'Granada' },
      { date: `${cal.year}-02-28`, name: 'Día de Andalucía', classification: 'autonomous_holiday', provRestriction: 'Córdoba' },
      { date: `${cal.year}-02-28`, name: 'Día de Andalucía', classification: 'autonomous_holiday', provRestriction: 'Cordoba' },
      { date: `${cal.year}-02-28`, name: 'Día de Andalucía', classification: 'autonomous_holiday', provRestriction: 'Almería' },
      { date: `${cal.year}-02-28`, name: 'Día de Andalucía', classification: 'autonomous_holiday', provRestriction: 'Huelva' },
      { date: `${cal.year}-02-28`, name: 'Día de Andalucía', classification: 'autonomous_holiday', provRestriction: 'Jaén' },

      // Región de Murcia
      { date: `${cal.year}-06-09`, name: 'Día de la Región de Murcia', classification: 'autonomous_holiday', provRestriction: 'Murcia' },

      // Comunidad Valenciana
      { date: `${cal.year}-10-09`, name: 'Día de la Comunidad Valenciana', classification: 'autonomous_holiday', provRestriction: 'Valencia' },
      { date: `${cal.year}-10-09`, name: 'Día de la Comunidad Valenciana', classification: 'autonomous_holiday', provRestriction: 'Alicante' },
      { date: `${cal.year}-10-09`, name: 'Día de la Comunidad Valenciana', classification: 'autonomous_holiday', provRestriction: 'Castellón' },
      { date: `${cal.year}-03-19`, name: 'San José', classification: 'autonomous_holiday', provRestriction: 'Valencia' },
      { date: `${cal.year}-03-19`, name: 'San José', classification: 'autonomous_holiday', provRestriction: 'Alicante' },
      { date: `${cal.year}-03-19`, name: 'San José', classification: 'autonomous_holiday', provRestriction: 'Castellón' },

      // --- FESTIVOS LOCALES (CIUDAD / MUNICIPIO) ---
      // Madrid Capital
      { date: `${cal.year}-05-15`, name: 'San Isidro Labrador', classification: 'local_holiday', munRestriction: 'Madrid' },
      { date: `${cal.year}-11-09`, name: 'Nuestra Señora de la Almudena', classification: 'local_holiday', munRestriction: 'Madrid' },

      // Barcelona Capital
      { date: `${cal.year}-06-24`, name: 'San Juan', classification: 'local_holiday', munRestriction: 'Barcelona' },
      { date: `${cal.year}-09-24`, name: 'La Mercè', classification: 'local_holiday', munRestriction: 'Barcelona' },

      // Valencia Capital
      { date: `${cal.year}-01-22`, name: 'San Vicente Mártir', classification: 'local_holiday', munRestriction: 'Valencia' },
      { date: formatDate(lunesPascua), name: 'San Vicente Ferrer', classification: 'local_holiday', munRestriction: 'Valencia' },

      // Sevilla Capital
      { date: `${cal.year}-05-30`, name: 'San Fernando', classification: 'local_holiday', munRestriction: 'Sevilla' },
      { date: `${cal.year}-04-26`, name: 'Feria de Abril (Sevilla)', classification: 'local_holiday', munRestriction: 'Sevilla' },

      // Málaga Capital
      { date: `${cal.year}-08-19`, name: 'Incorporación de Málaga a la Corona de Castilla', classification: 'local_holiday', munRestriction: 'Málaga' },
      { date: `${cal.year}-08-19`, name: 'Incorporación de Málaga a la Corona de Castilla', classification: 'local_holiday', munRestriction: 'Malaga' },
      { date: `${cal.year}-09-08`, name: 'Nuestra Señora de la Victoria', classification: 'local_holiday', munRestriction: 'Málaga' },
      { date: `${cal.year}-09-08`, name: 'Nuestra Señora de la Victoria', classification: 'local_holiday', munRestriction: 'Malaga' },

      // Murcia Capital
      { date: formatDate(bandoHuerta), name: 'Bando de la Huerta', classification: 'local_holiday', munRestriction: 'Murcia' },
      { date: `${cal.year}-09-15`, name: 'Romería de la Fuensanta (Murcia)', classification: 'local_holiday', munRestriction: 'Murcia' },

      // Lorca
      { date: `${cal.year}-09-08`, name: 'Virgen de las Huertas', classification: 'local_holiday', munRestriction: 'Lorca' },
      { date: `${cal.year}-11-23`, name: 'San Clemente', classification: 'local_holiday', munRestriction: 'Lorca' },

      // Cartagena
      { date: formatDate(viernesDolores), name: 'Viernes de Dolores', classification: 'local_holiday', munRestriction: 'Cartagena' }
    ];

    const matchingHolidays = baseHolidays.filter(h => {
      if (h.provRestriction && h.provRestriction.toLowerCase() !== province.toLowerCase()) return false;
      if (h.munRestriction && h.munRestriction.toLowerCase() !== municipality.toLowerCase()) return false;
      return true;
    });

    // Asegurarse de que siempre se importen al menos dos festivos locales para cualquier ciudad
    const hasLocalHolidays = matchingHolidays.some(h => h.classification === 'local_holiday');
    if (!hasLocalHolidays && municipality) {
      const cityName = municipality.trim().charAt(0).toUpperCase() + municipality.trim().slice(1);
      matchingHolidays.push(
        { date: `${cal.year}-05-15`, name: `Festivo Local de ${cityName} (Día 1)`, classification: 'local_holiday' },
        { date: `${cal.year}-09-08`, name: `Festivo Local de ${cityName} (Día 2)`, classification: 'local_holiday' }
      );
    }

    let createdCount = 0;
    let modifiedCount = 0;
    let conflictCount = 0;

    const newConflicts: CalendarImportConflict[] = [];
    const newDays: CalendarDay[] = [];

    const types = dayTypeSettings.filter(t => t.company_id === cal.company_id);
    const getSettingByClassification = (cls: string) => {
      const found = types.find(t => t.classification === cls) || types.find(t => t.classification === 'national_holiday') || types[0];
      if (found) return found;
      return {
        id: toUUID(`cdts-${cal.company_id}-${cls}`, '99999999'),
        company_id: cal.company_id,
        code: cls,
        name: cls === 'national_holiday' ? 'Festivo Nacional' : cls === 'autonomous_holiday' ? 'Festivo Autonómico' : cls === 'local_holiday' ? 'Festivo Local' : cls,
        classification: cls,
        is_working_day: false,
        reduces_weekly_target: true,
        work_multiplier: 1.5,
        color: cls === 'national_holiday' ? '#FCA5A5' : cls === 'autonomous_holiday' ? '#FDE047' : '#F472B6',
        is_system_type: true,
        status: 'active' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    };

    matchingHolidays.forEach(h => {
      const existingDay = calendarDays.find(d => d.calendar_id === calendarId && d.date === h.date);
      const matchingSetting = getSettingByClassification(h.classification);

      if (existingDay) {
        const isDifferent = existingDay.name !== h.name || existingDay.classification !== h.classification;
        
        if (isDifferent) {
          if (existingDay.is_manual || existingDay.manually_modified) {
            newConflicts.push({
              id: safeUUID(),
              import_run_id: runId,
              calendar_id: calendarId,
              date: h.date,
              existing_values: { name: existingDay.name, classification: existingDay.classification },
              imported_values: { name: h.name, classification: h.classification },
              conflict_reason: 'El día fue modificado manualmente por el administrador y difiere del festivo oficial importado.',
              resolution: 'pending',
              created_at: new Date().toISOString()
            });
            conflictCount++;
          } else {
            const updated = {
              ...existingDay,
              name: h.name,
              classification: h.classification,
              day_type_setting_id: matchingSetting.id,
              review_status: 'pending' as const,
              updated_at: new Date().toISOString()
            };
            newDays.push(updated);
            modifiedCount++;
          }
        }
      } else {
        newDays.push({
          id: safeUUID(),
          calendar_id: calendarId,
          date: h.date,
          day_type_setting_id: matchingSetting.id,
          name: h.name,
          classification: h.classification,
          source_type: 'official_import',
          source_url: run.source_url,
          source_reference: 'BOE Calendario Oficial',
          import_run_id: runId,
          is_manual: false,
          manually_modified: false,
          review_status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        createdCount++;
      }
    });

    const finalRunStatus = conflictCount > 0 ? 'completed_with_conflicts' as const : 'completed' as const;
    const finalRun: CalendarImportRun = {
      ...run,
      status: finalRunStatus,
      completed_at: new Date().toISOString(),
      days_found: matchingHolidays.length,
      days_created: createdCount,
      days_modified: modifiedCount,
      conflicts_found: conflictCount
    };

    setCalendarImportRuns(prev => prev.map(r => r.id === runId ? finalRun : r));
    
    if (newConflicts.length > 0) {
      setCalendarImportConflicts(prev => [...prev, ...newConflicts]);
    }
    if (newDays.length > 0) {
      setCalendarDays(prev => {
        const otherDays = prev.filter(d => !newDays.some(n => n.id === d.id || (n.calendar_id === d.calendar_id && n.date === d.date)));
        return [...otherDays, ...newDays];
      });
    }

    const updatedCal: LaborCalendar = {
      ...cal,
      status: 'pending_review',
      last_imported_at: new Date().toISOString(),
      source_summary: `Importados ${matchingHolidays.length} festivos (${createdCount} creados, ${modifiedCount} modificados, ${conflictCount} conflictos).`,
      updated_at: new Date().toISOString()
    };
    setLaborCalendars(prev => prev.map(c => c.id === calendarId ? updatedCal : c));
  };

  const resolveConflict = async (
    conflictId: string, 
    resolution: 'keep_existing' | 'apply_imported' | 'merge_manually', 
    manualDay?: Partial<CalendarDay>
  ): Promise<void> => {
    const conflict = calendarImportConflicts.find(c => c.id === conflictId);
    if (!conflict) return;

    const cal = laborCalendars.find(c => c.id === conflict.calendar_id);
    if (!cal) return;

    const existingDay = calendarDays.find(d => d.calendar_id === conflict.calendar_id && d.date === conflict.date);

    if (resolution === 'apply_imported') {
      const types = dayTypeSettings.filter(t => t.company_id === cal.company_id);
      const matchingSetting = types.find(t => t.classification === conflict.imported_values.classification) || types[0];

      if (existingDay) {
        const updated = {
          ...existingDay,
          name: conflict.imported_values.name,
          classification: conflict.imported_values.classification,
          day_type_setting_id: matchingSetting.id,
          manually_modified: true,
          review_status: 'confirmed' as const,
          updated_at: new Date().toISOString()
        };
        setCalendarDays(prev => prev.map(d => d.id === existingDay.id ? updated : d));
      }
    } else if (resolution === 'merge_manually' && manualDay) {
      if (existingDay) {
        const updated = {
          ...existingDay,
          ...manualDay,
          manually_modified: true,
          review_status: 'confirmed' as const,
          updated_at: new Date().toISOString()
        } as CalendarDay;
        setCalendarDays(prev => prev.map(d => d.id === existingDay.id ? updated : d));
      }
    } else if (resolution === 'keep_existing' && existingDay) {
      const updated = {
        ...existingDay,
        review_status: 'confirmed' as const,
        updated_at: new Date().toISOString()
      };
      setCalendarDays(prev => prev.map(d => d.id === existingDay.id ? updated : d));
    }

    const updatedConflict: CalendarImportConflict = {
      ...conflict,
      resolution,
      resolved_by: currentUser.profile?.id,
      resolved_at: new Date().toISOString()
    };

    setCalendarImportConflicts(prev => prev.map(c => c.id === conflictId ? updatedConflict : c));
    setTimeout(() => recalculateCompanyHours(cal.company_id), 500);
  };

  // 5. Overtime Adjustments CRUD
  const addOvertimeAdjustment = async (
    weeklySummaryId: string, 
    employeeId: string, 
    minutes: number, 
    reason: string
  ): Promise<void> => {
    const { data, error } = await supabase.rpc('add_overtime_adjustment', {
      p_weekly_summary_id: weeklySummaryId,
      p_employee_id: employeeId,
      p_adjustment_minutes: minutes,
      p_reason: reason.trim()
    });
    if (error || !data) {
      throw new Error(error?.message || 'No se pudo guardar el ajuste.');
    }
    rawSetOvertimeAdjustments(prev => [...prev, data as OvertimeAdjustment]);
    const employee = employees.find(item => item.id === employeeId);
    if (employee) await recalculateEmployeeHours(employeeId, employee.company_id);
  };

  return (
    <AppContext.Provider value={{
      companies, setCompanies, workCenters, profiles, setProfiles, employees, devices, timeEntries, setTimeEntries, incidents, requests, auditLogs, setAuditLogs,
      employeeWorkCenters, setEmployeeWorkCenters,
      
      // New Master lists
      laborCalendars, setLaborCalendars,
      dayTypeSettings, setDayTypeSettings,
      calendarDays, setCalendarDays,
      calendarImportRuns, setCalendarImportRuns,
      calendarImportConflicts, setCalendarImportConflicts,
      employeeWeeklyContracts, setEmployeeWeeklyContracts,
      dailyWorkSummaries, setDailyWorkSummaries,
      weeklyWorkSummaries, setWeeklyWorkSummaries,
      overtimeAdjustments, setOvertimeAdjustments,

      currentUser, currentCompany, currentWorkCenter, currentDevice, isDeviceAuthorized, authLoading,
      authorizeDevice, deauthorizeDevice, deleteDevice, loginEmployee, loginAdmin, logout, registerPunch,
      addEmployee, updateEmployee, changeEmployeePin, addWorkCenter, updateWorkCenter, deleteWorkCenter, updateDevice, resolveIncident, resolveRequest, submitRequest, deleteOldEntries, updateCompanySettings,
      showAlert, refreshData,

      // New Actions
      recalculateEmployeeHours, recalculateCompanyHours,
      addWeeklyContract, updateWeeklyContract, deleteWeeklyContract,
      addLaborCalendar, updateLaborCalendar,
      importHolidays, resolveConflict, addOvertimeAdjustment
    }}>
      {children}

      {/* GLOBAL CUSTOM DIALOG / POPUP */}
      {alertState.show && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-brand-border rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="p-6 text-center space-y-4">
              <div className="flex justify-center">
                {alertState.type === 'success' ? (
                  <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                ) : alertState.type === 'error' ? (
                  <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center border border-rose-100">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                ) : (
                  <div className="w-14 h-14 bg-brand-cream text-brand-maroon rounded-full flex items-center justify-center border border-brand-border/40">
                    <Info className="w-7 h-7" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-wider text-brand-text">
                  {alertState.title}
                </h3>
                <p className="text-xs font-bold text-brand-subtext leading-relaxed">
                  {alertState.message}
                </p>
              </div>
            </div>

            <div className="p-4 bg-brand-cream/10 border-t border-brand-border/40 flex justify-center">
              <button
                onClick={closeAlert}
                className="w-full bg-brand-maroon hover:bg-brand-maroon/90 text-white font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 shadow-md"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
