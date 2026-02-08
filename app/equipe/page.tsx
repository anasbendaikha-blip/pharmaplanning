'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useOrganization } from '@/lib/supabase/client';
import { getEmployees } from '@/lib/supabase/queries';
import { useToast } from '@/components/ui/Toast';
import type { Employee, EmployeeCategory } from '@/lib/types';
import type { HoraireFixes } from '@/lib/types/horaires-fixes';
import { getFixedForEmployee } from '@/lib/horaires-fixes-service';
import { MOCK_HORAIRES_FIXES } from '@/app/planning/data/mockHorairesFixes';
import {
  exportPlanningToCSV,
  exportHorairesToJSON,
  downloadFile,
} from '@/lib/planning-import-export';

// ─── Constants ───

type TabKey = 'liste' | 'horaires' | 'ajouter';

const CATEGORY_CONFIG: Record<EmployeeCategory, { label: string; icon: string; color: string }> = {
  pharmacien_titulaire: { label: 'Pharmacien Titulaire', icon: 'Ph', color: '#2563eb' },
  pharmacien_adjoint: { label: 'Pharmacien Adjoint', icon: 'Ph', color: '#3b82f6' },
  preparateur: { label: 'Preparateur', icon: 'Pr', color: '#10b981' },
  rayonniste: { label: 'Rayonniste', icon: 'Ra', color: '#f59e0b' },
  apprenti: { label: 'Apprenti', icon: 'Ap', color: '#8b5cf6' },
  etudiant: { label: 'Etudiant', icon: 'Et', color: '#ec4899' },
};

const CONTRACT_LABELS: Record<string, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  alternance: 'Alternance',
  stage: 'Stage',
  interim: 'Interim',
};

const DAY_NAMES_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const DB_ROLES = [
  { value: 'Pharmacien', label: 'Pharmacien' },
  { value: 'Preparateur', label: 'Preparateur' },
  { value: 'Conditionneur', label: 'Rayonniste / Conditionneur' },
  { value: 'Apprenti', label: 'Apprenti' },
  { value: 'Etudiant', label: 'Etudiant' },
];

const JOURS = [
  { num: 0, label: 'Lundi', short: 'Lun' },
  { num: 1, label: 'Mardi', short: 'Mar' },
  { num: 2, label: 'Mercredi', short: 'Mer' },
  { num: 3, label: 'Jeudi', short: 'Jeu' },
  { num: 4, label: 'Vendredi', short: 'Ven' },
  { num: 5, label: 'Samedi', short: 'Sam' },
];

const PRESETS = [
  { label: 'Matinee', start: '08:30', end: '14:00', breakMin: 0, type: 'morning' as const },
  { label: 'Apres-midi', start: '13:00', end: '19:30', breakMin: 0, type: 'afternoon' as const },
  { label: 'Journee', start: '08:30', end: '18:30', breakMin: 60, type: 'regular' as const },
  { label: 'Sam matin', start: '08:30', end: '13:00', breakMin: 0, type: 'morning' as const },
];

type SortField = 'nom' | 'role' | 'heures' | 'contrat';
type SortOrder = 'asc' | 'desc';

function getAccountStatusLabel(status: string | null): { label: string; className: string } {
  switch (status) {
    case 'active':
      return { label: 'Actif', className: 'ge-status-active' };
    case 'pending':
      return { label: 'En attente', className: 'ge-status-pending' };
    case 'suspended':
      return { label: 'Suspendu', className: 'ge-status-suspended' };
    case 'deactivated':
      return { label: 'Desactive', className: 'ge-status-deactivated' };
    default:
      return { label: 'Non invite', className: 'ge-status-none' };
  }
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 2) {
    parts.push(digits.slice(i, i + 2));
  }
  return parts.join(' ');
}

// ─── Component ───

export default function GestionEquipePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { addToast } = useToast();

  // Tab management
  const tabParam = searchParams.get('tab') as TabKey | null;
  const activeTab: TabKey = tabParam === 'horaires' || tabParam === 'ajouter' ? tabParam : 'liste';

  const setActiveTab = useCallback((tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'liste') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }
    router.replace(`/equipe?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // Shared state: employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEmployees = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    const data = await getEmployees(organizationId);
    setEmployees(data);
    setIsLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || orgLoading) return;
    loadEmployees();
  }, [organizationId, orgLoading, loadEmployees]);

  // ─── Tab Liste state ───
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<EmployeeCategory | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('nom');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [resendingId, setResendingId] = useState<string | null>(null);

  // ─── Tab Horaires state ───
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [horaires, setHoraires] = useState<HoraireFixes[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // ─── Tab Ajouter state ───
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState('Preparateur');
  const [formContractHours, setFormContractHours] = useState(35);
  const [formSendInvitation, setFormSendInvitation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // ─── Derived ───

  const activeEmployees = useMemo(() => employees.filter(e => e.is_active), [employees]);

  // Filtered + sorted employees for Liste tab
  const filteredEmployees = useMemo(() => {
    let result = [...activeEmployees];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(e =>
        e.first_name.toLowerCase().includes(term) ||
        e.last_name.toLowerCase().includes(term) ||
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(term)
      );
    }

    if (filterCategory !== 'all') {
      result = result.filter(e => e.category === filterCategory);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'nom':
          cmp = a.last_name.localeCompare(b.last_name);
          break;
        case 'role':
          cmp = a.category.localeCompare(b.category);
          break;
        case 'heures':
          cmp = a.contract_hours - b.contract_hours;
          break;
        case 'contrat':
          cmp = (a.contract_type || '').localeCompare(b.contract_type || '');
          break;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [activeEmployees, searchTerm, filterCategory, sortField, sortOrder]);

  // Selected employee for Horaires tab
  const selectedEmployee = useMemo(
    () => activeEmployees.find(e => e.id === selectedEmployeeId) || null,
    [activeEmployees, selectedEmployeeId]
  );

  // Auto-select first employee for horaires tab
  useEffect(() => {
    if (activeTab === 'horaires' && !selectedEmployeeId && activeEmployees.length > 0) {
      setSelectedEmployeeId(activeEmployees[0].id);
    }
  }, [activeTab, selectedEmployeeId, activeEmployees]);

  // Load horaires when employee changes
  useEffect(() => {
    if (!selectedEmployeeId) {
      setHoraires([]);
      return;
    }
    const fixed = getFixedForEmployee(MOCK_HORAIRES_FIXES, selectedEmployeeId);
    setHoraires(fixed);
    setHasChanges(false);
    setSelectedDay(null);
  }, [selectedEmployeeId]);

  // Horaires stats
  const weeklyStats = useMemo(() => {
    const totalHours = horaires.reduce((sum, h) => {
      const [sh, sm] = h.start_time.split(':').map(Number);
      const [eh, em] = h.end_time.split(':').map(Number);
      return sum + ((eh * 60 + em) - (sh * 60 + sm) - h.break_duration) / 60;
    }, 0);
    return { days: horaires.length, hours: Math.round(totalHours * 10) / 10 };
  }, [horaires]);

  // ─── Handlers: Liste ───

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        return field;
      }
      setSortOrder('asc');
      return field;
    });
  }, []);

  const handleExportCSV = useCallback(() => {
    const csv = exportPlanningToCSV(MOCK_HORAIRES_FIXES, employees);
    downloadFile(csv, 'equipe-horaires-fixes.csv', 'text/csv');
    addToast('success', 'Export CSV telecharge');
  }, [employees, addToast]);

  const handleExportJSON = useCallback(() => {
    const json = exportHorairesToJSON(MOCK_HORAIRES_FIXES, employees);
    downloadFile(json, 'equipe-horaires-fixes.json', 'application/json');
    addToast('success', 'Export JSON telecharge');
  }, [employees, addToast]);

  const handleResendInvitation = useCallback(async (employeeId: string) => {
    setResendingId(employeeId);
    try {
      const response = await fetch('/api/employees/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erreur');
      }
      addToast('success', 'Invitation renvoyee avec succes');
      await loadEmployees();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      addToast('error', message);
    } finally {
      setResendingId(null);
    }
  }, [addToast, loadEmployees]);

  const handleGoToHoraires = useCallback((empId: string) => {
    setSelectedEmployeeId(empId);
    setActiveTab('horaires');
  }, [setActiveTab]);

  // ─── Handlers: Horaires ───

  const getHoraireForDay = useCallback((dayNum: number): HoraireFixes | undefined => {
    return horaires.find(h => h.day_of_week === dayNum);
  }, [horaires]);

  const handleTimeChange = useCallback((dayNum: number, field: 'start_time' | 'end_time', value: string) => {
    const existing = horaires.find(h => h.day_of_week === dayNum);
    if (existing) {
      setHoraires(prev => prev.map(h =>
        h.day_of_week === dayNum ? { ...h, [field]: value } : h
      ));
    } else {
      const newH: HoraireFixes = {
        id: `hf-new-${dayNum}-${Date.now()}`,
        employee_id: selectedEmployeeId,
        day_of_week: dayNum,
        start_time: field === 'start_time' ? value : '08:30',
        end_time: field === 'end_time' ? value : '14:00',
        break_duration: 0,
        shift_type: 'regular',
        alternate_weeks: null,
        is_active: true,
        label: 'Nouveau',
      };
      setHoraires(prev => [...prev, newH]);
    }
    setHasChanges(true);
  }, [horaires, selectedEmployeeId]);

  const handleBreakChange = useCallback((dayNum: number, value: number) => {
    setHoraires(prev => prev.map(h =>
      h.day_of_week === dayNum ? { ...h, break_duration: value } : h
    ));
    setHasChanges(true);
  }, []);

  const handlePresetApply = useCallback((dayNum: number, preset: typeof PRESETS[0]) => {
    const existing = horaires.find(h => h.day_of_week === dayNum);
    if (existing) {
      setHoraires(prev => prev.map(h =>
        h.day_of_week === dayNum
          ? { ...h, start_time: preset.start, end_time: preset.end, break_duration: preset.breakMin, shift_type: preset.type, label: preset.label }
          : h
      ));
    } else {
      const newH: HoraireFixes = {
        id: `hf-new-${dayNum}-${Date.now()}`,
        employee_id: selectedEmployeeId,
        day_of_week: dayNum,
        start_time: preset.start,
        end_time: preset.end,
        break_duration: preset.breakMin,
        shift_type: preset.type,
        alternate_weeks: null,
        is_active: true,
        label: preset.label,
      };
      setHoraires(prev => [...prev, newH]);
    }
    setHasChanges(true);
  }, [horaires, selectedEmployeeId]);

  const handleRemoveDay = useCallback((dayNum: number) => {
    setHoraires(prev => prev.filter(h => h.day_of_week !== dayNum));
    setSelectedDay(null);
    setHasChanges(true);
  }, []);

  const handleCopyToWeekdays = useCallback((dayNum: number) => {
    const source = horaires.find(h => h.day_of_week === dayNum);
    if (!source) return;

    setHoraires(prev => {
      const result = [...prev];
      for (let d = 0; d < 5; d++) {
        if (d === dayNum) continue;
        const existing = result.findIndex(h => h.day_of_week === d);
        const copied: HoraireFixes = {
          ...source,
          id: `hf-copy-${d}-${Date.now()}`,
          day_of_week: d,
        };
        if (existing >= 0) {
          result[existing] = copied;
        } else {
          result.push(copied);
        }
      }
      return result;
    });
    setHasChanges(true);
    addToast('success', 'Horaires copies vers Lun-Ven');
  }, [horaires, addToast]);

  const handleSaveHoraires = useCallback(async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 500));
    setHasChanges(false);
    setIsSaving(false);
    addToast('success', 'Horaires fixes sauvegardes');
  }, [addToast]);

  const handleResetHoraires = useCallback(() => {
    if (selectedEmployeeId) {
      const fixed = getFixedForEmployee(MOCK_HORAIRES_FIXES, selectedEmployeeId);
      setHoraires(fixed);
      setHasChanges(false);
      addToast('warning', 'Horaires reinitialises');
    }
  }, [selectedEmployeeId, addToast]);

  // ─── Handlers: Ajouter ───

  const resetForm = useCallback(() => {
    setFormFirstName('');
    setFormLastName('');
    setFormEmail('');
    setFormPhone('');
    setFormRole('Preparateur');
    setFormContractHours(35);
    setFormSendInvitation(true);
    setFormError('');
  }, []);

  const handleCreateEmployee = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formFirstName.trim() || !formLastName.trim() || !formRole) {
      setFormError('Prenom, nom et role sont requis');
      return;
    }

    if (formSendInvitation && !formEmail.trim()) {
      setFormError('L\'email est requis pour envoyer une invitation');
      return;
    }

    if (formEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) {
      setFormError('Format d\'email invalide');
      return;
    }

    const phoneDigits = formPhone.replace(/\D/g, '');
    if (phoneDigits && phoneDigits.length !== 10) {
      setFormError('Le telephone doit contenir 10 chiffres');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/employees/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          firstName: formFirstName.trim(),
          lastName: formLastName.trim(),
          email: formEmail.trim(),
          phone: phoneDigits || null,
          role: formRole,
          contractHours: formContractHours,
          sendInvitation: formSendInvitation && !!formEmail.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la creation');
      }

      if (data.invitationSent) {
        addToast('success', `Employe cree et invitation envoyee a ${formEmail}`);
      } else if (data.invitationError) {
        addToast('warning', `Employe cree mais erreur d'invitation: ${data.invitationError}`);
      } else {
        addToast('success', 'Employe cree avec succes');
      }

      await loadEmployees();
      resetForm();
      setActiveTab('liste');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }, [formFirstName, formLastName, formEmail, formPhone, formRole, formContractHours, formSendInvitation, organizationId, addToast, loadEmployees, resetForm, setActiveTab]);

  // ─── Helpers ───

  const getInitials = (fn: string, ln: string) => `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase();

  // ─── Loading ───

  if (orgLoading || isLoading) {
    return (
      <div className="ge-loading">
        <span className="ge-spinner" />
        <span>Chargement de l&apos;equipe...</span>
        <style jsx>{`
          .ge-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 400px; color: var(--color-neutral-500); }
          .ge-spinner { width: 32px; height: 32px; border: 3px solid var(--color-neutral-200); border-top-color: var(--color-primary-500); border-radius: 50%; animation: gespin 0.8s linear infinite; }
          @keyframes gespin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // ─── Render ───

  return (
    <>
      <div className="ge-page">
        {/* Header */}
        <div className="ge-header">
          <div className="ge-header-top">
            <div>
              <h1 className="ge-title">Gestion de l&apos;equipe</h1>
              <p className="ge-subtitle">{activeEmployees.length} employe{activeEmployees.length > 1 ? 's' : ''} actif{activeEmployees.length > 1 ? 's' : ''}</p>
            </div>
            <button className="ge-btn ge-btn--primary" onClick={() => setActiveTab('ajouter')} type="button">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Nouvel employe
            </button>
          </div>

          {/* Tabs */}
          <div className="ge-tabs">
            <button
              className={`ge-tab ${activeTab === 'liste' ? 'ge-tab--active' : ''}`}
              onClick={() => setActiveTab('liste')}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              Liste des employes
            </button>
            <button
              className={`ge-tab ${activeTab === 'horaires' ? 'ge-tab--active' : ''}`}
              onClick={() => setActiveTab('horaires')}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Horaires fixes
            </button>
            <button
              className={`ge-tab ${activeTab === 'ajouter' ? 'ge-tab--active' : ''}`}
              onClick={() => setActiveTab('ajouter')}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              Ajouter un employe
            </button>
          </div>
        </div>

        {/* ═══ TAB: LISTE ═══ */}
        {activeTab === 'liste' && (
          <div className="ge-tab-content">
            {/* Filters */}
            <div className="ge-filters">
              <div className="ge-search-wrap">
                <svg className="ge-search-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  className="ge-search"
                  placeholder="Rechercher un employe..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button className="ge-search-clear" onClick={() => setSearchTerm('')} type="button">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
              <select
                className="ge-filter-select"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value as EmployeeCategory | 'all')}
              >
                <option value="all">Tous les roles</option>
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <div className="ge-count">{filteredEmployees.length} employe{filteredEmployees.length > 1 ? 's' : ''}</div>
              <div className="ge-export-btns">
                <button className="ge-btn ge-btn--outline ge-btn--sm" onClick={handleExportCSV} type="button">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  CSV
                </button>
                <button className="ge-btn ge-btn--outline ge-btn--sm" onClick={handleExportJSON} type="button">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  JSON
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="ge-table-wrap">
              <table className="ge-table">
                <thead>
                  <tr>
                    <th className="ge-th ge-th--sortable" onClick={() => handleSort('nom')}>
                      Employe {sortField === 'nom' && (sortOrder === 'asc' ? '(A-Z)' : '(Z-A)')}
                    </th>
                    <th className="ge-th ge-th--sortable" onClick={() => handleSort('role')}>
                      Role {sortField === 'role' && (sortOrder === 'asc' ? '(A-Z)' : '(Z-A)')}
                    </th>
                    <th className="ge-th">Telephone</th>
                    <th className="ge-th">Horaires fixes</th>
                    <th className="ge-th ge-th--sortable" onClick={() => handleSort('heures')}>
                      Contrat {sortField === 'heures' && (sortOrder === 'asc' ? '(+)' : '(-)')}
                    </th>
                    <th className="ge-th">Statut</th>
                    <th className="ge-th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => {
                    const empHoraires = getFixedForEmployee(MOCK_HORAIRES_FIXES, emp.id);
                    const catCfg = CATEGORY_CONFIG[emp.category];
                    const totalWeeklyHours = empHoraires.reduce((sum, h) => {
                      const [sh, sm] = h.start_time.split(':').map(Number);
                      const [eh, em] = h.end_time.split(':').map(Number);
                      return sum + ((eh * 60 + em) - (sh * 60 + sm) - h.break_duration) / 60;
                    }, 0);
                    const daysWithHoraires = new Set(empHoraires.map(h => h.day_of_week));
                    const status = getAccountStatusLabel(emp.account_status);

                    return (
                      <tr key={emp.id} className="ge-row">
                        <td className="ge-td">
                          <div className="ge-emp-cell">
                            <div className="ge-avatar" style={{ backgroundColor: catCfg.color }}>
                              {getInitials(emp.first_name, emp.last_name)}
                            </div>
                            <div className="ge-emp-info">
                              <span className="ge-emp-name">{emp.first_name} {emp.last_name}</span>
                              <span className="ge-emp-email">{emp.email || '-'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="ge-td">
                          <span className="ge-role-badge" style={{ borderColor: catCfg.color, color: catCfg.color }}>
                            {catCfg.label}
                          </span>
                        </td>
                        <td className="ge-td">
                          <span className="ge-phone">{emp.phone ? formatPhone(emp.phone) : '-'}</span>
                        </td>
                        <td className="ge-td">
                          {empHoraires.length > 0 ? (
                            <div className="ge-hf-summary">
                              <div className="ge-hf-days">
                                {DAY_NAMES_SHORT.map((name, idx) => (
                                  <span
                                    key={idx}
                                    className={`ge-hf-day ${daysWithHoraires.has(idx) ? 'ge-hf-day--active' : ''}`}
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                              <span className="ge-hf-hours">{Math.round(totalWeeklyHours)}h/sem</span>
                            </div>
                          ) : (
                            <span className="ge-hf-empty">Aucun</span>
                          )}
                        </td>
                        <td className="ge-td">
                          <span className="ge-contract">{emp.contract_hours}h/sem</span>
                          <span className="ge-contract-type">{CONTRACT_LABELS[emp.contract_type] || emp.contract_type}</span>
                        </td>
                        <td className="ge-td">
                          <span className={`ge-status-badge ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="ge-td">
                          <div className="ge-actions-cell">
                            <button
                              className="ge-action-btn"
                              onClick={() => handleGoToHoraires(emp.id)}
                              title="Gerer horaires fixes"
                              type="button"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              Horaires
                            </button>
                            {emp.account_status === 'pending' && emp.email && (
                              <button
                                className="ge-action-btn ge-action-btn--resend"
                                onClick={() => handleResendInvitation(emp.id)}
                                disabled={resendingId === emp.id}
                                title="Renvoyer l'invitation"
                                type="button"
                              >
                                {resendingId === emp.id ? (
                                  <span className="ge-mini-spinner" />
                                ) : (
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                  </svg>
                                )}
                                Renvoyer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredEmployees.length === 0 && (
                <div className="ge-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <div className="ge-empty-text">Aucun employe trouve</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ TAB: HORAIRES FIXES ═══ */}
        {activeTab === 'horaires' && (
          <div className="ge-tab-content">
            {activeEmployees.length === 0 ? (
              <div className="ge-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <div className="ge-empty-text">Aucun employe dans l&apos;equipe</div>
              </div>
            ) : (
              <>
                {/* Employee selector + actions */}
                <div className="ge-hf-header">
                  <div className="ge-hf-selector">
                    <label className="ge-hf-selector-label">Employe :</label>
                    <select
                      className="ge-hf-employee-select"
                      value={selectedEmployeeId}
                      onChange={e => setSelectedEmployeeId(e.target.value)}
                    >
                      {activeEmployees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} - {CATEGORY_CONFIG[emp.category].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedEmployee && (
                    <div className="ge-hf-emp-badge">
                      <div className="ge-avatar ge-avatar--sm" style={{ backgroundColor: CATEGORY_CONFIG[selectedEmployee.category].color }}>
                        {getInitials(selectedEmployee.first_name, selectedEmployee.last_name)}
                      </div>
                      <div>
                        <span className="ge-hf-emp-name">{selectedEmployee.first_name} {selectedEmployee.last_name}</span>
                        <span className="ge-hf-emp-meta">{CATEGORY_CONFIG[selectedEmployee.category].label} - {selectedEmployee.contract_hours}h/sem</span>
                      </div>
                    </div>
                  )}

                  <div className="ge-hf-actions">
                    <button className="ge-btn ge-btn--outline ge-btn--sm" onClick={handleResetHoraires} type="button">
                      Reinitialiser
                    </button>
                    <button
                      className="ge-btn ge-btn--primary ge-btn--sm"
                      onClick={handleSaveHoraires}
                      disabled={!hasChanges || isSaving}
                      type="button"
                    >
                      {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                {selectedEmployee && (
                  <div className="ge-hf-instructions">
                    <svg className="ge-hf-instructions-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <div>
                      <strong>Definissez la semaine type de {selectedEmployee.first_name}</strong>
                      <span>Ces horaires seront automatiquement pre-remplis chaque semaine dans le planning.</span>
                    </div>
                  </div>
                )}

                {/* Presets */}
                <div className="ge-hf-presets">
                  <span className="ge-hf-presets-label">Raccourcis :</span>
                  {PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      className="ge-hf-preset-btn"
                      onClick={() => selectedDay !== null && handlePresetApply(selectedDay, preset)}
                      disabled={selectedDay === null}
                      type="button"
                      title={`${preset.start}-${preset.end}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  {selectedDay === null && (
                    <span className="ge-hf-presets-hint">Selectionnez un jour d&apos;abord</span>
                  )}
                </div>

                {/* Grid */}
                <div className="ge-hf-grid">
                  {JOURS.map(jour => {
                    const horaire = getHoraireForDay(jour.num);
                    const hasHoraire = !!horaire;
                    const isSelected = selectedDay === jour.num;

                    let durationLabel = '';
                    if (horaire) {
                      const [sh, sm] = horaire.start_time.split(':').map(Number);
                      const [eh, em] = horaire.end_time.split(':').map(Number);
                      const brut = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                      const effectif = brut - horaire.break_duration / 60;
                      durationLabel = `${Math.round(effectif * 10) / 10}h eff.`;
                    }

                    return (
                      <div
                        key={jour.num}
                        className={`ge-hf-day-card ${hasHoraire ? 'ge-hf-day-card--filled' : 'ge-hf-day-card--empty'} ${isSelected ? 'ge-hf-day-card--selected' : ''}`}
                        onClick={() => setSelectedDay(jour.num === selectedDay ? null : jour.num)}
                      >
                        <div className="ge-hf-day-header">
                          <span className="ge-hf-day-label">{jour.label}</span>
                          {hasHoraire && (
                            <button
                              className="ge-hf-day-remove"
                              onClick={e => { e.stopPropagation(); handleRemoveDay(jour.num); }}
                              type="button"
                              title="Supprimer"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          )}
                        </div>

                        {hasHoraire && horaire ? (
                          <div className="ge-hf-day-content">
                            <div className="ge-hf-time-row">
                              <div className="ge-hf-time-group">
                                <label className="ge-hf-time-label">Debut</label>
                                <input
                                  type="time"
                                  className="ge-hf-time-input"
                                  value={horaire.start_time}
                                  onChange={e => handleTimeChange(jour.num, 'start_time', e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                />
                              </div>
                              <span className="ge-hf-time-sep">-&gt;</span>
                              <div className="ge-hf-time-group">
                                <label className="ge-hf-time-label">Fin</label>
                                <input
                                  type="time"
                                  className="ge-hf-time-input"
                                  value={horaire.end_time}
                                  onChange={e => handleTimeChange(jour.num, 'end_time', e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                />
                              </div>
                            </div>

                            <div className="ge-hf-break-row">
                              <label className="ge-hf-time-label">Pause</label>
                              <select
                                className="ge-hf-break-select"
                                value={horaire.break_duration}
                                onChange={e => handleBreakChange(jour.num, Number(e.target.value))}
                                onClick={e => e.stopPropagation()}
                              >
                                <option value={0}>Aucune</option>
                                <option value={20}>20 min</option>
                                <option value={30}>30 min</option>
                                <option value={45}>45 min</option>
                                <option value={60}>1h</option>
                                <option value={90}>1h30</option>
                              </select>
                            </div>

                            <div className="ge-hf-day-footer">
                              <span className="ge-hf-duration">{durationLabel}</span>
                              {isSelected && (
                                <button
                                  className="ge-hf-copy-btn"
                                  onClick={e => { e.stopPropagation(); handleCopyToWeekdays(jour.num); }}
                                  type="button"
                                >
                                  Copier Lun-Ven
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="ge-hf-day-empty">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-300)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            <span className="ge-hf-add-text">Cliquer pour ajouter</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Stats */}
                {selectedEmployee && (
                  <div className="ge-hf-stats">
                    <div className="ge-hf-stat">
                      <span className="ge-hf-stat-label">Jours travailles :</span>
                      <span className="ge-hf-stat-value">{weeklyStats.days} / 6</span>
                    </div>
                    <div className="ge-hf-stat">
                      <span className="ge-hf-stat-label">Heures hebdo estimees :</span>
                      <span className="ge-hf-stat-value">{weeklyStats.hours}h</span>
                    </div>
                    <div className="ge-hf-stat">
                      <span className="ge-hf-stat-label">Contrat :</span>
                      <span className="ge-hf-stat-value">{selectedEmployee.contract_hours}h</span>
                    </div>
                    <div className="ge-hf-stat">
                      <span className="ge-hf-stat-label">Difference :</span>
                      <span className={`ge-hf-stat-value ${weeklyStats.hours > selectedEmployee.contract_hours ? 'ge-hf-stat--over' : weeklyStats.hours < selectedEmployee.contract_hours ? 'ge-hf-stat--under' : ''}`}>
                        {weeklyStats.hours > selectedEmployee.contract_hours ? '+' : ''}{Math.round((weeklyStats.hours - selectedEmployee.contract_hours) * 10) / 10}h
                      </span>
                    </div>
                  </div>
                )}

                {/* Unsaved changes warning */}
                {hasChanges && (
                  <div className="ge-hf-warning">
                    [!] Modifications non sauvegardees
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ TAB: AJOUTER ═══ */}
        {activeTab === 'ajouter' && (
          <div className="ge-tab-content">
            <div className="ge-add-form-wrap">
              <h2 className="ge-add-title">Ajouter un employe</h2>
              <p className="ge-add-desc">Remplissez les informations pour creer un nouvel employe.</p>

              <form onSubmit={handleCreateEmployee} className="ge-add-form">
                <div className="ge-form-row">
                  <div className="ge-form-group">
                    <label htmlFor="ge-firstname">Prenom *</label>
                    <input
                      id="ge-firstname"
                      type="text"
                      value={formFirstName}
                      onChange={(e) => setFormFirstName(e.target.value)}
                      placeholder="Marie"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="ge-form-group">
                    <label htmlFor="ge-lastname">Nom *</label>
                    <input
                      id="ge-lastname"
                      type="text"
                      value={formLastName}
                      onChange={(e) => setFormLastName(e.target.value)}
                      placeholder="Dupont"
                      required
                    />
                  </div>
                </div>

                <div className="ge-form-row">
                  <div className="ge-form-group">
                    <label htmlFor="ge-email">Email professionnel</label>
                    <input
                      id="ge-email"
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="marie.dupont@pharmacie.fr"
                    />
                    <p className="ge-form-hint">
                      Requis pour envoyer une invitation au portail employe
                    </p>
                  </div>
                  <div className="ge-form-group">
                    <label htmlFor="ge-phone">Telephone</label>
                    <input
                      id="ge-phone"
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(formatPhone(e.target.value))}
                      placeholder="06 12 34 56 78"
                    />
                    <p className="ge-form-hint">
                      Format francais : 06 12 34 56 78
                    </p>
                  </div>
                </div>

                <div className="ge-form-row">
                  <div className="ge-form-group">
                    <label htmlFor="ge-role">Role *</label>
                    <select
                      id="ge-role"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      required
                    >
                      {DB_ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ge-form-group">
                    <label htmlFor="ge-hours">Heures/semaine</label>
                    <input
                      id="ge-hours"
                      type="number"
                      value={formContractHours}
                      onChange={(e) => setFormContractHours(Number(e.target.value))}
                      min={1}
                      max={48}
                    />
                  </div>
                </div>

                {formEmail.trim() && (
                  <div className="ge-invitation-box">
                    <label className="ge-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formSendInvitation}
                        onChange={(e) => setFormSendInvitation(e.target.checked)}
                      />
                      <span className="ge-checkbox-text">
                        Envoyer un email d&apos;invitation
                      </span>
                    </label>
                    <p className="ge-invitation-hint">
                      L&apos;employe recevra un email avec un lien pour activer son compte
                      et definir son mot de passe. Le lien expire dans 7 jours.
                    </p>
                  </div>
                )}

                {formError && (
                  <div className="ge-form-error">{formError}</div>
                )}

                <div className="ge-form-actions">
                  <button
                    type="button"
                    className="ge-btn ge-btn--outline"
                    onClick={() => { resetForm(); setActiveTab('liste'); }}
                    disabled={submitting}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="ge-btn ge-btn--primary"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <span className="ge-mini-spinner" />
                        Creation...
                      </>
                    ) : (
                      formSendInvitation && formEmail.trim()
                        ? 'Creer et inviter'
                        : 'Creer l\'employe'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        /* ═══════════════════════════════════
           GESTION EQUIPE — ge- prefix
           ═══════════════════════════════════ */

        .ge-page {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ge-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          min-height: 400px;
          color: var(--color-neutral-500);
        }

        /* ─── Header ─── */
        .ge-header {
          background: white;
          border-radius: var(--radius-lg);
          padding: 20px;
          border: 1px solid var(--color-neutral-200);
        }

        .ge-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .ge-title {
          font-size: 20px;
          font-weight: 700;
          margin: 0;
          color: var(--color-neutral-900);
        }

        .ge-subtitle {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--color-neutral-500);
        }

        /* ─── Buttons ─── */
        .ge-btn {
          padding: 8px 16px;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .ge-btn--primary {
          background: var(--color-primary-600);
          color: white;
        }

        .ge-btn--primary:hover:not(:disabled) {
          background: var(--color-primary-700);
        }

        .ge-btn--primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ge-btn--outline {
          background: white;
          color: var(--color-neutral-600);
          border: 1px solid var(--color-neutral-300);
        }

        .ge-btn--outline:hover {
          background: var(--color-neutral-50);
          border-color: var(--color-neutral-400);
        }

        .ge-btn--sm {
          padding: 5px 10px;
          font-size: 12px;
        }

        /* ─── Tabs ─── */
        .ge-tabs {
          display: flex;
          gap: 4px;
          border-top: 1px solid var(--color-neutral-100);
          padding-top: 12px;
        }

        .ge-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-500);
          cursor: pointer;
          transition: all 0.15s;
        }

        .ge-tab:hover {
          background: var(--color-neutral-50);
          color: var(--color-neutral-700);
        }

        .ge-tab--active {
          background: var(--color-primary-50);
          color: var(--color-primary-700);
        }

        .ge-tab--active:hover {
          background: var(--color-primary-100);
        }

        .ge-tab-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ─── Filters ─── */
        .ge-filters {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          background: white;
          padding: 12px 16px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-neutral-200);
        }

        .ge-search-wrap {
          position: relative;
          flex: 1;
          max-width: 280px;
          min-width: 180px;
        }

        .ge-search-wrap .ge-search-icon-svg {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: var(--color-neutral-400);
        }

        .ge-search {
          width: 100%;
          padding: 7px 30px 7px 32px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          color: var(--color-neutral-700);
        }

        .ge-search:focus {
          outline: none;
          border-color: var(--color-primary-400);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
        }

        .ge-search-clear {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          padding: 4px;
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--color-neutral-400);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ge-search-clear:hover { color: var(--color-neutral-600); }

        .ge-filter-select {
          padding: 7px 12px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          color: var(--color-neutral-700);
          background: white;
          cursor: pointer;
        }

        .ge-count {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-500);
          white-space: nowrap;
        }

        .ge-export-btns {
          display: flex;
          gap: 6px;
          margin-left: auto;
        }

        /* ─── Table ─── */
        .ge-table-wrap {
          background: white;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-neutral-200);
          overflow: hidden;
        }

        .ge-table {
          width: 100%;
          border-collapse: collapse;
        }

        .ge-th {
          padding: 10px 14px;
          text-align: left;
          font-size: 11px;
          font-weight: 700;
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: var(--color-neutral-50);
          border-bottom: 2px solid var(--color-neutral-200);
          white-space: nowrap;
        }

        .ge-th--sortable {
          cursor: pointer;
          user-select: none;
          transition: color 0.15s;
        }

        .ge-th--sortable:hover { color: var(--color-neutral-800); }

        .ge-row {
          border-bottom: 1px solid var(--color-neutral-100);
          transition: background 0.1s;
        }

        .ge-row:hover { background: var(--color-neutral-50); }

        .ge-td {
          padding: 10px 14px;
          font-size: 13px;
          color: var(--color-neutral-700);
          vertical-align: middle;
        }

        /* Employee cell */
        .ge-emp-cell {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ge-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 12px;
          flex-shrink: 0;
        }

        .ge-avatar--sm {
          width: 40px;
          height: 40px;
          font-size: 14px;
        }

        .ge-emp-info { min-width: 0; }

        .ge-emp-name {
          display: block;
          font-weight: 600;
          color: var(--color-neutral-900);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ge-emp-email {
          display: block;
          font-size: 11px;
          color: var(--color-neutral-400);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }

        /* Role badge */
        .ge-role-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          font-size: 11px;
          font-weight: 600;
          background: white;
          border: 1px solid;
          white-space: nowrap;
        }

        /* Phone */
        .ge-phone {
          font-size: 12px;
          color: var(--color-neutral-600);
          white-space: nowrap;
        }

        /* Horaires summary */
        .ge-hf-summary {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ge-hf-days {
          display: flex;
          gap: 3px;
        }

        .ge-hf-day {
          width: 28px;
          height: 20px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-weight: 700;
          background: var(--color-neutral-100);
          color: var(--color-neutral-400);
        }

        .ge-hf-day--active {
          background: rgba(99, 102, 241, 0.12);
          color: #6366f1;
        }

        .ge-hf-hours {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-neutral-500);
        }

        .ge-hf-empty {
          font-size: 12px;
          color: var(--color-neutral-400);
          font-style: italic;
        }

        /* Contract */
        .ge-contract {
          font-weight: 600;
          color: var(--color-neutral-700);
          display: block;
        }

        .ge-contract-type {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-primary-600);
          display: block;
          margin-top: 2px;
        }

        /* Status badges */
        .ge-status-badge {
          padding: 3px 10px;
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .ge-status-active { background: #d1fae5; color: #065f46; }
        .ge-status-pending { background: #fef3c7; color: #92400e; }
        .ge-status-suspended { background: #fee2e2; color: #991b1b; }
        .ge-status-deactivated { background: #f3f4f6; color: #6b7280; }
        .ge-status-none { background: #f1f5f9; color: #94a3b8; }

        /* Actions */
        .ge-actions-cell {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .ge-action-btn {
          padding: 5px 10px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          font-weight: 600;
          border: 1px solid var(--color-neutral-300);
          background: white;
          color: var(--color-neutral-600);
          cursor: pointer;
          transition: all 0.15s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          font-family: var(--font-family-primary);
        }

        .ge-action-btn:hover {
          border-color: var(--color-primary-400);
          color: var(--color-primary-600);
          background: var(--color-primary-50);
        }

        .ge-action-btn--resend {
          border-color: #3b82f6;
          color: #3b82f6;
        }

        .ge-action-btn--resend:hover:not(:disabled) {
          background: #3b82f6;
          color: white;
        }

        .ge-action-btn--resend:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ge-mini-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: gespin 0.8s linear infinite;
          display: inline-block;
        }

        @keyframes gespin { to { transform: rotate(360deg); } }

        /* Empty */
        .ge-empty {
          padding: 48px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .ge-empty-text {
          font-size: 14px;
          color: var(--color-neutral-500);
        }

        /* ═══ HORAIRES FIXES TAB ═══ */

        .ge-hf-header {
          display: flex;
          align-items: center;
          gap: 16px;
          background: white;
          padding: 14px 18px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-neutral-200);
          flex-wrap: wrap;
        }

        .ge-hf-selector {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 200px;
        }

        .ge-hf-selector-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-600);
          white-space: nowrap;
        }

        .ge-hf-employee-select {
          flex: 1;
          padding: 7px 12px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          color: var(--color-neutral-700);
          background: white;
          cursor: pointer;
          min-width: 220px;
        }

        .ge-hf-emp-badge {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 200px;
        }

        .ge-hf-emp-name {
          display: block;
          font-size: 14px;
          font-weight: 700;
          color: var(--color-neutral-900);
        }

        .ge-hf-emp-meta {
          display: block;
          font-size: 12px;
          color: var(--color-neutral-500);
          margin-top: 1px;
        }

        .ge-hf-actions {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }

        /* Instructions */
        .ge-hf-instructions {
          display: flex;
          gap: 12px;
          background: rgba(59, 130, 246, 0.06);
          border-left: 3px solid #3b82f6;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          align-items: flex-start;
        }

        .ge-hf-instructions-icon {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .ge-hf-instructions strong {
          display: block;
          font-size: 13px;
          color: #1e40af;
          margin-bottom: 2px;
        }

        .ge-hf-instructions span {
          font-size: 12px;
          color: #3b82f6;
        }

        /* Presets */
        .ge-hf-presets {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: white;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-neutral-200);
          flex-wrap: wrap;
        }

        .ge-hf-presets-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-500);
        }

        .ge-hf-preset-btn {
          padding: 5px 12px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--color-neutral-300);
          background: white;
          font-family: var(--font-family-primary);
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-600);
          cursor: pointer;
          transition: all 0.15s;
        }

        .ge-hf-preset-btn:hover:not(:disabled) {
          border-color: var(--color-primary-400);
          color: var(--color-primary-600);
          background: var(--color-primary-50);
        }

        .ge-hf-preset-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .ge-hf-presets-hint {
          font-size: 11px;
          color: var(--color-neutral-400);
          font-style: italic;
        }

        /* Grid */
        .ge-hf-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }

        .ge-hf-day-card {
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: 14px;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
        }

        .ge-hf-day-card--empty { border-style: dashed; }

        .ge-hf-day-card--filled {
          background: rgba(99, 102, 241, 0.03);
          border-color: var(--color-primary-300);
        }

        .ge-hf-day-card--selected {
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
          border-color: var(--color-primary-500);
        }

        .ge-hf-day-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        .ge-hf-day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .ge-hf-day-label {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-neutral-900);
        }

        .ge-hf-day-remove {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: none;
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .ge-hf-day-remove:hover {
          background: #ef4444;
          color: white;
        }

        /* Day content */
        .ge-hf-day-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ge-hf-time-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .ge-hf-time-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .ge-hf-time-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .ge-hf-time-input {
          padding: 6px 8px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-sm);
          font-family: var(--font-family-primary);
          font-size: 14px;
          font-weight: 700;
          color: var(--color-neutral-900);
          text-align: center;
          width: 100%;
        }

        .ge-hf-time-input:focus {
          outline: none;
          border-color: var(--color-primary-400);
        }

        .ge-hf-time-sep {
          color: var(--color-neutral-300);
          font-size: 14px;
          padding-bottom: 6px;
          font-weight: 600;
        }

        .ge-hf-break-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ge-hf-break-select {
          flex: 1;
          padding: 5px 8px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-sm);
          font-family: var(--font-family-primary);
          font-size: 12px;
          color: var(--color-neutral-700);
          cursor: pointer;
        }

        .ge-hf-day-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
        }

        .ge-hf-duration {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-primary-600);
        }

        .ge-hf-copy-btn {
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          border: 1px solid #10b981;
          background: white;
          font-family: var(--font-family-primary);
          font-size: 11px;
          font-weight: 600;
          color: #10b981;
          cursor: pointer;
          transition: all 0.15s;
        }

        .ge-hf-copy-btn:hover {
          background: #10b981;
          color: white;
        }

        /* Empty day */
        .ge-hf-day-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 0;
          gap: 6px;
        }

        .ge-hf-add-text {
          font-size: 11px;
          color: var(--color-neutral-400);
        }

        /* Stats */
        .ge-hf-stats {
          display: flex;
          gap: 24px;
          padding: 12px 16px;
          background: white;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-neutral-200);
          flex-wrap: wrap;
        }

        .ge-hf-stat {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ge-hf-stat-label {
          font-size: 12px;
          color: var(--color-neutral-500);
        }

        .ge-hf-stat-value {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-primary-600);
        }

        .ge-hf-stat--over { color: var(--color-warning-600); }
        .ge-hf-stat--under { color: var(--color-secondary-600); }

        /* Warning */
        .ge-hf-warning {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #fef3c7;
          color: #92400e;
          padding: 10px 20px;
          border-radius: var(--radius-md);
          border: 2px solid #fbbf24;
          font-size: 13px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          z-index: 100;
          animation: ge-slide-up 0.3s ease;
        }

        @keyframes ge-slide-up {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        /* ═══ AJOUTER TAB ═══ */

        .ge-add-form-wrap {
          background: white;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-neutral-200);
          padding: 24px;
          max-width: 640px;
        }

        .ge-add-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 4px;
          color: var(--color-neutral-900);
        }

        .ge-add-desc {
          font-size: 13px;
          color: var(--color-neutral-500);
          margin: 0 0 20px;
        }

        .ge-add-form {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ge-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .ge-form-group {
          margin-bottom: 12px;
        }

        .ge-form-group label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-700);
          margin-bottom: 6px;
        }

        .ge-form-group input,
        .ge-form-group select {
          width: 100%;
          padding: 9px 12px;
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          transition: all 0.15s;
          box-sizing: border-box;
          background: white;
        }

        .ge-form-group input:focus,
        .ge-form-group select:focus {
          outline: none;
          border-color: var(--color-primary-400);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .ge-form-hint {
          margin: 4px 0 0;
          font-size: 12px;
          color: var(--color-neutral-400);
        }

        /* Invitation */
        .ge-invitation-box {
          background: var(--color-neutral-50);
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          padding: 14px;
          margin-bottom: 12px;
        }

        .ge-checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .ge-checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--color-primary-500);
        }

        .ge-checkbox-text {
          font-weight: 600;
          color: var(--color-neutral-800);
          font-size: 13px;
        }

        .ge-invitation-hint {
          margin: 8px 0 0 28px;
          font-size: 12px;
          color: var(--color-neutral-500);
          line-height: 1.5;
        }

        /* Error */
        .ge-form-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          margin-bottom: 12px;
          font-size: 13px;
          font-weight: 500;
        }

        /* Actions */
        .ge-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 8px;
          border-top: 1px solid var(--color-neutral-100);
        }

        /* ═══ RESPONSIVE ═══ */
        @media (max-width: 1024px) {
          .ge-header-top {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .ge-filters {
            flex-wrap: wrap;
          }

          .ge-search-wrap {
            max-width: none;
            min-width: 0;
          }

          .ge-hf-header {
            flex-direction: column;
            align-items: stretch;
          }

          .ge-hf-actions {
            margin-left: 0;
          }
        }

        @media (max-width: 768px) {
          .ge-tabs {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .ge-table-wrap {
            overflow-x: auto;
          }

          .ge-table {
            min-width: 800px;
          }

          .ge-hf-grid {
            grid-template-columns: 1fr;
          }

          .ge-hf-stats {
            flex-direction: column;
            gap: 8px;
          }

          .ge-form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
