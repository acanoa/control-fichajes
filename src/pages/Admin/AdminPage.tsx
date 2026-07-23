import React, { useState } from 'react';
import { useApp } from '../../context/useApp';
import { EntryType, Employee, WorkCenter, AuthorizedDevice, TimeEntry, Company, Profile, CalendarDay, LaborCalendar } from '../../types';
import { 
  Users, Building, Video, Clock, AlertTriangle, 
  Settings, LogOut, Check, X, FileSpreadsheet, 
  FileText, ShieldAlert, Key, Plus, Trash2, Calendar, Edit,
  Pencil, Ban, Power, FileCheck, UserPlus, Lock, Unlock,
  Compass, MapPin, Map
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { deleteDayType } from '../../repositories/calendarRepository';
import { geocodeAddress } from '../../integrations/geocoding/nominatim';
import { logger } from '../../lib/logger';

// Helper utilities for local UUID operations
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

const downloadCsv = (rows: Record<string, unknown>[], filename: string) => {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escapeCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [
    headers.map(escapeCell).join(','),
    ...rows.map(row => headers.map(header => escapeCell(row[header])).join(','))
  ].join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const AdminPage: React.FC = () => {
  const {
    currentUser, currentCompany, logout,
    companies, setCompanies,
    profiles, setProfiles,
    employees, workCenters, devices, timeEntries,
    incidents, requests, auditLogs, employeeWorkCenters,
    addEmployee, updateEmployee, changeEmployeePin,
    addWorkCenter, updateWorkCenter, deleteWorkCenter, updateDevice, resolveIncident,
    approveDeviceRegistration, deauthorizeDevice, deleteDevice, resolveRequest, deleteOldEntries, updateCompanySettings,
    setTimeEntries, showAlert, refreshData,
    setCalendarDays, setDayTypeSettings
  } = useApp();

  const adminProfile = currentUser.profile;
  const isSuperadmin = currentUser.role === 'superadmin';

  // Active Company Selection for Superadmin
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(() => {
    return companies[0]?.id || '';
  });

  // Calculate Active Company ID and object based on selected company
  const companyId = isSuperadmin ? selectedCompanyId : (currentCompany?.id || '');
  const activeCompany = companies.find(c => c.id === companyId);

  React.useEffect(() => {
    if (!isSuperadmin) return;
    if (companies.length === 0) return;
    const selectedExists = companies.some(c => c.id === selectedCompanyId);
    if (!selectedCompanyId || !selectedExists) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [isSuperadmin, companies, selectedCompanyId]);

  const [activeTab, setActiveTab] = useState<
    'companies' | 'dashboard' | 'employees' | 'centers' | 'devices' | 'entries' | 'requests' | 'incidents' | 'audit' | 'reports' | 'settings' | 'settings_global' | 'calendars' | 'overtime'
  >(isSuperadmin ? 'companies' : 'dashboard');

  const refreshDataRef = React.useRef(refreshData);
  React.useEffect(() => {
    refreshDataRef.current = refreshData;
  }, [refreshData]);

  // Refresh data on sidebar tab switch
  React.useEffect(() => {
    void refreshDataRef.current();
  }, [activeTab]);

  // Add/Edit Company Form State (Superadmin)
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [legalName, setLegalName] = useState('');
  const [commercialName, setCommercialName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [compCode, setCompCode] = useState('');
  const [compAddress, setCompAddress] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compSessionTimeout, setCompSessionTimeout] = useState(5);
  const [compStatus, setCompStatus] = useState<'active' | 'blocked'>('active');

  // Assign Admin Form State (Superadmin)
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminTargetCompanyId, setAdminTargetCompanyId] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // Global Settings state (Superadmin)
  const [globalTimeout, setGlobalTimeout] = useState(5);
  const [globalSettingsSuccess, setGlobalSettingsSuccess] = useState(false);

  // Add/Edit Employee Form State
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empDni, setEmpDni] = useState('');
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empJobTitle, setEmpJobTitle] = useState('');
  const [empDept, setEmpDept] = useState('');
  const [empHireDate, setEmpHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [empStatus, setEmpStatus] = useState<'active' | 'inactive'>('active');
  const [empCentersSelected, setEmpCentersSelected] = useState<string[]>([]);
  const [empCompanyId, setEmpCompanyId] = useState('');

  // Change PIN Form State
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinTargetEmpId, setPinTargetEmpId] = useState('');
  const [newPinValue, setNewPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');

  // Add/Edit Work Center Form State
  const [showCenterModal, setShowCenterModal] = useState(false);
  const [editingCenter, setEditingCenter] = useState<WorkCenter | null>(null);
  const [centerName, setCenterName] = useState('');
  const [centerAddress, setCenterAddress] = useState('');
  const [centerLat, setCenterLat] = useState<string>('');
  const [centerLng, setCenterLng] = useState<string>('');
  const [centerRadius, setCenterRadius] = useState<number>(50); // Default 50m
  const [centerStatus, setCenterStatus] = useState<'active' | 'inactive'>('active');
  const [centerCompanyId, setCenterCompanyId] = useState('');
  const [centerProvince, setCenterProvince] = useState('');
  const [centerCity, setCenterCity] = useState('');

  // Add/Edit Device Form State
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AuthorizedDevice | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [deviceCenterId, setDeviceCenterId] = useState('');
  const [deviceStatus, setDeviceStatus] = useState<AuthorizedDevice['status']>('active');
  const [deviceCameraStatus, setDeviceCameraStatus] = useState<AuthorizedDevice['camera_validation_status']>('validated');
  const [deviceLat, setDeviceLat] = useState('');
  const [deviceLng, setDeviceLng] = useState('');
  const [showMapPickerModal, setShowMapPickerModal] = useState(false);
  const [mapPickerLat, setMapPickerLat] = useState<number>(40.416775);
  const [mapPickerLng, setMapPickerLng] = useState<number>(-3.703790);
  const [mapSearchText, setMapSearchText] = useState('');

  // Resolve Incident State
  const [showResolveIncidentModal, setShowResolveIncidentModal] = useState(false);
  const [resolveIncidentId, setResolveIncidentId] = useState('');
  const [incidentJustification, setIncidentJustification] = useState('');

  // Resolve Request State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveTargetId, setResolveTargetId] = useState('');
  const [resolveType, setResolveType] = useState<'approved' | 'rejected'>('approved');
  const [resolveResponseText, setResolveResponseText] = useState('');

  // Photo Viewer Modal State
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerUrl, setPhotoViewerUrl] = useState('');
  const [photoViewerTitle, setPhotoViewerTitle] = useState('');
  const [photoViewerSub, setPhotoViewerSub] = useState('');

  // Manual Punch Form State
  const [showManualPunchModal, setShowManualPunchModal] = useState(false);
  const [manualEmpId, setManualEmpId] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualTime, setManualTime] = useState('09:00');
  const [manualEntryType, setManualEntryType] = useState<EntryType>('entry');
  const [manualReason, setManualReason] = useState('');

  // Void Entry State
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidTargetId, setVoidTargetId] = useState('');
  const [voidReason, setVoidReason] = useState('');

  // Purge Confirmation State
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [purgeTargetCompanyId, setPurgeTargetCompanyId] = useState('');

  // Delete Device Confirmation State
  const [showDeleteDeviceModal, setShowDeleteDeviceModal] = useState(false);
  const [deleteDeviceTarget, setDeleteDeviceTarget] = useState<AuthorizedDevice | null>(null);
  const [deleteDeviceError, setDeleteDeviceError] = useState('');

  // Report filters state
  const [reportEmpId, setReportEmpId] = useState('');
  const [reportCenterId, setReportCenterId] = useState('');
  const [reportStartDate, setReportStartDate] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Company Settings state
  const [sessionTimeout, setSessionTimeout] = useState(activeCompany?.session_timeout_minutes || 5);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // ==========================================
  // NEW SYSTEM UI STATES: CALENDARS & OVERTIME
  // ==========================================
  const {
    laborCalendars, dayTypeSettings, calendarDays, calendarImportConflicts,
    employeeWeeklyContracts, dailyWorkSummaries, weeklyWorkSummaries,
    addWeeklyContract, updateWeeklyContract, deleteWeeklyContract,
    addLaborCalendar, updateLaborCalendar, importHolidays, resolveConflict, addOvertimeAdjustment,
    recalculateCompanyHours
  } = useApp();

  const [selectedCalendarCenterId, setSelectedCalendarCenterId] = useState<string>('');
  const [selectedCalendarYear, setSelectedCalendarYear] = useState<number>(2026);
  const [showCreateCalendarModal, setShowCreateCalendarModal] = useState(false);
  const [newCalendarModel, setNewCalendarModel] = useState<'monday_to_friday' | 'monday_to_saturday'>('monday_to_friday');
  
  // Day editing modal
  const [showDayEditModal, setShowDayEditModal] = useState(false);
  const [dayToEditDate, setDayToEditDate] = useState('');
  const [dayToEditName, setDayToEditName] = useState('');
  const [dayToEditTypeId, setDayToEditTypeId] = useState('');
  const [dayToEditNotes, setDayToEditNotes] = useState('');

  // Day Type Setting CRUD modal
  const [showDayTypeModal, setShowDayTypeModal] = useState(false);
  const [editingDayType, setEditingDayType] = useState<any | null>(null);
  const [dayTypeName, setDayTypeName] = useState('');
  const [dayTypeMultiplier, setDayTypeMultiplier] = useState(1.0);
  const [dayTypeReduces, setDayTypeReduces] = useState(false);
  const [dayTypeColor, setDayTypeColor] = useState('#E2E8F0');
  const [dayTypeSpecialMin, setDayTypeSpecialMin] = useState<number | ''>('');

  // Weekly Contract state
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractEmployeeId, setContractEmployeeId] = useState('');
  const [contractWeeklyMin, setContractWeeklyMin] = useState(2400); // 40h
  const [contractFrom, setContractFrom] = useState(new Date().toISOString().split('T')[0]);
  const [contractTo, setContractTo] = useState('');
  const [contractReason, setContractReason] = useState('');
  const [editingContract, setEditingContract] = useState<any | null>(null);

  // Overtime Quadrant state
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [overtimeViewMode, setOvertimeViewMode] = useState<'weekly' | 'monthly' | 'annual' | 'ranking'>('weekly');
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentTargetSummaryId, setAdjustmentTargetSummaryId] = useState('');
  const [adjustmentTargetEmployeeId, setAdjustmentTargetEmployeeId] = useState('');
  const [adjustmentAmountHours, setAdjustmentAmountHours] = useState<number>(0);
  const [adjustmentReasonText, setAdjustmentReasonText] = useState('');
  
  // Day detail modal
  const [showDayDetailModal, setShowDayDetailModal] = useState(false);
  const [dayDetailEmployeeId, setDayDetailEmployeeId] = useState('');
  const [dayDetailDate, setDayDetailDate] = useState('');

  // Sync settings state when active company changes
  React.useEffect(() => {
    if (activeCompany) {
      setSessionTimeout(activeCompany.session_timeout_minutes);
    }
  }, [companyId, activeCompany]);

  // Filter entities by active company
  const companyEmployees = employees.filter(e => e.company_id === companyId);
  const companyCenters = workCenters.filter(c => c.company_id === companyId);
  const companyDevices = devices.filter(d => d.company_id === companyId);
  const companyEntries = timeEntries.filter(t => t.company_id === companyId);
  const companyIncidents = incidents.filter(i => i.company_id === companyId);
  const companyRequests = requests.filter(r => r.company_id === companyId);
  const companyAuditLogs = auditLogs.filter(a => a.company_id === companyId);

  // Stats Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayPunches = companyEntries.filter(t => t.registered_at.startsWith(todayStr) && t.status === 'active');

  // Find present employees (last active punch is entry or break_end)
  const getEmployeeStatusToday = () => {
    const present: string[] = [];
    const resting: string[] = [];
    const outside: string[] = [];
    const absent: string[] = [];

    companyEmployees.forEach(emp => {
      const empPunchesToday = todayPunches
        .filter(p => p.employee_id === emp.id)
        .sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());

      if (empPunchesToday.length === 0) {
        absent.push(emp.id);
      } else {
        const lastPunch = empPunchesToday[empPunchesToday.length - 1];
        if (lastPunch.entry_type === 'entry' || lastPunch.entry_type === 'break_end') {
          present.push(emp.id);
        } else if (lastPunch.entry_type === 'break_start') {
          resting.push(emp.id);
        } else {
          outside.push(emp.id);
        }
      }
    });

    return { present, resting, outside, absent };
  };

  const { present, resting, outside, absent } = getEmployeeStatusToday();
  const away = [...outside, ...absent];
  const pendingRequests = companyRequests.filter(r => r.status === 'pending');

  const formatLastPunchTime = (dateStr?: string) => {
    if (!dateStr) return 'Sin registros';
    const date = new Date(dateStr);
    const today = new Date();
    
    const isToday = date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
      
    const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) {
      return `Hoy a las ${timeStr}`;
    } else {
      const dateStrFormatted = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `${dateStrFormatted} a las ${timeStr}`;
    }
  };

  // Superadmin: Company CRUD handlers
  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName || !commercialName || !taxId || !compCode) {
      showAlert('Nombre, C.I.F. y Código de Empresa son obligatorios.', 'error');
      return;
    }

    const cleanCode = compCode.trim().toUpperCase();

    if (editingCompany) {
      const updated = companies.map(c => c.id === editingCompany.id ? {
        ...c,
        legal_name: legalName,
        commercial_name: commercialName,
        tax_id: taxId,
        company_code: cleanCode,
        address: compAddress || undefined,
        email: compEmail || undefined,
        phone: compPhone || undefined,
        session_timeout_minutes: compSessionTimeout,
        status: compStatus,
        updated_at: new Date().toISOString()
      } : c);
      if (setCompanies) setCompanies(updated);
      showAlert('Empresa modificada con éxito.', 'success');
    } else {
      if (companies.some(c => c.company_code === cleanCode)) {
        showAlert('Este código de empresa ya está en uso.', 'error');
        return;
      }

      const newCompany: Company = {
        id: 'comp-' + Math.random().toString(36).substr(2, 9),
        legal_name: legalName,
        commercial_name: commercialName,
        tax_id: taxId,
        company_code: cleanCode,
        address: compAddress || undefined,
        email: compEmail || undefined,
        phone: compPhone || undefined,
        status: 'active',
        session_timeout_minutes: compSessionTimeout,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (setCompanies) setCompanies(prev => [...prev, newCompany]);
      showAlert('Nueva empresa registrada con éxito.', 'success');
    }

    setShowCompanyModal(false);
  };

  const openCompanyModal = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setLegalName(company.legal_name);
      setCommercialName(company.commercial_name);
      setTaxId(company.tax_id);
      setCompCode(company.company_code);
      setCompAddress(company.address || '');
      setCompEmail(company.email || '');
      setCompPhone(company.phone || '');
      setCompSessionTimeout(company.session_timeout_minutes);
      setCompStatus(company.status);
    } else {
      setEditingCompany(null);
      setLegalName('');
      setCommercialName('');
      setTaxId('');
      setCompCode('');
      setCompAddress('');
      setCompEmail('');
      setCompPhone('');
      setCompSessionTimeout(5);
      setCompStatus('active');
    }
    setShowCompanyModal(true);
  };

  const handleToggleBlock = (companyId: string) => {
    if (setCompanies) {
      setCompanies(prev => prev.map(c => {
        if (c.id === companyId) {
          const nextStatus = c.status === 'active' ? 'blocked' as const : 'active' as const;
          showAlert(`Empresa ${nextStatus === 'blocked' ? 'BLOQUEADA' : 'ACTIVADA'} correctamente.`, 'success');
          return { ...c, status: nextStatus, updated_at: new Date().toISOString() };
        }
        return c;
      }));
    }
  };

  // Superadmin: Admin Assignment handler
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName || !adminEmail || !adminPass) {
      showAlert('Complete todos los campos del administrador.', 'error');
      return;
    }

    const emailExists = profiles.some(p => p.email.toLowerCase() === adminEmail.trim().toLowerCase());
    if (emailExists) {
      showAlert('Este correo electrónico ya está registrado en el sistema.', 'error');
      return;
    }

    const updatedProfiles = profiles.map(p => 
      (p.company_id === adminTargetCompanyId && p.role === 'company_admin') 
        ? { ...p, status: 'blocked' as const, updated_at: new Date().toISOString() } 
        : p
    );

    const newAdmin: Profile = {
      id: 'prof-' + Math.random().toString(36).substr(2, 9),
      auth_user_id: 'auth-' + Math.random().toString(36).substr(2, 9),
      full_name: adminName,
      email: adminEmail.trim().toLowerCase(),
      role: 'company_admin',
      company_id: adminTargetCompanyId,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (setProfiles) setProfiles([...updatedProfiles, newAdmin]);
    showAlert(`Administrador asignado correctamente a la empresa.`, 'success');
    setShowAdminModal(false);
    setAdminName('');
    setAdminEmail('');
    setAdminPass('');
  };

  const openAdminModal = (companyId: string) => {
    setAdminTargetCompanyId(companyId);
    setAdminName('');
    setAdminEmail('');
    setAdminPass('');
    setShowAdminModal(true);
  };

  // Superadmin: Global parameters save
  const handleSaveGlobalTimeout = (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalSettingsSuccess(true);
    setTimeout(() => setGlobalSettingsSuccess(false), 2000);
  };

  // ==========================================
  // NEW SYSTEM FORM HANDLERS: CALENDARS & OVERTIME
  // ==========================================

  // 1. Create Calendar Handler
  const handleCreateCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCalendarCenterId) {
      showAlert('Seleccione un centro de trabajo.', 'error');
      return;
    }
    try {
      await addLaborCalendar({
        company_id: companyId,
        work_center_id: selectedCalendarCenterId,
        year: selectedCalendarYear,
        working_week_model: newCalendarModel
      });
      showAlert('Calendario creado en estado Borrador correctamente.', 'success');
      setShowCreateCalendarModal(false);
    } catch (err: any) {
      showAlert(err.message || 'Error al crear el calendario.', 'error');
    }
  };

  // 2. Save Day Details (editing a specific day in the calendar)
  const handleSaveDayDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dayToEditDate || !dayToEditTypeId) return;

    // Find active calendar
    const activeCal = laborCalendars.find(c => c.work_center_id === selectedCalendarCenterId && c.year === selectedCalendarYear);
    if (!activeCal) return;

    // Block modifying active calendars
    if (activeCal.status === 'active') {
      showAlert('No se puede modificar un calendario activo.', 'error');
      return;
    }

    try {
      const existing = calendarDays.find(d => d.calendar_id === activeCal.id && d.date === dayToEditDate);
      const daySetting = dayTypeSettings.find(s => s.id === dayToEditTypeId);
      if (!daySetting) return;

      const newDayObj: CalendarDay = existing ? {
        ...existing,
        name: dayToEditName,
        day_type_setting_id: dayToEditTypeId,
        classification: daySetting.classification,
        manually_modified: true,
        notes: dayToEditNotes,
        updated_by: currentUser.profile?.id,
        updated_at: new Date().toISOString()
      } : {
        id: safeUUID(),
        calendar_id: activeCal.id,
        date: dayToEditDate,
        day_type_setting_id: dayToEditTypeId,
        name: dayToEditName,
        classification: daySetting.classification,
        source_type: 'manual',
        is_manual: true,
        manually_modified: false,
        review_status: 'confirmed',
        notes: dayToEditNotes,
        created_by: currentUser.profile?.id,
        updated_by: currentUser.profile?.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setCalendarDays(prev => {
        const other = prev.filter(d => d.id !== newDayObj.id && !(d.calendar_id === newDayObj.calendar_id && d.date === newDayObj.date));
        return [...other, newDayObj];
      });

      if (activeCal.status !== 'draft') {
        await updateLaborCalendar({
          ...activeCal,
          status: 'draft',
          reviewed_by: undefined,
          reviewed_at: undefined
        });
      }

      showAlert('Día actualizado correctamente en el calendario.', 'success');
      setShowDayEditModal(false);

      // Cascade recalculate company hours
      setTimeout(() => recalculateCompanyHours(companyId), 500);
    } catch (err: any) {
      showAlert(err.message || 'Error al actualizar el día.', 'error');
    }
  };

  const handleSaveCalendarDraft = async (calendar: LaborCalendar) => {
    const pendingConflicts = calendarImportConflicts.filter(
      conflict => conflict.calendar_id === calendar.id && conflict.resolution === 'pending'
    );
    if (pendingConflicts.length > 0) {
      showAlert('Resuelva todos los conflictos de importación antes de guardar el calendario.', 'error');
      return;
    }

    try {
      await updateLaborCalendar({
        ...calendar,
        status: 'pending_review',
        reviewed_by: currentUser.profile?.id,
        reviewed_at: new Date().toISOString()
      });
      showAlert('Calendario guardado correctamente. Ya puede activarlo cuando esté listo.', 'success');
    } catch (err: any) {
      showAlert(err.message || 'No se pudo guardar el calendario.', 'error');
    }
  };

  // 3. Save Day Type Setting (CRUD)
  const handleSaveDayType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dayTypeName.trim()) return;

    try {
      const code = editingDayType ? editingDayType.code : 'custom_' + Math.random().toString(36).substr(2, 5);
      const newSetting = {
        id: editingDayType ? editingDayType.id : safeUUID(),
        company_id: companyId,
        code,
        name: dayTypeName,
        classification: editingDayType ? editingDayType.classification : 'custom_company_day',
        is_working_day: dayTypeMultiplier > 0,
        reduces_weekly_target: dayTypeReduces,
        special_target_minutes: dayTypeSpecialMin !== '' ? Number(dayTypeSpecialMin) : undefined,
        work_multiplier: Number(dayTypeMultiplier),
        color: dayTypeColor,
        is_system_type: editingDayType ? editingDayType.is_system_type : false,
        status: 'active' as const,
        created_at: editingDayType ? editingDayType.created_at : new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setDayTypeSettings(prev => {
        const other = prev.filter(s => s.id !== newSetting.id);
        return [...other, newSetting];
      });

      showAlert('Tipo de día guardado correctamente.', 'success');
      setShowDayTypeModal(false);
      setEditingDayType(null);
      setDayTypeName('');
      setDayTypeSpecialMin('');
      setDayTypeColor('#E2E8F0');

      // Cascade recalculate
      setTimeout(() => recalculateCompanyHours(companyId), 500);
    } catch (err: any) {
      showAlert(err.message || 'Error al guardar tipo de día.', 'error');
    }
  };

  // 4. Save Weekly Contract Handler
  const handleSaveContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractEmployeeId || !contractWeeklyMin || !contractFrom) {
      showAlert('Complete todos los campos del contrato.', 'error');
      return;
    }
    try {
      const contractData = {
        employee_id: contractEmployeeId,
        weekly_minutes: Number(contractWeeklyMin),
        effective_from: contractFrom,
        effective_to: contractTo || undefined,
        reason: contractReason
      };

      if (editingContract) {
        await updateWeeklyContract({
          ...editingContract,
          ...contractData
        });
        showAlert('Contrato semanal actualizado correctamente.', 'success');
      } else {
        await addWeeklyContract(contractData);
        showAlert('Contrato semanal añadido correctamente.', 'success');
      }

      setShowContractModal(false);
      setEditingContract(null);
      setContractReason('');
      setContractTo('');
    } catch (err: any) {
      showAlert(err.message || 'Error al guardar el contrato.', 'error');
    }
  };

  // 5. Save Overtime Adjustment Handler
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentTargetSummaryId || !adjustmentTargetEmployeeId || !adjustmentReasonText.trim()) {
      showAlert('Debe completar todos los campos.', 'error');
      return;
    }

    try {
      const minutes = Math.round(adjustmentAmountHours * 60);
      await addOvertimeAdjustment(
        adjustmentTargetSummaryId,
        adjustmentTargetEmployeeId,
        minutes,
        adjustmentReasonText
      );

      await refreshData();

      showAlert('Ajuste de horas extra guardado correctamente.', 'success');
      setShowAdjustmentModal(false);
      setAdjustmentAmountHours(0);
      setAdjustmentReasonText('');
    } catch (err: any) {
      showAlert(err.message || 'Error al aplicar el ajuste.', 'error');
    }
  };

  // Open Employee Modal
  const openEmpModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmp(emp);
      setEmpDni(emp.dni);
      setEmpName(emp.full_name);
      setEmpEmail(emp.email || '');
      setEmpPhone(emp.phone || '');
      setEmpJobTitle(emp.job_title || '');
      setEmpDept(emp.department || '');
      setEmpHireDate(emp.hire_date);
      setEmpStatus(emp.status);
      setEmpCompanyId(emp.company_id);
      const centers = employeeWorkCenters
        .filter(ewc => ewc.employee_id === emp.id)
        .map(ewc => ewc.work_center_id);
      setEmpCentersSelected(centers);
    } else {
      setEditingEmp(null);
      setEmpDni('');
      setEmpName('');
      setEmpEmail('');
      setEmpPhone('');
      setEmpJobTitle('');
      setEmpDept('');
      setEmpHireDate(new Date().toISOString().split('T')[0]);
      setEmpStatus('active');
      setEmpCompanyId(companyId);
      setEmpCentersSelected([]);
    }
    setShowEmpModal(true);
  };

  // Handle Employee Form Submit
  const handleEmpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empDni || !empName) {
      showAlert('DNI y Nombre son obligatorios.', 'error');
      return;
    }

    if (editingEmp) {
      updateEmployee({
        ...editingEmp,
        company_id: empCompanyId,
        dni: empDni,
        full_name: empName,
        email: empEmail || undefined,
        phone: empPhone || undefined,
        job_title: empJobTitle || undefined,
        department: empDept || undefined,
        hire_date: empHireDate,
        status: empStatus
      }, empCentersSelected);
    } else {
      const generatedPin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 9000 + 1000);
      addEmployee({
        company_id: empCompanyId,
        dni: empDni,
        full_name: empName,
        pin_hash: generatedPin,
        email: empEmail || undefined,
        phone: empPhone || undefined,
        job_title: empJobTitle || undefined,
        department: empDept || undefined,
        hire_date: empHireDate,
        status: empStatus
      }, empCentersSelected);
      showAlert(`Empleado creado con éxito. PIN inicial generado automáticamente: ${generatedPin}`, 'success', 'PIN Generado');
    }
    setShowEmpModal(false);
  };

  // Handle Work Center Form Submit
  const handleCenterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerName || !centerAddress) {
      showAlert('Nombre y Dirección son obligatorios.', 'error');
      return;
    }

    const lat = centerLat ? Number(centerLat) : undefined;
    const lng = centerLng ? Number(centerLng) : undefined;

    if (editingCenter) {
      updateWorkCenter({
        ...editingCenter,
        company_id: centerCompanyId,
        name: centerName,
        address: centerAddress,
        latitude: lat,
        longitude: lng,
        province: centerProvince || undefined,
        municipality: centerCity || undefined,
        status: centerStatus
      });
      showAlert('Centro de trabajo modificado correctamente.', 'success');
    } else {
      addWorkCenter(centerCompanyId, centerName, centerAddress, lat, lng, centerRadius, centerStatus, centerProvince || undefined, centerCity || undefined);
      showAlert('Centro de trabajo creado correctamente.', 'success');
    }

    setShowCenterModal(false);
    setEditingCenter(null);
    setCenterName('');
    setCenterAddress('');
    setCenterLat('');
    setCenterLng('');
    setCenterRadius(50);
    setCenterProvince('');
    setCenterCity('');
  };

  const openCenterModal = (center?: WorkCenter) => {
    if (center) {
      setEditingCenter(center);
      setCenterName(center.name);
      setCenterAddress(center.address || '');
      setCenterLat(center.latitude ? String(center.latitude) : '');
      setCenterLng(center.longitude ? String(center.longitude) : '');
      setCenterStatus(center.status);
      setCenterCompanyId(center.company_id);
      setCenterProvince(center.province || '');
      setCenterCity(center.municipality || '');
    } else {
      setEditingCenter(null);
      setCenterName('');
      setCenterAddress('');
      setCenterLat('');
      setCenterLng('');
      setCenterStatus('active');
      setCenterCompanyId(companyId);
      setCenterProvince('');
      setCenterCity('');
    }
    setShowCenterModal(true);
  };

  // Handle Device Form Submit
  const handleDeviceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName || !deviceCenterId) {
      showAlert('Nombre y Centro son obligatorios.', 'error');
      return;
    }

    if (editingDevice) {
      updateDevice({
        ...editingDevice,
        name: deviceName,
        work_center_id: deviceCenterId,
        status: deviceStatus,
        camera_validation_status: deviceCameraStatus
      });

      // Update work center coordinates if they changed
      const center = workCenters.find(c => c.id === deviceCenterId);
      if (center) {
        const newLat = deviceLat ? Number(deviceLat) : undefined;
        const newLng = deviceLng ? Number(deviceLng) : undefined;
        if (center.latitude !== newLat || center.longitude !== newLng) {
          updateWorkCenter({
            ...center,
            latitude: newLat,
            longitude: newLng
          });
        }
      }

      showAlert('Dispositivo modificado correctamente.', 'success');
    }
    setShowDeviceModal(false);
    setEditingDevice(null);
  };

  const openDeviceModal = (dev: AuthorizedDevice) => {
    setEditingDevice(dev);
    setDeviceName(dev.name);
    setDeviceCenterId(dev.work_center_id);
    setDeviceStatus(dev.status);
    setDeviceCameraStatus(dev.camera_validation_status);

    // Find the center coordinates and set them
    const center = workCenters.find(c => c.id === dev.work_center_id);
    setDeviceLat(center?.latitude ? String(center.latitude) : '');
    setDeviceLng(center?.longitude ? String(center.longitude) : '');

    setShowDeviceModal(true);
  };

  // Helper to parse coordinates from text/Google Maps URLs
  const parseCoordinates = (text: string) => {
    const geoRegex = /@?(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
    const match = text.match(geoRegex);
    if (match) {
      return { lat: match[1], lng: match[2] };
    }
    return null;
  };

  // Map Picker Helper
  const handleOpenMapPicker = () => {
    let initialLat = 40.416775;
    let initialLng = -3.703790;

    if (deviceLat && !isNaN(Number(deviceLat))) {
      initialLat = Number(deviceLat);
    }
    if (deviceLng && !isNaN(Number(deviceLng))) {
      initialLng = Number(deviceLng);
    }

    mapInitialPositionRef.current = [initialLat, initialLng];
    setMapPickerLat(initialLat);
    setMapPickerLng(initialLng);
    setMapSearchText('');
    setShowMapPickerModal(true);
  };

  // Leaflet Map Picker Initializer
  const mapRef = React.useRef<L.Map | null>(null);
  const markerRef = React.useRef<L.Marker | null>(null);
  const mapInitialPositionRef = React.useRef<[number, number]>([40.416775, -3.703790]);

  React.useEffect(() => {
    if (!showMapPickerModal) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
      return;
    }

    const timer = setTimeout(() => {
      const mapEl = document.getElementById('leaflet-map-picker');
      if (!mapEl) return;

      const [initialLat, initialLng] = mapInitialPositionRef.current;
      const map = L.map('leaflet-map-picker').setView([initialLat, initialLng], 15);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      const defaultIcon = L.icon({
        iconUrl: markerIconUrl,
        iconRetinaUrl: markerIconRetinaUrl,
        shadowUrl: markerShadowUrl,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowSize: [41, 41]
      });

      const marker = L.marker([initialLat, initialLng], {
        draggable: true,
        icon: defaultIcon
      }).addTo(map);
      markerRef.current = marker;

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setMapPickerLat(pos.lat);
        setMapPickerLng(pos.lng);
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        setMapPickerLat(e.latlng.lat);
        setMapPickerLng(e.latlng.lng);
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [showMapPickerModal]);

  // Handle PIN Change
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinSuccess('');
    if (newPinValue.length !== 4 || isNaN(Number(newPinValue))) {
      setPinError('El PIN debe tener exactamente 4 números.');
      return;
    }

    try {
      await changeEmployeePin(pinTargetEmpId, newPinValue);
      setPinSuccess('PIN actualizado correctamente.');
      setTimeout(() => {
        setShowPinModal(false);
      }, 1000);
    } catch (err: any) {
      setPinError(err.message || 'Error actualizando PIN.');
    }
  };

  // Handle Incident Resolution
  const handleResolveIncidentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentJustification.trim()) {
      showAlert('La justificación es obligatoria.', 'error');
      return;
    }

    resolveIncident(resolveIncidentId, incidentJustification);
    showAlert('Incidencia justificada y resuelta correctamente.', 'success');
    setShowResolveIncidentModal(false);
    setIncidentJustification('');
  };

  // Handle Request Resolution
  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveResponseText) {
      showAlert('Escriba una respuesta explicativa.', 'error');
      return;
    }
    resolveRequest(resolveTargetId, resolveType, resolveResponseText);
    showAlert(`Solicitud ${resolveType === 'approved' ? 'aprobada' : 'rechazada'} correctamente.`, 'success');
    setShowResolveModal(false);
    setResolveResponseText('');
  };

  const openResolveModal = (reqId: string, type: 'approved' | 'rejected') => {
    setResolveTargetId(reqId);
    setResolveType(type);
    setResolveResponseText('');
    setShowResolveModal(true);
  };

  // Handle Manual Punch
  const handleManualPunchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEmpId || !manualReason) {
      showAlert('Complete todos los campos.', 'error');
      return;
    }

    const regTime = `${manualDate}T${manualTime}:00+02:00`;
    const newEntry: TimeEntry = {
      id: 'entry-' + Math.random().toString(36).substr(2, 9),
      company_id: companyId,
      work_center_id: companyCenters[0]?.id || 'unknown',
      employee_id: manualEmpId,
      entry_type: manualEntryType,
      registered_at: regTime,
      photo_status: 'missing',
      gps_status: 'missing',
      has_incident: false,
      source: 'administrator',
      status: 'active',
      manual_reason: manualReason,
      created_by: adminProfile ? adminProfile.id : 'superadmin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setTimeEntries(prev => [...prev, newEntry]);

    showAlert('Fichaje creado manualmente por el administrador.', 'success');
    setShowManualPunchModal(false);
    setManualEmpId('');
    setManualReason('');
  };

  // Handle Void punch submit
  const handleVoidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidReason) return;

    setTimeEntries(prev => prev.map(t => t.id === voidTargetId ? {
      ...t,
      status: 'cancelled',
      manual_reason: voidReason,
      updated_at: new Date().toISOString()
    } : t));

    showAlert('Fichaje anulado correctamente. Guardado en auditoría.', 'success');
    setShowVoidModal(false);
    setVoidReason('');
  };

  // Handle Purge submit
  const handlePurgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (purgeConfirmText !== 'ELIMINAR DEFINITIVAMENTE') {
      showAlert('Escriba exactamente "ELIMINAR DEFINITIVAMENTE" para confirmar.', 'error');
      return;
    }

    deleteOldEntries(purgeTargetCompanyId || companyId);
    showAlert('Se han eliminado de forma definitiva todos los registros de fichajes con más de 4 años.', 'success');
    setShowPurgeModal(false);
    setPurgeConfirmText('');
    setPurgeTargetCompanyId('');
  };

  // Save timeouts
  const handleSaveTimeout = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanySettings(sessionTimeout);
    setSettingsSuccess(true);
    setTimeout(() => setSettingsSuccess(false), 2000);
  };

  // Detail of records report: one row per employee and working day.
  const reportRows = (() => {
    const filteredEntries = companyEntries
      .filter(t => t.status === 'active')
      .filter(t => !reportEmpId || t.employee_id === reportEmpId)
      .filter(t => !reportCenterId || t.work_center_id === reportCenterId)
      .filter(t => {
        const dateStr = t.registered_at.split('T')[0];
        return dateStr >= reportStartDate && dateStr <= reportEndDate;
      })
      .sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());

    const rowsByEmployeeAndDate = new globalThis.Map<string, {
      employeeId: string;
      date: string;
      entry?: TimeEntry;
      breakStart?: TimeEntry;
      exit?: TimeEntry;
    }>();

    filteredEntries.forEach(timeEntry => {
      const date = timeEntry.registered_at.split('T')[0];
      const key = `${timeEntry.employee_id}:${date}`;
      const row = rowsByEmployeeAndDate.get(key) || {
        employeeId: timeEntry.employee_id,
        date
      };

      if (timeEntry.entry_type === 'entry' && !row.entry) {
        row.entry = timeEntry;
      } else if (timeEntry.entry_type === 'break_start' && !row.breakStart) {
        row.breakStart = timeEntry;
      } else if (timeEntry.entry_type === 'exit') {
        row.exit = timeEntry;
      }
      rowsByEmployeeAndDate.set(key, row);
    });

    return [...rowsByEmployeeAndDate.values()]
      .map(row => ({
        ...row,
        employee: companyEmployees.find(employee => employee.id === row.employeeId)
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || (a.employee?.full_name || '').localeCompare(b.employee?.full_name || ''));
  })();

  const formatReportDateTime = (timeEntry?: TimeEntry) => {
    if (!timeEntry) return '—';
    return new Date(timeEntry.registered_at).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getReportDeviceName = (timeEntry?: TimeEntry) => {
    if (!timeEntry) return '—';
    if (!timeEntry.device_id) return timeEntry.source === 'administrator' ? 'Administrador' : 'Sin dispositivo';
    return devices.find(device => device.id === timeEntry.device_id)?.name || 'Dispositivo no disponible';
  };

  const formatReportEvent = (timeEntry?: TimeEntry) => {
    if (!timeEntry) return '—';
    return `${formatReportDateTime(timeEntry)} (${getReportDeviceName(timeEntry)})`;
  };

  // Report Downloads
  const downloadExcel = () => {
    const exportRows = reportRows.map(row => ({
      'Empleado': row.employee?.full_name || 'Desconocido',
      'Fecha': row.date,
      'Entrada (Dispositivo)': formatReportEvent(row.entry),
      'Descanso (Dispositivo)': formatReportEvent(row.breakStart),
      'Salida (Dispositivo)': formatReportEvent(row.exit)
    }));

    downloadCsv(exportRows, `detalle_registros_${activeCompany?.commercial_name || 'empresa'}.csv`);
  };

  const downloadPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFont('Helvetica', 'bold');
    doc.text(`DETALLE DE REGISTROS - ${(activeCompany?.commercial_name || 'empresa').toUpperCase()}`, 14, 16);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Periodo: ${reportStartDate} al ${reportEndDate}`, 14, 22);

    let y = 31;
    doc.setFont('Helvetica', 'bold');
    doc.text('Empleado', 14, y);
    doc.text('Entrada (dispositivo)', 70, y);
    doc.text('Descanso (dispositivo)', 142, y);
    doc.text('Salida (dispositivo)', 214, y);
    doc.line(14, y + 2, 283, y + 2);
    y += 7;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    reportRows.forEach(row => {
      if (y > 195) {
        doc.addPage();
        y = 20;
      }
      doc.text((row.employee?.full_name || 'Desconocido').slice(0, 22), 14, y);
      doc.text(formatReportEvent(row.entry).slice(0, 37), 70, y);
      doc.text(formatReportEvent(row.breakStart).slice(0, 37), 142, y);
      doc.text(formatReportEvent(row.exit).slice(0, 37), 214, y);
      y += 7;
    });

    doc.save(`detalle_registros_${activeCompany?.commercial_name || 'empresa'}.pdf`);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen bg-brand-cream/20">
      {/* Side Menu Navigation */}
      <aside className="w-full md:w-64 bg-brand-maroon text-white flex flex-col shrink-0 border-r border-brand-border/40 shadow-lg md:sticky md:top-0 md:h-screen">
        <div className="p-6 border-b border-white/10 text-center">
          <h2 className="text-xl font-bold tracking-wider uppercase">
            {isSuperadmin ? 'PANEL SUPERADMIN' : 'Panel Admin'}
          </h2>
          <p className="text-xs text-white/60 mt-1 truncate">
            {isSuperadmin ? 'Control Centralizado' : activeCompany?.commercial_name}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {/* Superadmin specific tab: Companies */}
          {isSuperadmin && (
            <button
              onClick={() => setActiveTab('companies')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${
                activeTab === 'companies' 
                  ? 'bg-white text-brand-maroon shadow-md' 
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Building className="w-4 h-4" />
              Gestión Empresas
            </button>
          )}

          {/* Common Company Admin tabs */}
          {([
            { id: 'dashboard', label: 'Dashboard', icon: Users },
            { id: 'employees', label: 'Empleados', icon: Users },
            { id: 'centers', label: 'Centros de Trabajo', icon: Building },
            { id: 'calendars', label: 'Calendarios Laborales', icon: Calendar },
            { id: 'overtime', label: 'Cuadrante y Horas Extra', icon: Clock },
            { id: 'devices', label: 'Dispositivos', icon: Video },
            { id: 'entries', label: 'Fichajes', icon: Clock },
            { id: 'requests', label: 'Solicitudes', icon: FileText },
            { id: 'incidents', label: 'Incidencias', icon: AlertTriangle },
            { id: 'audit', label: 'Auditoría', icon: ShieldAlert },
            { id: 'reports', label: 'Informes', icon: FileSpreadsheet },
            { id: 'settings', label: 'Configuración', icon: Settings }
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${
                activeTab === tab.id 
                  ? 'bg-white text-brand-maroon shadow-md' 
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'requests' && pendingRequests.length > 0 && (
                <span className="ml-auto bg-amber-500 text-white rounded-full text-[10px] px-2 py-0.5 animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ))}

          {/* Superadmin specific tab: Global Settings */}
          {isSuperadmin && (
            <button
              onClick={() => setActiveTab('settings_global')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${
                activeTab === 'settings_global' 
                  ? 'bg-white text-brand-maroon shadow-md' 
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <Settings className="w-4 h-4" />
              Parámetros Globales
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button 
            onClick={logout} 
            className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Panel Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {/* Active Company Selector Header for Superadmin (Only visible on common tabs) */}
        {isSuperadmin && activeTab !== 'companies' && activeTab !== 'settings_global' && (
          <div className="bg-brand-card p-4 rounded-2xl border border-brand-border flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm mb-6 animate-scale-up">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-brand-maroon" />
              <span className="font-extrabold text-sm text-brand-text">Gestión Activa en Modo Superadmin:</span>
            </div>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full sm:w-72 px-4 py-2 border border-brand-border bg-white rounded-xl text-sm font-bold text-brand-text focus:ring-2 focus:ring-brand-maroon focus:outline-none"
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.commercial_name} ({c.company_code})</option>
              ))}
            </select>
          </div>
        )}

        {/* Tab 0. COMPANIES (Superadmin Only) */}
        {isSuperadmin && activeTab === 'companies' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-brand-maroon">GESTIÓN DE EMPRESAS</h1>
              <button
                onClick={() => openCompanyModal()}
                className="flex items-center gap-1.5 bg-brand-maroon text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-brand-maroon/90 active:scale-95 transition-all shadow-md uppercase"
              >
                <Plus className="w-4 h-4" /> Crear Empresa
              </button>
            </div>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                    <th className="px-4 py-3">Cód</th>
                    <th className="px-4 py-3">Nombre Comercial</th>
                    <th className="px-4 py-3">Administrador</th>
                    <th className="px-4 py-3">Empleados</th>
                    <th className="px-4 py-3">Centros</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs font-semibold">
                  {companies.map(comp => {
                    const empCount = employees.filter(e => e.company_id === comp.id).length;
                    const wcCount = workCenters.filter(w => w.company_id === comp.id).length;
                    const admin = profiles.find(p => p.company_id === comp.id && p.role === 'company_admin' && p.status === 'active');
                    
                    return (
                      <tr key={comp.id} className="hover:bg-brand-cream/10">
                        <td className="px-4 py-3.5 font-mono">{comp.company_code}</td>
                        <td className="px-4 py-3.5">{comp.commercial_name}</td>
                        <td className="px-4 py-3.5">
                          {admin ? (
                            <div>
                              <p className="font-bold">{admin.full_name}</p>
                              <p className="text-[10px] text-brand-subtext">{admin.email}</p>
                            </div>
                          ) : (
                            <span className="text-amber-600 font-bold">Sin asignar</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">{empCount}</td>
                        <td className="px-4 py-3.5">{wcCount}</td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            comp.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                          }`}>
                            {comp.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openAdminModal(comp.id)}
                              className="p-1.5 text-brand-maroon hover:bg-brand-cream/50 rounded-lg transition-all"
                              title="Asignar Administrador"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleBlock(comp.id)}
                              className={`p-1.5 rounded-lg transition-all ${
                                comp.status === 'active' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={comp.status === 'active' ? 'Bloquear Empresa' : 'Desbloquear Empresa'}
                            >
                              {comp.status === 'active' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                setPurgeTargetCompanyId(comp.id);
                                setShowPurgeModal(true);
                              }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Purgar Datos"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openCompanyModal(comp)}
                              className="p-1.5 text-brand-maroon hover:bg-brand-cream/50 rounded-lg transition-all"
                              title="Editar Empresa"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1. DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-maroon">DASHBOARD COMERCIAL</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs uppercase text-brand-subtext font-bold">Activos Hoy</h3>
                  <p className="text-3xl font-black text-brand-text">{present.length}</p>
                </div>
              </div>

              <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs uppercase text-brand-subtext font-bold">En Descanso</h3>
                  <p className="text-3xl font-black text-brand-text">{resting.length}</p>
                </div>
              </div>

              <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm flex items-center gap-4">
                <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xs uppercase text-brand-subtext font-bold">Fuera</h3>
                  <p className="text-3xl font-black text-brand-text">{away.length}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
              <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm space-y-4">
                <h2 className="font-extrabold text-sm text-brand-maroon uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                  Presentes en Centro
                </h2>
                <div className="divide-y divide-brand-border text-xs font-semibold max-h-60 overflow-y-auto">
                  {present.length === 0 ? (
                    <p className="text-brand-subtext text-center py-4">No hay empleados trabajando actualmente.</p>
                  ) : (
                    present.map(id => {
                      const emp = companyEmployees.find(e => e.id === id);
                      const lastEntry = [...companyEntries]
                        .filter(p => p.employee_id === id && p.entry_type === 'entry' && p.status === 'active')
                        .sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime())[0];
                      return (
                        <div key={id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <p className="text-brand-text font-bold">{emp?.full_name}</p>
                            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                              Llegada: {formatLastPunchTime(lastEntry?.registered_at)}
                            </p>
                          </div>
                          <span className="font-mono text-[10px] text-brand-subtext">{emp?.employee_code}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm space-y-4">
                <h2 className="font-extrabold text-sm text-amber-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span>
                  Descansos
                </h2>
                <div className="divide-y divide-brand-border text-xs font-semibold max-h-60 overflow-y-auto">
                  {resting.length === 0 ? (
                    <p className="text-brand-subtext text-center py-4">No hay empleados en descanso.</p>
                  ) : (
                    resting.map(id => {
                      const emp = companyEmployees.find(e => e.id === id);
                      const breakStart = [...companyEntries]
                        .filter(p => p.employee_id === id && p.entry_type === 'break_start' && p.status === 'active')
                        .sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime())[0];
                      return (
                        <div key={id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <p className="text-brand-text font-bold">{emp?.full_name}</p>
                            <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                              Inicio descanso: {formatLastPunchTime(breakStart?.registered_at)}
                            </p>
                          </div>
                          <span className="font-mono text-[10px] text-brand-subtext">{emp?.employee_code}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm space-y-4">
                <h2 className="font-extrabold text-sm text-rose-700 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span>
                  Fuera
                </h2>
                <div className="divide-y divide-brand-border text-xs font-semibold max-h-60 overflow-y-auto">
                  {away.length === 0 ? (
                    <p className="text-brand-subtext text-center py-4">No hay empleados fuera del centro.</p>
                  ) : (
                    away.map(id => {
                      const emp = companyEmployees.find(e => e.id === id);
                      const lastExit = [...companyEntries]
                        .filter(p => p.employee_id === id && p.entry_type === 'exit' && p.status === 'active')
                        .sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime())[0];
                      return (
                        <div key={id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <p className="text-brand-text font-bold">{emp?.full_name}</p>
                            <p className="text-[10px] text-rose-600 font-bold mt-0.5">
                              {lastExit
                                ? `Última salida: ${formatLastPunchTime(lastExit.registered_at)}`
                                : 'Sin fichajes registrados hoy'}
                            </p>
                          </div>
                          <span className="font-mono text-[10px] text-brand-subtext">{emp?.employee_code}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2. EMPLOYEES */}
        {activeTab === 'employees' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-brand-maroon">GESTIÓN DE EMPLEADOS</h1>
              <button
                onClick={() => openEmpModal()}
                className="flex items-center gap-1.5 bg-brand-maroon text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-brand-maroon/90 active:scale-95 transition-all shadow-md uppercase"
              >
                <Plus className="w-4 h-4" /> Add Empleado
              </button>
            </div>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">DNI</th>
                    <th className="px-4 py-3">Centros Asignados</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs font-semibold">
                  {companyEmployees.map(emp => {
                    const empCenters = employeeWorkCenters
                      .filter(ewc => ewc.employee_id === emp.id)
                      .map(ewc => companyCenters.find(wc => wc.id === ewc.work_center_id)?.name)
                      .filter(Boolean);

                    return (
                      <tr key={emp.id} className="hover:bg-brand-cream/10">
                        <td className="px-4 py-3.5 font-mono">{emp.employee_code}</td>
                        <td className="px-4 py-3.5">{emp.full_name}</td>
                        <td className="px-4 py-3.5 font-mono">{emp.dni}</td>
                        <td className="px-4 py-3.5 max-w-[200px] truncate">
                          {empCenters.length > 0 ? empCenters.join(', ') : 'Ninguno'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            emp.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                          }`}>
                            {emp.status === 'active' ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setPinTargetEmpId(emp.id);
                                setNewPinValue('');
                                setPinError('');
                                setPinSuccess('');
                                setShowPinModal(true);
                              }}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                              title="Modificar PIN"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEmpModal(emp)}
                              className="p-1.5 text-brand-maroon hover:bg-brand-cream/50 rounded-lg transition-all"
                              title="Editar Empleado"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3. CENTERS */}
        {activeTab === 'centers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-brand-maroon">CENTROS DE TRABAJO</h1>
              <button
                onClick={() => openCenterModal()}
                className="flex items-center gap-1.5 bg-brand-maroon text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-brand-maroon/90 active:scale-95 transition-all shadow-md uppercase"
              >
                <Plus className="w-4 h-4" /> Nuevo Centro
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companyCenters.map(center => (
                <div key={center.id} className="bg-brand-card p-5 rounded-2xl border border-brand-border shadow-sm flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm">{center.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        center.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                      }`}>
                        {center.status === 'active' ? 'ACTIVO' : 'INACTIVO'}
                      </span>
                    </div>
                    <p className="text-xs text-brand-subtext">{center.address || 'Sin dirección registrada'}</p>
                    {center.latitude && center.longitude && (
                      <p className="text-[10px] font-mono text-brand-subtext">GPS: {center.latitude}, {center.longitude} (R: {center.latitude}m)</p>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-brand-border/40 mt-4">
                    <button
                      onClick={async () => {
                        if (window.confirm(`¿Está seguro de que desea eliminar el centro "${center.name}"?`)) {
                          try {
                            await deleteWorkCenter(center.id);
                            showAlert('Centro de trabajo eliminado con éxito.', 'success');
                          } catch (err: any) {
                            showAlert(err.message || 'Error al eliminar el centro de trabajo.', 'error');
                          }
                        }
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Eliminar Centro"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openCenterModal(center)}
                      className="p-1.5 text-brand-maroon hover:bg-brand-cream/50 rounded-lg transition-all"
                      title="Editar Centro"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4. DEVICES */}
        {activeTab === 'devices' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-maroon">DISPOSITIVOS AUTORIZADOS</h1>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Token del dispositivo</th>
                    <th className="px-4 py-3">Cámara Validada</th>
                    <th className="px-4 py-3">Centro Asignado</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs font-semibold">
                  {companyDevices.map(dev => (
                    <tr key={dev.id} className="hover:bg-brand-cream/10">
                      <td className="px-4 py-3.5">{dev.name}</td>
                      <td className="px-4 py-3.5 font-mono">{dev.device_token}</td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          dev.camera_validation_status === 'validated' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                        }`}>
                          {dev.camera_validation_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {companyCenters.find(c => c.id === dev.work_center_id)?.name || 'N/D'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          dev.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                        }`}>
                          {dev.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex justify-end gap-1.5">
                          {dev.status === 'pending' && (
                            <button
                              onClick={async () => {
                                try {
                                  await approveDeviceRegistration(dev.id);
                                  showAlert('Dispositivo aprobado correctamente.', 'success');
                                } catch (err: any) {
                                  showAlert(err.message || 'No se pudo aprobar el dispositivo.', 'error');
                                }
                              }}
                              className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                              title="Aprobar Dispositivo"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openDeviceModal(dev)}
                            className="p-1.5 text-brand-maroon hover:bg-brand-cream/50 rounded-lg transition-all"
                            title="Editar Dispositivo"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          {dev.status === 'active' && (
                            <button
                              onClick={() => deauthorizeDevice(dev.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Desactivar Dispositivo"
                            >
                              <Power className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => { setDeleteDeviceTarget(dev); setDeleteDeviceError(''); setShowDeleteDeviceModal(true); }}
                            className="p-1.5 text-red-800 hover:bg-red-100 rounded-lg transition-all"
                            title="Eliminar Dispositivo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5. ENTRIES */}
        {activeTab === 'entries' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-brand-maroon">HISTORIAL DE FICHAJES</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPurgeModal(true)}
                  className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-red-700 active:scale-95 transition-all shadow-md uppercase"
                >
                  <Trash2 className="w-4 h-4" /> Purga (+4 años)
                </button>
                <button
                  onClick={() => setShowManualPunchModal(true)}
                  className="flex items-center gap-1.5 bg-brand-maroon text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-brand-maroon/90 active:scale-95 transition-all shadow-md uppercase"
                >
                  <Plus className="w-4 h-4" /> Crear Manual
                </button>
              </div>
            </div>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                    <th className="px-4 py-3">Empleado</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Hora</th>
                    <th className="px-4 py-3">Fichaje</th>
                    <th className="px-4 py-3">Foto / GPS</th>
                    <th className="px-4 py-3">Origen</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs font-semibold">
                  {companyEntries.map(entry => {
                    const emp = companyEmployees.find(e => e.id === entry.employee_id);
                    return (
                      <tr key={entry.id} className={`hover:bg-brand-cream/10 ${entry.status === 'cancelled' ? 'bg-red-50/20 text-gray-400' : ''}`}>
                        <td className="px-4 py-3.5">
                          <div>
                            <p className="font-bold">{emp?.full_name || 'Desconocido'}</p>
                            <p className="text-[10px] text-brand-subtext">{emp?.employee_code}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">{new Date(entry.registered_at).toLocaleDateString('es-ES')}</td>
                        <td className="px-4 py-3.5 font-mono">{new Date(entry.registered_at).toLocaleTimeString('es-ES')}</td>
                        <td className="px-4 py-3.5">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            entry.entry_type === 'entry' ? 'bg-emerald-50 text-emerald-800' :
                            entry.entry_type === 'exit' ? 'bg-rose-50 text-rose-800' :
                            'bg-amber-50 text-amber-800'
                          }`}>
                            {entry.entry_type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex gap-2">
                            {entry.photo_path ? (
                              <button
                                onClick={() => {
                                  setPhotoViewerUrl(entry.photo_path || '');
                                  setPhotoViewerTitle(emp?.full_name || 'Empleado');
                                  setPhotoViewerSub(`${entry.entry_type.toUpperCase()} — ${new Date(entry.registered_at).toLocaleDateString('es-ES')} a las ${new Date(entry.registered_at).toLocaleTimeString('es-ES')}`);
                                  setShowPhotoViewer(true);
                                }}
                                className="text-brand-maroon hover:underline font-bold text-[9px] uppercase cursor-pointer bg-transparent border-none p-0 align-baseline"
                              >
                                VER FOTO
                              </button>
                            ) : (
                              <span className="text-[9px] text-red-500 font-bold uppercase">SIN FOTO</span>
                            )}
                            <span className="text-[9px] font-bold uppercase text-brand-subtext">
                              GPS: {entry.gps_status === 'success' ? '✓' : '✗'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 uppercase text-[9px] font-bold text-brand-subtext">{entry.source}</td>
                        <td className="px-4 py-3.5">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            entry.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {entry.status === 'active' ? 'ACTIVO' : 'ANULADO'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end">
                            {entry.status === 'active' && (
                              <button
                                onClick={() => {
                                    setVoidTargetId(entry.id);
                                    setShowVoidModal(true);
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Anular Fichaje"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 6. CORRECTION REQUESTS */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-maroon">SOLICITUDES DE CORRECCIÓN</h1>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              {companyRequests.length === 0 ? (
                <div className="p-8 text-center text-brand-subtext text-sm">
                  No hay solicitudes de corrección registradas.
                </div>
              ) : (
                <div className="divide-y divide-brand-border">
                  {companyRequests.map(req => {
                    const emp = companyEmployees.find(e => e.id === req.employee_id);
                    return (
                      <div key={req.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-brand-text">{emp?.full_name}</span>
                            <span className="text-[10px] font-mono text-brand-subtext">({emp?.employee_code})</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                              req.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {req.status}
                            </span>
                          </div>

                          <div className="text-xs text-brand-subtext grid grid-cols-2 md:grid-cols-4 gap-2">
                            <div><span className="font-bold">Tipo:</span> {req.request_type === 'create_missing' ? 'Fichaje Olvidado' : 'Modificar Fichaje'}</div>
                            <div><span className="font-bold">Fichaje Solicitado:</span> {req.requested_entry_type.toUpperCase()}</div>
                            <div><span className="font-bold">Fecha:</span> {new Date(req.requested_date).toLocaleDateString('es-ES')}</div>
                            <div><span className="font-bold">Hora:</span> {req.requested_time.slice(0, 5)}</div>
                          </div>

                          <div className="bg-brand-cream/10 p-3 rounded-lg border border-brand-border/40 text-xs">
                            <span className="font-bold text-[9px] uppercase tracking-wider text-brand-subtext block mb-1">Motivo del empleado:</span>
                            {req.employee_reason}
                          </div>

                          {req.admin_response && (
                            <div className="bg-brand-maroon/5 p-3 rounded-lg border border-brand-maroon/20 text-xs">
                              <span className="font-bold text-[9px] uppercase tracking-wider text-brand-maroon block mb-1">Respuesta del Admin:</span>
                              {req.admin_response}
                            </div>
                          )}
                        </div>

                        {req.status === 'pending' && (
                          <div className="flex md:flex-col gap-2 shrink-0">
                            <button
                              onClick={() => openResolveModal(req.id, 'approved')}
                              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center"
                              title="Aprobar Solicitud"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openResolveModal(req.id, 'rejected')}
                              className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl active:scale-95 transition-all shadow-md flex items-center justify-center"
                              title="Rechazar Solicitud"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 7. INCIDENTS */}
        {activeTab === 'incidents' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-maroon">INCIDENCIAS DE CAPTURA</h1>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              {companyIncidents.length === 0 ? (
                <div className="p-8 text-center text-brand-subtext text-sm">
                  No se han registrado incidencias en la captura de fichajes.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[840px] text-left border-collapse">
                    <thead>
                      <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                        <th className="px-4 py-3">Empleado</th>
                        <th className="px-4 py-3">Fecha/Hora</th>
                        <th className="px-4 py-3">Tipo de Incidencia</th>
                        <th className="px-4 py-3">Falta Foto</th>
                        <th className="px-4 py-3">Falta GPS</th>
                        <th className="px-4 py-3">Detalle / Justificación</th>
                        <th className="px-4 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border text-xs font-semibold">
                      {companyIncidents.map(inc => {
                        const emp = companyEmployees.find(e => e.id === inc.employee_id);
                        const isResolved = inc.description && inc.description.includes('JUSTIFICADO');
                        
                        return (
                          <tr key={inc.id} className="hover:bg-brand-cream/10">
                            <td className="px-4 py-3.5">
                              <p className="font-bold">{emp?.full_name}</p>
                              <p className="text-[10px] text-brand-subtext">{emp?.employee_code}</p>
                            </td>
                            <td className="px-4 py-3.5">{new Date(inc.created_at).toLocaleString('es-ES')}</td>
                            <td className="px-4 py-3.5 font-bold text-rose-600">{inc.incident_type}</td>
                            <td className="px-4 py-3.5">{inc.missing_photo ? '🔴 SÍ' : '🟢 NO'}</td>
                            <td className="px-4 py-3.5">{inc.missing_gps ? '🔴 SÍ' : '🟢 NO'}</td>
                            <td className="px-4 py-3.5 text-brand-subtext max-w-[200px] truncate" title={inc.description}>
                              {inc.description}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex justify-end">
                                {!isResolved ? (
                                  <button
                                    onClick={() => {
                                      setResolveIncidentId(inc.id);
                                      setIncidentJustification('');
                                      setShowResolveIncidentModal(true);
                                    }}
                                    className="p-1.5 text-brand-maroon hover:bg-brand-cream/50 rounded-lg transition-all"
                                    title="Justificar Incidencia"
                                  >
                                    <FileCheck className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <span className="text-emerald-600 font-bold text-xs flex items-center gap-1 justify-end"><Check className="w-3.5 h-3.5" /> Resuelto</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 8. AUDIT */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-maroon">LOGS DE AUDITORÍA</h1>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                    <th className="px-4 py-3">Entidad</th>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Realizado por</th>
                    <th className="px-4 py-3">Fecha/Hora</th>
                    <th className="px-4 py-3">Motivo Justificativo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs font-semibold">
                  {companyAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-brand-cream/10">
                      <td className="px-4 py-3.5 uppercase font-mono text-[10px]">{log.entity_type}</td>
                      <td className="px-4 py-3.5 uppercase text-[10px] text-brand-maroon font-bold">{log.action}</td>
                      <td className="px-4 py-3.5 text-brand-subtext">
                        {log.performed_by === adminProfile?.id ? 'Administrador' : 'Sistema'}
                      </td>
                      <td className="px-4 py-3.5">{new Date(log.performed_at).toLocaleString('es-ES')}</td>
                      <td className="px-4 py-3.5 text-brand-subtext font-normal">{log.reason || 'N/D'}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 9. REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black text-brand-maroon">INFORMES</h1>
              <p className="text-xs text-brand-subtext mt-1">Detalle de registros de jornada por empleado y fecha.</p>
            </div>

            <div className="bg-brand-card rounded-2xl border border-brand-border shadow-sm overflow-hidden">
              <div className="p-5 border-b border-brand-border bg-brand-cream/20 space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={downloadPDF}
                    className="flex items-center justify-center gap-2 bg-brand-maroon hover:bg-brand-maroon/90 text-white font-bold px-4 py-2.5 rounded-xl hover:shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                  >
                    <FileText className="w-4 h-4" /> PDF
                  </button>
                  <button
                    onClick={downloadExcel}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl hover:shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Excel
                  </button>
                  <h2 className="font-black text-sm uppercase tracking-wider text-brand-text ml-0 sm:ml-2">
                    Detalle de registros
                  </h2>
                </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-2">Filtrar Empleado</label>
                  <select
                    value={reportEmpId}
                    onChange={(e) => setReportEmpId(e.target.value)}
                    className="w-full px-3 py-2 border border-brand-border bg-white rounded-xl text-xs focus:ring-1 focus:ring-brand-maroon"
                  >
                    <option value="">Todos los empleados</option>
                    {companyEmployees.map(e => (
                      <option key={e.id} value={e.id}>{e.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-2">Filtrar Centro</label>
                  <select
                    value={reportCenterId}
                    onChange={(e) => setReportCenterId(e.target.value)}
                    className="w-full px-3 py-2 border border-brand-border bg-white rounded-xl text-xs focus:ring-1 focus:ring-brand-maroon"
                  >
                    <option value="">Todos los centros</option>
                    {companyCenters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-2">Fecha Inicio</label>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-brand-border rounded-xl text-xs focus:ring-1 focus:ring-brand-maroon"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-2">Fecha Fin</label>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-brand-border rounded-xl text-xs focus:ring-1 focus:ring-brand-maroon"
                  />
                </div>
              </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left border-collapse">
                  <thead>
                    <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                      <th className="px-4 py-3">Empleado</th>
                      <th className="px-4 py-3">Entrada (dispositivo)</th>
                      <th className="px-4 py-3">Descanso (dispositivo)</th>
                      <th className="px-4 py-3">Salida (dispositivo)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border text-xs font-semibold">
                    {reportRows.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-brand-subtext">
                          No hay registros para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      reportRows.map(row => (
                        <tr key={`${row.employeeId}-${row.date}`} className="hover:bg-brand-cream/10">
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-brand-text">{row.employee?.full_name || 'Desconocido'}</p>
                            <p className="text-[10px] text-brand-subtext font-mono mt-0.5">{row.employee?.employee_code || ''}</p>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">{formatReportEvent(row.entry)}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">{formatReportEvent(row.breakStart)}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">{formatReportEvent(row.exit)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 10. SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-maroon">CONFIGURACIÓN DE EMPRESA</h1>

            <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm max-w-md">
              <form onSubmit={handleSaveTimeout} className="space-y-5">
                {settingsSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-semibold">
                    ✓ Cambios guardados correctamente.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-2">
                    Inactividad de Sesión (Minutos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-brand-border rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-maroon text-sm"
                  />
                  <span className="text-[10px] text-brand-subtext/80 block mt-1">
                    Tiempo de espera antes de cerrar sesión automáticamente por inactividad en la pantalla de fichajes.
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand-maroon text-white font-bold py-3 rounded-xl hover:bg-brand-maroon/90 active:scale-95 transition-all text-xs uppercase tracking-wider"
                >
                  Guardar Cambios
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 11. GLOBAL SETTINGS (Superadmin Only) */}
        {isSuperadmin && activeTab === 'settings_global' && (
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-black text-brand-maroon">PARÁMETROS GLOBAL DEL SISTEMA</h1>

            <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm max-w-md">
              <form onSubmit={handleSaveGlobalTimeout} className="space-y-5">
                {globalSettingsSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-semibold">
                    ✓ Parámetros guardados correctamente.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-2">
                    Inactividad Predeterminada Global (Minutos)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={globalTimeout}
                    onChange={(e) => setGlobalTimeout(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-maroon text-sm"
                  />
                  <span className="text-[10px] text-brand-subtext/80 block mt-1">
                    Tiempo de espera predeterminado aplicado a nuevas empresas si no configuran un valor propio.
                  </span>
                </div>

                <button
                  type="submit"
                  className="w-full bg-brand-maroon text-white font-bold py-3 rounded-xl hover:bg-brand-maroon/90 active:scale-95 transition-all text-xs uppercase tracking-wider"
                >
                  Guardar Parámetros
                </button>
              </form>
            </div>
          </div>
        )}
        {/* Tab 12. LABOUR CALENDARS */}
        {activeTab === 'calendars' && (
          <div className="space-y-4 animate-fade-in text-brand-text flex flex-col h-full">
            {/* STICKY HEADER CONTROLS */}
            <div className="sticky top-0 bg-[#fcfbf9]/95 backdrop-blur-md z-30 pb-3 pt-1 border-b border-brand-border/20 space-y-3 -mx-6 px-6 md:-mx-8 md:px-8 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-black text-brand-maroon tracking-tight leading-none">CALENDARIOS LABORALES</h1>
                  <p className="text-[10px] text-brand-subtext font-bold mt-1.5 leading-none">
                    Centro de trabajo, festivos oficiales y tipos de jornada.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 bg-white/90 p-1.5 rounded-xl border border-brand-border/40 shadow-xs">
                  <div>
                    <label className="block text-[8px] font-black uppercase text-brand-subtext tracking-wider">Centro de Trabajo</label>
                    <select
                      value={selectedCalendarCenterId}
                      onChange={(e) => setSelectedCalendarCenterId(e.target.value)}
                      className="bg-white border border-brand-border rounded-lg px-2 py-1 text-xs font-bold text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-maroon mt-0.5"
                    >
                      <option value="">-- Seleccionar --</option>
                      {companyCenters.map(wc => (
                        <option key={wc.id} value={wc.id}>{wc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[8px] font-black uppercase text-brand-subtext tracking-wider">Año</label>
                    <select
                      value={selectedCalendarYear}
                      onChange={(e) => setSelectedCalendarYear(Number(e.target.value))}
                      className="bg-white border border-brand-border rounded-lg px-2 py-1 text-xs font-bold text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-maroon mt-0.5"
                    >
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>
                  {!laborCalendars.some(c => c.work_center_id === selectedCalendarCenterId && c.year === selectedCalendarYear) && selectedCalendarCenterId && (
                    <button
                      onClick={() => {
                        setNewCalendarModel('monday_to_friday');
                        setShowCreateCalendarModal(true);
                      }}
                      className="h-8 px-3 bg-brand-maroon text-white text-[9px] font-black uppercase tracking-wider rounded-lg hover:bg-brand-maroon/90 transition-all active:scale-95 flex items-center gap-1 mt-3"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Crear
                    </button>
                  )}
                </div>
              </div>

              {/* Status Bar inside sticky header */}
              {(() => {
                const activeCal = laborCalendars.find(c => c.work_center_id === selectedCalendarCenterId && c.year === selectedCalendarYear);
                if (!activeCal) return null;
                const calConflicts = calendarImportConflicts.filter(c => c.calendar_id === activeCal.id && c.resolution === 'pending');
                const targetCenter = companyCenters.find(w => w.id === selectedCalendarCenterId);

                return (
                  <div className="bg-white p-2 px-3 rounded-xl border border-brand-border flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider shadow-xs ${
                        activeCal.status === 'active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-250' :
                        activeCal.status === 'pending_review' ? 'bg-amber-100 text-amber-800 border border-amber-250' :
                        'bg-gray-150 text-gray-700 border border-gray-300'
                      }`}>
                        Estado: {activeCal.status === 'active' ? 'Activo' : activeCal.status === 'pending_review' ? 'Guardado' : 'Borrador sin guardar'}
                      </span>
                      <span className="text-[9.5px] text-brand-subtext font-bold">
                        Modelo: <span className="font-extrabold text-brand-text">{activeCal.working_week_model === 'monday_to_friday' ? 'Lunes a Viernes' : 'Lunes a Sábado'}</span>
                      </span>
                      {activeCal.last_imported_at && (
                        <span className="text-[9px] text-brand-subtext italic">
                          Imp: {new Date(activeCal.last_imported_at).toLocaleDateString('es-ES')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {activeCal.status !== 'active' && (
                        <>
                          <button
                            onClick={async () => {
                              const prov = targetCenter?.province || 'Madrid';
                              const mun = targetCenter?.municipality || 'Madrid';
                              try {
                                await importHolidays(activeCal.id, prov, mun);
                                showAlert(`Festivos importados para ${mun} (${prov}). Puede modificarlos antes de guardar el calendario.`, 'info');
                              } catch (err: any) {
                                showAlert(err.message || 'No se pudieron importar los festivos.', 'error');
                              }
                            }}
                            className="px-2.5 py-1.5 bg-brand-cream border border-brand-border text-brand-maroon text-[9px] font-black uppercase tracking-wider rounded-lg hover:bg-brand-maroon hover:text-white transition-all active:scale-95 shadow-xs"
                          >
                            ⚡ Importar Festivos
                          </button>

                          {activeCal.status === 'draft' && (
                            <button
                              onClick={() => handleSaveCalendarDraft(activeCal)}
                              className="px-2.5 py-1.5 bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider rounded-lg hover:bg-blue-700 transition-all active:scale-95 shadow-xs"
                            >
                              💾 Guardar calendario
                            </button>
                          )}

                          {activeCal.status === 'pending_review' && (
                            <button
                              onClick={async () => {
                                if (calConflicts.length > 0) {
                                  showAlert('Resuelva todos los conflictos de importación pendientes antes de activar.', 'error');
                                  return;
                                }
                                try {
                                  await updateLaborCalendar({
                                    ...activeCal,
                                    status: 'active',
                                    activated_by: currentUser.profile?.id,
                                    activated_at: new Date().toISOString()
                                  });
                                  showAlert('El calendario laboral ha sido activado correctamente.', 'success');
                                } catch (err: any) {
                                  showAlert(err.message || 'No se pudo activar el calendario.', 'error');
                                }
                              }}
                              className="px-2.5 py-1.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider rounded-lg hover:bg-emerald-700 transition-all active:scale-95 shadow-xs"
                            >
                              ✓ Activar
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* SCROLLABLE BODY CONTAINER */}
            <div className="space-y-6 pt-2">
              {(() => {
                const activeCal = laborCalendars.find(c => c.work_center_id === selectedCalendarCenterId && c.year === selectedCalendarYear);
                if (!selectedCalendarCenterId) {
                  return (
                    <div className="bg-white rounded-2xl border border-brand-border/60 p-12 text-center shadow-sm">
                      <Calendar className="w-12 h-12 text-brand-subtext/40 mx-auto mb-4" />
                      <h3 className="font-extrabold text-sm text-brand-text uppercase tracking-wider">Seleccionar Centro</h3>
                      <p className="text-xs text-brand-subtext mt-1 max-w-sm mx-auto leading-relaxed">
                        Elija un centro de trabajo del selector superior para visualizar o gestionar su calendario laboral.
                      </p>
                    </div>
                  );
                }

                if (!activeCal) {
                  return (
                    <div className="bg-white rounded-2xl border border-brand-border/60 p-12 text-center shadow-sm">
                      <Calendar className="w-12 h-12 text-brand-subtext/40 mx-auto mb-4" />
                      <h3 className="font-extrabold text-sm text-brand-text uppercase tracking-wider">Calendario No Creado</h3>
                      <p className="text-xs text-brand-subtext mt-1 max-w-sm mx-auto leading-relaxed mb-4">
                        No existe un calendario laboral registrado para este centro de trabajo y año. Pulse en "Crear Calendario" para inicializarlo.
                      </p>
                    </div>
                  );
                }

                const calDays = calendarDays.filter(d => d.calendar_id === activeCal.id);
                const calConflicts = calendarImportConflicts.filter(c => c.calendar_id === activeCal.id && c.resolution === 'pending');

                return (
                  <>
                    {/* Conflict banner */}
                    {calConflicts.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-3 animate-pulse shadow-sm">
                        <div className="flex items-center gap-2 text-amber-800">
                          <AlertTriangle className="w-5 h-5" />
                          <h4 className="font-extrabold text-xs uppercase tracking-wider">¡Conflictos de Importación Detectados!</h4>
                        </div>
                        <p className="text-xs text-amber-700 font-medium">
                          Se han encontrado {calConflicts.length} discrepancias entre cambios manuales y festivos oficiales importados. Resuélvalas para asegurar cálculos correctos:
                        </p>
                        <div className="bg-white border border-amber-200/60 rounded-xl overflow-hidden text-xs max-h-40 overflow-y-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-amber-100/40 text-[9px] uppercase font-bold text-amber-800 border-b border-amber-200">
                                <th className="px-3 py-2">Fecha</th>
                                <th className="px-3 py-2">Existente (Manual)</th>
                                <th className="px-3 py-2">Importado (Oficial)</th>
                                <th className="px-3 py-2 text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100 font-semibold text-brand-text">
                              {calConflicts.map(cf => (
                                <tr key={cf.id}>
                                  <td className="px-3 py-2">{new Date(cf.date).toLocaleDateString('es-ES')}</td>
                                  <td className="px-3 py-2 text-red-650">{cf.existing_values?.name || 'N/D'} ({cf.existing_values?.classification || 'N/D'})</td>
                                  <td className="px-3 py-2 text-emerald-600">{cf.imported_values?.name} ({cf.imported_values?.classification})</td>
                                  <td className="px-3 py-2 text-right space-x-1.5">
                                    <button
                                      onClick={() => resolveConflict(cf.id, 'keep_existing')}
                                      className="px-2 py-0.5 bg-brand-cream border border-brand-border text-brand-maroon text-[9px] font-black uppercase rounded hover:bg-brand-maroon hover:text-white"
                                    >
                                      Mantener
                                    </button>
                                    <button
                                      onClick={() => resolveConflict(cf.id, 'apply_imported')}
                                      className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black uppercase rounded hover:bg-emerald-700"
                                    >
                                      Aplicar
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* 12 Months Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {Array.from({ length: 12 }).map((_, monthIndex) => {
                        const monthName = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][monthIndex];
                        const daysInMonth = new Date(selectedCalendarYear, monthIndex + 1, 0).getDate();
                        
                        // Convert starting day of week to Monday-based (0 = Mon, 6 = Sun)
                        let startDay = new Date(selectedCalendarYear, monthIndex, 1).getDay();
                        const offset = startDay === 0 ? 6 : startDay - 1;

                        return (
                          <div key={monthIndex} className="bg-white p-2.5 rounded-xl border border-brand-border/60 shadow-sm space-y-2">
                            <h3 className="font-black text-[10px] uppercase tracking-wider text-brand-maroon text-center border-b border-brand-border pb-1">{monthName}</h3>
                            
                            <div className="grid grid-cols-7 gap-0.5 text-center text-[8px] font-black text-brand-subtext">
                              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                                <div key={d} className="py-0.5">{d}</div>
                              ))}
                            </div>

                            <div className="grid grid-cols-7 gap-0.5 text-[8.5px]">
                              {/* Empty spacer slots */}
                              {Array.from({ length: offset }).map((_, i) => (
                                <div key={`empty-${i}`} className="aspect-square"></div>
                              ))}

                              {/* Actual day cells */}
                              {Array.from({ length: daysInMonth }).map((_, i) => {
                                const dayNum = i + 1;
                                const dateStr = `${selectedCalendarYear}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                const calDay = calDays.find(d => d.date === dateStr);
                                const cellDate = new Date(dateStr);
                                const dayOfWeek = cellDate.getDay(); // 0 is Sunday, 6 is Saturday

                                let cellColor = '';
                                let isSunday = dayOfWeek === 0;
                                let isSaturday = dayOfWeek === 6;

                                // Check default backgrounds
                                if (calDay) {
                                  const setting = dayTypeSettings.find(s => s.id === calDay.day_type_setting_id);
                                  cellColor = setting?.color || '';
                                } else if (isSunday) {
                                  cellColor = '#FCA5A5'; // light red for Sunday
                                } else if (isSaturday && activeCal.working_week_model === 'monday_to_friday') {
                                  cellColor = '#FEE2E2'; // light red-orange for Saturday L-V
                                }

                                return (
                                  <button
                                  key={`day-${dayNum}`}
                                  type="button"
                                  onClick={() => {
                                    setDayToEditDate(dateStr);
                                    if (calDay) {
                                      setDayToEditName(calDay.name);
                                      const matchingSetting = dayTypeSettings.find(s => s.id === calDay.day_type_setting_id)
                                        || dayTypeSettings.find(s => s.company_id === companyId && s.classification === calDay.classification);
                                      setDayToEditTypeId(matchingSetting?.id || calDay.day_type_setting_id);
                                      setDayToEditNotes(calDay.notes || '');
                                    } else {
                                      setDayToEditName(isSunday ? 'Domingo / Descanso' : 'Laborable');
                                      const defaultType = dayTypeSettings.find(s => s.company_id === companyId && s.classification === (isSunday ? 'sunday' : 'working_day'));
                                      setDayToEditTypeId(defaultType?.id || '');
                                      setDayToEditNotes('');
                                    }
                                    setShowDayEditModal(true);
                                  }}
                                  style={{ backgroundColor: cellColor || undefined }}
                                  className={`aspect-square font-bold rounded-md flex items-center justify-center border transition-all hover:scale-105 active:scale-95 p-0.5 ${
                                    calDay ? 'border-brand-border text-brand-text shadow-sm' :
                                    isSunday ? 'border-red-200 text-red-700' :
                                    isSaturday ? 'border-red-100 text-red-650' :
                                    'border-brand-border/20 text-brand-subtext hover:bg-brand-cream/10'
                                  }`}
                                  title={calDay ? `${calDay.name} (${calDay.classification})` : isSunday ? 'Domingo' : 'Laborable'}
                                >
                                  {dayNum}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Day Type configuration & legend */}
                  <div className="bg-white p-6 rounded-2xl border border-brand-border shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-sm uppercase tracking-wider text-brand-maroon flex items-center gap-1.5">
                        <span>🏷️</span>
                        Tipos de Día y Multiplicadores de Empresa
                      </h3>
                      <button
                        onClick={() => {
                          setEditingDayType(null);
                          setDayTypeName('');
                          setDayTypeMultiplier(1.0);
                          setDayTypeReduces(false);
                          setDayTypeColor('#E2E8F0');
                          setDayTypeSpecialMin('');
                          setShowDayTypeModal(true);
                        }}
                        className="px-3 py-1.5 bg-brand-maroon text-white text-[10px] font-black uppercase rounded-lg hover:bg-brand-maroon/90 transition-all shadow-sm flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Añadir Tipo
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
                      {dayTypeSettings.filter(t => t.company_id === companyId).map(s => (
                        <div
                          key={s.id}
                          className="p-3 bg-brand-cream/10 border border-brand-border/50 rounded-xl flex items-center justify-between hover:bg-brand-cream/20 transition-all cursor-pointer"
                          onClick={() => {
                            setEditingDayType(s);
                            setDayTypeName(s.name);
                            setDayTypeMultiplier(s.work_multiplier);
                            setDayTypeReduces(s.reduces_weekly_target);
                            setDayTypeColor(s.color);
                            setDayTypeSpecialMin(s.special_target_minutes !== undefined ? s.special_target_minutes : '');
                            setShowDayTypeModal(true);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: s.color }}></span>
                            <div className="text-xs">
                              <p className="font-bold text-brand-text leading-tight">{s.name}</p>
                              <p className="text-[10px] text-brand-subtext font-medium mt-0.5">
                                Mult: {s.work_multiplier}x • {s.reduces_weekly_target ? 'Reduce Obj' : 'No reduce'}
                              </p>
                            </div>
                          </div>
                          {!s.is_system_type && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await deleteDayType(s.id);
                                  setDayTypeSettings(prev => prev.filter(item => item.id !== s.id));
                                  showAlert('Tipo de día eliminado correctamente.', 'success');
                                } catch (error) {
                                  logger.error('Error eliminando el tipo de día.', error, { dayTypeId: s.id });
                                  showAlert('No se pudo eliminar el tipo de día.', 'error');
                                }
                              }}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
            </div>
          </div>
        )}

        {/* Tab 13. WEEKLY QUADRANT & OVERTIME */}
        {activeTab === 'overtime' && (
          <div className="space-y-6 animate-fade-in text-brand-text">
            {/* Top Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-brand-maroon">CUADRANTE Y CÓMPUTO DE HORAS EXTRA</h1>
                <p className="text-xs text-brand-subtext font-medium mt-1">
                  Cálculo semanal/mensual, redondeo diario de 15 minutos, ponderación festiva y ajustes de horas extra.
                </p>
              </div>

              {/* View Selector Tabs */}
              <div className="flex bg-brand-cream/30 p-1 rounded-xl border border-brand-border/40 shrink-0 self-start md:self-auto">
                {(['weekly', 'monthly', 'ranking'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setOvertimeViewMode(mode)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      overtimeViewMode === mode 
                        ? 'bg-brand-maroon text-white shadow-sm' 
                        : 'text-brand-subtext hover:text-brand-text'
                    }`}
                  >
                    {mode === 'weekly' ? 'Semanal' : mode === 'monthly' ? 'Mensual' : 'Ranking Global'}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="bg-brand-card p-4 rounded-2xl border border-brand-border shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                {overtimeViewMode === 'weekly' && (
                  <div>
                    <label className="block text-[8px] font-black uppercase text-brand-subtext tracking-wider">Semana (Lunes)</label>
                    <input
                      type="date"
                      value={selectedWeekStart}
                      onChange={(e) => {
                        const d = new Date(e.target.value);
                        const day = d.getDay();
                        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                        setSelectedWeekStart(new Date(d.setDate(diff)).toISOString().split('T')[0]);
                      }}
                      className="bg-white border border-brand-border rounded-lg px-2.5 py-1 text-xs font-bold text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-maroon mt-0.5"
                    />
                  </div>
                )}

                {overtimeViewMode === 'monthly' && (
                  <>
                    <div>
                      <label className="block text-[8px] font-black uppercase text-brand-subtext tracking-wider">Empleado</label>
                      <select
                        value={selectedEmployeeId}
                        onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        className="bg-white border border-brand-border rounded-lg px-2.5 py-1 text-xs font-bold text-brand-text focus:outline-none focus:ring-1 focus:ring-brand-maroon mt-0.5"
                      >
                        <option value="">-- Seleccionar --</option>
                        {companyEmployees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Exports Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const exportRows = weeklyWorkSummaries.filter(s => s.company_id === companyId).map(s => {
                      const emp = employees.find(e => e.id === s.employee_id);
                      return {
                        'Empleado': emp?.full_name || 'Desconocido',
                        'DNI/CIF': emp?.dni || '',
                        'Semana Inicio': s.week_start,
                        'Jornada Semanal (Min)': s.contracted_weekly_minutes,
                        'Objetivo Ajustado (Min)': s.adjusted_target_minutes,
                        'Reales (Min)': s.actual_worked_minutes,
                        'Ponderadas (Min)': s.weighted_worked_minutes,
                        'Horas Extra Aut (Min)': s.automatic_overtime_minutes,
                        'Ajustes (Min)': s.manual_adjustment_minutes,
                        'Horas Extra Finales (Min)': s.final_overtime_minutes
                      };
                    });
                    downloadCsv(exportRows, `Control_Horas_Extra_${companyId.substring(0,6)}.csv`);
                    showAlert('Archivo CSV exportado con éxito.', 'success');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg hover:bg-emerald-700 transition-all flex items-center gap-1 shadow-sm active:scale-95"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Excel
                </button>

                <button
                  onClick={async () => {
                    const { jsPDF } = await import('jspdf');
                    const doc = new jsPDF();
                    doc.setFont('helvetica', 'bold');
                    doc.text('REPORTE DE HORAS EXTRA Y CÓMPUTO HORARIO', 15, 15);
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`Empresa: ${activeCompany?.commercial_name || 'Servicios'}`, 15, 22);
                    doc.text(`Fecha de Reporte: ${new Date().toLocaleDateString('es-ES')}`, 15, 27);
                    
                    let y = 37;
                    doc.setFillColor(112, 30, 54); // Brand Maroon
                    doc.rect(15, y, 180, 8, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFont('helvetica', 'bold');
                    doc.text('EMPLEADO', 18, y + 5);
                    doc.text('OBJETIVO', 90, y + 5);
                    doc.text('TRABAJADAS', 125, y + 5);
                    doc.text('H. EXTRA FINALES', 160, y + 5);
                    
                    doc.setTextColor(0, 0, 0);
                    doc.setFont('helvetica', 'normal');
                    y += 8;

                    const activeSummaries = weeklyWorkSummaries.filter(s => s.company_id === companyId && s.week_start === selectedWeekStart);
                    activeSummaries.forEach(s => {
                      const emp = employees.find(e => e.id === s.employee_id);
                      y += 8;
                      doc.text(emp?.full_name || 'Desconocido', 18, y);
                      doc.text(`${(s.adjusted_target_minutes/60).toFixed(2)}h`, 90, y);
                      doc.text(`${(s.weighted_worked_minutes/60).toFixed(2)}h`, 125, y);
                      doc.text(`${(s.final_overtime_minutes/60).toFixed(2)}h`, 160, y);
                      doc.line(15, y + 2, 195, y + 2);
                    });

                    doc.save('reporte_horas_extra.pdf');
                    showAlert('Reporte PDF descargado con éxito.', 'success');
                  }}
                  className="px-3 py-1.5 bg-red-650 text-white text-[10px] font-black uppercase rounded-lg hover:bg-red-700 transition-all flex items-center gap-1 shadow-sm active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5" /> Exportar PDF
                </button>
              </div>
            </div>

            {/* 1. WEEKLY QUADRANT */}
            {overtimeViewMode === 'weekly' && (
              <div className="bg-white rounded-2xl border border-brand-border overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-brand-cream/50 border-b border-brand-border font-black text-[9px] uppercase tracking-wider text-brand-subtext">
                        <th className="px-4 py-3">Empleado</th>
                        {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((d, index) => {
                          const currentDayDate = new Date(selectedWeekStart);
                          currentDayDate.setDate(currentDayDate.getDate() + index);
                          return (
                            <th key={d} className="px-3 py-3 text-center min-w-[70px]">
                              <p>{d}</p>
                              <p className="text-[8px] font-bold text-brand-subtext/60 mt-0.5">
                                {currentDayDate.getDate()}/{currentDayDate.getMonth() + 1}
                              </p>
                            </th>
                          );
                        })}
                        <th className="px-3 py-3 text-center">Objetivo</th>
                        <th className="px-3 py-3 text-center">Reales</th>
                        <th className="px-3 py-3 text-center">Ponderadas</th>
                        <th className="px-3 py-3 text-center">Extras (Auto)</th>
                        <th className="px-3 py-3 text-center">Ajustes</th>
                        <th className="px-3 py-3 text-center">Extras Finales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border font-semibold text-brand-text">
                      {companyEmployees.map(emp => {
                        const weekSummaryId = toUUID(`wws-${emp.id}-${selectedWeekStart}`, 'ffffffff');
                        const summary = weeklyWorkSummaries.find(s => s.id === weekSummaryId);
                        
                        return (
                          <tr key={emp.id} className="hover:bg-brand-cream/5">
                            <td className="px-4 py-3">
                              <p className="font-extrabold">{emp.full_name}</p>
                              <p className="text-[9px] text-brand-subtext/80 font-mono mt-0.5">{emp.employee_code}</p>
                            </td>

                            {/* 7 Days cells */}
                            {Array.from({ length: 7 }).map((_, index) => {
                              const currentDayDate = new Date(selectedWeekStart);
                              currentDayDate.setDate(currentDayDate.getDate() + index);
                              const dayStr = currentDayDate.toISOString().split('T')[0];
                              const dayOfWeek = currentDayDate.getDay();

                              const dwsId = toUUID(`dws-${emp.id}-${dayStr}`, 'eeeeeeee');
                              const daySummary = dailyWorkSummaries.find(s => s.id === dwsId);

                              // Resolve visual colors based on day type
                              let cellColor = '';
                              let cellLabel = '';

                              if (daySummary?.calendar_id) {
                                const calDay = calendarDays.find(d => d.calendar_id === daySummary.calendar_id && d.date === dayStr);
                                if (calDay) {
                                  const setting = dayTypeSettings.find(s => s.id === calDay.day_type_setting_id);
                                  cellColor = setting?.color || '';
                                  cellLabel = calDay.name.substring(0, 8);
                                }
                              } else if (dayOfWeek === 0) {
                                cellColor = '#FCA5A5'; // Sunday
                                cellLabel = 'Domingo';
                              } else if (dayOfWeek === 6) {
                                cellColor = '#FEE2E2'; // Saturday
                                cellLabel = 'Sábado';
                              }

                              return (
                                <td
                                  key={index}
                                  onClick={() => {
                                    setDayDetailEmployeeId(emp.id);
                                    setDayDetailDate(dayStr);
                                    setShowDayDetailModal(true);
                                  }}
                                  style={{ backgroundColor: cellColor || undefined }}
                                  className="px-2 py-3 text-center border-l border-brand-border/10 cursor-pointer hover:brightness-95 transition-all min-w-[70px]"
                                >
                                  {daySummary ? (
                                    <div className="space-y-0.5">
                                      <p className="font-extrabold text-[11px]">
                                        {(daySummary.rounded_worked_minutes / 60).toFixed(2)}h
                                      </p>
                                      {daySummary.effective_multiplier > 1 && (
                                        <p className="text-[7.5px] bg-brand-maroon/20 text-brand-maroon font-black px-1 rounded inline-block">
                                          x{daySummary.effective_multiplier}
                                        </p>
                                      )}
                                      <div className="flex justify-center gap-1">
                                        {!daySummary.is_complete && (
                                          <span className="text-[7px] bg-amber-500 text-white px-1 rounded-sm uppercase tracking-widest font-black">Inc</span>
                                        )}
                                        {daySummary.has_incident && (
                                          <span className="text-[7.5px] text-red-650 font-bold">⚠️</span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[8px] text-brand-subtext/60 italic font-medium block">
                                      {cellLabel || 'Sin fichar'}
                                    </span>
                                  )}
                                </td>
                              );
                            })}

                            {/* Totals columns */}
                            {summary ? (
                              <>
                                <td className="px-3 py-3 text-center bg-brand-cream/5 font-bold">{(summary.adjusted_target_minutes / 60).toFixed(2)}h</td>
                                <td className="px-3 py-3 text-center bg-brand-cream/5">{(summary.actual_worked_minutes / 60).toFixed(2)}h</td>
                                <td className="px-3 py-3 text-center bg-brand-cream/5">{(summary.weighted_worked_minutes / 60).toFixed(2)}h</td>
                                <td className="px-3 py-3 text-center bg-brand-cream/5 font-mono">{(summary.automatic_overtime_minutes / 60).toFixed(2)}h</td>
                                <td className="px-3 py-3 text-center bg-brand-cream/5">
                                  <button
                                    onClick={() => {
                                      setAdjustmentTargetSummaryId(summary.id);
                                      setAdjustmentTargetEmployeeId(emp.id);
                                      setAdjustmentAmountHours(summary.manual_adjustment_minutes / 60);
                                      setAdjustmentReasonText('');
                                      setShowAdjustmentModal(true);
                                    }}
                                    className="px-2 py-0.5 border border-brand-border/60 bg-brand-cream text-brand-maroon font-bold rounded hover:bg-brand-maroon hover:text-white transition-all text-[10px]"
                                  >
                                    {(summary.manual_adjustment_minutes / 60).toFixed(2)}h
                                  </button>
                                </td>
                                <td className="px-3 py-3 text-center bg-brand-maroon/5 font-black text-brand-maroon text-[13px]">
                                  {(summary.final_overtime_minutes / 60).toFixed(2)}h
                                </td>
                              </>
                            ) : (
                              <td colSpan={6} className="px-3 py-3 text-center text-[10px] text-brand-subtext/50 italic bg-brand-cream/5">
                                Sin resúmenes
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. MONTHLY WORK SUMMARY BY EMPLOYEE */}
            {overtimeViewMode === 'monthly' && (
              <div className="space-y-6">
                {selectedEmployeeId ? (() => {
                  const empContracts = employeeWeeklyContracts.filter(c => c.employee_id === selectedEmployeeId);
                  
                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: Contracts lists & Add Contract */}
                      <div className="bg-white p-5 rounded-2xl border border-brand-border shadow-sm space-y-4">
                        <div className="flex items-center justify-between border-b border-brand-border/60 pb-3">
                          <h3 className="font-extrabold text-sm uppercase tracking-wider text-brand-maroon">Contratos Semanales</h3>
                          <button
                            onClick={() => {
                              setContractEmployeeId(selectedEmployeeId);
                              setEditingContract(null);
                              setContractWeeklyMin(2400); // 40h
                              setContractFrom(new Date().toISOString().split('T')[0]);
                              setContractTo('');
                              setContractReason('');
                              setShowContractModal(true);
                            }}
                            className="px-2.5 py-1 bg-brand-maroon text-white text-[9px] font-black uppercase rounded hover:bg-brand-maroon/90"
                          >
                            + Añadir
                          </button>
                        </div>

                        {empContracts.length === 0 ? (
                          <p className="text-xs text-brand-subtext italic text-center py-4">No tiene contratos asignados. (Se aplica 40h por defecto).</p>
                        ) : (
                          <div className="divide-y divide-brand-border text-xs">
                            {empContracts.map(c => (
                              <div key={c.id} className="py-2.5 flex items-start justify-between gap-2">
                                <div className="space-y-0.5">
                                  <p className="font-extrabold text-brand-text">{(c.weekly_minutes/60).toFixed(1)}h Semanales</p>
                                  <p className="text-[9.5px] text-brand-subtext">Vigencia: {c.effective_from} a {c.effective_to || 'Indefinido'}</p>
                                  {c.reason && <p className="text-[9px] text-brand-subtext italic font-medium">Motivo: {c.reason}</p>}
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingContract(c);
                                      setContractEmployeeId(selectedEmployeeId);
                                      setContractWeeklyMin(c.weekly_minutes);
                                      setContractFrom(c.effective_from);
                                      setContractTo(c.effective_to || '');
                                      setContractReason(c.reason || '');
                                      setShowContractModal(true);
                                    }}
                                    className="p-1 text-brand-maroon hover:bg-brand-cream/50 rounded"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => deleteWeeklyContract(c.id)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Right: Calculated Month details */}
                      <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-brand-border shadow-sm space-y-4">
                        <h3 className="font-extrabold text-sm uppercase tracking-wider text-brand-maroon border-b border-brand-border/60 pb-3">Resumen de Horas Recientes</h3>
                        <div className="bg-brand-cream/10 rounded-xl p-4 border border-brand-border/30 grid grid-cols-3 gap-4 text-center">
                          <div>
                            <span className="text-[9px] font-black uppercase text-brand-subtext tracking-wider block">Horas Totales Reales</span>
                            <span className="text-2xl font-black text-brand-text mt-1 block">
                              {(weeklyWorkSummaries.filter(s => s.employee_id === selectedEmployeeId).reduce((sum, item) => sum + item.actual_worked_minutes, 0) / 60).toFixed(2)}h
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-brand-subtext tracking-wider block">Horas Ponderadas (Festivo)</span>
                            <span className="text-2xl font-black text-emerald-600 mt-1 block">
                              {(weeklyWorkSummaries.filter(s => s.employee_id === selectedEmployeeId).reduce((sum, item) => sum + item.weighted_worked_minutes, 0) / 60).toFixed(2)}h
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black uppercase text-brand-subtext tracking-wider block">Horas Extra Finales</span>
                            <span className="text-2xl font-black text-brand-maroon mt-1 block">
                              {(weeklyWorkSummaries.filter(s => s.employee_id === selectedEmployeeId).reduce((sum, item) => sum + item.final_overtime_minutes, 0) / 60).toFixed(2)}h
                            </span>
                          </div>
                        </div>

                        {/* Recent weeks details */}
                        <div className="border border-brand-border rounded-xl overflow-hidden text-xs font-semibold">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="bg-brand-cream/50 text-[9px] uppercase font-black text-brand-subtext border-b border-brand-border">
                                <th className="px-4 py-2">Semana</th>
                                <th className="px-3 py-2 text-center">Objetivo Aj</th>
                                <th className="px-3 py-2 text-center">Reales</th>
                                <th className="px-3 py-2 text-center">Ponderadas</th>
                                <th className="px-3 py-2 text-center">Extra Auto</th>
                                <th className="px-3 py-2 text-center">Ajustes</th>
                                <th className="px-3 py-2 text-center">Extra Final</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-brand-border text-brand-text">
                              {[...weeklyWorkSummaries]
                                .filter(s => s.employee_id === selectedEmployeeId)
                                .sort((a, b) => b.week_start.localeCompare(a.week_start))
                                .slice(0, 8)
                                .map(s => (
                                  <tr key={s.id}>
                                    <td className="px-4 py-2">{s.week_start} a {s.week_end}</td>
                                    <td className="px-3 py-2 text-center">{(s.adjusted_target_minutes/60).toFixed(2)}h</td>
                                    <td className="px-3 py-2 text-center">{(s.actual_worked_minutes/60).toFixed(2)}h</td>
                                    <td className="px-3 py-2 text-center">{(s.weighted_worked_minutes/60).toFixed(2)}h</td>
                                    <td className="px-3 py-2 text-center">{(s.automatic_overtime_minutes/60).toFixed(2)}h</td>
                                    <td className="px-3 py-2 text-center text-brand-maroon">{(s.manual_adjustment_minutes/60).toFixed(2)}h</td>
                                    <td className="px-3 py-2 text-center font-black text-[12px]">{(s.final_overtime_minutes/60).toFixed(2)}h</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="bg-white rounded-2xl border border-brand-border/60 p-12 text-center shadow-sm">
                    <Users className="w-12 h-12 text-brand-subtext/40 mx-auto mb-4" />
                    <h3 className="font-extrabold text-sm text-brand-text uppercase tracking-wider">Seleccionar Empleado</h3>
                    <p className="text-xs text-brand-subtext mt-1 max-w-sm mx-auto leading-relaxed">
                      Seleccione un empleado del menú superior para ver su historial de contratos y cuadrante consolidado.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 3. RANKING GLOBAL */}
            {overtimeViewMode === 'ranking' && (
              <div className="bg-white p-5 rounded-2xl border border-brand-border shadow-sm space-y-4">
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-brand-maroon border-b border-brand-border/60 pb-3">Ranking de Empleados con Mayor Horas Extra</h3>
                
                <div className="border border-brand-border rounded-xl overflow-hidden text-xs font-semibold">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-brand-cream/50 text-[9px] uppercase font-black text-brand-subtext border-b border-brand-border">
                        <th className="px-4 py-3">Puesto</th>
                        <th className="px-4 py-3">Empleado</th>
                        <th className="px-3 py-3 text-center">Horas Reales Acumuladas</th>
                        <th className="px-3 py-3 text-center">Horas Ponderadas</th>
                        <th className="px-3 py-3 text-center">Total Horas Extra Finales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border text-brand-text">
                      {companyEmployees.map((emp) => {
                        const empSummaries = weeklyWorkSummaries.filter(s => s.employee_id === emp.id);
                        const totalReales = empSummaries.reduce((sum, item) => sum + item.actual_worked_minutes, 0);
                        const totalPonderadas = empSummaries.reduce((sum, item) => sum + item.weighted_worked_minutes, 0);
                        const totalExtras = empSummaries.reduce((sum, item) => sum + item.final_overtime_minutes, 0);

                        return { emp, totalReales, totalPonderadas, totalExtras };
                      })
                      .sort((a, b) => b.totalExtras - a.totalExtras)
                      .map((row, index) => (
                        <tr key={row.emp.id} className="hover:bg-brand-cream/5">
                          <td className="px-4 py-3 font-black text-brand-maroon">{index + 1}º</td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-brand-text">{row.emp.full_name}</p>
                            <p className="text-[9.5px] text-brand-subtext">Código: {row.emp.employee_code}</p>
                          </td>
                          <td className="px-3 py-3 text-center">{(row.totalReales/60).toFixed(2)}h</td>
                          <td className="px-3 py-3 text-center">{(row.totalPonderadas/60).toFixed(2)}h</td>
                          <td className="px-3 py-3 text-center font-black text-[13px] text-brand-maroon">{(row.totalExtras/60).toFixed(2)}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* CREATE CALENDAR MODAL OVERLAY */}
      {showCreateCalendarModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider">Crear Nuevo Calendario</h3>
              <button onClick={() => setShowCreateCalendarModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleCreateCalendar} className="p-5 space-y-4 text-xs font-semibold text-brand-text">
              <div>
                <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Año de Vigencia</label>
                <input
                  type="number"
                  value={selectedCalendarYear}
                  disabled
                  className="w-full px-3 py-2 border border-brand-border rounded-lg bg-brand-cream/20 text-brand-subtext"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Modelo de Jornada Semanal</label>
                <select
                  value={newCalendarModel}
                  onChange={(e: any) => setNewCalendarModel(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg"
                >
                  <option value="monday_to_friday">Lunes a Viernes (Sábado no festivo/laboral)</option>
                  <option value="monday_to_saturday">Lunes a Sábado (Sábado laborable/festivo)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCalendarModal(false)}
                  className="flex-1 py-2 bg-brand-cream border border-brand-border text-brand-maroon font-bold rounded-lg uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand-maroon text-white font-bold rounded-lg uppercase shadow-md hover:bg-brand-maroon/90"
                >
                  Crear borrador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DAY IN CALENDAR MODAL OVERLAY */}
      {showDayEditModal && (() => {
        const activeCal = laborCalendars.find(c => c.work_center_id === selectedCalendarCenterId && c.year === selectedCalendarYear);
        const isCalendarActive = activeCal?.status === 'active';

        return (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
              <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-xs uppercase tracking-wider">
                    {isCalendarActive ? 'Ver Día del Calendario' : 'Modificar Día del Calendario'}
                  </h3>
                  <p className="text-[9px] text-white/80 font-bold mt-0.5">{new Date(dayToEditDate).toLocaleDateString('es-ES', { dateStyle: 'full' })}</p>
                </div>
                <button onClick={() => setShowDayEditModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <form onSubmit={handleSaveDayDetails} className="p-5 space-y-4 text-xs font-semibold text-brand-text">
                <div>
                  <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Tipo de Festivo</label>
                  <select
                    value={dayToEditTypeId}
                    disabled={isCalendarActive}
                    onChange={(e) => {
                      const typeId = e.target.value;
                      setDayToEditTypeId(typeId);
                      const selectedSetting = dayTypeSettings.find(s => s.id === typeId);
                      if (selectedSetting && (!dayToEditName || dayToEditName === 'Laborable' || dayToEditName === 'Domingo / Descanso')) {
                        setDayToEditName(selectedSetting.name);
                      }
                    }}
                    required
                    className="w-full px-3 py-2 border border-brand-border rounded-lg bg-white text-xs font-semibold disabled:bg-brand-cream/40 disabled:text-brand-subtext/80 disabled:cursor-not-allowed"
                  >
                    <option value="">-- Seleccionar --</option>
                    {dayTypeSettings.filter(s => s.company_id === companyId).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Mult: {s.work_multiplier}x • {s.reduces_weekly_target ? 'Reduce Obj' : 'No reduce'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Descripción / Nombre del Festivo</label>
                  <input
                    type="text"
                    value={dayToEditName}
                    disabled={isCalendarActive}
                    onChange={(e) => setDayToEditName(e.target.value)}
                    placeholder="Ej. Año Nuevo, Reyes Magos, Festivo Local"
                    required
                    className="w-full px-3 py-2 border border-brand-border rounded-lg text-xs disabled:bg-brand-cream/40 disabled:text-brand-subtext/80 disabled:cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Notas Internas</label>
                  <textarea
                    value={dayToEditNotes}
                    disabled={isCalendarActive}
                    onChange={(e) => setDayToEditNotes(e.target.value)}
                    placeholder="Información adicional o detalles sobre el cambio..."
                    className="w-full px-3 py-2 border border-brand-border rounded-lg h-16 resize-none disabled:bg-brand-cream/40 disabled:text-brand-subtext/80 disabled:cursor-not-allowed"
                  />
                </div>

                {isCalendarActive ? (
                  <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-250 text-emerald-800 font-bold text-[10px] leading-tight">
                    ✓ Este calendario está activo. No admite modificaciones adicionales.
                  </div>
                ) : null}

                <div className="flex gap-3 pt-2">
                  {isCalendarActive ? (
                    <button
                      type="button"
                      onClick={() => setShowDayEditModal(false)}
                      className="w-full py-2 bg-brand-cream border border-brand-border text-brand-maroon font-bold rounded-lg uppercase"
                    >
                      Cerrar
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowDayEditModal(false)}
                        className="flex-1 py-2 bg-brand-cream border border-brand-border text-brand-maroon font-bold rounded-lg uppercase"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-brand-maroon text-white font-bold rounded-lg uppercase shadow-md hover:bg-brand-maroon/90"
                      >
                        Guardar Día
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* DAY TYPE CONFIG MODAL OVERLAY */}
      {showDayTypeModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingDayType ? 'Editar Tipo de Día' : 'Añadir Tipo de Día'}
              </h3>
              <button onClick={() => setShowDayTypeModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSaveDayType} className="p-5 space-y-4 text-xs font-semibold text-brand-text">
              <div>
                <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Nombre Descriptivo</label>
                <input
                  type="text"
                  value={dayTypeName}
                  onChange={(e) => setDayTypeName(e.target.value)}
                  placeholder="Ej. Jornada Intensiva de Invierno"
                  required
                  className="w-full px-3 py-2 border border-brand-border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Multiplicador Festivo</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={dayTypeMultiplier}
                    onChange={(e) => setDayTypeMultiplier(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-brand-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Color Identificador</label>
                  <input
                    type="color"
                    value={dayTypeColor}
                    onChange={(e) => setDayTypeColor(e.target.value)}
                    className="w-full h-9 border border-brand-border rounded-lg cursor-pointer p-1 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Minutos Objetivo de Jornada Especial (Opcional)</label>
                <input
                  type="number"
                  placeholder="Ej. 360 para 6h (vacío aplica referencia)"
                  value={dayTypeSpecialMin}
                  onChange={(e) => setDayTypeSpecialMin(e.target.value !== '' ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-brand-border rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="reduces-obj"
                  checked={dayTypeReduces}
                  onChange={(e) => setDayTypeReduces(e.target.checked)}
                  className="w-4 h-4 rounded border-brand-border text-brand-maroon focus:ring-brand-maroon"
                />
                <label htmlFor="reduces-obj" className="text-brand-text font-bold text-xs cursor-pointer select-none">
                  El día libre reduce el objetivo de horas de la semana
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDayTypeModal(false)}
                  className="flex-1 py-2 bg-brand-cream border border-brand-border text-brand-maroon font-bold rounded-lg uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand-maroon text-white font-bold rounded-lg uppercase shadow-md hover:bg-brand-maroon/90"
                >
                  Guardar Tipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WEEKLY CONTRACT MODAL OVERLAY */}
      {showContractModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider">
                {editingContract ? 'Editar Jornada Contratada' : 'Añadir Jornada Contratada'}
              </h3>
              <button onClick={() => setShowContractModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="p-5 space-y-4 text-xs font-semibold text-brand-text">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Horas Semanales</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    value={contractWeeklyMin / 60}
                    onChange={(e) => setContractWeeklyMin(Math.round(Number(e.target.value) * 60))}
                    required
                    className="w-full px-3 py-2 border border-brand-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Fecha de Inicio</label>
                  <input
                    type="date"
                    value={contractFrom}
                    onChange={(e) => setContractFrom(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-brand-border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Fecha Final (Opcional)</label>
                  <input
                    type="date"
                    value={contractTo}
                    onChange={(e) => setContractTo(e.target.value)}
                    className="w-full px-3 py-2 border border-brand-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Identificador / Razón</label>
                  <input
                    type="text"
                    value={contractReason}
                    onChange={(e) => setContractReason(e.target.value)}
                    placeholder="Ej. Jornada 40h Indefinido"
                    className="w-full px-3 py-2 border border-brand-border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowContractModal(false)}
                  className="flex-1 py-2 bg-brand-cream border border-brand-border text-brand-maroon font-bold rounded-lg uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand-maroon text-white font-bold rounded-lg uppercase shadow-md hover:bg-brand-maroon/90"
                >
                  Guardar Contrato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERTIME ADJUSTMENT MODAL OVERLAY */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider">Ajuste Manual de Horas Extra</h3>
              <button onClick={() => setShowAdjustmentModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-5 space-y-4 text-xs font-semibold text-brand-text">
              <div className="bg-brand-cream/15 p-3 rounded-xl border border-brand-border/40 text-[10px] space-y-1">
                <p className="text-brand-subtext font-bold uppercase tracking-wider">Información del Cómputo</p>
                {(() => {
                  const emp = employees.find(e => e.id === adjustmentTargetEmployeeId);
                  const summary = weeklyWorkSummaries.find(s => s.id === adjustmentTargetSummaryId);
                  return (
                    <div className="font-semibold text-brand-text">
                      <p>Trabajador: <span className="font-extrabold">{emp?.full_name}</span></p>
                      <p>Semana: <span className="font-bold">{summary?.week_start} al {summary?.week_end}</span></p>
                      <p>Horas Extra Calculadas: <span className="font-extrabold text-brand-maroon">{(summary ? summary.automatic_overtime_minutes / 60 : 0).toFixed(2)}h</span></p>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Cantidad de Horas a Ajustar</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ej. -2.0 o 1.5"
                  value={adjustmentAmountHours}
                  onChange={(e) => setAdjustmentAmountHours(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm"
                />
                <span className="text-[9px] text-brand-subtext block mt-1 leading-normal italic">
                  * Indique valores negativos para descontar horas acumuladas, o positivos para añadir compensaciones.
                </span>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase text-brand-subtext tracking-wider mb-1">Motivo / Justificación (Obligatorio)</label>
                <textarea
                  value={adjustmentReasonText}
                  onChange={(e) => setAdjustmentReasonText(e.target.value)}
                  placeholder="Detallar por qué se introduce este ajuste..."
                  required
                  className="w-full px-3 py-2 border border-brand-border rounded-lg h-20 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(false)}
                  className="flex-1 py-2 bg-brand-cream border border-brand-border text-brand-maroon font-bold rounded-lg uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-brand-maroon text-white font-bold rounded-lg uppercase shadow-md hover:bg-brand-maroon/90"
                >
                  Guardar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DAILY WORK DETAIL MODAL OVERLAY */}
      {showDayDetailModal && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-brand-border flex flex-col max-h-[90vh] text-xs">
            {/* Header */}
            <div className="bg-brand-maroon px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider">Detalle del Fichaje Diario</h3>
                <p className="text-[10px] text-white/80 font-bold mt-0.5">
                  {new Date(dayDetailDate).toLocaleDateString('es-ES', { dateStyle: 'full' })}
                </p>
              </div>
              <button onClick={() => setShowDayDetailModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Content Body */}
            {(() => {
              const emp = employees.find(e => e.id === dayDetailEmployeeId);
              const dayPunches = timeEntries
                .filter(t => t.employee_id === dayDetailEmployeeId && t.registered_at.split('T')[0] === dayDetailDate && t.status === 'active')
                .sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());
              const dwsId = toUUID(`dws-${dayDetailEmployeeId}-${dayDetailDate}`, 'eeeeeeee');
              const dws = dailyWorkSummaries.find(s => s.id === dwsId);

              return (
                <div className="p-6 overflow-y-auto space-y-5 bg-brand-cream/5 flex-1 font-semibold text-brand-text">
                  {/* Employee Header */}
                  <div className="bg-brand-cream/25 p-3 rounded-xl border border-brand-border/45 flex items-center justify-between">
                    <div>
                      <p className="font-extrabold text-sm leading-tight">{emp?.full_name}</p>
                      <p className="text-[9.5px] text-brand-subtext font-mono mt-0.5">Código: {emp?.employee_code}</p>
                    </div>
                    {dws && (
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                        dws.is_complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {dws.is_complete ? 'Completo' : 'Incompleto'}
                      </span>
                    )}
                  </div>

                  {/* Calculations Details Card */}
                  {dws ? (
                    <div className="bg-white border border-brand-border rounded-xl p-4 space-y-2.5 shadow-sm">
                      <div className="grid grid-cols-2 text-xs border-b border-brand-border/30 pb-1.5">
                        <span className="text-brand-subtext font-bold">Tiempo Real (Fichajes):</span>
                        <span className="text-right font-black text-brand-text">{(dws.raw_worked_minutes / 60).toFixed(2)}h ({dws.raw_worked_minutes}m)</span>
                      </div>
                      <div className="grid grid-cols-2 text-xs border-b border-brand-border/30 pb-1.5">
                        <span className="text-brand-subtext font-bold">Descansos Deductivos:</span>
                        <span className="text-right font-black text-brand-text">{(dws.break_minutes / 60).toFixed(2)}h ({dws.break_minutes}m)</span>
                      </div>
                      <div className="grid grid-cols-2 text-xs border-b border-brand-border/30 pb-1.5">
                        <span className="text-brand-subtext font-bold">Tiempo Redondeado (15m):</span>
                        <span className="text-right font-black text-emerald-700">{(dws.rounded_worked_minutes / 60).toFixed(2)}h ({dws.rounded_worked_minutes}m)</span>
                      </div>
                      <div className="grid grid-cols-2 text-xs border-b border-brand-border/30 pb-1.5">
                        <span className="text-brand-subtext font-bold">Multiplicador Aplicado:</span>
                        <span className="text-right font-black text-brand-maroon">{dws.effective_multiplier}x</span>
                      </div>
                      <div className="grid grid-cols-2 text-xs font-black text-[13px] text-brand-maroon pt-1">
                        <span>Horas Ponderadas Totales:</span>
                        <span className="text-right">{(dws.weighted_minutes / 60).toFixed(2)}h</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-brand-cream/15 text-center rounded-xl border border-brand-border text-brand-subtext italic">
                      No hay cómputos diarios registrados para esta fecha.
                    </div>
                  )}

                  {/* Punch Timeline */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-[10px] uppercase tracking-wider text-brand-maroon">Cronología de Fichajes</h4>
                    {dayPunches.length === 0 ? (
                      <p className="text-xs text-brand-subtext italic bg-white p-3 border border-brand-border/60 rounded-xl text-center">No hay marcas registradas para hoy.</p>
                    ) : (
                      <div className="bg-white border border-brand-border rounded-xl divide-y divide-brand-border overflow-hidden">
                        {dayPunches.map(p => {
                          const time = new Date(p.registered_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                          return (
                            <div key={p.id} className="p-3 flex items-center justify-between hover:bg-brand-cream/5">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                  p.entry_type === 'entry' ? 'bg-emerald-500' :
                                  p.entry_type === 'exit' ? 'bg-rose-500' :
                                  'bg-amber-500'
                                }`}></span>
                                <span className="font-black uppercase text-[10px]">
                                  {p.entry_type === 'entry' ? 'Entrada' : p.entry_type === 'exit' ? 'Salida' : p.entry_type === 'break_start' ? 'Inicio Descanso' : 'Vuelta Descanso'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-xs">{time}</span>
                                {p.photo_path && (
                                  <a href={p.photo_path} target="_blank" rel="noreferrer" className="text-[10px] bg-brand-cream border border-brand-border text-brand-maroon px-2 py-0.5 rounded font-black uppercase hover:bg-brand-maroon hover:text-white">Foto</a>
                                )}
                                {p.latitude && p.longitude && (
                                  <a href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`} target="_blank" rel="noreferrer" className="text-[10px] bg-brand-cream border border-brand-border text-brand-maroon px-2 py-0.5 rounded font-black uppercase hover:bg-brand-maroon hover:text-white">GPS</a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Footer */}
            <div className="bg-brand-cream/35 px-6 py-4 border-t border-brand-border shrink-0 flex justify-end">
              <button
                onClick={() => setShowDayDetailModal(false)}
                className="px-5 py-2 bg-brand-maroon hover:bg-brand-maroon/90 text-white text-xs font-black rounded-xl active:scale-95 transition-all shadow-sm uppercase tracking-wider"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 0.1 COMPANY REGISTRATION MODAL (Superadmin Only) */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider">
                {editingCompany ? 'Editar Empresa' : 'Registrar Empresa'}
              </h3>
              <button onClick={() => setShowCompanyModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleCompanySubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Razón Social</label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                    placeholder="Empresa S.L."
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Nombre Comercial</label>
                  <input
                    type="text"
                    value={commercialName}
                    onChange={(e) => setCommercialName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                    placeholder="Empresa"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">C.I.F.</label>
                  <input
                    type="text"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                    placeholder="B12345678"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Código Prefijo (3 letras)</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={compCode}
                    onChange={(e) => setCompCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs uppercase"
                    placeholder="XYZ"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Dirección</label>
                <input
                  type="text"
                  value={compAddress}
                  onChange={(e) => setCompAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Email</label>
                  <input
                    type="email"
                    value={compEmail}
                    onChange={(e) => setCompEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={compPhone}
                    onChange={(e) => setCompPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Timeout Sesión (minutos)</label>
                  <input
                    type="number"
                    value={compSessionTimeout}
                    onChange={(e) => setCompSessionTimeout(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                  />
                </div>
                {editingCompany && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Estado</label>
                    <select
                      value={compStatus}
                      onChange={(e) => setCompStatus(e.target.value as 'active' | 'blocked')}
                      className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-xs"
                    >
                      <option value="active">Activo</option>
                      <option value="blocked">Bloqueado</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompanyModal(false)}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-maroon text-white rounded-lg hover:bg-brand-maroon/90 active:scale-95 shadow-md"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 0.2 ASSIGN ADMINISTRATOR MODAL (Superadmin Only) */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider">Asignar Administrador</h3>
              <button onClick={() => setShowAdminModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleAdminSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                  placeholder="Juan Admin"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                  placeholder="admin@empresa.com"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Contraseña (Mín. 4 caracteres)</label>
                <input
                  type="password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-maroon text-white rounded-lg hover:bg-brand-maroon/90 active:scale-95 shadow-md"
                >
                  Asignar Administrador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. ADD / EDIT EMPLOYEE MODAL */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider">
                {editingEmp ? 'Editar Empleado' : 'Crear Empleado'}
              </h3>
              <button onClick={() => setShowEmpModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleEmpSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Empresa</label>
                  <select
                    value={empCompanyId}
                    onChange={(e) => {
                      setEmpCompanyId(e.target.value);
                      setEmpCentersSelected([]);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-xs focus:ring-1 focus:ring-brand-maroon focus:outline-none"
                    disabled={!isSuperadmin}
                    required
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.commercial_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  {editingEmp ? (
                    <>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Código de Empleado</label>
                      <input
                        type="text"
                        value={editingEmp.employee_code}
                        className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs bg-brand-cream/10 text-brand-subtext font-mono"
                        readOnly
                      />
                    </>
                  ) : (
                    <>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Código (Autogenerado)</label>
                      <input
                        type="text"
                        value="Prefijo-XXXX"
                        className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs bg-brand-cream/10 text-brand-subtext italic"
                        readOnly
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">DNI</label>
                  <input
                    type="text"
                    value={empDni}
                    onChange={(e) => setEmpDni(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs focus:ring-1 focus:ring-brand-maroon"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    value={empName}
                    onChange={(e) => setEmpName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs focus:ring-1 focus:ring-brand-maroon"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Correo (Opcional)</label>
                  <input
                    type="email"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs focus:ring-1 focus:ring-brand-maroon"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Teléfono (Opcional)</label>
                  <input
                    type="text"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs focus:ring-1 focus:ring-brand-maroon"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Puesto</label>
                  <input
                    type="text"
                    value={empJobTitle}
                    onChange={(e) => setEmpJobTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs focus:ring-1 focus:ring-brand-maroon"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Departamento</label>
                  <input
                    type="text"
                    value={empDept}
                    onChange={(e) => setEmpDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs focus:ring-1 focus:ring-brand-maroon"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Fecha Contratación</label>
                  <input
                    type="date"
                    value={empHireDate}
                    onChange={(e) => setEmpHireDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs focus:ring-1 focus:ring-brand-maroon"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Estado</label>
                  <select
                    value={empStatus}
                    onChange={(e) => setEmpStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-xs"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1.5">Asignar Centros de Trabajo</label>
                <div className="border border-brand-border rounded-lg p-2.5 space-y-1.5 max-h-28 overflow-y-auto bg-brand-cream/10">
                  {workCenters.filter(wc => wc.company_id === empCompanyId).map(center => {
                    const isChecked = empCentersSelected.includes(center.id);
                    return (
                      <label key={center.id} className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setEmpCentersSelected(prev => prev.filter(id => id !== center.id));
                            } else {
                              setEmpCentersSelected(prev => [...prev, center.id]);
                            }
                          }}
                          className="rounded border-brand-border text-brand-maroon focus:ring-brand-maroon"
                        />
                        {center.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmpModal(false)}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30 active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-maroon text-white rounded-lg hover:bg-brand-maroon/90 active:scale-95 shadow-md"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. CHANGE PIN MODAL */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider">Modificar PIN</h3>
              <button onClick={() => setShowPinModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handlePinSubmit} className="p-5 space-y-4">
              {pinError && <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs font-semibold">{pinError}</div>}
              {pinSuccess && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs font-semibold">{pinSuccess}</div>}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Nuevo PIN (4 dígitos)</label>
                <input
                  type="text"
                  maxLength={4}
                  value={newPinValue}
                  onChange={(e) => {
                    setPinError('');
                    setNewPinValue(e.target.value.replace(/\D/g, ''));
                  }}
                  className="w-full text-center text-lg font-mono tracking-widest px-3 py-2.5 rounded-lg border border-brand-border"
                  placeholder="1234"
                  required
                />
                <span className="text-[9px] text-brand-subtext/75 mt-1 block">
                  Debe ser único en toda la plataforma.
                </span>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-maroon text-white rounded-lg hover:bg-brand-maroon/90 active:scale-95"
                >
                  Actualizar PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ADD / EDIT WORK CENTER MODAL */}
      {showCenterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider">
                {editingCenter ? 'Editar Centro' : 'Nuevo Centro'}
              </h3>
              <button onClick={() => { setShowCenterModal(false); setEditingCenter(null); }} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleCenterSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Empresa</label>
                <select
                  value={centerCompanyId}
                  onChange={(e) => setCenterCompanyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-xs focus:ring-1 focus:ring-brand-maroon focus:outline-none"
                  disabled={!isSuperadmin}
                  required
                >
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.commercial_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Nombre del Centro</label>
                <input
                  type="text"
                  value={centerName}
                  onChange={(e) => setCenterName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                  placeholder="Sede Central"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Dirección</label>
                <input
                  type="text"
                  value={centerAddress}
                  onChange={(e) => setCenterAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                  placeholder="Calle de la Industria 1, Madrid"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Provincia</label>
                  <input
                    type="text"
                    value={centerProvince}
                    onChange={(e) => setCenterProvince(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs focus:ring-1 focus:ring-brand-maroon focus:outline-none"
                    placeholder="Ej. Madrid, Murcia"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Ciudad / Municipio</label>
                  <input
                    type="text"
                    value={centerCity}
                    onChange={(e) => setCenterCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs focus:ring-1 focus:ring-brand-maroon focus:outline-none"
                    placeholder="Ej. Madrid, Lorca"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Latitud (Opcional)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={centerLat}
                    onChange={(e) => setCenterLat(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                    placeholder="40.416775"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Longitud (Opcional)</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={centerLng}
                    onChange={(e) => setCenterLng(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                    placeholder="-3.70379"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Radio de Geofencing (m)</label>
                  <input
                    type="number"
                    value={centerRadius}
                    onChange={(e) => setCenterRadius(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                    placeholder="50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Estado</label>
                  <select
                    value={centerStatus}
                    onChange={(e) => setCenterStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-xs"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowCenterModal(false); setEditingCenter(null); }}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-maroon text-white rounded-lg hover:bg-brand-maroon/90 active:scale-95"
                >
                  {editingCenter ? 'Guardar' : 'Añadir Centro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. EDIT DEVICE MODAL */}
      {showDeviceModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider">Editar Dispositivo</h3>
              <button onClick={() => setShowDeviceModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleDeviceSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Nombre Dispositivo</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Centro Asignado</label>
                <select
                  value={deviceCenterId}
                  onChange={(e) => {
                    const centerId = e.target.value;
                    setDeviceCenterId(centerId);
                    const center = companyCenters.find(c => c.id === centerId);
                    if (center) {
                      setDeviceLat(center.latitude ? String(center.latitude) : '');
                      setDeviceLng(center.longitude ? String(center.longitude) : '');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-xs"
                  required
                >
                  {companyCenters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Geolocation Section */}
              <div className="bg-brand-cream/30 p-3.5 rounded-xl border border-brand-border/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-subtext flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-brand-maroon" /> Geolocalización (Centro)
                  </span>
                  {deviceLat && deviceLng && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${deviceLat},${deviceLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-bold text-brand-maroon hover:underline flex items-center gap-0.5"
                    >
                      <MapPin className="w-3 h-3" /> Google Maps ↗
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-brand-subtext mb-0.5">Latitud</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={deviceLat}
                      onChange={(e) => setDeviceLat(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-brand-border text-xs bg-white"
                      placeholder="ej: 40.416775"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-brand-subtext mb-0.5">Longitud</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={deviceLng}
                      onChange={(e) => setDeviceLng(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-brand-border text-xs bg-white"
                      placeholder="ej: -3.703790"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleOpenMapPicker}
                    className="flex-1 py-1.5 bg-brand-maroon/10 hover:bg-brand-maroon/20 text-brand-maroon text-[10px] font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                  >
                    <Map className="w-3.5 h-3.5" /> Posicionar en Mapa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = prompt("Pega las coordenadas (ej: 40.41,-3.7) o el enlace de Google Maps aquí:");
                      if (url) {
                        const parsed = parseCoordinates(url);
                        if (parsed) {
                          setDeviceLat(parsed.lat);
                          setDeviceLng(parsed.lng);
                          showAlert("Coordenadas importadas correctamente.", "success");
                        } else {
                          showAlert("No se pudieron extraer las coordenadas del texto.", "error");
                        }
                      }
                    }}
                    className="py-1.5 px-3 bg-brand-cream border border-brand-border hover:bg-brand-cream/70 text-brand-subtext text-[10px] font-bold rounded-lg transition-all"
                  >
                    Pegar Enlace
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Estado</label>
                  <select
                    value={deviceStatus}
                    onChange={(e) => setDeviceStatus(e.target.value as AuthorizedDevice['status'])}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-xs"
                  >
                    <option value="active">Activo</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Validación Cámara</label>
                  <select
                    value={deviceCameraStatus}
                    onChange={(e) => setDeviceCameraStatus(e.target.value as AuthorizedDevice['camera_validation_status'])}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-xs"
                  >
                    <option value="validated">Validada</option>
                    <option value="pending">Pendiente</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeviceModal(false)}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-maroon text-white rounded-lg hover:bg-brand-maroon/90 active:scale-95"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. RESOLVE INCIDENT MODAL */}
      {showResolveIncidentModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider">Justificar Incidencia</h3>
              <button onClick={() => setShowResolveIncidentModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleResolveIncidentSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Motivo / Justificación (Obligatorio)</label>
                <textarea
                  value={incidentJustification}
                  onChange={(e) => setIncidentJustification(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs h-24 resize-none"
                  placeholder="Se permite fichaje sin cámara/GPS debido a..."
                  required
                ></textarea>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowResolveIncidentModal(false)}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-maroon text-white rounded-lg hover:bg-brand-maroon/90 active:scale-95"
                >
                  Guardar Justificación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. RESOLVE REQUEST MODAL */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider">
                {resolveType === 'approved' ? 'Aprobar Solicitud' : 'Rechazar Solicitud'}
              </h3>
              <button onClick={() => setShowResolveModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Respuesta / Motivo (Obligatorio)</label>
                <textarea
                  value={resolveResponseText}
                  onChange={(e) => setResolveResponseText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs h-24 resize-none"
                  required
                ></textarea>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-maroon text-white rounded-lg hover:bg-brand-maroon/90 active:scale-95"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MANUAL PUNCH MODAL */}
      {showManualPunchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider">Crear Fichaje Manual</h3>
              <button onClick={() => setShowManualPunchModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleManualPunchSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Empleado</label>
                <select
                  value={manualEmpId}
                  onChange={(e) => setManualEmpId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-xs"
                  required
                >
                  <option value="">Seleccione empleado...</option>
                  {companyEmployees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Fecha</label>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Hora</label>
                  <input
                    type="time"
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Tipo de Fichaje</label>
                <select
                  value={manualEntryType}
                  onChange={(e) => setManualEntryType(e.target.value as EntryType)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-xs"
                  required
                >
                  <option value="entry">Entrada</option>
                  <option value="break_start">Inicio Descanso</option>
                  <option value="break_end">Vuelta Descanso</option>
                  <option value="exit">Salida</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Motivo de Creación (Obligatorio)</label>
                <textarea
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs h-20 resize-none"
                  required
                ></textarea>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowManualPunchModal(false)}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-maroon text-white rounded-lg hover:bg-brand-maroon/90 active:scale-95"
                >
                  Crear Fichaje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. VOID / ANULAR FICHAJE MODAL */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider">Anular Fichaje</h3>
              <button onClick={() => setShowVoidModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleVoidSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Motivo de Anulación (Obligatorio)</label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs h-24 resize-none"
                  required
                ></textarea>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowVoidModal(false)}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg active:scale-95"
                >
                  Anular Fichaje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. PURGE MODAL */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-red-700 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Eliminación Definitiva
              </h3>
              <button onClick={() => setShowPurgeModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handlePurgeSubmit} className="p-5 space-y-4">
              <div className="text-xs text-gray-700 space-y-2">
                <p>Está a punto de borrar definitivamente **todos los registros de fichajes e incidencias de más de 4 años** de su empresa.</p>
                <p className="text-red-600 font-bold">Esta acción es irreversible.</p>
                <p>Para confirmar, escriba textualmente: **ELIMINAR DEFINITIVAMENTE**</p>
              </div>

              <div>
                <input
                  type="text"
                  value={purgeConfirmText}
                  onChange={(e) => setPurgeConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-red-300 rounded-lg text-xs text-center font-bold text-red-700"
                  placeholder="ELIMINAR DEFINITIVAMENTE"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowPurgeModal(false)}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={purgeConfirmText !== 'ELIMINAR DEFINITIVAMENTE'}
                  className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg active:scale-95 disabled:opacity-50"
                >
                  Confirmar Purga
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE DEVICE CONFIRMATION MODAL */}
      {showDeleteDeviceModal && deleteDeviceTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-brand-border rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-white" />
              <h3 className="text-white font-black text-base uppercase tracking-wider">Eliminar Dispositivo</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-brand-text text-sm">
                ¿Estás seguro de que quieres <strong>eliminar definitivamente</strong> el dispositivo:
              </p>
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="font-black text-red-900 text-sm">{deleteDeviceTarget.name}</p>
                <p className="text-red-700 text-xs font-mono mt-0.5">{deleteDeviceTarget.device_token}</p>
                <p className="text-red-600 text-xs mt-1">
                  Centro: {workCenters.find(w => w.id === deleteDeviceTarget.work_center_id)?.name || 'N/D'} — Estado: {deleteDeviceTarget.status.toUpperCase()}
                </p>
              </div>
              <p className="text-brand-subtext text-xs">
                ⚠️ Esta acción es <strong>irreversible</strong>. El dispositivo se eliminará por completo de la base de datos. Si el terminal estaba activo, perderá el acceso inmediatamente.
              </p>
              {deleteDeviceError && (
                <p className="text-red-600 text-xs font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-2">{deleteDeviceError}</p>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowDeleteDeviceModal(false); setDeleteDeviceTarget(null); }}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await deleteDevice(deleteDeviceTarget.id);
                      setShowDeleteDeviceModal(false);
                      setDeleteDeviceTarget(null);
                      showAlert('Dispositivo eliminado correctamente.', 'success');
                    } catch (err: any) {
                      setDeleteDeviceError(err.message || 'Error al eliminar el dispositivo.');
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg active:scale-95 transition-all"
                >
                  Sí, Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE MAP PICKER MODAL */}
      {showMapPickerModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-brand-border rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="bg-brand-maroon px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-white animate-spin-slow" />
                <h3 className="text-white font-black text-base uppercase tracking-wider font-sans">Posicionar en el Mapa</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowMapPickerModal(false)}
                className="p-1 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Search bar */}
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!mapSearchText.trim()) return;
                  try {
                    const location = await geocodeAddress(mapSearchText);
                    if (location) {
                      const lat = location.latitude;
                      const lng = location.longitude;
                      setMapPickerLat(lat);
                      setMapPickerLng(lng);
                      if (mapRef.current) {
                        mapRef.current.setView([lat, lng], 15);
                      }
                      if (markerRef.current) {
                        markerRef.current.setLatLng([lat, lng]);
                      }
                    } else {
                      showAlert('No se encontraron resultados para la dirección buscada.', 'error');
                    }
                  } catch (err) {
                    logger.error('Error en la geocodificación.', err);
                    showAlert('Error al buscar la dirección.', 'error');
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={mapSearchText}
                  onChange={(e) => setMapSearchText(e.target.value)}
                  placeholder="Buscar dirección (ej: Lorca, Madrid, Calle Mayor...)"
                  className="flex-1 px-3 py-2 border border-brand-border rounded-xl text-xs bg-brand-cream/10"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-maroon text-white font-extrabold rounded-xl text-xs hover:bg-brand-maroon/90 active:scale-95 transition-all shadow-sm"
                >
                  Buscar
                </button>
              </form>

              {/* Leaflet container */}
              <div id="leaflet-map-picker" className="w-full h-72 rounded-2xl border border-brand-border overflow-hidden shadow-inner bg-brand-cream/10 z-10"></div>
              
              <div className="flex items-center justify-between text-xs text-brand-subtext bg-brand-cream/20 px-3 py-2 rounded-xl border border-brand-border/40">
                <span>📍 Ubicación seleccionada:</span>
                <span className="font-mono font-bold text-brand-maroon">
                  {mapPickerLat.toFixed(6)}, {mapPickerLng.toFixed(6)}
                </span>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowMapPickerModal(false)}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeviceLat(String(mapPickerLat));
                    setDeviceLng(String(mapPickerLng));
                    setShowMapPickerModal(false);
                    showAlert("Ubicación del mapa aplicada.", "success");
                  }}
                  className="px-4 py-2 text-xs font-bold bg-brand-maroon text-white rounded-lg hover:bg-brand-maroon/90 active:scale-95 transition-all"
                >
                  Confirmar Ubicación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO VIEWER MODAL */}
      {showPhotoViewer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up border border-brand-border">
            <div className="bg-brand-maroon px-6 py-4 flex items-center justify-between text-white">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider font-sans">{photoViewerTitle}</h3>
                <p className="text-[10px] text-white/80 font-medium mt-0.5">{photoViewerSub}</p>
              </div>
              <button 
                onClick={() => setShowPhotoViewer(false)} 
                className="p-1 hover:bg-white/10 rounded-full transition-all text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center justify-center bg-brand-cream/10">
              <div className="w-full aspect-[3/4] max-h-[400px] rounded-2xl border border-brand-border overflow-hidden bg-black flex items-center justify-center shadow-md">
                <img 
                  src={photoViewerUrl} 
                  alt="Fichaje Selfie" 
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoViewer(false)}
                className="mt-5 w-full py-2 bg-brand-maroon text-white text-xs font-bold rounded-xl hover:bg-brand-maroon/90 active:scale-95 transition-all shadow-sm uppercase tracking-wider"
              >
                Cerrar Vista
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
