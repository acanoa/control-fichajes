import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/useApp';
import { EntryType } from '../../types';
import { Clock, LogOut, CheckCircle2, History, AlertTriangle, FileEdit, PlusCircle, Compass, Camera, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export const EmployeePage: React.FC = () => {
  const { 
    currentUser, currentCompany, currentWorkCenter, 
    timeEntries, registerPunch, submitRequest, requests, logout, workCenters, showAlert 
  } = useApp();

  const employee = currentUser.employee!;

  const [activeSubTab, setActiveSubTab] = useState<'clock' | 'history' | 'requests'>('clock');
  const [time, setTime] = useState(new Date());

  // Simulation flags for testing incidents
  const [simulateCameraFail, setSimulateCameraFail] = useState(false);

  // GPS state
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'ok' | 'error'>('idle');

  // Custom incident report state
  const [reportIncident, setReportIncident] = useState(false);
  const [incidentComment, setIncidentComment] = useState('');

  // Punch screen state
  const [punchingType, setPunchingType] = useState<EntryType | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [punchSuccess, setPunchSuccess] = useState<string | null>(null);
  const [punchError, setPunchError] = useState('');
  const [punchStep, setPunchStep] = useState<'idle' | 'camera_preview' | 'registering'>('idle');

  // History filtering
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');

  // Request form state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqType, setReqType] = useState<'modify_existing' | 'create_missing'>('create_missing');
  const [reqTargetEntryId, setReqTargetEntryId] = useState<string>('');
  const [reqDate, setReqDate] = useState('');
  const [reqTime, setReqTime] = useState('');
  const [reqEntryType, setReqEntryType] = useState<EntryType>('entry');
  const [reqReason, setReqReason] = useState('');
  const [reqSuccess, setReqSuccess] = useState('');

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine button disabled state & reasons
  const getTodayEntries = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    return timeEntries
      .filter(t => t.employee_id === employee.id && t.status === 'active' && t.registered_at.startsWith(todayStr))
      .sort((a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime());
  };

  const getButtonState = (type: EntryType): { disabled: boolean; reason?: string } => {
    const todayEntries = getTodayEntries();
    const lastEntry = todayEntries[todayEntries.length - 1];

    if (type === 'entry') {
      if (lastEntry && lastEntry.entry_type !== 'exit') {
        return { disabled: true, reason: 'Ya has registrado la Entrada de tu jornada.' };
      }
      return { disabled: false };
    }

    if (todayEntries.length === 0) {
      return { disabled: true, reason: 'Debes registrar la Entrada primero.' };
    }

    if (type === 'break_start') {
      if (lastEntry.entry_type !== 'entry') {
        return { disabled: true, reason: 'Debes estar en estado "Entrada" para iniciar un descanso.' };
      }
      const hasBreak = todayEntries.some(t => t.entry_type === 'break_start');
      if (hasBreak) {
        return { disabled: true, reason: 'Solo se permite un descanso por jornada.' };
      }
      return { disabled: false };
    }

    if (type === 'break_end') {
      if (lastEntry.entry_type !== 'break_start') {
        return { disabled: true, reason: 'No tienes un descanso en progreso.' };
      }
      return { disabled: false };
    }

    if (type === 'exit') {
      if (lastEntry.entry_type === 'break_start') {
        return { disabled: true, reason: 'Debes registrar la Vuelta del descanso primero.' };
      }
      if (lastEntry.entry_type === 'exit') {
        return { disabled: true, reason: 'Ya has registrado la Salida de tu jornada.' };
      }
      return { disabled: false };
    }

    return { disabled: false };
  };

  // Run Punch Action
  const startPunchFlow = async (type: EntryType) => {
    setPunchError('');
    setPunchSuccess(null);
    setPunchingType(type);
    setPunchStep('camera_preview');

    if (simulateCameraFail || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Direct jump to register since camera isn't accessible, log as incident
      const errorMsg = !navigator.mediaDevices ? 'Acceso bloqueado por navegador (Conexión insegura HTTP)' : 'Cámara no disponible / Permiso denegado';
      registerPunchAction(type, null, errorMsg, reportIncident ? incidentComment : undefined);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);
      setTimeout(() => {
        const video = document.getElementById('punch-video') as HTMLVideoElement;
        if (video) {
          video.srcObject = stream;
          video.play();
        }
      }, 500);
    } catch {
      // Fallback: camera error but PRD says let employee complete the punch with an incident
      registerPunchAction(type, null, 'Permiso de cámara denegado', reportIncident ? incidentComment : undefined);
    }
  };

  const captureAndRegister = () => {
    if (!cameraStream) return;
    const video = document.getElementById('punch-video') as HTMLVideoElement;
    const canvas = document.createElement('canvas');
    if (video) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgBase64 = canvas.toDataURL('image/jpeg');
        
        // Stop stream
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);

        registerPunchAction(punchingType!, imgBase64, undefined, reportIncident ? incidentComment : undefined);
      }
    }
  };

  const registerPunchAction = async (type: EntryType, photo: string | null, camErr?: string, manualReason?: string) => {
    setPunchStep('registering');

    // Real GPS acquisition
    let lat: number | undefined = undefined;
    let lng: number | undefined = undefined;
    let gpsErr: string | undefined = undefined;

    if ('geolocation' in navigator) {
      setGpsStatus('acquiring');
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        lat = position.coords.latitude;
        lng = position.coords.longitude;
        setGpsStatus('ok');
      } catch (geoErr: any) {
        setGpsStatus('error');
        const code = geoErr?.code;
        if (code === 1) gpsErr = 'Permiso de ubicación denegado por el usuario';
        else if (code === 2) gpsErr = 'Posición GPS no disponible';
        else if (code === 3) gpsErr = 'Tiempo de espera GPS agotado';
        else gpsErr = 'Error al obtener ubicación GPS';
      }
    } else {
      gpsErr = 'Geolocalización no soportada por este dispositivo';
    }

    try {
      await registerPunch(type, photo, lat, lng, camErr, gpsErr, manualReason);
      
      // Success Confetti!
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#701E36', '#DED2C8', '#765247']
      });

      const typeLabels = {
        entry: 'Entrada registrada correctamente.',
        break_start: 'Inicio de descanso registrado.',
        break_end: 'Vuelta de descanso registrada.',
        exit: 'Salida registrada correctamente.'
      };

      setPunchSuccess(typeLabels[type]);
      setPunchStep('idle');
      setPunchingType(null);
      setReportIncident(false);
      setIncidentComment('');
      setTimeout(() => setGpsStatus('idle'), 3000); // hide GPS badge after 3s
    } catch (err: any) {
      setPunchError(err.message || 'Error registrando el fichaje.');
      setPunchStep('idle');
      setPunchingType(null);
      setTimeout(() => setGpsStatus('idle'), 3000);
    }
  };

  const handleCancelPunch = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setPunchStep('idle');
    setPunchingType(null);
    setReportIncident(false);
    setIncidentComment('');
  };

  // Submit Request Action
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqDate || !reqTime || !reqReason) {
      showAlert('Por favor rellene todos los campos.', 'error');
      return;
    }
    try {
      await submitRequest(reqType, reqDate, reqTime, reqEntryType, reqReason, reqTargetEntryId || undefined);
      setReqSuccess('Solicitud registrada correctamente. El administrador recibirá una notificación.');
    } catch (error) {
      showAlert(error instanceof Error ? error.message : 'No se pudo registrar la solicitud.', 'error');
      return;
    }
    setTimeout(() => {
      setReqSuccess('');
      setShowRequestModal(false);
      // Reset form
      setReqDate('');
      setReqTime('');
      setReqReason('');
      setReqTargetEntryId('');
    }, 2000);
  };

  // Filter history
  const filteredEntries = timeEntries
    .filter(t => t.employee_id === employee.id)
    .filter(t => {
      if (!historyStart && !historyEnd) return true;
      const date = t.registered_at.split('T')[0];
      const startMatch = !historyStart || date >= historyStart;
      const endMatch = !historyEnd || date <= historyEnd;
      return startMatch && endMatch;
    })
    .sort((a, b) => new Date(b.registered_at).getTime() - new Date(a.registered_at).getTime());

  const filteredRequests = requests.filter(r => r.employee_id === employee.id);

  const getEntryTypeBadge = (type: EntryType) => {
    const labels = {
      entry: { text: 'ENTRADA', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
      break_start: { text: 'DESCANSO', bg: 'bg-amber-50 text-amber-800 border-amber-200' },
      break_end: { text: 'VUELTA', bg: 'bg-blue-50 text-blue-800 border-blue-200' },
      exit: { text: 'SALIDA', bg: 'bg-rose-50 text-rose-800 border-rose-200' }
    };
    return labels[type] || { text: type, bg: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Top Header */}
      <header className="bg-brand-maroon text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          {currentCompany?.logo_path ? (
            <img src={currentCompany.logo_path} alt="Logo" className="w-8 h-8 rounded-full object-cover border border-white/20" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-sm">
              {currentCompany?.commercial_name[0]}
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold leading-tight">{employee.full_name}</h2>
            <p className="text-xs text-white/70 font-medium">Código: {employee.employee_code} • {currentWorkCenter?.name}</p>
          </div>
        </div>

        <button 
          onClick={logout} 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-bold hover:bg-white/20 active:scale-95 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Salir
        </button>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-brand-border flex">
        <button
          onClick={() => setActiveSubTab('clock')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'clock' 
              ? 'text-brand-maroon border-b-2 border-brand-maroon bg-brand-cream/10' 
              : 'text-brand-subtext hover:text-brand-text'
          }`}
        >
          <Clock className="w-4 h-4" />
          Terminal
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'history' 
              ? 'text-brand-maroon border-b-2 border-brand-maroon bg-brand-cream/10' 
              : 'text-brand-subtext hover:text-brand-text'
          }`}
        >
          <History className="w-4 h-4" />
          Mis Fichajes
        </button>
        <button
          onClick={() => setActiveSubTab('requests')}
          className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeSubTab === 'requests' 
              ? 'text-brand-maroon border-b-2 border-brand-maroon bg-brand-cream/10' 
              : 'text-brand-subtext hover:text-brand-text'
          }`}
        >
          <FileEdit className="w-4 h-4" />
          Solicitudes
        </button>
      </div>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        {/* 1. CLOCK / TERMINAL VIEW */}
        {activeSubTab === 'clock' && (
          <div className="space-y-6">
            {/* Clock Widget */}
            <div className="bg-brand-card rounded-2xl p-6 border border-brand-border text-center shadow-sm">
              <span className="text-brand-subtext font-mono text-sm tracking-widest font-semibold uppercase">
                {time.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <h2 className="text-4xl md:text-5xl font-mono font-black text-brand-maroon mt-2 select-none">
                {time.toLocaleTimeString('es-ES')}
              </h2>
            </div>

            {/* Dev simulation controls — camera only */}
            <div className="p-3 bg-brand-cream/40 border border-brand-border/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-brand-subtext">
              <span>🔧 Simular Entornos de Prueba:</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simulateCameraFail}
                    onChange={(e) => setSimulateCameraFail(e.target.checked)}
                    className="rounded text-brand-maroon focus:ring-brand-maroon"
                  />
                  Fallo de Cámara
                </label>
              </div>
              {/* GPS status indicator */}
              {gpsStatus !== 'idle' && (
                <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider ${
                  gpsStatus === 'acquiring' ? 'bg-amber-100 text-amber-700' :
                  gpsStatus === 'ok' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  <Compass className="w-3 h-3" />
                  {gpsStatus === 'acquiring' ? 'Obteniendo GPS...' :
                   gpsStatus === 'ok' ? 'GPS ✓' : 'GPS sin señal'}
                </span>
              )}
            </div>

            {/* Notification alert */}
            {punchSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-start gap-3 animate-fade-in shadow-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <h4 className="font-bold">Fichaje Exitoso</h4>
                  <p className="text-xs text-emerald-700 mt-0.5">{punchSuccess}</p>
                  <p className="text-[10px] text-emerald-600/80 mt-1 uppercase font-bold tracking-wider">Cerrando sesión en 2 segundos...</p>
                </div>
              </div>
            )}

            {punchError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-bold">Error en Fichaje</h4>
                  <p className="text-xs text-red-600 mt-0.5">{punchError}</p>
                </div>
              </div>
            )}

            {/* Camera Preview modal overlay inside container */}
            {punchStep === 'camera_preview' && (
              <div className="bg-black border border-brand-border rounded-2xl overflow-hidden p-4 flex flex-col items-center justify-center space-y-4 shadow-xl">
                <div className="flex items-center justify-between w-full text-white px-2 border-b border-white/10 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-brand-maroon">
                    <Camera className="w-4 h-4" />
                    CONFIRMAR FICHAJE
                  </span>
                  <button onClick={handleCancelPunch} className="p-1 hover:bg-white/10 rounded-full">
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>

                {/* Confirm employee name block */}
                <div className="text-center text-white bg-white/5 py-2.5 px-4 rounded-xl border border-white/10 w-full max-w-xs">
                  <p className="text-[10px] font-black uppercase text-brand-cream/60 tracking-wider">Empleado Identificado</p>
                  <h3 className="text-base font-extrabold text-brand-cream mt-0.5">{employee.full_name}</h3>
                </div>

                <div className="relative aspect-video max-w-md w-full bg-zinc-950 rounded-xl overflow-hidden flex items-center justify-center border border-white/10">
                  <video id="punch-video" className="w-full h-full object-cover scale-x-[-1]"></video>
                  <div className="absolute inset-0 border border-dashed border-white/20 rounded-xl pointer-events-none flex items-center justify-center">
                    <div className="w-40 h-40 border border-brand-maroon/40 rounded-full"></div>
                  </div>
                </div>

                <div className="flex gap-3 w-full max-w-xs">
                  <button
                    onClick={handleCancelPunch}
                    className="flex-1 py-2.5 rounded-lg border border-white/30 text-white font-bold text-xs hover:bg-white/10 active:scale-95 transition-all uppercase"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={captureAndRegister}
                    className="flex-1 py-2.5 rounded-lg bg-brand-maroon text-white font-bold text-xs hover:bg-brand-maroon/90 active:scale-95 transition-all uppercase shadow-md"
                  >
                    Fichar Ahora
                  </button>
                </div>
              </div>
            )}

            {/* Manual Incident Report Section */}
            {punchStep === 'idle' && (
              <div className="bg-brand-cream/30 p-4 rounded-2xl border border-brand-border/60 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-extrabold text-brand-text">
                  <input
                    type="checkbox"
                    checked={reportIncident}
                    onChange={(e) => {
                      setReportIncident(e.target.checked);
                      if (!e.target.checked) setIncidentComment('');
                    }}
                    className="rounded text-brand-maroon focus:ring-brand-maroon"
                  />
                  ⚠️ Reportar Incidencia o Comentario en este fichaje
                </label>

                {reportIncident && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="block text-[9px] font-black uppercase tracking-wider text-brand-subtext">Motivo / Descripción de la Incidencia</label>
                    <textarea
                      value={incidentComment}
                      onChange={(e) => setIncidentComment(e.target.value)}
                      placeholder="Ej. Retraso por tráfico, corte de suministro, problema con dispositivo, etc."
                      rows={2}
                      className="w-full p-2.5 rounded-xl border border-brand-border text-xs focus:outline-none focus:ring-1 focus:ring-brand-maroon bg-white font-sans font-medium"
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {/* Button Layout Grid */}
            {punchStep === 'idle' && (
              <div className="grid grid-cols-2 gap-4">
                {(['entry', 'break_start', 'break_end', 'exit'] as EntryType[]).map(type => {
                  const state = getButtonState(type);
                  const labels = {
                    entry: 'Entrada',
                    break_start: 'Inicio Descanso',
                    break_end: 'Vuelta Descanso',
                    exit: 'Salida'
                  };
                  const colors = {
                    entry: 'bg-emerald-600 hover:bg-emerald-700 text-white',
                    break_start: 'bg-amber-500 hover:bg-amber-600 text-white',
                    break_end: 'bg-blue-500 hover:bg-blue-600 text-white',
                    exit: 'bg-rose-600 hover:bg-rose-700 text-white'
                  };

                  return (
                    <div key={type} className="flex flex-col h-full">
                      <button
                        onClick={() => startPunchFlow(type)}
                        disabled={state.disabled}
                        className={`w-full py-6 rounded-2xl font-bold text-lg active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1.5 shadow-sm focus:outline-none disabled:bg-gray-200 disabled:text-gray-400 disabled:pointer-events-none ${colors[type]}`}
                      >
                        {labels[type]}
                      </button>
                      {state.disabled && state.reason && (
                        <span className="text-[10px] text-brand-subtext font-semibold text-center mt-1 bg-white border border-brand-border/40 py-1 px-2 rounded-lg">
                          ⚠️ {state.reason}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. HISTORY VIEW */}
        {activeSubTab === 'history' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-brand-card p-4 rounded-xl border border-brand-border flex flex-wrap items-center gap-4 justify-between shadow-sm">
              <span className="text-xs font-bold uppercase text-brand-subtext">Rango de fechas:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={historyStart}
                  onChange={(e) => setHistoryStart(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-brand-border text-xs focus:outline-none focus:ring-1 focus:ring-brand-maroon"
                />
                <span className="text-xs text-brand-subtext font-bold">a</span>
                <input
                  type="date"
                  value={historyEnd}
                  onChange={(e) => setHistoryEnd(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-brand-border text-xs focus:outline-none focus:ring-1 focus:ring-brand-maroon"
                />
              </div>
            </div>

            {/* Punches table */}
            <div className="bg-brand-card rounded-xl border border-brand-border shadow-sm overflow-hidden">
              {filteredEntries.length === 0 ? (
                <div className="p-8 text-center text-brand-subtext text-sm">
                  No hay registros de fichajes en el rango seleccionado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-brand-cream/50 text-[10px] uppercase font-bold tracking-wider text-brand-subtext border-b border-brand-border">
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Hora</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Centro</th>
                        <th className="px-4 py-3">Cámara / GPS</th>
                        <th className="px-4 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border text-xs font-semibold text-brand-text">
                      {filteredEntries.map(entry => (
                        <tr key={entry.id} className="hover:bg-brand-cream/10">
                          <td className="px-4 py-3.5">
                            {new Date(entry.registered_at).toLocaleDateString('es-ES')}
                          </td>
                          <td className="px-4 py-3.5">
                            {new Date(entry.registered_at).toLocaleTimeString('es-ES')}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${getEntryTypeBadge(entry.entry_type).bg}`}>
                              {getEntryTypeBadge(entry.entry_type).text}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 max-w-[120px] truncate">
                            {workCenters.find(w => w.id === entry.work_center_id)?.name || 'Desconocido'}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                entry.photo_status === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                              }`}>
                                FOTO: {entry.photo_status === 'success' ? '✓' : '✗'}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                entry.gps_status === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
                              }`}>
                                GPS: {entry.gps_status === 'success' ? '✓' : '✗'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => {
                                setReqType('modify_existing');
                                setReqTargetEntryId(entry.id);
                                setReqEntryType(entry.entry_type);
                                const dateStr = entry.registered_at.split('T')[0];
                                const timeStr = entry.registered_at.split('T')[1].slice(0, 5);
                                setReqDate(dateStr);
                                setReqTime(timeStr);
                                setShowRequestModal(true);
                              }}
                              className="text-brand-maroon hover:text-brand-maroon/80 font-bold hover:underline"
                            >
                              Corregir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setReqType('create_missing');
                setReqTargetEntryId('');
                setReqEntryType('entry');
                setReqDate(new Date().toISOString().split('T')[0]);
                setReqTime('09:00');
                setShowRequestModal(true);
              }}
              className="w-full flex items-center justify-center gap-2 bg-brand-maroon text-white font-bold py-3 rounded-xl hover:bg-brand-maroon/90 active:scale-95 transition-all text-xs uppercase tracking-wider"
            >
              <PlusCircle className="w-4 h-4" />
              Solicitar Fichaje Olvidado
            </button>
          </div>
        )}

        {/* 3. REQUESTS VIEW */}
        {activeSubTab === 'requests' && (
          <div className="space-y-4">
            <div className="bg-brand-card rounded-xl border border-brand-border shadow-sm overflow-hidden">
              {filteredRequests.length === 0 ? (
                <div className="p-8 text-center text-brand-subtext text-sm">
                  No has enviado ninguna solicitud de corrección.
                </div>
              ) : (
                <div className="divide-y divide-brand-border">
                  {filteredRequests.map(req => (
                    <div key={req.id} className="p-4 hover:bg-brand-cream/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-brand-text flex items-center gap-1.5">
                          {req.request_type === 'create_missing' ? 'Fichaje Olvidado' : 'Modificación de Fichaje'}
                          <span className={`px-1.5 py-0.5 rounded border text-[8px] font-bold ${getEntryTypeBadge(req.requested_entry_type).bg}`}>
                            {getEntryTypeBadge(req.requested_entry_type).text}
                          </span>
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                          req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          req.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800 animate-pulse'
                        }`}>
                          {req.status === 'approved' && 'APROBADO'}
                          {req.status === 'rejected' && 'RECHAZADO'}
                          {req.status === 'pending' && 'PENDIENTE'}
                        </span>
                      </div>
                      
                      <div className="text-xs text-brand-subtext grid grid-cols-2 gap-y-1">
                        <div><span className="font-bold">Fecha Solicitada:</span> {new Date(req.requested_date).toLocaleDateString('es-ES')}</div>
                        <div><span className="font-bold">Hora Solicitada:</span> {req.requested_time.slice(0, 5)}</div>
                      </div>

                      <div className="bg-brand-cream/20 p-2.5 rounded-lg border border-brand-border/40 text-xs">
                        <span className="font-bold text-[10px] text-brand-subtext uppercase tracking-wider block mb-1">Mi motivo:</span>
                        {req.employee_reason}
                      </div>

                      {req.admin_response && (
                        <div className="bg-brand-maroon/5 p-2.5 rounded-lg border border-brand-maroon/20 text-xs">
                          <span className="font-bold text-[10px] text-brand-maroon uppercase tracking-wider block mb-1">Respuesta del Administrador:</span>
                          {req.admin_response}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* REQUEST MODAL OVERLAY */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-brand-border shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="bg-brand-maroon text-white p-4 flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider">
                {reqType === 'create_missing' ? 'Solicitar Fichaje Olvidado' : 'Solicitar Corrección'}
              </h3>
              <button onClick={() => setShowRequestModal(false)} className="p-1 hover:bg-white/10 rounded-full">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleRequestSubmit} className="p-5 space-y-4">
              {reqSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-xs font-semibold">
                  {reqSuccess}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Fecha</label>
                  <input
                    type="date"
                    value={reqDate}
                    onChange={(e) => setReqDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs focus:ring-1 focus:ring-brand-maroon"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Hora</label>
                  <input
                    type="time"
                    value={reqTime}
                    onChange={(e) => setReqTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs focus:ring-1 focus:ring-brand-maroon"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Tipo de Fichaje</label>
                <select
                  value={reqEntryType}
                  onChange={(e) => setReqEntryType(e.target.value as EntryType)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border bg-white text-xs"
                >
                  <option value="entry">Entrada</option>
                  <option value="break_start">Inicio Descanso</option>
                  <option value="break_end">Vuelta Descanso</option>
                  <option value="exit">Salida</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-subtext mb-1">Motivo Justificativo</label>
                <textarea
                  placeholder="Explique detalladamente el motivo de la corrección..."
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-brand-border text-xs focus:ring-1 focus:ring-brand-maroon h-24 resize-none"
                  required
                ></textarea>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 text-xs font-bold text-brand-subtext border border-brand-border rounded-lg hover:bg-brand-cream/30 active:scale-95 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-brand-maroon text-white rounded-lg hover:bg-brand-maroon/90 active:scale-95 transition-all shadow-md"
                >
                  Enviar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
