import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DeviceRegistrationFields } from '../src/components/DeviceRegistrationFields.js';

const options = {
  companies: [{ id: 'a', commercial_name: 'Empresa A' }, { id: 'b', commercial_name: 'Empresa B' }],
  workCenters: [{ id: 'ca', company_id: 'a', name: 'Centro A' }, { id: 'cb', company_id: 'b', name: 'Centro B' }],
};
const render = (companyId: string, loading = false) => renderToStaticMarkup(createElement(DeviceRegistrationFields, {
  options, companyId, centerId: '', loading, onCompanyChange: () => {}, onCenterChange: () => {},
}));

test('muestra empresas públicas sin campo status y solo los centros de la empresa seleccionada', () => {
  const html = render('a');
  assert.match(html, />Empresa A<\/option>/);
  assert.match(html, />Empresa B<\/option>/);
  assert.match(html, />Centro A<\/option>/);
  assert.doesNotMatch(html, />Centro B<\/option>/);
  const otherCompany = render('b');
  assert.match(otherCompany, />Centro B<\/option>/);
  assert.doesNotMatch(otherCompany, />Centro A<\/option>/);
});

test('permite elegir empresa antes de habilitar el centro y bloquea ambos durante la carga', () => {
  const html = render('');
  assert.match(html, /id="registration-center"[^>]*disabled/);
  assert.doesNotMatch(html, /id="registration-company"[^>]*disabled/);
  assert.match(render('a', true), /id="registration-company"[^>]*disabled/);
  assert.match(render('a', true), /id="registration-center"[^>]*disabled/);
});
