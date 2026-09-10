// Centers tab: list, geofence editor with MapPickerModal, create/edit/delete.

import React from 'react';
import { Modal, Badge, Button } from '../../../components/ui';
import { MapPickerModal, DEFAULT_POSITION } from '../components/MapPickerModal';
import {
  useCenters,
  type CenterFormState,
  type CenterRecord
} from '../hooks/useCenters';

interface CentersTabProps {
  companyId: string | null;
  canManage: boolean;
}

const CenterFormFields: React.FC<{
  form: CenterFormState;
  onChange: (field: keyof CenterFormState, value: string | boolean) => void;
  onOpenMap: () => void;
}> = ({ form, onChange, onOpenMap }) => (
  <div className="row g-3">
    <div className="col-md-6">
      <label className="form-label">Nombre del centro *</label>
      <input className="form-control" value={form.name} onChange={e => onChange('name', e.target.value)} />
    </div>
    <div className="col-md-6">
      <label className="form-label">Ciudad</label>
      <input className="form-control" value={form.city} onChange={e => onChange('city', e.target.value)} />
    </div>
    <div className="col-12">
      <label className="form-label">Dirección</label>
      <input className="form-control" value={form.address} onChange={e => onChange('address', e.target.value)} />
    </div>
    <div className="col-12">
      <label className="form-label">Ubicación (lat, lng)</label>
      <div className="d-flex gap-2 align-items-center">
        <input
          className="form-control"
          readOnly
          value={form.latitude && form.longitude ? `${form.latitude}, ${form.longitude}` : 'Sin ubicación'}
        />
        <Button variant="outline-primary" onClick={onOpenMap}>Seleccionar en mapa</Button>
      </div>
    </div>
    <div className="col-12">
      <div className="form-check form-switch">
        <input
          className="form-check-input"
          type="checkbox"
          role="switch"
          id="center-active-switch"
          checked={form.active}
          onChange={e => onChange('active', e.target.checked)}
        />
        <label className="form-check-label" htmlFor="center-active-switch">Centro activo</label>
      </div>
    </div>
  </div>
);

export const CentersTab: React.FC<CentersTabProps> = ({ companyId, canManage }) => {
  const {
    centers,
    isLoading,
    centerForm,
    updateCenterForm,
    editingCenterId,
    centerModalOpen,
    openCreateCenter,
    openEditCenter,
    closeCenterModal,
    isSavingCenter,
    saveCenter,
    deletingCenterId,
    deleteCenter
  } = useCenters(companyId);

  const [mapPickerOpen, setMapPickerOpen] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [centerToDelete, setCenterToDelete] = React.useState<CenterRecord | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);
    try {
      await saveCenter();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar el centro.');
    }
  };

  const requestDelete = (center: CenterRecord) => {
    setDeleteError(null);
    setCenterToDelete(center);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!centerToDelete) return;
    setDeleteError(null);
    try {
      await deleteCenter(centerToDelete.id);
      setDeleteConfirmOpen(false);
      setCenterToDelete(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'No se pudo eliminar el registro.');
    }
  };

  if (!companyId) {
    return <p className="text-muted">Selecciona una empresa para ver sus centros.</p>;
  }

  return (
    <div className="admin-panel">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h4 mb-0">Centros</h2>
        {canManage && (
          <Button variant="primary" onClick={openCreateCenter}>+ Nuevo centro</Button>
        )}
      </div>

      {isLoading ? (
        <p>Cargando centros…</p>
      ) : centers.length === 0 ? (
        <p className="text-muted">No hay centros configurados para esta empresa.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Dirección</th>
                <th>Ciudad</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {centers.map(center => (
                <tr key={center.id}>
                  <td>{center.name}</td>
                  <td>{center.address ?? '—'}</td>
                  <td>{center.city ?? '—'}</td>
                  <td>
                    {center.latitude != null && center.longitude != null
                      ? `${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`
                      : '—'}
                  </td>
                  <td>
                    <Badge variant={center.active ? 'success' : 'secondary'}>
                      {center.active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="text-end">
                    {canManage && (
                      <>
                        <Button variant="outline-secondary" size="sm" className="me-2" onClick={() => openEditCenter(center)}>
                          Editar
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          disabled={deletingCenterId === center.id}
                          onClick={() => requestDelete(center)}
                        >
                          {deletingCenterId === center.id ? '…' : 'Eliminar'}
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
        open={centerModalOpen}
        onClose={closeCenterModal}
        title={editingCenterId ? 'Editar centro' : 'Nuevo centro'}
        footer={
          <>
            <Button variant="secondary" onClick={closeCenterModal}>Cancelar</Button>
            <Button variant="primary" disabled={isSavingCenter} onClick={handleSave}>
              {isSavingCenter ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        {formError && <div className="alert alert-danger">{formError}</div>}
        <CenterFormFields
          form={centerForm}
          onChange={updateCenterForm}
          onOpenMap={() => setMapPickerOpen(true)}
        />
      </Modal>

      <MapPickerModal
        open={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        initialPosition={[centerForm.latitude ? Number(centerForm.latitude) : DEFAULT_POSITION[0], centerForm.longitude ? Number(centerForm.longitude) : DEFAULT_POSITION[1]]}
        lat={centerForm.latitude ? Number(centerForm.latitude) : DEFAULT_POSITION[0]}
        lng={centerForm.longitude ? Number(centerForm.longitude) : DEFAULT_POSITION[1]}
        onLatChange={lat => updateCenterForm('latitude', String(lat))}
        onLngChange={lng => updateCenterForm('longitude', String(lng))}
      />

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
          ¿Seguro que quieres eliminar el centro <strong>{centerToDelete?.name}</strong>? Esta acción no se puede deshacer.
        </p>
      </Modal>
    </div>
  );
};
