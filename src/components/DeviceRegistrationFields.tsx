import type { DeviceRegistrationOptions } from '../features/devices/domain/registrationOptions.js';

interface Props {
  options: DeviceRegistrationOptions;
  companyId: string;
  centerId: string;
  loading: boolean;
  onCompanyChange: (id: string) => void;
  onCenterChange: (id: string) => void;
}

export function DeviceRegistrationFields({ options, companyId, centerId, loading, onCompanyChange, onCenterChange }: Props) {
  const centers = options.workCenters.filter(center => center.company_id === companyId);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor="registration-company" className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-1.5">Empresa</label>
        <select id="registration-company" value={companyId} onChange={event => onCompanyChange(event.target.value)} disabled={loading}
          className="w-full px-3 py-3 rounded-xl border border-brand-border bg-white focus:outline-none focus:ring-2 focus:ring-brand-maroon text-sm">
          <option value="">{loading ? 'Cargando...' : 'Seleccione...'}</option>
          {options.companies.map(company => <option key={company.id} value={company.id}>{company.commercial_name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="registration-center" className="block text-xs font-bold uppercase tracking-wider text-brand-subtext mb-1.5">Centro de Trabajo</label>
        <select id="registration-center" value={centerId} onChange={event => onCenterChange(event.target.value)} disabled={loading || !companyId}
          className="w-full px-3 py-3 rounded-xl border border-brand-border bg-white focus:outline-none focus:ring-2 focus:ring-brand-maroon text-sm">
          <option value="">Seleccione...</option>
          {centers.map(center => <option key={center.id} value={center.id}>{center.name}</option>)}
        </select>
      </div>
    </div>
  );
}
