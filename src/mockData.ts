import { 
  Company, WorkCenter, Profile, Employee, 
  AuthorizedDevice, TimeEntry, TimeEntryIncident, 
  CorrectionRequest, AuditLog, GlobalSetting, WeeklySchedule 
} from './types';

export const mockGlobalSettings: GlobalSetting = {
  id: 'gs-1',
  default_session_timeout_minutes: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export const mockCompanies: Company[] = [
  {
    id: 'comp-acme',
    legal_name: 'Acme Servicios S.L.',
    commercial_name: 'Acme Corp',
    tax_id: 'B12345678',
    company_code: 'ACM',
    address: 'Calle Mayor 12, Madrid',
    email: 'contacto@acme.com',
    phone: '912345678',
    logo_path: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=100&fit=crop',
    status: 'active',
    session_timeout_minutes: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'comp-beta',
    legal_name: 'Beta Tecnologías S.A.',
    commercial_name: 'Beta Tech',
    tax_id: 'A87654321',
    company_code: 'BET',
    address: 'Avenida de la Industria 45, Barcelona',
    email: 'admin@betatech.es',
    phone: '934567890',
    logo_path: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100&h=100&fit=crop',
    status: 'active',
    session_timeout_minutes: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'comp-blocked',
    legal_name: 'Empresa Bloqueada S.L.',
    commercial_name: 'Blocked Corp',
    tax_id: 'B99999999',
    company_code: 'BLO',
    status: 'blocked',
    session_timeout_minutes: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const mockWorkCenters: WorkCenter[] = [
  {
    id: 'wc-acme-hq',
    company_id: 'comp-acme',
    name: 'Sede Central Acme',
    address: 'Calle Mayor 12, Madrid',
    latitude: 40.416775,
    longitude: -3.703790,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'wc-acme-warehouse',
    company_id: 'comp-acme',
    name: 'Almacén Logístico',
    address: 'Polígono Cobo Calleja, Fuenlabrada',
    latitude: 40.266224,
    longitude: -3.738018,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'wc-beta-bcn',
    company_id: 'comp-beta',
    name: 'Oficinas Barcelona',
    address: 'Avenida de la Industria 45, Barcelona',
    latitude: 41.385064,
    longitude: 2.173404,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const mockProfiles: Profile[] = [
  {
    id: 'prof-super-acanoa',
    auth_user_id: '8ffbc810-8cde-4336-a6e2-1c82548f9b01',
    full_name: 'Alberto Canoa',
    email: 'acano2@hotmail.com',
    role: 'superadmin',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'prof-super',
    auth_user_id: 'auth-super',
    full_name: 'Alberto Canoa (Superadmin)',
    email: 'super@acanoa.es',
    role: 'superadmin',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'prof-admin-acme',
    auth_user_id: 'auth-admin-acme',
    full_name: 'Carlos Administrador Acme',
    email: 'admin@acme.com',
    role: 'company_admin',
    company_id: 'comp-acme',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'prof-admin-beta',
    auth_user_id: 'auth-admin-beta',
    full_name: 'Sofía Administradora Beta',
    email: 'admin@betatech.es',
    role: 'company_admin',
    company_id: 'comp-beta',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const mockEmployees: Employee[] = [
  {
    id: 'emp-juan',
    company_id: 'comp-acme',
    dni: '12345678A',
    full_name: 'Juan Pérez García',
    employee_counter: 1,
    employee_code: 'ACM-00001',
    pin_hash: '1234', // En producción sería hash, para mock comparamos directo o hash simple
    email: 'juan.perez@acme.com',
    phone: '600111222',
    job_title: 'Desarrollador Senior',
    department: 'Tecnología',
    hire_date: '2023-01-15',
    status: 'active',
    failed_pin_attempts: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'emp-ana',
    company_id: 'comp-acme',
    dni: '87654321B',
    full_name: 'Ana Gómez Rodríguez',
    employee_counter: 2,
    employee_code: 'ACM-00002',
    pin_hash: '4321',
    email: 'ana.gomez@acme.com',
    phone: '600333444',
    job_title: 'Diseñadora UX/UI',
    department: 'Diseño',
    hire_date: '2023-06-10',
    status: 'active',
    failed_pin_attempts: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'emp-inactive',
    company_id: 'comp-acme',
    dni: '99999999Z',
    full_name: 'Empleado Inactivo de Prueba',
    employee_counter: 3,
    employee_code: 'ACM-00003',
    pin_hash: '9999',
    job_title: 'Ex-empleado',
    hire_date: '2022-01-01',
    termination_date: '2025-12-31',
    status: 'inactive',
    failed_pin_attempts: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'emp-beta-pepe',
    company_id: 'comp-beta',
    dni: '45678901C',
    full_name: 'Pepe López Ruiz',
    employee_counter: 1,
    employee_code: 'BET-00001',
    pin_hash: '1111',
    email: 'pepe@betatech.es',
    phone: '611222333',
    job_title: 'Soporte Técnico',
    department: 'Sistemas',
    hire_date: '2024-02-20',
    status: 'active',
    failed_pin_attempts: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const mockEmployeeWorkCenters = [
  { id: 'ewc-1', employee_id: 'emp-juan', work_center_id: 'wc-acme-hq' },
  { id: 'ewc-2', employee_id: 'emp-juan', work_center_id: 'wc-acme-warehouse' },
  { id: 'ewc-3', employee_id: 'emp-ana', work_center_id: 'wc-acme-hq' },
  { id: 'ewc-4', employee_id: 'emp-beta-pepe', work_center_id: 'wc-beta-bcn' }
];

export const mockWeeklySchedules: WeeklySchedule[] = [
  {
    id: 'sched-juan-1',
    employee_id: 'emp-juan',
    day_of_week: 1, // Lunes
    expected_entry_time: '09:00:00',
    expected_break_start_time: '14:00:00',
    expected_break_end_time: '14:30:00',
    expected_exit_time: '18:00:00',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sched-juan-2',
    employee_id: 'emp-juan',
    day_of_week: 2, // Martes
    expected_entry_time: '09:00:00',
    expected_break_start_time: '14:00:00',
    expected_break_end_time: '14:30:00',
    expected_exit_time: '18:00:00',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sched-juan-3',
    employee_id: 'emp-juan',
    day_of_week: 3, // Miércoles
    expected_entry_time: '09:00:00',
    expected_break_start_time: '14:00:00',
    expected_break_end_time: '14:30:00',
    expected_exit_time: '18:00:00',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sched-juan-4',
    employee_id: 'emp-juan',
    day_of_week: 4, // Jueves
    expected_entry_time: '09:00:00',
    expected_break_start_time: '14:00:00',
    expected_break_end_time: '14:30:00',
    expected_exit_time: '18:00:00',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'sched-juan-5',
    employee_id: 'emp-juan',
    day_of_week: 5, // Viernes
    expected_entry_time: '08:00:00',
    expected_exit_time: '15:00:00', // Sin descanso programado
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const mockAuthorizedDevices: AuthorizedDevice[] = [
  {
    id: 'dev-acme-tablet',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-hq',
    name: 'Tablet Recepción HQ',
    device_token: 'acme-hq-token-123',
    status: 'active',
    camera_validation_status: 'validated',
    camera_validated_at: new Date().toISOString(),
    camera_validated_by: 'prof-admin-acme',
    registered_at: new Date().toISOString(),
    last_used_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'dev-acme-warehouse-tablet',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-warehouse',
    name: 'Tablet Almacén Central',
    device_token: 'acme-wh-token-456',
    status: 'active',
    camera_validation_status: 'validated',
    camera_validated_at: new Date().toISOString(),
    camera_validated_by: 'prof-admin-acme',
    registered_at: new Date().toISOString(),
    last_used_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'dev-acme-pending',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-hq',
    name: 'Móvil de Prueba Pendiente',
    device_token: 'acme-pending-token',
    status: 'pending',
    camera_validation_status: 'pending',
    registered_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'dev-beta-tablet',
    company_id: 'comp-beta',
    work_center_id: 'wc-beta-bcn',
    name: 'Tablet Recepción Barcelona',
    device_token: 'beta-token-789',
    status: 'active',
    camera_validation_status: 'validated',
    camera_validated_at: new Date().toISOString(),
    camera_validated_by: 'prof-admin-beta',
    registered_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Generar fichajes realistas para Juan Pérez
const getPastDateString = (daysAgo: number, timeStr: string) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.toISOString().split('T')[0]}T${timeStr}+02:00`;
};

export const mockTimeEntries: TimeEntry[] = [
  // Fichajes de Juan de hace 3 días
  {
    id: 'entry-juan-3-1',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-hq',
    employee_id: 'emp-juan',
    device_id: 'dev-acme-tablet',
    entry_type: 'entry',
    registered_at: getPastDateString(3, '08:58:32'),
    photo_path: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=400&fit=crop',
    latitude: 40.416750,
    longitude: -3.703800,
    photo_status: 'success',
    gps_status: 'success',
    has_incident: false,
    source: 'employee',
    status: 'active',
    created_at: getPastDateString(3, '08:58:32'),
    updated_at: getPastDateString(3, '08:58:32')
  },
  {
    id: 'entry-juan-3-2',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-hq',
    employee_id: 'emp-juan',
    device_id: 'dev-acme-tablet',
    entry_type: 'break_start',
    registered_at: getPastDateString(3, '14:02:11'),
    photo_path: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=400&fit=crop',
    photo_status: 'success',
    gps_status: 'missing',
    has_incident: true, // Incidencia GPS no disponible
    source: 'employee',
    status: 'active',
    created_at: getPastDateString(3, '14:02:11'),
    updated_at: getPastDateString(3, '14:02:11')
  },
  {
    id: 'entry-juan-3-3',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-hq',
    employee_id: 'emp-juan',
    device_id: 'dev-acme-tablet',
    entry_type: 'break_end',
    registered_at: getPastDateString(3, '14:31:05'),
    photo_path: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=400&fit=crop',
    latitude: 40.416750,
    longitude: -3.703800,
    photo_status: 'success',
    gps_status: 'success',
    has_incident: false,
    source: 'employee',
    status: 'active',
    created_at: getPastDateString(3, '14:31:05'),
    updated_at: getPastDateString(3, '14:31:05')
  },
  {
    id: 'entry-juan-3-4',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-hq',
    employee_id: 'emp-juan',
    device_id: 'dev-acme-tablet',
    entry_type: 'exit',
    registered_at: getPastDateString(3, '18:03:40'),
    photo_path: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=400&fit=crop',
    latitude: 40.416750,
    longitude: -3.703800,
    photo_status: 'success',
    gps_status: 'success',
    has_incident: false,
    source: 'employee',
    status: 'active',
    created_at: getPastDateString(3, '18:03:40'),
    updated_at: getPastDateString(3, '18:03:40')
  },

  // Fichajes de Juan de hace 2 días (sin descanso)
  {
    id: 'entry-juan-2-1',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-hq',
    employee_id: 'emp-juan',
    device_id: 'dev-acme-tablet',
    entry_type: 'entry',
    registered_at: getPastDateString(2, '09:05:00'),
    photo_path: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=400&fit=crop',
    latitude: 40.416750,
    longitude: -3.703800,
    photo_status: 'success',
    gps_status: 'success',
    has_incident: false,
    source: 'employee',
    status: 'active',
    created_at: getPastDateString(2, '09:05:00'),
    updated_at: getPastDateString(2, '09:05:00')
  },
  {
    id: 'entry-juan-2-2',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-hq',
    employee_id: 'emp-juan',
    device_id: 'dev-acme-tablet',
    entry_type: 'exit',
    registered_at: getPastDateString(2, '18:00:00'),
    photo_path: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=400&fit=crop',
    latitude: 40.416750,
    longitude: -3.703800,
    photo_status: 'success',
    gps_status: 'success',
    has_incident: false,
    source: 'employee',
    status: 'active',
    created_at: getPastDateString(2, '18:00:00'),
    updated_at: getPastDateString(2, '18:00:00')
  },

  // Fichajes de Ana Gómez de hace 1 día (falló cámara al entrar)
  {
    id: 'entry-ana-1-1',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-hq',
    employee_id: 'emp-ana',
    device_id: 'dev-acme-tablet',
    entry_type: 'entry',
    registered_at: getPastDateString(1, '08:45:12'),
    latitude: 40.416750,
    longitude: -3.703800,
    photo_status: 'failed',
    gps_status: 'success',
    has_incident: true, // Incidencia cámara no disponible
    source: 'employee',
    status: 'active',
    created_at: getPastDateString(1, '08:45:12'),
    updated_at: getPastDateString(1, '08:45:12')
  },
  {
    id: 'entry-ana-1-2',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-hq',
    employee_id: 'emp-ana',
    device_id: 'dev-acme-tablet',
    entry_type: 'exit',
    registered_at: getPastDateString(1, '17:05:00'),
    photo_path: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=400&fit=crop',
    latitude: 40.416750,
    longitude: -3.703800,
    photo_status: 'success',
    gps_status: 'success',
    has_incident: false,
    source: 'employee',
    status: 'active',
    created_at: getPastDateString(1, '17:05:00'),
    updated_at: getPastDateString(1, '17:05:00')
  }
];

export const mockTimeEntryIncidents: TimeEntryIncident[] = [
  {
    id: 'inc-1',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-hq',
    employee_id: 'emp-juan',
    device_id: 'dev-acme-tablet',
    time_entry_id: 'entry-juan-3-2',
    incident_type: 'GPS no disponible',
    description: 'El empleado fichó sin coordenadas de GPS debido a un error de geolocalización o permiso denegado.',
    missing_photo: false,
    missing_gps: true,
    created_at: getPastDateString(3, '14:02:11')
  },
  {
    id: 'inc-2',
    company_id: 'comp-acme',
    work_center_id: 'wc-acme-hq',
    employee_id: 'emp-ana',
    device_id: 'dev-acme-tablet',
    time_entry_id: 'entry-ana-1-1',
    incident_type: 'Cámara no disponible',
    description: 'El empleado completó el fichaje pero no se pudo capturar la fotografía porque el permiso fue denegado o falló la cámara.',
    missing_photo: true,
    missing_gps: false,
    created_at: getPastDateString(1, '08:45:12')
  }
];

export const mockCorrectionRequests: CorrectionRequest[] = [
  {
    id: 'req-1',
    company_id: 'comp-acme',
    employee_id: 'emp-juan',
    time_entry_id: 'entry-juan-2-1',
    request_type: 'modify_existing',
    requested_date: new Date().toISOString().split('T')[0],
    requested_time: '08:30:00',
    requested_entry_type: 'entry',
    employee_reason: 'El dispositivo no reconocía mi código a las 8:30, me registré tarde a las 9:05.',
    status: 'pending',
    created_at: new Date().toISOString()
  },
  {
    id: 'req-2',
    company_id: 'comp-acme',
    employee_id: 'emp-ana',
    request_type: 'create_missing',
    requested_date: getPastDateString(2, '00:00:00').split('T')[0],
    requested_time: '17:00:00',
    requested_entry_type: 'exit',
    employee_reason: 'Olvidé registrar mi salida al finalizar la jornada por ir apurada a una cita médica.',
    status: 'approved',
    admin_response: 'Aprobado. Se procede a crear el fichaje de salida solicitado.',
    resolved_by: 'prof-admin-acme',
    created_at: getPastDateString(1, '10:00:00'),
    resolved_at: getPastDateString(1, '11:30:00')
  }
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 'audit-1',
    company_id: 'comp-acme',
    entity_type: 'employees',
    entity_id: 'emp-juan',
    action: 'update_pin',
    old_values: { pin_hash: '****' },
    new_values: { pin_hash: '****' },
    reason: 'Cambio de PIN solicitado por el trabajador debido a olvido.',
    performed_by: 'prof-admin-acme',
    performed_at: getPastDateString(4, '12:00:00')
  },
  {
    id: 'audit-2',
    company_id: 'comp-acme',
    entity_type: 'time_entries',
    entity_id: 'entry-ana-forgotten-exit',
    action: 'create_manual',
    old_values: null,
    new_values: { entry_type: 'exit', registered_at: '2026-07-13T17:00:00+02:00' },
    reason: 'Aprobación de la solicitud de fichaje olvidado #req-2',
    performed_by: 'prof-admin-acme',
    performed_at: getPastDateString(1, '11:30:00')
  }
];
