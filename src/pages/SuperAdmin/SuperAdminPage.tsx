import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Company, Profile, GlobalSetting } from '../../types';
import { 
  Building, Shield, Users, Clock, AlertTriangle, 
  Settings, LogOut, Check, X, Plus, ShieldAlert, Trash2, Key, Video,
  Pencil, UserCheck, Lock, Unlock
} from 'lucide-react';

export const SuperAdminPage: React.FC = () => {
  const {
    logout,
    companies, setCompanies,
    profiles, setProfiles,
    workCenters, employees, devices, timeEntries,
    incidents, auditLogs, deleteOldEntries
  } = useApp();

  const [activeTab, setActiveTab] = useState<'companies' | 'all_entries' | 'all_incidents' | 'all_audit' | 'settings' | 'all_employees' | 'all_centers' | 'all_devices'>('companies');

  // Add / Edit Company Form
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [legalName, setLegalName] = useState('');
  const [commercialName, setCommercialName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [compCode, setCompCode] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [sessionTimeout, setSessionTimeout] = useState(5);
  const [compStatus, setCompStatus] = useState<'active' | 'blocked'>('active');

  // Assign Admin Form
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminTargetCompanyId, setAdminTargetCompanyId] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // Purge State
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeTargetCompanyId, setPurgeTargetCompanyId] = useState('');
  const [purgeConfirmText, setPurgeConfirmText] = useState('');

  // Global Settings state
  const [globalTimeout, setGlobalTimeout] = useState(5);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Filters for lists
  const [filterCompanyId, setFilterCompanyId] = useState('');

  // Handle Company Submission
  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName || !commercialName || !taxId || !compCode) {
      alert('Nombre, C.I.F. y Código de Empresa son obligatorios.');
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
        address: address || undefined,
        email: email || undefined,
        phone: phone || undefined,
        session_timeout_minutes: sessionTimeout,
        status: compStatus,
        updated_at: new Date().toISOString()
      } : c);
      if (setCompanies) setCompanies(updated);
      alert('Empresa modificada con éxito.');
    } else {
      if (companies.some(c => c.company_code === cleanCode)) {
        alert('Este código de empresa ya está en uso.');
        return;
      }

      const newCompany: Company = {
        id: 'comp-' + Math.random().toString(36).substr(2, 9),
        legal_name: legalName,
        commercial_name: commercialName,
        tax_id: taxId,
        company_code: cleanCode,
        address: address || undefined,
        email: email || undefined,
        phone: phone || undefined,
        status: 'active',
        session_timeout_minutes: sessionTimeout,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (setCompanies) setCompanies(prev => [...prev, newCompany]);
      alert('Nueva empresa registrada con éxito.');
    }

    setShowCompanyModal(false);
  };

  // Handle Admin Submission (Assign/Substitute Company Administrator)
  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminName || !adminEmail || !adminPass) {
      alert('Complete todos los campos del administrador.');
      return;
    }

    // Check if email already in use
    const emailExists = profiles.some(p => p.email.toLowerCase() === adminEmail.trim().toLowerCase());
    if (emailExists) {
      alert('Este correo electrónico ya está registrado en el sistema.');
      return;
    }

    // Inactivate previous admin for this company
    const updatedProfiles = profiles.map(p => 
      (p.company_id === adminTargetCompanyId && p.role === 'company_admin') 
        ? { ...p, status: 'blocked' as const, updated_at: new Date().toISOString() } 
        : p
    );

    // Add new Admin Profile
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
    alert(`Administrador asignado correctamente a la empresa. Credenciales simuladas listas.`);
    setShowAdminModal(false);
    // Reset Form
    setAdminName('');
    setAdminEmail('');
    setAdminPass('');
  };

  const openCompanyModal = (company?: Company) => {
    if (company) {
      setEditingCompany(company);
      setLegalName(company.legal_name);
      setCommercialName(company.commercial_name);
      setTaxId(company.tax_id);
      setCompCode(company.company_code);
      setAddress(company.address || '');
      setEmail(company.email || '');
      setPhone(company.phone || '');
      setSessionTimeout(company.session_timeout_minutes);
      setCompStatus(company.status);
    } else {
      setEditingCompany(null);
      setLegalName('');
      setCommercialName('');
      setTaxId('');
      setCompCode('');
      setAddress('');
      setEmail('');
      setPhone('');
      setSessionTimeout(5);
      setCompStatus('active');
    }
    setShowCompanyModal(true);
  };

  const openAdminModal = (companyId: string) => {
    setAdminTargetCompanyId(companyId);
    setAdminName('');
    setAdminEmail('');
    setAdminPass('');
    setShowAdminModal(true);
  };

  const handleToggleBlock = (companyId: string) => {
    if (setCompanies) {
      setCompanies(prev => prev.map(c => {
        if (c.id === companyId) {
          const nextStatus = c.status === 'active' ? 'blocked' as const : 'active' as const;
          alert(`Empresa ${nextStatus === 'blocked' ? 'BLOQUEADA' : 'ACTIVADA'} correctamente.`);
          return { ...c, status: nextStatus, updated_at: new Date().toISOString() };
        }
        return c;
      }));
    }
  };

  const handlePurgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (purgeConfirmText !== 'ELIMINAR DEFINITIVAMENTE') {
      alert('Escriba exactamente "ELIMINAR DEFINITIVAMENTE" para confirmar.');
      return;
    }

    deleteOldEntries(purgeTargetCompanyId);
    alert('Registros antiguos eliminados con éxito.');
    setShowPurgeModal(false);
    setPurgeConfirmText('');
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSuccess(true);
    setTimeout(() => setSettingsSuccess(false), 2000);
  };

  // Filter handlers
  const filteredEmployees = employees.filter(e => !filterCompanyId || e.company_id === filterCompanyId);
  const filteredCenters = workCenters.filter(c => !filterCompanyId || c.company_id === filterCompanyId);
  const filteredDevices = devices.filter(d => !filterCompanyId || d.company_id === filterCompanyId);

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen bg-brand-cream/20">
      {/* Side Navigation Menu */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col shrink-0 border-r border-brand-border/40 shadow-lg">
        <div className="p-6 border-b border-white/10 text-center">
          <h2 className="text-xl font-bold tracking-wider text-white">SUPERADMIN</h2>
          <p className="text-[10px] text-white/50 mt-1 uppercase tracking-widest font-bold">Consola de Control Global</p>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {[
            { id: 'companies', label: 'Gestión Empresas', icon: Building },
            { id: 'all_employees', label: 'Consulta Empleados', icon: Users },
            { id: 'all_centers', label: 'Consulta Centros', icon: Building },
            { id: 'all_devices', label: 'Consulta Dispositivos', icon: Video },
            { id: 'all_entries', label: 'Consulta Fichajes', icon: Clock },
            { id: 'all_incidents', label: 'Incidencias Globales', icon: AlertTriangle },
            { id: 'all_audit', label: 'Auditoría Completa', icon: ShieldAlert },
            { id: 'settings', label: 'Parámetros Globales', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${
                activeTab === tab.id 
                  ? 'bg-brand-maroon text-white shadow-md' 
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
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
        {/* 1. COMPANIES MANAGEMENT */}
        {activeTab === 'companies' && (
          <div className="space-y-6">
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
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => openAdminModal(comp.id)}
                              className="p-1.5 text-brand-maroon hover:bg-brand-cream/50 rounded-lg transition-all"
                              title="Asignar Administrador"
                            >
                              <UserCheck className="w-4 h-4" />
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
        )}

        {/* 2. CONSULT EMPLOYEES */}
        {activeTab === 'all_employees' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-brand-maroon">CONSULTA DE EMPLEADOS</h1>
              {/* Company Filter Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-subtext">Filtrar Empresa:</span>
                <select
                  value={filterCompanyId}
                  onChange={(e) => setFilterCompanyId(e.target.value)}
                  className="px-3 py-1.5 border border-brand-border bg-white rounded-lg text-xs"
                >
                  <option value="">Todas</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.commercial_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">DNI</th>
                    <th className="px-4 py-3">Puesto</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs font-semibold">
                  {filteredEmployees.map(emp => {
                    const comp = companies.find(c => c.id === emp.company_id);
                    return (
                      <tr key={emp.id} className="hover:bg-brand-cream/10">
                        <td className="px-4 py-3.5 uppercase text-[9px] font-bold text-brand-subtext">{comp?.commercial_name}</td>
                        <td className="px-4 py-3.5 font-mono">{emp.employee_code}</td>
                        <td className="px-4 py-3.5">{emp.full_name}</td>
                        <td className="px-4 py-3.5 font-mono">{emp.dni}</td>
                        <td className="px-4 py-3.5 text-brand-subtext">{emp.job_title || 'N/D'}</td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            emp.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                          }`}>
                            {emp.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. CONSULT CENTERS */}
        {activeTab === 'all_centers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-brand-maroon">CONSULTA DE CENTROS</h1>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-subtext">Filtrar Empresa:</span>
                <select
                  value={filterCompanyId}
                  onChange={(e) => setFilterCompanyId(e.target.value)}
                  className="px-3 py-1.5 border border-brand-border bg-white rounded-lg text-xs"
                >
                  <option value="">Todas</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.commercial_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Nombre Centro</th>
                    <th className="px-4 py-3">Dirección</th>
                    <th className="px-4 py-3">Coordenadas</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs font-semibold">
                  {filteredCenters.map(center => {
                    const comp = companies.find(c => c.id === center.company_id);
                    return (
                      <tr key={center.id} className="hover:bg-brand-cream/10">
                        <td className="px-4 py-3.5 uppercase text-[9px] font-bold text-brand-subtext">{comp?.commercial_name}</td>
                        <td className="px-4 py-3.5 font-bold">{center.name}</td>
                        <td className="px-4 py-3.5 text-brand-subtext">{center.address || 'N/D'}</td>
                        <td className="px-4 py-3.5 font-mono text-[10px]">
                          {center.latitude && center.longitude ? `${center.latitude}, ${center.longitude}` : 'N/D'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            center.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                          }`}>
                            {center.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. CONSULT DEVICES */}
        {activeTab === 'all_devices' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-brand-maroon">CONSULTA DE DISPOSITIVOS</h1>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-subtext">Filtrar Empresa:</span>
                <select
                  value={filterCompanyId}
                  onChange={(e) => setFilterCompanyId(e.target.value)}
                  className="px-3 py-1.5 border border-brand-border bg-white rounded-lg text-xs"
                >
                  <option value="">Todas</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.commercial_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Token</th>
                    <th className="px-4 py-3">Cámara Validada</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs font-semibold">
                  {filteredDevices.map(dev => {
                    const comp = companies.find(c => c.id === dev.company_id);
                    return (
                      <tr key={dev.id} className="hover:bg-brand-cream/10">
                        <td className="px-4 py-3.5 uppercase text-[9px] font-bold text-brand-subtext">{comp?.commercial_name}</td>
                        <td className="px-4 py-3.5">{dev.name}</td>
                        <td className="px-4 py-3.5 font-mono">{dev.device_token}</td>
                        <td className="px-4 py-3.5 uppercase text-[9px] font-bold">{dev.camera_validation_status}</td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            dev.status === 'active' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                          }`}>
                            {dev.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. ALL ENTRIES CONSULTATION */}
        {activeTab === 'all_entries' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-maroon">CONSULTA GLOBAL DE FICHAJES</h1>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Empleado</th>
                    <th className="px-4 py-3">Fecha/Hora</th>
                    <th className="px-4 py-3">Fichaje</th>
                    <th className="px-4 py-3">Foto Evidencia</th>
                    <th className="px-4 py-3">Ubicación GPS</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs font-semibold">
                  {timeEntries.map(entry => {
                    const comp = companies.find(c => c.id === entry.company_id);
                    const emp = employees.find(e => e.id === entry.employee_id);
                    return (
                      <tr key={entry.id} className="hover:bg-brand-cream/10">
                        <td className="px-4 py-3.5 uppercase text-[9px] font-bold text-brand-subtext">{comp?.commercial_name}</td>
                        <td className="px-4 py-3.5">{emp?.full_name}</td>
                        <td className="px-4 py-3.5">{new Date(entry.registered_at).toLocaleString('es-ES')}</td>
                        <td className="px-4 py-3.5">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                            entry.entry_type === 'entry' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                          }`}>
                            {entry.entry_type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          {entry.photo_path ? (
                            <a href={entry.photo_path} target="_blank" rel="noreferrer" className="text-brand-maroon hover:underline font-bold text-[9px] uppercase">VER FOTOGRAFÍA</a>
                          ) : (
                            <span className="text-[9px] text-red-500 font-bold uppercase">SIN FOTO</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[10px]">
                          {entry.latitude && entry.longitude ? `${entry.latitude.toFixed(4)}, ${entry.longitude.toFixed(4)}` : 'N/D'}
                        </td>
                        <td className="px-4 py-3.5 uppercase font-bold text-[9px]">{entry.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. ALL INCIDENTS */}
        {activeTab === 'all_incidents' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-maroon">INCIDENCIAS DE CAPTURA GLOBALES</h1>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Empleado</th>
                    <th className="px-4 py-3">Fecha/Hora</th>
                    <th className="px-4 py-3">Tipo Incidencia</th>
                    <th className="px-4 py-3">Foto / GPS faltante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs font-semibold">
                  {incidents.map(inc => {
                    const comp = companies.find(c => c.id === inc.company_id);
                    const emp = employees.find(e => e.id === inc.employee_id);
                    return (
                      <tr key={inc.id} className="hover:bg-brand-cream/10">
                        <td className="px-4 py-3.5 uppercase text-[9px] font-bold text-brand-subtext">{comp?.commercial_name}</td>
                        <td className="px-4 py-3.5">{emp?.full_name}</td>
                        <td className="px-4 py-3.5">{new Date(inc.created_at).toLocaleString('es-ES')}</td>
                        <td className="px-4 py-3.5 font-bold text-rose-600">{inc.incident_type}</td>
                        <td className="px-4 py-3.5">
                          {inc.missing_photo && 'FOTO'} {inc.missing_gps && 'GPS'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. ALL AUDIT LOGS */}
        {activeTab === 'all_audit' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-maroon">LOGS DE AUDITORÍA CENTRALIZADOS</h1>

            <div className="bg-brand-card rounded-2xl border border-brand-border overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Entidad</th>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Fecha/Hora</th>
                    <th className="px-4 py-3">Motivo Justificativo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border text-xs font-semibold">
                  {auditLogs.map(log => {
                    const comp = companies.find(c => c.id === log.company_id);
                    return (
                      <tr key={log.id} className="hover:bg-brand-cream/10">
                        <td className="px-4 py-3.5 uppercase text-[9px] font-bold text-brand-subtext">{comp?.commercial_name || 'Global'}</td>
                        <td className="px-4 py-3.5 uppercase font-mono text-[10px]">{log.entity_type}</td>
                        <td className="px-4 py-3.5 uppercase text-[10px] text-brand-maroon font-bold">{log.action}</td>
                        <td className="px-4 py-3.5">{new Date(log.performed_at).toLocaleString('es-ES')}</td>
                        <td className="px-4 py-3.5 text-brand-subtext font-normal">{log.reason || 'Sin justificación'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 8. SETTINGS */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-brand-maroon">PARÁMETROS GLOBAL DEL SISTEMA</h1>

            <div className="bg-brand-card p-6 rounded-2xl border border-brand-border shadow-sm max-w-md">
              <form onSubmit={handleSaveSettings} className="space-y-5">
                {settingsSuccess && (
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

      {/* COMPANY REGISTRATION MODAL */}
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
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Timeout Sesión (minutos)</label>
                  <input
                    type="number"
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(Number(e.target.value))}
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

      {/* ASSIGN ADMINISTRATOR MODAL */}
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

      {/* PURGE CONFIRMATION MODAL */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-red-700 text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> ELIMINACIÓN DEFINITIVA GLOBAL
              </h3>
              <button onClick={() => setShowPurgeModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handlePurgeSubmit} className="p-5 space-y-4">
              <div className="text-xs text-gray-700 space-y-2">
                <p>Está a punto de borrar definitivamente **todos los registros de fichajes, fotografías, incidencias y auditorías que superen los 4 años de antigüedad** para la empresa seleccionada.</p>
                <p className="text-red-600 font-bold">Esta acción es irreversible y borrará también las evidencias del almacenamiento físico.</p>
                <p>Para confirmar, escriba textualmente: **ELIMINAR DEFINITIVAMENTE**</p>
              </div>

              <div>
                <input
                  type="text"
                  value={purgeConfirmText}
                  onChange={(e) => setPurgeConfirmText(e.target.value)}
                  className="w-full px-3 py-2 border border-red-300 rounded-lg text-xs text-center font-bold"
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
                  Eliminar Todo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
