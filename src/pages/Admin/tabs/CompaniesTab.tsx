// Companies tab: list, search, create/edit modal, delete.

import React from 'react';
import { Modal, Badge, Button } from '../../../components/ui';
import {
  useCompanies,
  type CompanyFormState,
  type CompanyRecord
} from '../hooks/useCompanies';

interface CompaniesTabProps {
  canManage: boolean;
}

const CompanyFormFields: React.FC<{
  form: CompanyFormState;
  onChange: (field: keyof CompanyFormState, value: string | boolean) => void;
}> = ({ form, onChange }) => (
  <div className="row g-3">
    <div className="col-md-6">
      <label className="form-label">Razón social *</label>
      <input className="form-control" value={form.legal_name} onChange={e => onChange('legal_name', e.target.value)} />
    </div>
    <div className="col-md-6">
      <label className="form-label">Código de empresa *</label>
      <input className="form-control" value={form.company_code} onChange={e => onChange('company_code', e.target.value)} />
    </div>
    <div className="col-md-6">
      <label className="form-label">Nombre *</label>
      <input className="form-control" value={form.name} onChange={e => onChange('name', e.target.value)} />
    </div>
    <div className="col-md-6">
      <label className="form-label">NIF / CIF</label>
      <input className="form-control" value={form.tax_id} onChange={e => onChange('tax_id', e.target.value)} />
    </div>
    <div className="col-12">
      <label className="form-label">Dirección</label>
      <input className="form-control" value={form.address} onChange={e => onChange('address', e.target.value)} />
    </div>
    <div className="col-md-6">
      <label className="form-label">Teléfono</label>
      <input className="form-control" value={form.phone} onChange={e => onChange('phone', e.target.value)} />
    </div>
    <div className="col-md-6">
      <label className="form-label">Email</label>
      <input type="email" className="form-control" value={form.email} onChange={e => onChange('email', e.target.value)} />
    </div>
    <div className="col-12">
      <label className="form-label">URL del logo</label>
      <input className="form-control" value={form.logo_url} onChange={e => onChange('logo_url', e.target.value)} />
    </div>
    <div className="col-12">
      <div className="form-check form-switch">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="company-active-switch"
          checked={form.active}
          onChange={e => onChange('active', e.target.checked)}
        />
        <label className="form-check-label" htmlFor="company-active-switch">Empresa activa</label>
      </div>
    </div>
  </div>
);

export const CompaniesTab: React.FC<CompaniesTabProps> = ({ canManage }) => {
  const {
    filteredCompanies,
    isLoading,
    searchText,
    setSearchText,
    companyForm,
    updateCompanyForm,
    companyModalOpen,
    editingCompanyId,
    openCreateCompany,
    openEditCompany,
    closeCompanyModal,
    isSavingCompany,
    saveCompany,
    deletingCompanyId,
    deleteCompany
  } = useCompanies();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [companyToDelete, setCompanyToDelete] = React.useState<CompanyRecord | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);
    try {
      await saveCompany();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar la empresa.');
    }
  };

  const requestDelete = (company: CompanyRecord) => {
    setDeleteError(null);
    setCompanyToDelete(company);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!companyToDelete) return;
    setDeleteError(null);
    try {
      await deleteCompany(companyToDelete.id);
      setDeleteConfirmOpen(false);
      setCompanyToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar el registro.');
    }
  };

  return (
    <div className="admin-panel">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h4 mb-0">Empresas</h2>
        {canManage && (
          <Button variant="primary" onClick={openCreateCompany}>+ Nueva empresa</Button>
        )}
      </div>

      <input
        type="search"
        className="form-control mb-3"
        placeholder="Buscar por nombre, NIF o email…"
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
      />

      {isLoading ? (
        <p>Cargando empresas…</p>
      ) : filteredCompanies.length === 0 ? (
        <p className="text-muted">No hay empresas que coincidan con la búsqueda.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>NIF / CIF</th>
                <th>Email</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map(company => (
                <tr key={company.id}>
                  <td>{company.name}</td>
                  <td>{company.tax_id ?? '—'}</td>
                  <td>{company.email ?? '—'}</td>
                  <td>{company.phone ?? '—'}</td>
                  <td>
                    <Badge variant={company.active ? 'success' : 'secondary'}>
                      {company.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </td>
                  <td className="text-end">
                    {canManage && (
                      <>
                        <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => openEditCompany(company)}>
                          Editar
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          disabled={deletingCompanyId === company.id}
                          onClick={() => requestDelete(company)}
                        >
                          {deletingCompanyId === company.id ? '…' : 'Eliminar'}
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={companyModalOpen}
        onClose={closeCompanyModal}
        title={editingCompanyId ? 'Editar empresa' : 'Nueva empresa'}
        footer={
          <>
            <Button variant="secondary" onClick={closeCompanyModal}>Cancelar</Button>
            <Button variant="primary" disabled={isSavingCompany} onClick={handleSave}>
              {isSavingCompany ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        {formError && <div className="alert alert-danger">{formError}</div>}
        <CompanyFormFields form={companyForm} onChange={updateCompanyForm} />
      </Modal>

      <Modal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirmar eliminación"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={confirmDelete}>Eliminar</Button>
          </>
        }
      >
        {deleteError && <p role="alert" className="alert alert-danger">{deleteError}</p>}
        <p>
          ¿Seguro que quieres eliminar la empresa <strong>{companyToDelete?.name}</strong>? Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  );
};
