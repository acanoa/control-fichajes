// State management hook for the Employees admin feature area.

import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../../context/useApp';
import { saveEmployeeRecord, deleteEmployeeRecord } from '../../../repositories/adminManagementRepository';
import { toEmployeeRecord } from '../../../features/admin/domain/adminRecords';
import type { EmployeeFormState, EmployeeRecord } from '../../../features/admin/domain/adminRecords';
export type { EmployeeFormState, EmployeeRecord } from '../../../features/admin/domain/adminRecords';

export const emptyEmployeeForm: EmployeeFormState = {
  full_name: '',
  dni: '',
  hire_date: '',
  email: '',
  phone: '',
  position: '',
  department: '',
  active: true
};

export const useEmployees = (companyId: string | null) => {
  const { currentUser, authLoading, refreshData, employees: rows } = useApp();
  const profile = currentUser.profile;

  const [searchText, setSearchText] = useState('');
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(emptyEmployeeForm);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);

  const employees = useMemo(() => rows.filter(row => row.company_id === companyId).map(toEmployeeRecord), [rows, companyId]);

  const filteredEmployees = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(employee =>
      employee.full_name?.toLowerCase().includes(term) ||
      employee.email?.toLowerCase().includes(term) ||
      employee.department?.toLowerCase().includes(term)
    );
  }, [employees, searchText]);

  const openCreateEmployee = useCallback(() => {
    setEmployeeForm(emptyEmployeeForm);
    setEditingEmployeeId(null);
    setEmployeeModalOpen(true);
  }, []);

  const openEditEmployee = useCallback((employee: EmployeeRecord) => {
    setEmployeeForm({
      full_name: employee.full_name ?? '',
      dni: employee.dni,
      hire_date: employee.hire_date,
      email: employee.email ?? '',
      phone: employee.phone ?? '',
      position: employee.position ?? '',
      department: employee.department ?? '',
      active: employee.active ?? true
    });
    setEditingEmployeeId(employee.id);
    setEmployeeModalOpen(true);
  }, []);

  const closeEmployeeModal = useCallback(() => {
    setEmployeeModalOpen(false);
    setEditingEmployeeId(null);
    setEmployeeForm(emptyEmployeeForm);
  }, []);

  const updateEmployeeForm = useCallback((field: keyof EmployeeFormState, value: string | boolean) => {
    setEmployeeForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const saveEmployee = useCallback(async () => {
    if (!companyId) throw new Error('No hay empresa seleccionada.');
    if (!employeeForm.full_name.trim()) {
      throw new Error('El nombre del empleado es obligatorio.');
    }
    setIsSavingEmployee(true);
    try {
      if (!profile || profile.status !== 'active' || (profile.role !== 'superadmin' && (profile.role !== 'company_admin' || companyId !== profile.company_id))) throw new Error('No tienes permisos para realizar esta operación.');
      await saveEmployeeRecord(editingEmployeeId, companyId, employeeForm);
      await refreshData();
      closeEmployeeModal();
    } finally {
      setIsSavingEmployee(false);
    }
  }, [companyId, employeeForm, editingEmployeeId, refreshData, profile, closeEmployeeModal]);

  const deleteEmployee = useCallback(async (employeeId: string) => {
    if (!companyId) return;
    setDeletingEmployeeId(employeeId);
    try {
      if (!profile || profile.status !== 'active' || (profile.role !== 'superadmin' && (profile.role !== 'company_admin' || companyId !== profile.company_id))) throw new Error('No tienes permisos para realizar esta operación.');
      await deleteEmployeeRecord(employeeId, companyId);
      await refreshData();
    } finally {
      setDeletingEmployeeId(null);
    }
  }, [companyId, refreshData, profile]);

  return {
    employees,
    filteredEmployees,
    isLoading: authLoading,
    error: null,
    searchText,
    setSearchText,
    employeeForm,
    updateEmployeeForm,
    editingEmployeeId,
    employeeModalOpen,
    openCreateEmployee,
    openEditEmployee,
    closeEmployeeModal,
    isSavingEmployee,
    saveEmployee,
    deletingEmployeeId,
    deleteEmployee
  };
};
