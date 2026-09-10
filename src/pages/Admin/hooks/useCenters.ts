// State management hook for the Centers admin feature area.

import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../../context/useApp';
import { saveCenterRecord, deleteCenterRecord } from '../../../repositories/adminManagementRepository';
import { toCenterRecord } from '../../../features/admin/domain/adminRecords';
import type { CenterFormState, CenterRecord } from '../../../features/admin/domain/adminRecords';
export type { CenterFormState, CenterRecord } from '../../../features/admin/domain/adminRecords';

export const emptyCenterForm: CenterFormState = {
  name: '',
  address: '',
  city: '',
  latitude: '',
  longitude: '',
  active: true
};

export const useCenters = (companyId: string | null) => {
  const { currentUser, authLoading, refreshData, workCenters: rows } = useApp();
  const profile = currentUser.profile;

  const [centerForm, setCenterForm] = useState<CenterFormState>(emptyCenterForm);
  const [editingCenterId, setEditingCenterId] = useState<string | null>(null);
  const [centerModalOpen, setCenterModalOpen] = useState(false);
  const [isSavingCenter, setIsSavingCenter] = useState(false);
  const [deletingCenterId, setDeletingCenterId] = useState<string | null>(null);

  const centers = useMemo(() => rows.filter(row => row.company_id === companyId).map(toCenterRecord), [rows, companyId]);

  const openCreateCenter = useCallback(() => {
    setCenterForm(emptyCenterForm);
    setEditingCenterId(null);
    setCenterModalOpen(true);
  }, []);

  const openEditCenter = useCallback((center: CenterRecord) => {
    setCenterForm({
      name: center.name ?? '',
      address: center.address ?? '',
      city: center.city ?? '',
      latitude: center.latitude != null ? String(center.latitude) : '',
      longitude: center.longitude != null ? String(center.longitude) : '',
      active: center.active ?? true
    });
    setEditingCenterId(center.id);
    setCenterModalOpen(true);
  }, []);

  const closeCenterModal = useCallback(() => {
    setCenterModalOpen(false);
    setEditingCenterId(null);
    setCenterForm(emptyCenterForm);
  }, []);

  const updateCenterForm = useCallback((field: keyof CenterFormState, value: string | boolean) => {
    setCenterForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const setCenterLocation = useCallback((latitude: number, longitude: number) => {
    setCenterForm(prev => ({
      ...prev,
      latitude: String(latitude),
      longitude: String(longitude)
    }));
  }, []);

  const saveCenter = useCallback(async () => {
    if (!companyId) throw new Error('No hay empresa seleccionada.');
    if (!centerForm.name.trim()) throw new Error('El nombre del centro es obligatorio.');

    setIsSavingCenter(true);
    try {
      if (!profile || profile.status !== 'active' || (profile.role !== 'superadmin' && (profile.role !== 'company_admin' || companyId !== profile.company_id))) throw new Error('No tienes permisos para realizar esta operación.');
      await saveCenterRecord(editingCenterId, companyId, centerForm);
      await refreshData();
      closeCenterModal();
    } finally {
      setIsSavingCenter(false);
    }
  }, [companyId, centerForm, editingCenterId, refreshData, profile, closeCenterModal]);

  const deleteCenter = useCallback(async (centerId: string) => {
    if (!companyId) return;
    setDeletingCenterId(centerId);
    try {
      if (!profile || profile.status !== 'active' || (profile.role !== 'superadmin' && (profile.role !== 'company_admin' || companyId !== profile.company_id))) throw new Error('No tienes permisos para realizar esta operación.');
      await deleteCenterRecord(centerId, companyId);
      await refreshData();
    } finally {
      setDeletingCenterId(null);
    }
  }, [companyId, refreshData, profile]);

  return {
    centers,
    isLoading: authLoading,
    error: null,
    centerForm,
    updateCenterForm,
    setCenterLocation,
    editingCenterId,
    centerModalOpen,
    openCreateCenter,
    openEditCenter,
    closeCenterModal,
    isSavingCenter,
    saveCenter,
    deletingCenterId,
    deleteCenter
  };
};
