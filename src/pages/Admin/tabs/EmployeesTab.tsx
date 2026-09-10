// Employees tab: list, search, create/edit modal, delete — scoped to selected company.

import React from 'react';
import { Modal, Badge, Button } from '../../../components/ui';
import {
  useEmployees,
  type EmployeeFormState,
  type EmployeeRecord
} from '../hooks/useEmployees';

interface EmployeesTabProps {
  companyId: string | null;
  canManage: boolean;
}

const EmployeeFormFields: React.FC<{
  form: EmployeeFormState;
  onChange: (field: keyof EmployeeFormState, value: string | boolean) => void;
}> = ({ form, onChange }) => (
  <div className="row g-3">
    <div className="col-md-6">
      <label className="form-label">DNI / NIE *</label>
      <input className="form-control" value={form.dni} onChange={e => onChange('dni', e.target.value)} />
    </div>
    <div className="col-md-6">
      <label className="form-label">Fecha de alta *</label>
      <input type="date" className="form-control" value={form.hire_date} onChange={e => onChange('hire_date', e.target.value)} />
    </div>
    <div className="col-md-6">
      <label className="form-label">Nombre completo *</label>
      <input className="form-control" value={form.full_name} onChange={e => onChange('full_name', e.target.value)} />
    </div>
    <div className="col-md-6">
      <label className="form-label">Email</label>
      <input type="email" className="form-control" value={form.email} onChange={e => onChange('email', e.target.value)} />
    </div>
    <div className="col-md-6">
      <label className="form-label">Teléfono</label>
      <input className="form-control" value={form.phone} onChange={e => onChange('phone', e.target.value)} />
    </div>
    <div className="col-md-6">
      <label className="form-label">Departamento</label>
      <input className="form-control" value={form.department} onChange={e => onChange('department', e.target.value)} />
    </div>
    <div className="col-md-6">
      <label className="form-label">Puesto</label>
      <input className="form-control" value={form.position} onChange={e => onChange('position', e.target.value)} />
    </div>
    <div className="col-12">
      <div className="form-check form-switch">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="employee-active-switch"
          checked={form.active}
          onChange={e => onChange('active', e.target.checked)}
        />
        <label className="form-check-label" htmlFor="employee-active-switch">Empleado activo</label>
      </div>
    </div>
  </div>
);

export const EmployeesTab: React.FC<EmployeesTabProps> = ({ companyId, canManage }) => {
  const {
    filteredEmployees,
    isLoading,
    searchText,
    setSearchText,
    employeeForm,
    updateEmployeeForm,
    employeeModalOpen,
    editingEmployeeId,
    openCreateEmployee,
    openEditEmployee,
    closeEmployeeModal,
    isSavingEmployee,
    saveEmployee,
    deletingEmployeeId,
    deleteEmployee
  } = useEmployees(companyId);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [employeeToDelete, setEmployeeToDelete] = React.useState<EmployeeRecord | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);
    try {
      await saveEmployee();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar el empleado.');
    }
  };

  const requestDelete = (employee: EmployeeRecord) => {
    setDeleteError(null);
    setEmployeeToDelete(employee);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    setDeleteError(null);
    try {
      await deleteEmployee(employeeToDelete.id);
      setDeleteConfirmOpen(false);
      setEmployeeToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar el registro.');
    }
  };

  if (!companyId) {
    return <p className="text-muted">Selecciona una empresa para ver sus empleados.</p>;
  }

  return (
    <div className="admin-panel">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h4 mb-0">Empleados</h2>
        {canManage && (
          <Button variant="primary" onClick={openCreateEmployee}>+ Nuevo empleado</Button>
        )}
      </div>

      <input
        type="search"
        className="form-control mb-3"
        placeholder="Buscar por nombre, email o departamento…"
        value={searchText}
        onChange={e => setSearchText(e.target.value)}
      />

      {isLoading ? (
        <p>Cargando empleados…</p>
      ) : filteredEmployees.length === 0 ? (
        <p className="text-muted">No hay empleados que coincidan con la búsqueda.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Departamento</th>
                <th>Puesto</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map(employee => (
                <tr key={employee.id}>
                  <td>{employee.full_name}</td>
                  <td>{employee.email ?? '—'}</td>
                  <td>{employee.department ?? '—'}</td>
                  <td>{employee.position ?? '—'}</td>
                  <td>
                    <Badge variant={employee.active ? 'success' : 'secondary'}>
                      {employee.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="text-end">
                    {canManage && (
                      <>
                        <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => openEditEmployee(employee)}>
                          Editar
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          disabled={deletingEmployeeId === employee.id}
                          onClick={() => requestDelete(employee)}
                        >
                          {deletingEmployeeId === employee.id ? '…' : 'Eliminar'}
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
        open={employeeModalOpen}
        onClose={closeEmployeeModal}
        title={editingEmployeeId ? 'Editar empleado' : 'Nuevo empleado'}
        footer={
          <>
            <Button variant="secondary" onClick={closeEmployeeModal}>Cancelar</Button>
            <Button variant="primary" disabled={isSavingEmployee} onClick={handleSave}>
              {isSavingEmployee ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        {formError && <div className="alert alert-danger">{formError}</div>}
        <EmployeeFormFields form={employeeForm} onChange={updateEmployeeForm} />
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
          ¿Seguro que quieres eliminar a <strong>{employeeToDelete?.full_name}</strong>? Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  );
};
