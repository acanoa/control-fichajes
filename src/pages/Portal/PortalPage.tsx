import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Key, Shield, Building, User, Video, AlertTriangle } from 'lucide-react';

export const PortalPage: React.FC = () => {
  const { 
    currentDevice, isDeviceAuthorized, authorizeDevice, 
    loginEmployee, loginAdmin, companies, workCenters 
  } = useApp();

  const [activeTab, setActiveTab] = useState<'employee' | 'admin' | 'register'>('employee');
  
  // Employee Login form state
  const [empCode, setEmpCode] = useState('');
  const [pin, setPin] = useState('');
  const [empError, setEmpError] = useState('');
  const [empLoading, setEmpLoading] = useState(false);

  // Admin Login form state
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // Device registration state
  const [deviceName, setDeviceName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regCenter, setRegCenter] = useState('');
  const [cameraTestStatus, setCameraTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraImg, setCameraImg] = useState<string | null>(null);
  const [regError, setRegError] = useState('');

  // Handle PIN keypad input
  const handleKeypadPress = (val: string) => {
    setEmpError('');
    if (val === 'clear') {
      setPin('');
    } else if (val === 'back') {
      setPin(prev => prev.slice(0, -1));
    } else {
      if (pin.length < 5) {
        setPin(prev => prev + val);
      }
    }
  };

  const handleEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empCode) {
      setEmpError('Por favor introduzca su código de empleado.');
      return;
    }
    if (pin.length < 5) {
      setEmpError('El PIN debe tener 5 dígitos.');
      return;
    }

    setEmpLoading(true);
    setEmpError('');
    try {
      await loginEmployee(empCode, pin);
    } catch (err: any) {
      setEmpError(err.message || 'Error de autenticación.');
      setPin(''); // Reset PIN on error
    } finally {
      setEmpLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail || !adminPass) {
      setAdminError('Complete todos los campos.');
      return;
    }

    setAdminLoading(true);
    setAdminError('');
    try {
      await loginAdmin(adminEmail, adminPass);
    } catch (err: any) {
      setAdminError(err.message || 'Credenciales incorrectas.');
    } finally {
      setAdminLoading(false);
    }
  };

  const startCameraTest = async () => {
    setRegError('');
    setCameraTestStatus('testing');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraTestStatus('failed');
      setRegError(
        'El navegador bloquea el acceso a la cámara porque la conexión no es segura (HTTP en lugar de HTTPS). ' +
        'Para solucionarlo en pruebas locales de red, abre "chrome://flags/#unsafely-treat-insecure-origin-as-secure" ' +
        'en el navegador del otro PC, activa la opción y añade la dirección "http://192.168.2.158:5173" a la lista blanca.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      setCameraStream(stream);

      // Create video preview
      setTimeout(() => {
        const video = document.getElementById('camera-preview') as HTMLVideoElement;
        if (video) {
          video.srcObject = stream;
          video.play();
        }
      }, 500);
    } catch (err: any) {
      setCameraTestStatus('failed');
      setRegError('No se pudo acceder a la cámara. Asegúrese de otorgar permisos de cámara en el navegador.');
    }
  };

  const captureCameraTest = () => {
    if (!cameraStream) return;
    const video = document.getElementById('camera-preview') as HTMLVideoElement;
    const canvas = document.createElement('canvas');
    if (video && canvas) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCameraImg(dataUrl);

        // Stop stream
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);

        // Validate image upload test (mocked success after 1.5s)
        setTimeout(() => {
          setCameraTestStatus('success');
          // In production, the test photo is uploaded and then deleted immediately
          setCameraImg(null); // delete test photo immediately
        }, 1500);
      }
    }
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName || !regCompany || !regCenter) {
      setRegError('Complete todos los campos.');
      return;
    }
    if (cameraTestStatus !== 'success') {
      setRegError('Es obligatorio superar la validación de cámara.');
      return;
    }

    try {
      await authorizeDevice(deviceName, regCompany, regCenter, true);
      setActiveTab('employee');
      // Reset form
      setDeviceName('');
      setRegCompany('');
      setRegCenter('');
      setCameraTestStatus('idle');
    } catch (err: any) {
      setRegError(err.message || 'Error registrando el dispositivo.');
    }
  };

  const filteredCenters = workCenters.filter(c => c.company_id === regCompany && c.status === 'active');

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-brand-card rounded-2xl shadow-xl border border-brand-border overflow-hidden">
        {/* Maroon Header */}
        <div className="bg-brand-maroon p-6 text-white text-center">
          <h1 className="text-2xl font-bold tracking-wide">CONTROL FICHAJES</h1>
          <p className="text-white/80 text-xs mt-1 uppercase tracking-widest font-semibold">Terminal de Acceso</p>
        </div>

        {/* Device Status Bar */}
        <div className="bg-brand-cream/50 px-4 py-2 border-b border-brand-border flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-1.5 text-brand-subtext">
            <Building className="w-3.5 h-3.5" />
            <span>Dispositivo: {currentDevice ? currentDevice.name : 'No Autorizado'}</span>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            isDeviceAuthorized 
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
              : 'bg-amber-100 text-amber-800 border border-amber-200'
          }`}>
            {isDeviceAuthorized ? 'VALIDADO' : 'PENDIENTE CÁMARA'}
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-brand-border">
          <button
            onClick={() => setActiveTab('employee')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'employee' 
                ? 'text-brand-maroon border-b-2 border-brand-maroon bg-brand-cream/20' 
                : 'text-brand-subtext hover:text-brand-text hover:bg-brand-cream/10'
            }`}
          >
            <User className="w-4 h-4" />
            Empleado
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'admin' 
                ? 'text-brand-maroon border-b-2 border-brand-maroon bg-brand-cream/20' 
                : 'text-brand-subtext hover:text-brand-text hover:bg-brand-cream/10'
            }`}
          >
            <Shield className="w-4 h-4" />
            Administrador
          </button>
          {!isDeviceAuthorized && (
            <button
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'register' 
                  ? 'text-brand-maroon border-b-2 border-brand-maroon bg-brand-cream/20' 
                  : 'text-brand-subtext hover:text-brand-text hover:bg-brand-cream/10'
              }`}
            >
              <Video className="w-4 h-4" />
              Autorizar
            </button>
          )}
        </div>

        <div className="p-6">
          {/* 1. EMPLOYEE LOGIN */}
          {activeTab === 'employee' && (
            <div>
              {!isDeviceAuthorized ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm flex gap-3 mb-6">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
                  <div>
                    <h4 className="font-bold">Dispositivo no Autorizado</h4>
                    <p className="text-amber-800 text-xs mt-1">
                      Este terminal no tiene la cámara validada o autorizada. Un administrador debe autorizar el dispositivo antes de poder registrar fichajes.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEmployeeSubmit} className="space-y-6">
                  {empError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-semibold">
                      {empError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-2">Código Personal</label>
                    <input
                      type="text"
                      placeholder="Ej. ACM-00001"
                      value={empCode}
                      onChange={(e) => {
                        setEmpError('');
                        setEmpCode(e.target.value);
                      }}
                      className="w-full text-center tracking-wider text-lg font-mono px-4 py-3 rounded-xl border border-brand-border bg-brand-cream/20 focus:outline-none focus:ring-2 focus:ring-brand-maroon focus:border-transparent transition-all uppercase"
                      disabled={empLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-2">PIN de 5 Dígitos</label>
                    <div className="flex justify-center gap-2 mb-4">
                      {[0, 1, 2, 3, 4].map((idx) => (
                        <div
                          key={idx}
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-lg font-extrabold transition-all ${
                            pin.length > idx 
                              ? 'border-brand-maroon bg-brand-maroon text-white scale-110 shadow-sm' 
                              : 'border-brand-border bg-white text-transparent'
                          }`}
                        >
                          *
                        </div>
                      ))}
                    </div>

                    {/* Numeric Keypad */}
                    <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleKeypadPress(val)}
                          className="py-3 rounded-xl bg-brand-cream/30 border border-brand-border text-brand-text font-bold text-lg hover:bg-brand-maroon hover:text-white active:scale-95 transition-all focus:outline-none shadow-sm"
                          disabled={empLoading}
                        >
                          {val}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('clear')}
                        className="py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold hover:bg-red-100 hover:text-red-800 active:scale-95 transition-all text-xs focus:outline-none uppercase shadow-sm"
                        disabled={empLoading}
                      >
                        Limpiar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('0')}
                        className="py-3 rounded-xl bg-brand-cream/30 border border-brand-border text-brand-text font-bold text-lg hover:bg-brand-maroon hover:text-white active:scale-95 transition-all focus:outline-none shadow-sm"
                        disabled={empLoading}
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKeypadPress('back')}
                        className="py-3 rounded-xl bg-brand-cream/50 border border-brand-border text-brand-subtext font-bold hover:bg-brand-maroon hover:text-white active:scale-95 transition-all text-xs focus:outline-none uppercase shadow-sm"
                        disabled={empLoading}
                      >
                        Borrar
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={empLoading || pin.length < 5 || !empCode}
                    className="w-full bg-brand-maroon text-white font-bold py-3.5 rounded-xl hover:bg-brand-maroon/90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md text-sm uppercase tracking-wider"
                  >
                    {empLoading ? 'Accediendo...' : 'Iniciar Sesión Empleado'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 2. ADMIN LOGIN */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-5">
              {adminError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-semibold">
                  {adminError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-1.5">Correo Electrónico</label>
                <input
                  type="email"
                  placeholder="ejemplo@empresa.com"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminError('');
                    setAdminEmail(e.target.value);
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-maroon focus:border-transparent transition-all text-sm"
                  disabled={adminLoading}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-1.5">Contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={adminPass}
                  onChange={(e) => {
                    setAdminError('');
                    setAdminPass(e.target.value);
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-maroon focus:border-transparent transition-all text-sm"
                  disabled={adminLoading}
                />
              </div>

              <button
                type="submit"
                disabled={adminLoading || !adminEmail || !adminPass}
                className="w-full bg-brand-maroon text-white font-bold py-3.5 rounded-xl hover:bg-brand-maroon/90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md text-sm uppercase tracking-wider"
              >
                {adminLoading ? 'Accediendo...' : 'Iniciar Sesión Administrador'}
              </button>
            </form>
          )}

          {/* 3. DEVICE AUTHORIZATION & CAMERA TEST */}
          {activeTab === 'register' && !isDeviceAuthorized && (
            <form onSubmit={handleRegisterDevice} className="space-y-4">
              {regError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm font-semibold">
                  {regError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-1.5">Nombre del Terminal</label>
                <input
                  type="text"
                  placeholder="Ej. Tablet Recepción Principal"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-maroon focus:border-transparent transition-all text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-1.5">Empresa</label>
                  <select
                    value={regCompany}
                    onChange={(e) => {
                      setRegCompany(e.target.value);
                      setRegCenter('');
                    }}
                    className="w-full px-3 py-3 rounded-xl border border-brand-border bg-white focus:outline-none focus:ring-2 focus:ring-brand-maroon text-sm"
                  >
                    <option value="">Seleccione...</option>
                    {companies.filter(c => c.status === 'active').map(c => (
                      <option key={c.id} value={c.id}>{c.commercial_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-1.5">Centro de Trabajo</label>
                  <select
                    value={regCenter}
                    onChange={(e) => setRegCenter(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl border border-brand-border bg-white focus:outline-none focus:ring-2 focus:ring-brand-maroon text-sm"
                    disabled={!regCompany}
                  >
                    <option value="">Seleccione...</option>
                    {filteredCenters.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Camera Verification Box */}
              <div className="border border-brand-border rounded-xl p-4 bg-brand-cream/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-brand-subtext">Validación de Cámara</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    cameraTestStatus === 'success' ? 'bg-emerald-100 text-emerald-800' :
                    cameraTestStatus === 'failed' ? 'bg-red-100 text-red-800' :
                    cameraTestStatus === 'testing' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {cameraTestStatus === 'success' && 'VALIDACIÓN CORRECTA'}
                    {cameraTestStatus === 'failed' && 'VALIDACIÓN FALLIDA'}
                    {cameraTestStatus === 'testing' && 'PROBANDO CÁMARA...'}
                    {cameraTestStatus === 'idle' && 'PENDIENTE'}
                  </span>
                </div>

                {cameraTestStatus === 'testing' && (
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-brand-border bg-black flex items-center justify-center">
                    <video id="camera-preview" className="w-full h-full object-cover scale-x-[-1]"></video>
                    <button
                      type="button"
                      onClick={captureCameraTest}
                      className="absolute bottom-3 px-4 py-2 bg-brand-maroon text-white font-bold text-xs rounded-lg hover:bg-brand-maroon/90 active:scale-95 transition-all shadow-md"
                    >
                      Capturar Foto de Prueba
                    </button>
                  </div>
                )}

                {cameraTestStatus === 'success' && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-lg flex items-center gap-2">
                    <span className="font-semibold">✓ Prueba de cámara y subida temporal completada correctamente. La foto de prueba ha sido eliminada inmediatamente.</span>
                  </div>
                )}

                {(cameraTestStatus === 'idle' || cameraTestStatus === 'failed') && (
                  <button
                    type="button"
                    onClick={startCameraTest}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-brand-border text-brand-text font-bold py-2.5 rounded-lg hover:bg-brand-cream/30 active:scale-[0.98] transition-all text-xs"
                  >
                    <Video className="w-4 h-4 text-brand-maroon" />
                    Iniciar Prueba de Cámara Obligatoria
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!deviceName || !regCompany || !regCenter || cameraTestStatus !== 'success'}
                className="w-full bg-brand-maroon text-white font-bold py-3.5 rounded-xl hover:bg-brand-maroon/90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-md text-sm uppercase tracking-wider"
              >
                Autorizar Terminal
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
