// State management hook for the Companies admin feature area.

import { useCallback, useMemo, useState } from 'react';
import { useApp } from '../../../context/useApp';
import { saveCompanyRecord, deleteCompanyRecord } from '../../../repositories/adminManagementRepository';
import { toCompanyRecord } from '../../../features/admin/domain/adminRecords';
import type { CompanyFormState, CompanyRecord } from '../../../features/admin/domain/adminRecords';
export type { CompanyFormState, CompanyRecord } from '../../../features/admin/domain/adminRecords';

export const emptyCompanyForm: CompanyFormState = {
  name: '',
  legal_name: '',
  company_code: '',
  tax_id: '',
  address: '',
  phone: '',
  email: '',
  logo_url: '',
  active: true
};

export const useCompanies = () => {
  const { currentUser, authLoading, refreshData, companies: rows } = useApp();
  const profile = currentUser.profile;

  const [searchText, setSearchText] = useState('');
  const [companyForm, setCompanyForm] = useState<CompanyFormState>(emptyCompanyForm);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [isSavingCompany, setIsSavingCompany] = useState(false);
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null);

  const companies = useMemo(() => rows.map(toCompanyRecord), [rows]);

  const filteredCompanies = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter(company =>
      company.name?.toLowerCase().includes(term) ||
      company.tax_id?.toLowerCase().includes(term) ||
      company.email?.toLowerCase().includes(term)
    );
  }, [companies, searchText]);

  const openCreateCompany = useCallback(() => {
    setCompanyForm(emptyCompanyForm);
    setEditingCompanyId(null);
    setCompanyModalOpen(true);
  }, []);

  const openEditCompany = useCallback((company: CompanyRecord) => {
    setCompanyForm({
      name: company.name ?? '',
      legal_name: company.legal_name,
      company_code: company.company_code,
      tax_id: company.tax_id ?? '',
      address: company.address ?? '',
      phone: company.phone ?? '',
      email: company.email ?? '',
      logo_url: company.logo_url ?? '',
      active: company.active ?? true
    });
    setEditingCompanyId(company.id);
    setCompanyModalOpen(true);
  }, []);

  const closeCompanyModal = useCallback(() => {
    setCompanyModalOpen(false);
    setEditingCompanyId(null);
    setCompanyForm(emptyCompanyForm);
  }, []);

  const updateCompanyForm = useCallback((field: keyof CompanyFormState, value: string | boolean) => {
    setCompanyForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const saveCompany = useCallback(async () => {
    if (!companyForm.name.trim()) {
      throw new Error('El nombre de la empresa es obligatorio.');
    }
    setIsSavingCompany(true);
    try {
      if (!profile || profile.status !== 'active' || (profile.role !== 'superadmin' && (profile.role !== 'company_admin' || editingCompanyId !== profile.company_id))) throw new Error('No tienes permisos para realizar esta operación.');
      await saveCompanyRecord(editingCompanyId, companyForm);
      await refreshData();
      closeCompanyModal();
    } finally {
      setIsSavingCompany(false);
    }
  }, [companyForm, editingCompanyId, refreshData, profile, closeCompanyModal]);

  const deleteCompany = useCallback(async (companyId: string) => {
    setDeletingCompanyId(companyId);
    try {
      if (!profile || profile.status !== 'active' || profile.role !== 'superadmin') throw new Error('No tienes permisos para realizar esta operación.');
      await deleteCompanyRecord(companyId);
      await refreshData();
    } finally {
      setDeletingCompanyId(null);
    }
  }, [refreshData, profile]);

  return {
    companies,
    filteredCompanies,
    isLoading: authLoading,
    error: null,
    searchText,
    setSearchText,
    companyForm,
    updateCompanyForm,
    editingCompanyId,
    companyModalOpen,
    openCreateCompany,
    openEditCompany,
    closeCompanyModal,
    isSavingCompany,
    saveCompany,
    deletingCompanyId,
    deleteCompany
  };
};
