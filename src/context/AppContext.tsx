import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Company, WorkCenter, Profile, Employee, 
  AuthorizedDevice, TimeEntry, TimeEntryIncident, 
  CorrectionRequest, AuditLog, EntryType, 
  TimeEntrySource, TimeEntryStatus, EmployeeWorkCenter
} from '../types';
import { 
  mockCompanies, mockWorkCenters, mockProfiles, 
  mockEmployees, mockAuthorizedDevices, mockTimeEntries, 
  mockTimeEntryIncidents, mockCorrectionRequests, mockAuditLogs 
} from '../mockData';
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
  setCompanies: React.Dispatch<React.SetStateAction<Company[]>>;
  setProfiles: React.Dispatch<React.SetStateAction<Profile[]>>;
  setTimeEntries: React.Dispatch<React.SetStateAction<TimeEntry[]>>;
  setEmployeeWorkCenters: React.Dispatch<React.SetStateAction<EmployeeWorkCenter[]>>;

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

  // Actions
  authorizeDevice: (name: string, companyId: string, workCenterId: string, cameraWorking: boolean) => Promise<AuthorizedDevice>;
  deauthorizeDevice: (deviceId: string) => void;
  loginEmployee: (code: string, pin: string) => Promise<Employee>;
  loginAdmin: (email: string, pass: string) => Promise<Profile>;
  logout: () => void;
  registerPunch: (type: EntryType, photoBase64: string | null, lat?: number, lng?: number, cameraError?: string, gpsError?: string) => Promise<TimeEntry>;
  
  // Admin functions
  addEmployee: (emp: Omit<Employee, 'id' | 'employee_code' | 'employee_counter' | 'failed_pin_attempts' | 'created_at' | 'updated_at'>, allowedCenters?: string[]) => void;
  updateEmployee: (emp: Employee, allowedCenters?: string[]) => void;
  changeEmployeePin: (empId: string, newPin: string) => Promise<void>;
  addWorkCenter: (companyId: string, name: string, address: string, lat?: number, lng?: number, radius?: number, status?: 'active' | 'inactive') => void;
  updateWorkCenter: (center: WorkCenter) => void;
  deleteWorkCenter: (centerId: string) => Promise<void>;
  updateDevice: (device: AuthorizedDevice) => void;
  resolveIncident: (incidentId: string, justification: string) => void;
  resolveRequest: (reqId: string, status: 'approved' | 'rejected', responseText: string) => void;
  submitRequest: (requestType: 'modify_existing' | 'create_missing', date: string, time: string, type: EntryType, reason: string, entryId?: string) => void;
  deleteOldEntries: (companyId: string) => void;
  updateCompanySettings: (timeout: number) => void;
  showAlert: (message: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  refreshData: () => Promise<void>;
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

      const { data: dbEmps } = await supabase.from('employees').select('*');
      if (dbEmps) setEmployees(dbEmps);

      const { data: dbDevs } = await supabase.from('authorized_devices').select('*');
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

      console.log("Supabase database load/refresh completed successfully!");
    } catch (err) {
      console.warn("Could not load data from Supabase. Using localStorage fallback:", err);
    }
  };

  // Sync with Supabase on mount (or auto-seed if database is empty)
  useEffect(() => {
    const initLoad = async () => {
      try {
        const { data: dbComps } = await supabase.from('companies').select('*');
        if (dbComps && dbComps.length === 0) {
          console.log("Supabase database is empty. Seeding with mock data...");
          // Seed Companies
          await supabase.from('companies').upsert(mockCompanies.map(c => ({
            id: toUUID(c.id, '11111111'),
            legal_name: c.legal_name,
            commercial_name: c.commercial_name,
            tax_id: c.tax_id,
            company_code: c.company_code,
            address: c.address,
            email: c.email,
            phone: c.phone,
            status: c.status,
            session_timeout_minutes: c.session_timeout_minutes
          })));

          // Seed Work Centers
          await supabase.from('work_centers').upsert(mockWorkCenters.map(wc => ({
            id: toUUID(wc.id, '22222222'),
            company_id: toUUID(wc.company_id, '11111111'),
            name: wc.name,
            address: wc.address,
            latitude: wc.latitude,
            longitude: wc.longitude,
            status: wc.status
          })));

          // Seed Profiles
          await supabase.from('profiles').upsert(mockProfiles.map(p => ({
            id: toUUID(p.id, '33333333'),
            auth_user_id: p.auth_user_id,
            full_name: p.full_name,
            email: p.email,
            role: p.role,
            company_id: p.company_id ? toUUID(p.company_id, '11111111') : undefined,
            status: p.status
          })));

          // Seed Employees (force 4 digits)
          await supabase.from('employees').upsert(mockEmployees.map(emp => ({
            id: toUUID(emp.id, '44444444'),
            company_id: toUUID(emp.company_id, '11111111'),
            dni: emp.dni,
            full_name: emp.full_name,
            employee_counter: emp.employee_counter,
            employee_code: emp.employee_code.replace('ACM-0000', 'ACM-000').replace('BET-0000', 'BET-000'),
            pin_hash: emp.pin_hash,
            email: emp.email,
            phone: emp.phone,
            job_title: emp.job_title,
            department: emp.department,
            hire_date: emp.hire_date,
            status: emp.status,
            failed_pin_attempts: emp.failed_pin_attempts
          })));

          // Seed employee_work_centers mappings
          const seededEwcs: any[] = [];
          mockEmployees.forEach(emp => {
            const empUUID = toUUID(emp.id, '44444444');
            const compCenters = mockWorkCenters.filter(wc => wc.company_id === emp.company_id);
            compCenters.forEach(wc => {
              const wcUUID = toUUID(wc.id, '22222222');
              seededEwcs.push({
                employee_id: empUUID,
                work_center_id: wcUUID
              });
            });
          });
          if (seededEwcs.length > 0) {
            await supabase.from('employee_work_centers').upsert(seededEwcs);
          }
        }
        
        await refreshData();
      } catch (err) {
        console.warn("Could not seed data from Supabase. Falling back to local refresh:", err);
        await refreshData();
      }
    };
    initLoad();
  }, []);

  // Local DB States
  // Local DB States
  const [companies, rawSetCompanies] = useState<Company[]>(() => {
    const saved = localStorage.getItem('cf_companies');
    return saved ? JSON.parse(saved) : mockCompanies;
  });
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>(() => {
    const saved = localStorage.getItem('cf_work_centers');
    return saved ? JSON.parse(saved) : mockWorkCenters;
  });
  const [profiles, rawSetProfiles] = useState<Profile[]>(() => {
    const saved = localStorage.getItem('cf_profiles');
    const list = saved ? JSON.parse(saved) : mockProfiles;
    if (!list.some((p: any) => p.email === 'acano2@hotmail.com')) {
      list.push({
        id: 'prof-super-acanoa',
        auth_user_id: '8ffbc810-8cde-4336-a6e2-1c82548f9b01',
        full_name: 'Alberto Canoa',
        email: 'acano2@hotmail.com',
        role: 'superadmin',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    return list;
  });
  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('cf_employees');
    return saved ? JSON.parse(saved) : mockEmployees;
  });
  const [devices, setDevices] = useState<AuthorizedDevice[]>(() => {
    const saved = localStorage.getItem('cf_devices');
    return saved ? JSON.parse(saved) : mockAuthorizedDevices;
  });
  const [timeEntries, rawSetTimeEntries] = useState<TimeEntry[]>(() => {
    const saved = localStorage.getItem('cf_time_entries');
    return saved ? JSON.parse(saved) : mockTimeEntries;
  });
  const [incidents, setIncidents] = useState<TimeEntryIncident[]>(() => {
    const saved = localStorage.getItem('cf_incidents');
    return saved ? JSON.parse(saved) : mockTimeEntryIncidents;
  });
  const [requests, setRequests] = useState<CorrectionRequest[]>(() => {
    const saved = localStorage.getItem('cf_requests');
    return saved ? JSON.parse(saved) : mockCorrectionRequests;
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('cf_audit_logs');
    return saved ? JSON.parse(saved) : mockAuditLogs;
  });
  const [employeeWorkCenters, rawSetEmployeeWorkCenters] = useState<EmployeeWorkCenter[]>(() => {
    const saved = localStorage.getItem('cf_employee_work_centers');
    if (saved) return JSON.parse(saved);
    const list: EmployeeWorkCenter[] = [];
    mockEmployees.forEach(emp => {
      const compCenters = mockWorkCenters.filter(wc => wc.company_id === emp.company_id);
      compCenters.forEach(wc => {
        list.push({
          id: `ewc-${emp.id}-${wc.id}`,
          employee_id: emp.id,
          work_center_id: wc.id,
          created_at: new Date().toISOString()
        });
      });
    });
    return list;
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

  // Session States
  const [currentUser, setCurrentUser] = useState<AppContextType['currentUser']>(() => {
    const saved = sessionStorage.getItem('cf_current_user');
    return saved ? JSON.parse(saved) : { role: 'none' };
  });

  const [currentCompany, setCurrentCompany] = useState<Company | undefined>(() => {
    const saved = sessionStorage.getItem('cf_current_company');
    return saved ? JSON.parse(saved) : undefined;
  });

  const [currentWorkCenter, setCurrentWorkCenter] = useState<WorkCenter | undefined>(() => {
    const saved = sessionStorage.getItem('cf_current_work_center');
    return saved ? JSON.parse(saved) : undefined;
  });

  const [currentDevice, setCurrentDevice] = useState<AuthorizedDevice | undefined>(() => {
    const activeToken = localStorage.getItem('cf_device_token');
    if (!activeToken) return undefined;
    const savedDevices: AuthorizedDevice[] = JSON.parse(localStorage.getItem('cf_devices') || '[]');
    return (savedDevices.length ? savedDevices : mockAuthorizedDevices).find(d => d.device_token === activeToken);
  });

  const isDeviceAuthorized = !!currentDevice && currentDevice.status === 'active' && currentDevice.camera_validation_status === 'validated';

  // Sync state to local storage when changed
  useEffect(() => {
    localStorage.setItem('cf_companies', JSON.stringify(companies));
  }, [companies]);
  useEffect(() => {
    localStorage.setItem('cf_work_centers', JSON.stringify(workCenters));
  }, [workCenters]);
  useEffect(() => {
    localStorage.setItem('cf_profiles', JSON.stringify(profiles));
  }, [profiles]);
  useEffect(() => {
    localStorage.setItem('cf_employees', JSON.stringify(employees));
  }, [employees]);

  // Migration check for 5-digit employee codes to 4-digit codes in localStorage
  useEffect(() => {
    const hasFiveDigits = employees.some(emp => /^[A-Z0-9]+-\d{5}$/.test(emp.employee_code));
    if (hasFiveDigits) {
      const migrated = employees.map(emp => {
        const match = emp.employee_code.match(/^([A-Z0-9]+)-(\d{5})$/);
        if (match) {
          const prefix = match[1];
          const num = match[2];
          const newNum = num.substring(1); // convert "00001" to "0001"
          return {
            ...emp,
            employee_code: `${prefix}-${newNum}`
          };
        }
        return emp;
      });
      setEmployees(migrated);
    }
  }, [employees]);
  useEffect(() => {
    localStorage.setItem('cf_devices', JSON.stringify(devices));
  }, [devices]);
  useEffect(() => {
    localStorage.setItem('cf_time_entries', JSON.stringify(timeEntries));
  }, [timeEntries]);
  useEffect(() => {
    localStorage.setItem('cf_incidents', JSON.stringify(incidents));
  }, [incidents]);
  useEffect(() => {
    localStorage.setItem('cf_employee_work_centers', JSON.stringify(employeeWorkCenters));
  }, [employeeWorkCenters]);
  useEffect(() => {
    localStorage.setItem('cf_requests', JSON.stringify(requests));
  }, [requests]);
  useEffect(() => {
    localStorage.setItem('cf_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Sync session states
  useEffect(() => {
    sessionStorage.setItem('cf_current_user', JSON.stringify(currentUser));
  }, [currentUser]);
  useEffect(() => {
    if (currentCompany) sessionStorage.setItem('cf_current_company', JSON.stringify(currentCompany));
    else sessionStorage.removeItem('cf_current_company');
  }, [currentCompany]);
  useEffect(() => {
    if (currentWorkCenter) sessionStorage.setItem('cf_current_work_center', JSON.stringify(currentWorkCenter));
    else sessionStorage.removeItem('cf_current_work_center');
  }, [currentWorkCenter]);

  // Actions
  const authorizeDevice = async (name: string, companyId: string, workCenterId: string, cameraWorking: boolean): Promise<AuthorizedDevice> => {
    const token = safeUUID();
    const newDevice: AuthorizedDevice = {
      id: safeUUID(),
      company_id: companyId,
      work_center_id: workCenterId,
      name,
      device_token: token,
      status: cameraWorking ? 'active' : 'pending',
      camera_validation_status: cameraWorking ? 'validated' : 'failed',
      camera_validated_at: cameraWorking ? new Date().toISOString() : undefined,
      camera_validated_by: currentUser.profile?.id,
      registered_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setDevices(prev => [...prev, newDevice]);
    
    // Insert into Supabase
    supabase.from('authorized_devices').insert(newDevice).then(({ error }) => {
      if (error) console.error("Error inserting device into Supabase:", error);
    });
    
    // Auto authorize on local device
    if (cameraWorking) {
      localStorage.setItem('cf_device_token', token);
      setCurrentDevice(newDevice);
    }
    return newDevice;
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

  const loginEmployee = async (code: string, pin: string): Promise<Employee> => {
    // Normalization and prepending the active terminal's company code
    let cleanCode = code.trim().toUpperCase();
    if (currentDevice) {
      const comp = companies.find(c => c.id === currentDevice.company_id);
      if (comp) {
        // Strip non-digit characters and pad the remaining number to 4 digits: e.g. "0001" or "1" -> "0001"
        const cleanNumber = code.replace(/\D/g, '');
        const paddedNumber = cleanNumber.padStart(4, '0');
        cleanCode = `${comp.company_code}-${paddedNumber}`;
      }
    }

    const emp = employees.find(e => e.employee_code === cleanCode);
    if (!emp) {
      throw new Error('Código de empleado o PIN incorrecto.');
    }

    if (emp.status === 'inactive') {
      throw new Error('El acceso de este empleado está desactivado.');
    }

    // Check Lockout
    if (emp.locked_until && new Date(emp.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(emp.locked_until).getTime() - new Date().getTime()) / 60000);
      throw new Error(`Acceso bloqueado. Inténtelo de nuevo en ${minutesLeft} minutos.`);
    }

    if (emp.pin_hash !== pin) {
      // Increment failed attempts
      const newAttempts = emp.failed_pin_attempts + 1;
      let lockedUntil: string | undefined = undefined;
      
      if (newAttempts >= 5) {
        // Lock for 15 minutes
        const lockDate = new Date();
        lockDate.setMinutes(lockDate.getMinutes() + 15);
        lockedUntil = lockDate.toISOString();
      }

      setEmployees(prev => prev.map(e => e.id === emp.id ? { 
        ...e, 
        failed_pin_attempts: newAttempts >= 5 ? 0 : newAttempts,
        locked_until: lockedUntil 
      } : e));

      // Update failed attempts/lockout in Supabase
      supabase.from('employees').update({
        failed_pin_attempts: newAttempts >= 5 ? 0 : newAttempts,
        locked_until: lockedUntil || null,
        updated_at: new Date().toISOString()
      }).eq('id', emp.id).then();

      if (newAttempts >= 5) {
        throw new Error('Demasiados intentos fallidos. Acceso bloqueado durante 15 minutos.');
      } else {
        throw new Error(`Código de empleado o PIN incorrecto. Intentos restantes: ${5 - newAttempts}`);
      }
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

    // If using an authorized device, tie the employee session to that work center
    if (currentDevice && currentDevice.company_id === company.id) {
      const wc = workCenters.find(w => w.id === currentDevice.work_center_id);
      setCurrentWorkCenter(wc);
    } else {
      // Default to HQ or first active work center if device not set
      const firstWc = workCenters.find(w => w.company_id === company.id && w.status === 'active');
      setCurrentWorkCenter(firstWc);
    }

    return emp;
  };

  const loginAdmin = async (email: string, pass: string): Promise<Profile> => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: pass
      });

      if (!authError && authData.user) {
        // Query the profiles table in Supabase
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('auth_user_id', authData.user.id)
          .single();

        if (dbProfile) {
          if (dbProfile.status === 'blocked') {
            await supabase.auth.signOut();
            throw new Error('Su cuenta administrativa está bloqueada.');
          }
          setCurrentUser({
            role: dbProfile.role,
            profile: dbProfile
          });
          if (dbProfile.company_id) {
            const company = companies.find(c => c.id === dbProfile.company_id);
            setCurrentCompany(company);
          }
          return dbProfile;
        }
      }
    } catch (e: any) {
      if (e.message && e.message.includes('bloqueada')) throw e;
      console.warn("Supabase Auth login failed, falling back to local credentials:", e);
    }

    // Normal mock authentication fallback
    const prof = profiles.find(p => p.email.toLowerCase() === email.trim().toLowerCase());
    if (!prof) {
      throw new Error('Credenciales de administrador incorrectas.');
    }

    if (prof.status === 'blocked') {
      throw new Error('Su cuenta administrativa está bloqueada.');
    }

    if (pass.length < 4) {
      throw new Error('La contraseña debe tener al menos 4 caracteres.');
    }

    setCurrentUser({
      role: prof.role,
      profile: prof
    });

    if (prof.company_id) {
      const company = companies.find(c => c.id === prof.company_id);
      setCurrentCompany(company);
    }

    return prof;
  };

  const logout = () => {
    setCurrentUser({ role: 'none' });
    setCurrentCompany(undefined);
    setCurrentWorkCenter(undefined);
    sessionStorage.clear();
  };

  const registerPunch = async (
    type: EntryType, 
    photoBase64: string | null, 
    lat?: number, 
    lng?: number,
    cameraError?: string,
    gpsError?: string
  ): Promise<TimeEntry> => {
    if (currentUser.role !== 'employee' || !currentUser.employee || !currentCompany || !currentWorkCenter) {
      throw new Error('Sesión de empleado inválida.');
    }

    const emp = currentUser.employee;

    // Check Sequence Validity in Mock
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
    const has_incident = photo_status !== 'success' || gps_status !== 'success';

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
        incident_type: cameraError || gpsError || 'Fichaje incompleto',
        description: `Incidencia registrada: ${cameraError ? 'Cámara (' + cameraError + ')' : ''} ${gpsError ? 'GPS (' + gpsError + ')' : ''}`,
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
      new_values: newEmp,
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
    const pinExists = employees.some(e => e.pin_hash === newPin && e.id !== empId && e.status === 'active');
    if (pinExists) {
      throw new Error('Este PIN ya está en uso por otro empleado en la plataforma. Elija otro.');
    }

    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, pin_hash: newPin, updated_at: new Date().toISOString() } : e));

    supabase.from('employees').update({
      pin_hash: newPin,
      updated_at: new Date().toISOString()
    }).eq('id', empId).then(({ error }) => {
      if (error) console.error("Error updating PIN in Supabase:", error);
    });

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

  const addWorkCenter = (companyId: string, name: string, address: string, lat?: number, lng?: number, radius?: number, status?: 'active' | 'inactive') => {
    const newCenter: WorkCenter = {
      id: safeUUID(),
      company_id: companyId,
      name,
      address,
      latitude: lat,
      longitude: lng,
      status: status || 'active',
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

  const submitRequest = (
    requestType: 'modify_existing' | 'create_missing', 
    date: string, 
    time: string, 
    type: EntryType, 
    reason: string, 
    entryId?: string
  ) => {
    if (currentUser.role !== 'employee' || !currentUser.employee || !currentCompany) return;

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

  return (
    <AppContext.Provider value={{
      companies, setCompanies, workCenters, profiles, setProfiles, employees, devices, timeEntries, setTimeEntries, incidents, requests, auditLogs,
      employeeWorkCenters, setEmployeeWorkCenters,
      currentUser, currentCompany, currentWorkCenter, currentDevice, isDeviceAuthorized,
      authorizeDevice, deauthorizeDevice, loginEmployee, loginAdmin, logout, registerPunch,
      addEmployee, updateEmployee, changeEmployeePin, addWorkCenter, updateWorkCenter, deleteWorkCenter, updateDevice, resolveIncident, resolveRequest, submitRequest, deleteOldEntries, updateCompanySettings,
      showAlert, refreshData
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
