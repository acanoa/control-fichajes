import { supabase } from '../integrations/supabase/client';
import { companyPayload, centerPayload, employeePayload } from '../features/admin/domain/adminRecords';
import type { CompanyFormState, CenterFormState, EmployeeFormState } from '../features/admin/domain/adminRecords';

function requireRow(result: { data: unknown; error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error('No se pudo guardar el cambio. Comprueba tus permisos y actualiza los datos.');
}

export async function saveCompanyRecord(id: string | null, form: CompanyFormState) {
  const payload = companyPayload(form);
  if (id) {
    const existing = await supabase.from('companies').select('company_code').eq('id', id).single();
    requireRow(existing);
    if (existing.data!.company_code !== payload.company_code) throw new Error('El código de una empresa existente no se puede cambiar en este formulario.');
  }
  requireRow(id
    ? await supabase.from('companies').update(payload).eq('id', id).select('id').single()
    : await supabase.from('companies').insert({ ...payload, id: crypto.randomUUID(), session_timeout_minutes: 5 }).select('id').single());
}
export async function saveCenterRecord(id: string | null, companyId: string, form: CenterFormState) {
  const payload = centerPayload(form);
  requireRow(id
    ? await supabase.from('work_centers').update(payload).eq('id', id).eq('company_id', companyId).select('id').single()
    : await supabase.from('work_centers').insert({ ...payload, company_id: companyId, id: crypto.randomUUID(), country: 'España', country_code: 'ES' }).select('id').single());
}
export async function saveEmployeeRecord(id: string | null, companyId: string, form: EmployeeFormState) {
  const payload = employeePayload(form);
  if (id) {
    requireRow(await supabase.from('employees').update(payload).eq('id', id).eq('company_id', companyId).select('id').single());
    return;
  }
  const company = await supabase.from('companies').select('company_code').eq('id', companyId).single();
  requireRow(company);
  const last = await supabase.from('employees').select('employee_counter').eq('company_id', companyId).order('employee_counter', { ascending: false }).limit(1);
  if (last.error) throw new Error(last.error.message);
  const counter = (last.data?.[0]?.employee_counter ?? 0) + 1;
  requireRow(await supabase.from('employees').insert({ ...payload, company_id: companyId, id: crypto.randomUUID(),
    employee_counter: counter, employee_code: `${company.data!.company_code}-${String(counter).padStart(4, '0')}` }).select('id').single());
}
export async function deleteCompanyRecord(id: string) {
  requireRow(await supabase.from('companies').delete().eq('id', id).select('id').single());
}
export async function deleteCenterRecord(id: string, companyId: string) {
  requireRow(await supabase.from('work_centers').delete().eq('id', id).eq('company_id', companyId).select('id').single());
}
export async function deleteEmployeeRecord(id: string, companyId: string) {
  requireRow(await supabase.from('employees').delete().eq('id', id).eq('company_id', companyId).select('id').single());
}
