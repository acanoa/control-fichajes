import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { EntryType, Employee, WorkCenter, AuthorizedDevice, TimeEntry, CorrectionRequest, TimeEntryIncident, Company, Profile } from '../../types';
import { 
  Users, Building, Video, Clock, AlertTriangle, 
  Settings, LogOut, Check, X, FileSpreadsheet, 
  FileText, ShieldAlert, Key, Plus, Trash2, Calendar, Edit
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export const AdminPage: React.FC = () => {
  const {
    currentUser, currentCompany, logout,
    companies, setCompanies,
    profiles, setProfiles,
    employees, workCenters, devices, timeEntries,
    incidents, requests, auditLogs, employeeWorkCenters,
    addEmployee, updateEmployee, changeEmployeePin,
    addWorkCenter, updateWorkCenter, updateDevice, resolveIncident,
    deauthorizeDevice, resolveRequest, deleteOldEntries, updateCompanySettings,
    setTimeEntries, showAlert
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

  // Tab State
  const [activeTab, setActiveTab] = useState<
    'companies' | 'dashboard' | 'employees' | 'centers' | 'devices' | 'entries' | 'requests' | 'incidents' | 'audit' | 'reports' | 'settings' | 'settings_global'
  >(isSuperadmin ? 'companies' : 'dashboard');

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

  // Add/Edit Device Form State
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AuthorizedDevice | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [deviceCenterId, setDeviceCenterId] = useState('');
  const [deviceStatus, setDeviceStatus] = useState<AuthorizedDevice['status']>('active');
  const [deviceCameraStatus, setDeviceCameraStatus] = useState<AuthorizedDevice['camera_validation_status']>('validated');

  // Resolve Incident State
  const [showResolveIncidentModal, setShowResolveIncidentModal] = useState(false);
  const [resolveIncidentId, setResolveIncidentId] = useState('');
  const [incidentJustification, setIncidentJustification] = useState('');

  // Resolve Request State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveTargetId, setResolveTargetId] = useState('');
  const [resolveType, setResolveType] = useState<'approved' | 'rejected'>('approved');
  const [resolveResponseText, setResolveResponseText] = useState('');

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

  // Report filters state
  const [reportEmpId, setReportEmpId] = useState('');
  const [reportCenterId, setReportCenterId] = useState('');
  const [reportStartDate, setReportStartDate] = useState(new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Company Settings state
  const [sessionTimeout, setSessionTimeout] = useState(activeCompany?.session_timeout_minutes || 5);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

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
          absent.push(emp.id);
        }
      }
    });

    return { present, resting, absent };
  };

  const { present, resting, absent } = getEmployeeStatusToday();
  const pendingRequests = companyRequests.filter(r => r.status === 'pending');

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
      const generatedPin = String(Math.floor(1000 + Math.random() * 9000));
      addEmployee({
        company_id: companyId,
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
        name: centerName,
        address: centerAddress,
        latitude: lat,
        longitude: lng,
        status: centerStatus
      });
      showAlert('Centro de trabajo modificado correctamente.', 'success');
    } else {
      addWorkCenter(centerName, centerAddress, lat, lng, centerRadius, centerStatus);
      showAlert('Centro de trabajo creado correctamente.', 'success');
    }

    setShowCenterModal(false);
    setEditingCenter(null);
    setCenterName('');
    setCenterAddress('');
    setCenterLat('');
    setCenterLng('');
    setCenterRadius(50);
  };

  const openCenterModal = (center?: WorkCenter) => {
    if (center) {
      setEditingCenter(center);
      setCenterName(center.name);
      setCenterAddress(center.address || '');
      setCenterLat(center.latitude ? String(center.latitude) : '');
      setCenterLng(center.longitude ? String(center.longitude) : '');
      setCenterStatus(center.status);
    } else {
      setEditingCenter(null);
      setCenterName('');
      setCenterAddress('');
      setCenterLat('');
      setCenterLng('');
      setCenterStatus('active');
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
    setShowDeviceModal(true);
  };

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

  // Report Downloads
  const downloadExcel = () => {
    const reportData = companyEntries
      .filter(t => !reportEmpId || t.employee_id === reportEmpId)
      .filter(t => {
        const dateStr = t.registered_at.split('T')[0];
        return dateStr >= reportStartDate && dateStr <= reportEndDate;
      })
      .map(t => {
        const emp = companyEmployees.find(e => e.id === t.employee_id);
        const center = companyCenters.find(c => c.id === t.work_center_id);
        return {
          'Empleado': emp?.full_name || 'Desconocido',
          'Código': emp?.employee_code || '',
          'DNI': emp?.dni || '',
          'Centro de Trabajo': center?.name || 'Desconocido',
          'Fecha': t.registered_at.split('T')[0],
          'Hora': t.registered_at.split('T')[1].slice(0, 8),
          'Tipo de Fichaje': t.entry_type.toUpperCase(),
          'Estado': t.status === 'active' ? 'Activo' : 'Anulado',
          'Método': t.source.toUpperCase(),
          'Justificación manual': t.manual_reason || ''
        };
      });

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fichajes');
    XLSX.writeFile(workbook, `reporte_fichajes_${activeCompany?.commercial_name || 'empresa'}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'bold');
    doc.text(`REPORTE DE CONTROL HORARIO - ${(activeCompany?.commercial_name || 'empresa').toUpperCase()}`, 14, 20);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Periodo: ${reportStartDate} al ${reportEndDate}`, 14, 26);

    const reportEntries = companyEntries
      .filter(t => !reportEmpId || t.employee_id === reportEmpId)
      .filter(t => {
        const dateStr = t.registered_at.split('T')[0];
        return dateStr >= reportStartDate && dateStr <= reportEndDate;
      });

    let y = 35;
    doc.setFont('Helvetica', 'bold');
    doc.text('Empleado', 14, y);
    doc.text('Fecha / Hora', 65, y);
    doc.text('Fichaje', 115, y);
    doc.text('Estado', 150, y);
    doc.text('Origen', 175, y);
    doc.line(14, y + 2, 195, y + 2);
    y += 7;

    doc.setFont('Helvetica', 'normal');
    reportEntries.forEach((t) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const emp = companyEmployees.find(e => e.id === t.employee_id);
      doc.text(emp?.full_name.slice(0, 20) || 'Desconocido', 14, y);
      doc.text(new Date(t.registered_at).toLocaleString('es-ES'), 65, y);
      doc.text(t.entry_type.toUpperCase(), 115, y);
      doc.text(t.status === 'active' ? 'ACTIVO' : 'ANULADO', 150, y);
      doc.text(t.source.toUpperCase(), 175, y);
      y += 6;
    });

    doc.save(`reporte_fichajes_${activeCompany?.commercial_name || 'empresa'}.pdf`);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen bg-brand-cream/20">
      {/* Side Menu Navigation */}
      <aside className="w-full md:w-64 bg-brand-maroon text-white flex flex-col shrink-0 border-r border-brand-border/40 shadow-lg">
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
              <table className="w-full text-left border-collapse">
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
                        <td className="px-4 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => openAdminModal(comp.id)}
                            className="text-brand-maroon hover:text-brand-maroon/80 font-bold hover:underline"
                          >
                            Asignar Admin
                          </button>
                          <button
                            onClick={() => handleToggleBlock(comp.id)}
                            className={`font-bold hover:underline ${
                              comp.status === 'active' ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'
                            }`}
                          >
                            {comp.status === 'active' ? 'Bloquear' : 'Desbloquear'}
                          </button>
                          <button
                            onClick={() => {
                              setPurgeTargetCompanyId(comp.id);
                              setShowPurgeModal(true);
                            }}
                            className="text-red-600 hover:text-red-700 font-bold hover:underline"
                          >
                            Purgar
                          </button>
                          <button
                            onClick={() => openCompanyModal(comp)}
                            className="text-brand-maroon hover:text-brand-maroon/80 font-bold hover:underline"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                  <h3 className="text-xs uppercase text-brand-subtext font-bold">Ausentes / Salida</h3>
                  <p className="text-3xl font-black text-brand-text">{absent.length}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm space-y-4">
                <h2 className="font-extrabold text-sm text-brand-maroon uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>
                  Presentes en Planta
                </h2>
                <div className="divide-y divide-brand-border text-xs font-semibold max-h-60 overflow-y-auto">
                  {present.length === 0 ? (
                    <p className="text-brand-subtext text-center py-4">No hay empleados trabajando actualmente.</p>
                  ) : (
                    present.map(id => {
                      const emp = companyEmployees.find(e => e.id === id);
                      return (
                        <div key={id} className="py-2.5 flex items-center justify-between">
                          <span className="text-brand-text font-bold">{emp?.full_name}</span>
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
                  Ausentes / Fuera
                </h2>
                <div className="divide-y divide-brand-border text-xs font-semibold max-h-60 overflow-y-auto">
                  {absent.length === 0 ? (
                    <p className="text-brand-subtext text-center py-4">Todos los empleados están presentes.</p>
                  ) : (
                    absent.map(id => {
                      const emp = companyEmployees.find(e => e.id === id);
                      return (
                        <div key={id} className="py-2.5 flex items-center justify-between">
                          <span className="text-brand-text font-bold">{emp?.full_name}</span>
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
              <table className="w-full text-left border-collapse">
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
                        <td className="px-4 py-3.5 text-right space-x-3">
                          <button
                            onClick={() => {
                              setPinTargetEmpId(emp.id);
                              setNewPinValue('');
                              setPinError('');
                              setPinSuccess('');
                              setShowPinModal(true);
                            }}
                            className="text-amber-600 hover:text-amber-700 hover:underline font-bold"
                          >
                            Modificar PIN
                          </button>
                          <button
                            onClick={() => openEmpModal(emp)}
                            className="text-brand-maroon hover:text-brand-maroon/80 hover:underline font-bold"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                  <div className="flex justify-end pt-4 border-t border-brand-border/40 mt-4">
                    <button
                      onClick={() => openCenterModal(center)}
                      className="text-brand-maroon hover:text-brand-maroon/80 font-bold text-xs flex items-center gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" /> Editar Centro
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
              <table className="w-full text-left border-collapse">
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
                      <td className="px-4 py-3.5 text-right space-x-3">
                        <button
                          onClick={() => openDeviceModal(dev)}
                          className="text-brand-maroon hover:underline font-bold"
                        >
                          Editar
                        </button>
                        {dev.status === 'active' && (
                          <button
                            onClick={() => deauthorizeDevice(dev.id)}
                            className="text-red-600 hover:text-red-700 font-bold hover:underline"
                          >
                            Desactivar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                              <a href={entry.photo_path} target="_blank" rel="noreferrer" className="text-brand-maroon hover:underline font-bold text-[9px] uppercase">VER FOTO</a>
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
                          {entry.status === 'active' && (
                            <button
                              onClick={() => {
                                  setVoidTargetId(entry.id);
                                  setShowVoidModal(true);
                              }}
                              className="text-red-600 hover:text-red-700 font-bold hover:underline"
                            >
                              Anular
                            </button>
                          )}
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
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" /> Aprobar
                            </button>
                            <button
                              onClick={() => openResolveModal(req.id, 'rejected')}
                              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg active:scale-95 transition-all shadow-md flex items-center gap-1.5"
                            >
                              <X className="w-3.5 h-3.5" /> Rechazar
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
                <table className="w-full text-left border-collapse">
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
                            {!isResolved ? (
                              <button
                                onClick={() => {
                                  setResolveIncidentId(inc.id);
                                  setIncidentJustification('');
                                  setShowResolveIncidentModal(true);
                                }}
                                className="text-brand-maroon hover:underline font-bold text-xs"
                              >
                                Justificar
                              </button>
                            ) : (
                              <span className="text-emerald-600 font-bold text-xs">✓ Resuelto</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 8. AUDIT */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-maroon">LOGS DE AUDITORÍA</h1>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
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
        )}

        {/* Tab 9. REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-maroon">DESCARGA DE INFORMES</h1>

            <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm max-w-xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="flex gap-4 pt-4 border-t border-brand-border/40">
                <button
                  onClick={downloadExcel}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl hover:shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
                </button>
                <button
                  onClick={downloadPDF}
                  className="flex-1 flex items-center justify-center gap-2 bg-brand-maroon hover:bg-brand-maroon/90 text-white font-bold py-3 rounded-xl hover:shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider"
                >
                  <FileText className="w-4 h-4" /> Exportar PDF
                </button>
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
      </main>

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
                  {companyCenters.map(center => {
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
                  onChange={(e) => setDeviceCenterId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-xs"
                  required
                >
                  {companyCenters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
    </div>
  );
};
