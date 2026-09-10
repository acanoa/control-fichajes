import assert from 'node:assert/strict';
import test from 'node:test';
import { companyPayload, centerPayload, employeePayload, toCompanyRecord, toCenterRecord, toEmployeeRecord } from '../src/features/admin/domain/adminRecords.js';

test('empresas usa nombres y estados reales de Supabase', () => {
  const record = toCompanyRecord({ id: 'company', legal_name: 'Legal', commercial_name: 'Comercial', company_code: 'ABC', tax_id: 'NIF',
    status: 'blocked', session_timeout_minutes: 5, created_at: '', updated_at: '' });
  const payload = companyPayload({ ...record, active: true });
  assert.equal(record.active, false);
  assert.equal(payload.commercial_name, 'Comercial');
  assert.equal(payload.legal_name, 'Legal');
  assert.equal(payload.status, 'active');
  assert.equal('active' in payload, false);
  assert.equal('name' in payload, false);
  assert.throws(() => companyPayload({ ...record, tax_id: '' }), /obligatorios/);
});

test('centros conserva coordenadas cero y traduce municipio y estado', () => {
  const record = toCenterRecord({ id: 'center', company_id: 'company', name: 'Centro', municipality: 'Madrid', latitude: 0, longitude: 0,
    country: 'España', country_code: 'ES', status: 'inactive', created_at: '', updated_at: '' });
  const payload = centerPayload({ name: record.name, address: record.address, city: record.city, latitude: '0', longitude: '0', active: record.active });
  assert.equal(payload.latitude, 0);
  assert.equal(payload.longitude, 0);
  assert.equal(payload.municipality, 'Madrid');
  assert.equal(payload.status, 'inactive');
  assert.equal('city' in payload, false);
  assert.equal('radius_meters' in payload, false);
});

test('centros rechaza coordenadas incompletas, no numéricas o fuera de rango', () => {
  const form = { name: 'Centro', address: '', city: '', latitude: '40', longitude: '-3', active: true };
  for (const patch of [{ latitude: '' }, { latitude: '91' }, { longitude: '181' }, { latitude: 'abc' }]) {
    assert.throws(() => centerPayload({ ...form, ...patch }), /válidas/);
  }
});

test('empleados conserva identificación y puesto sin exponer PIN ni inventar roles', () => {
  const record = toEmployeeRecord({ id: 'employee', company_id: 'company', full_name: 'Empleado', dni: 'TEST', hire_date: '2026-09-10',
    employee_counter: 1, employee_code: 'ABC-0001', job_title: 'Técnico', status: 'active', created_at: '', updated_at: '', pin_hash: 'test-only' });
  const payload = employeePayload(record);
  assert.equal(payload.job_title, 'Técnico');
  assert.equal(payload.dni, 'TEST');
  assert.equal('pin_hash' in record, false);
  assert.equal('role' in payload, false);
  assert.equal('position' in payload, false);
  assert.throws(() => employeePayload({ ...record, dni: '' }), /obligatorios/);
});
