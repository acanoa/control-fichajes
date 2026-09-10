import type { Company, Employee, WorkCenter } from '../../../types.js';

export interface CompanyFormState {
  name: string; legal_name: string; company_code: string; tax_id: string;
  address: string; phone: string; email: string; logo_url: string; active: boolean;
}
export interface CompanyRecord extends CompanyFormState { id: string }
export interface CenterFormState {
  name: string; address: string; city: string; latitude: string; longitude: string; active: boolean;
}
export interface CenterRecord {
  id: string; company_id: string; name: string; address: string; city: string;
  latitude?: number; longitude?: number; active: boolean;
}
export interface EmployeeFormState {
  full_name: string; dni: string; hire_date: string; email: string; phone: string;
  position: string; department: string; active: boolean;
}
export interface EmployeeRecord extends EmployeeFormState { id: string; company_id: string }

export const toCompanyRecord = (row: Company): CompanyRecord => ({
  id: row.id, name: row.commercial_name, legal_name: row.legal_name,
  company_code: row.company_code, tax_id: row.tax_id, address: row.address ?? '',
  phone: row.phone ?? '', email: row.email ?? '', logo_url: row.logo_path ?? '', active: row.status === 'active',
});
export const toCenterRecord = (row: WorkCenter): CenterRecord => ({
  id: row.id, company_id: row.company_id, name: row.name, address: row.address ?? '',
  city: row.municipality ?? '', latitude: row.latitude ?? undefined, longitude: row.longitude ?? undefined, active: row.status === 'active',
});
export const toEmployeeRecord = (row: Employee): EmployeeRecord => ({
  id: row.id, company_id: row.company_id, full_name: row.full_name, dni: row.dni,
  hire_date: row.hire_date, email: row.email ?? '', phone: row.phone ?? '',
  position: row.job_title ?? '', department: row.department ?? '', active: row.status === 'active',
});

export function companyPayload(form: CompanyFormState) {
  if (![form.name, form.legal_name, form.company_code, form.tax_id].every(value => value.trim())) {
    throw new Error('Nombre comercial, razón social, código y NIF son obligatorios.');
  }
  return {
    commercial_name: form.name.trim(), legal_name: form.legal_name.trim(), company_code: form.company_code.trim().toUpperCase(),
    tax_id: form.tax_id.trim(), address: form.address.trim(), phone: form.phone.trim(), email: form.email.trim(),
    logo_path: form.logo_url.trim(), status: form.active ? 'active' as const : 'blocked' as const,
  };
}
export function centerPayload(form: CenterFormState) {
  if (!form.name.trim()) throw new Error('El nombre del centro es obligatorio.');
  const latitude = form.latitude.trim() ? Number(form.latitude) : undefined;
  const longitude = form.longitude.trim() ? Number(form.longitude) : undefined;
  if ((latitude === undefined) !== (longitude === undefined) ||
      (latitude !== undefined && (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) ||
      (longitude !== undefined && (!Number.isFinite(longitude) || Math.abs(longitude) > 180))) {
    throw new Error('Indica una latitud y longitud válidas.');
  }
  return { name: form.name.trim(), address: form.address.trim(), municipality: form.city.trim(), latitude, longitude,
    status: form.active ? 'active' as const : 'inactive' as const };
}
export function employeePayload(form: EmployeeFormState) {
  if (!form.full_name.trim() || !form.dni.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(form.hire_date)) {
    throw new Error('Nombre, DNI y fecha de alta son obligatorios.');
  }
  return { full_name: form.full_name.trim(), dni: form.dni.trim(), hire_date: form.hire_date,
    email: form.email.trim(), phone: form.phone.trim(), job_title: form.position.trim(),
    department: form.department.trim(), status: form.active ? 'active' as const : 'inactive' as const };
}
