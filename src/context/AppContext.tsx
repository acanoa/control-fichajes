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
  updateDevice: (device: AuthorizedDevice) => void;
  resolveIncident: (incidentId: string, justification: string) => void;
  resolveRequest: (reqId: string, status: 'approved' | 'rejected', responseText: string) => void;
  submitRequest: (requestType: 'modify_existing' | 'create_missing', date: string, time: string, type: EntryType, reason: string, entryId?: string) => void;
  deleteOldEntries: (companyId: string) => void;
  updateCompanySettings: (timeout: number) => void;
  showAlert: (message: string, type?: 'success' | 'error' | 'info', title?: string) => void;
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

  // Local DB States
  const [companies, setCompanies] = useState<Company[]>(() => {
    const saved = localStorage.getItem('cf_companies');
    return saved ? JSON.parse(saved) : mockCompanies;
  });
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>(() => {
    const saved = localStorage.getItem('cf_work_centers');
    return saved ? JSON.parse(saved) : mockWorkCenters;
  });
  const [profiles, setProfiles] = useState<Profile[]>(() => {
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
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() => {
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
  const [employeeWorkCenters, setEmployeeWorkCenters] = useState<EmployeeWorkCenter[]>(() => {
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
    const token = 'token-' + Math.random().toString(36).substr(2, 9);
    const newDevice: AuthorizedDevice = {
      id: 'dev-' + Math.random().toString(36).substr(2, 9),
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
    
    // Auto authorize on local device
    if (cameraWorking) {
      localStorage.setItem('cf_device_token', token);
      setCurrentDevice(newDevice);
    }
    return newDevice;
  };

  const deauthorizeDevice = (deviceId: string) => {
    setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: 'inactive' as const } : d));
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
    // Normal mock authentication
    const prof = profiles.find(p => p.email.toLowerCase() === email.trim().toLowerCase());
    if (!prof) {
      throw new Error('Credenciales de administrador incorrectas.');
    }

    if (prof.status === 'blocked') {
      throw new Error('Su cuenta administrativa está bloqueada.');
    }

    // Pass verification (any password is fine for mock, let's enforce 'admin' or just pass)
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
      id: 'entry-' + Math.random().toString(36).substr(2, 9),
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

    // Handle Incidents logging
    if (has_incident) {
      const newInc: TimeEntryIncident = {
        id: 'inc-' + Math.random().toString(36).substr(2, 9),
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

    const newEmp: Employee = {
      ...emp,
      id: 'emp-' + Math.random().toString(36).substr(2, 9),
      employee_counter: newCounter,
      employee_code: empCode,
      failed_pin_attempts: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setEmployees(prev => [...prev, newEmp]);

    if (allowedCenters && allowedCenters.length) {
      const mappings: EmployeeWorkCenter[] = allowedCenters.map(cid => ({
        id: `ewc-${newEmp.id}-${cid}`,
        employee_id: newEmp.id,
        work_center_id: cid,
        created_at: new Date().toISOString()
      }));
      setEmployeeWorkCenters(prev => [...prev, ...mappings]);
    }

    const log: AuditLog = {
      id: 'audit-' + Math.random().toString(36).substr(2, 9),
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
  };

  const updateEmployee = (emp: Employee, allowedCenters?: string[]) => {
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...emp, updated_at: new Date().toISOString() } : e));

    if (allowedCenters) {
      setEmployeeWorkCenters(prev => {
        const clean = prev.filter(ewc => ewc.employee_id !== emp.id);
        const mappings = allowedCenters.map(cid => ({
          id: `ewc-${emp.id}-${cid}`,
          employee_id: emp.id,
          work_center_id: cid,
          created_at: new Date().toISOString()
        }));
        return [...clean, ...mappings];
      });
    }

    const log: AuditLog = {
      id: 'audit-' + Math.random().toString(36).substr(2, 9),
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
  };

  const changeEmployeePin = async (empId: string, newPin: string): Promise<void> => {
    const pinExists = employees.some(e => e.pin_hash === newPin && e.id !== empId && e.status === 'active');
    if (pinExists) {
      throw new Error('Este PIN ya está en uso por otro empleado en la plataforma. Elija otro.');
    }

    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, pin_hash: newPin, updated_at: new Date().toISOString() } : e));

    const emp = employees.find(e => e.id === empId);
    if (emp) {
      const log: AuditLog = {
        id: 'audit-' + Math.random().toString(36).substr(2, 9),
        company_id: emp.company_id,
        entity_type: 'employees',
        entity_id: empId,
        action: 'update_pin',
        reason: 'Modificación manual del PIN por el administrador',
        performed_by: currentUser.profile?.id,
        performed_at: new Date().toISOString()
      };
      setAuditLogs(prev => [...prev, log]);
    }
  };

  const addWorkCenter = (companyId: string, name: string, address: string, lat?: number, lng?: number, radius?: number, status?: 'active' | 'inactive') => {
    const newCenter: WorkCenter = {
      id: 'wc-' + Math.random().toString(36).substr(2, 9),
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
  };

  const updateWorkCenter = (center: WorkCenter) => {
    setWorkCenters(prev => prev.map(c => c.id === center.id ? { ...center, updated_at: new Date().toISOString() } : c));
  };

  const updateDevice = (device: AuthorizedDevice) => {
    setDevices(prev => prev.map(d => d.id === device.id ? { ...device, updated_at: new Date().toISOString() } : d));
    if (currentDevice && currentDevice.id === device.id) {
      setCurrentDevice({ ...device, updated_at: new Date().toISOString() });
    }
  };

  const resolveIncident = (incidentId: string, justification: string) => {
    const inc = incidents.find(i => i.id === incidentId);
    if (!inc) return;

    setIncidents(prev => prev.map(i => i.id === incidentId ? {
      ...i,
      description: i.description ? `${i.description} | JUSTIFICADO: ${justification}` : `JUSTIFICADO: ${justification}`,
    } : i));

    if (inc.time_entry_id) {
      setTimeEntries(prev => prev.map(t => t.id === inc.time_entry_id ? {
        ...t,
        has_incident: false,
        manual_reason: t.manual_reason ? `${t.manual_reason} | Incidencia justificada: ${justification}` : `Incidencia justificada: ${justification}`,
        updated_at: new Date().toISOString()
      } : t));
    }

    const log: AuditLog = {
      id: 'audit-' + Math.random().toString(36).substr(2, 9),
      company_id: inc.company_id,
      entity_type: 'time_entry_incidents',
      entity_id: incidentId,
      action: 'resolve_incident',
      reason: justification,
      performed_by: currentUser.profile?.id || currentUser.employee?.id,
      performed_at: new Date().toISOString()
    };
    setAuditLogs(prev => [...prev, log]);
  };

  const resolveRequest = (reqId: string, status: 'approved' | 'rejected', responseText: string) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;

    setRequests(prev => prev.map(r => r.id === reqId ? { 
      ...r, 
      status, 
      admin_response: responseText, 
      resolved_by: currentUser.profile?.id,
      resolved_at: new Date().toISOString()
    } : r));

    // Audit logs & creation of missing entry if approved
    if (status === 'approved') {
      const regTime = `${req.requested_date}T${req.requested_time}+02:00`;
      
      if (req.request_type === 'create_missing') {
        const newEntry: TimeEntry = {
          id: 'entry-' + Math.random().toString(36).substr(2, 9),
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

        // Audit Log
        const log: AuditLog = {
          id: 'audit-' + Math.random().toString(36).substr(2, 9),
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
      } else if (req.request_type === 'modify_existing' && req.time_entry_id) {
        const oldEntry = timeEntries.find(t => t.id === req.time_entry_id);
        
        setTimeEntries(prev => prev.map(t => t.id === req.time_entry_id ? {
          ...t,
          entry_type: req.requested_entry_type,
          registered_at: regTime,
          source: 'approved_request',
          updated_at: new Date().toISOString()
        } : t));

        // Audit Log
        const log: AuditLog = {
          id: 'audit-' + Math.random().toString(36).substr(2, 9),
          company_id: req.company_id,
          entity_type: 'time_entries',
          entity_id: req.time_entry_id,
          action: 'update_approved_request',
          old_values: oldEntry,
          new_values: { entry_type: req.requested_entry_type, registered_at: regTime },
          reason: `Solicitud de modificación aprobada. Motivo: ${responseText}`,
          performed_by: currentUser.profile?.id,
          performed_at: new Date().toISOString()
        };
        setAuditLogs(prev => [...prev, log]);
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
      id: 'req-' + Math.random().toString(36).substr(2, 9),
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
  };

  const deleteOldEntries = (companyId: string) => {
    // Delete entries older than 4 years (1460 days)
    const fourYearsAgo = new Date();
    fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);

    setTimeEntries(prev => prev.filter(t => {
      const isOld = new Date(t.registered_at) < fourYearsAgo && t.company_id === companyId;
      return !isOld;
    }));

    // Audit logs are cleared for deleted records
    setIncidents(prev => prev.filter(i => {
      const isOld = new Date(i.created_at) < fourYearsAgo && i.company_id === companyId;
      return !isOld;
    }));

    // Record audit of this global action
    const log: AuditLog = {
      id: 'audit-' + Math.random().toString(36).substr(2, 9),
      company_id: companyId,
      entity_type: 'company',
      entity_id: companyId,
      action: 'purge_old_records',
      reason: 'Eliminación definitiva manual de fichajes de más de 4 años por el administrador.',
      performed_by: currentUser.profile?.id || currentUser.employee?.id,
      performed_at: new Date().toISOString()
    };
    setAuditLogs(prev => [...prev, log]);
  };

  const updateCompanySettings = (timeout: number) => {
    if (!currentCompany) return;
    setCompanies(prev => prev.map(c => c.id === currentCompany.id ? { ...c, session_timeout_minutes: timeout, updated_at: new Date().toISOString() } : c));
    setCurrentCompany(prev => prev ? { ...prev, session_timeout_minutes: timeout } : undefined);

    // Audit
    const log: AuditLog = {
      id: 'audit-' + Math.random().toString(36).substr(2, 9),
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
  };

  return (
    <AppContext.Provider value={{
      companies, setCompanies, workCenters, profiles, setProfiles, employees, devices, timeEntries, setTimeEntries, incidents, requests, auditLogs,
      employeeWorkCenters, setEmployeeWorkCenters,
      currentUser, currentCompany, currentWorkCenter, currentDevice, isDeviceAuthorized,
      authorizeDevice, deauthorizeDevice, loginEmployee, loginAdmin, logout, registerPunch,
      addEmployee, updateEmployee, changeEmployeePin, addWorkCenter, updateWorkCenter, updateDevice, resolveIncident, resolveRequest, submitRequest, deleteOldEntries, updateCompanySettings,
      showAlert
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
