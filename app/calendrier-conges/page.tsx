/**
 * Page Calendrier des Congés
 *
 * CRUD complet sur la table leave_requests via API Route.
 * Vue liste par mois, modal création/édition, actions approve/reject.
 *
 * styled-jsx uniquement, CSS variables, pas d'emojis.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import {
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  getEmployees,
} from '@/lib/supabase/queries';
import type { LeaveRequest } from '@/lib/supabase/queries';
import type { Employee } from '@/lib/types';
import { toISODateString } from '@/lib/utils/dateUtils';
import Modal from '@/components/ui/Modal';
import Link from 'next/link';

// ─── Types & constantes ───

const LEAVE_TYPES: Record<string, string> = {
  conge_paye: 'Congé payé',
  rtt: 'RTT',
  maladie: 'Maladie',
  sans_solde: 'Sans solde',
  formation: 'Formation',
  autre: 'Autre',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Refusé',
  cancelled: 'Annulé',
};

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

interface FormData {
  employeeId: string;
  startDate: string;
  endDate: string;
  type: string;
  notes: string;
}

const INITIAL_FORM: FormData = {
  employeeId: '',
  startDate: '',
  endDate: '',
  type: 'conge_paye',
  notes: '',
};

// ─── Helpers ───

function countBusinessDays(start: string, end: string): number {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  let count = 0;
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function getEmployeeName(emp: Employee): string {
  return `${emp.first_name} ${emp.last_name}`;
}

// ─── Composant ───

export default function CalendrierCongesPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();

  // Navigation mois
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  // Données
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Filtre statut
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dates du mois pour filtrage
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const nextMonth = month === 11 ? `${year + 1}-01-01` : `${year}-${String(month + 2).padStart(2, '0')}-01`;
  const lastDay = new Date(new Date(nextMonth + 'T12:00:00').getTime() - 86400000);
  const monthEnd = toISODateString(lastDay);

  // ─── Chargement ───

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    try {
      const [leaves, emps] = await Promise.all([
        getLeaveRequests(organizationId, monthStart, monthEnd),
        getEmployees(organizationId),
      ]);
      setLeaveRequests(leaves);
      setEmployees(emps);
    } catch (error) {
      console.error('Erreur chargement congés:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, monthStart, monthEnd]);

  useEffect(() => {
    if (!orgLoading && organizationId) loadData();
  }, [orgLoading, organizationId, loadData]);

  // ─── Navigation mois ───

  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // ─── Données filtrées ───

  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const emp of employees) map.set(emp.id, emp);
    return map;
  }, [employees]);

  const filteredLeaves = useMemo(() => {
    if (statusFilter === 'all') return leaveRequests;
    return leaveRequests.filter((l) => l.status === statusFilter);
  }, [leaveRequests, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = leaveRequests.length;
    const pending = leaveRequests.filter((l) => l.status === 'pending').length;
    const approved = leaveRequests.filter((l) => l.status === 'approved').length;
    const totalDays = leaveRequests
      .filter((l) => l.status === 'approved')
      .reduce((sum, l) => sum + (l.business_days || 0), 0);
    return { total, pending, approved, totalDays };
  }, [leaveRequests]);

  // ─── CRUD handlers ───

  const openCreate = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (leave: LeaveRequest) => {
    setEditingId(leave.id);
    setFormData({
      employeeId: leave.employee_id,
      startDate: leave.start_date,
      endDate: leave.end_date,
      type: leave.type,
      notes: leave.notes || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    // Validation
    if (!formData.employeeId || !formData.startDate || !formData.endDate) {
      setFormError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (formData.endDate < formData.startDate) {
      setFormError('La date de fin doit être après la date de début.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const businessDays = countBusinessDays(formData.startDate, formData.endDate);

      if (editingId) {
        await updateLeaveRequest(editingId, {
          start_date: formData.startDate,
          end_date: formData.endDate,
          type: formData.type,
          business_days: businessDays,
          notes: formData.notes,
        });
      } else {
        await createLeaveRequest(organizationId, {
          employee_id: formData.employeeId,
          start_date: formData.startDate,
          end_date: formData.endDate,
          type: formData.type,
          business_days: businessDays,
          notes: formData.notes,
        });
      }

      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Erreur soumission:', error);
      setFormError('Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    await updateLeaveRequest(id, { status: 'approved' });
    loadData();
  };

  const handleReject = async (id: string) => {
    await updateLeaveRequest(id, { status: 'rejected' });
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette demande de congé ?')) return;
    await deleteLeaveRequest(id);
    loadData();
  };

  // ─── Rendu ───

  if (orgLoading || (isLoading && leaveRequests.length === 0 && employees.length === 0)) {
    return (
      <>
        <div className="loading-page">
          <span className="loading-spinner" />
          <span>Chargement des congés...</span>
        </div>
        <style jsx>{`
          .loading-page {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: var(--spacing-3); height: 400px; color: var(--color-neutral-500);
          }
          .loading-spinner {
            width: 36px; height: 36px; border: 3px solid var(--color-neutral-200);
            border-top-color: var(--color-primary-500); border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div className="conges-page">
        {/* ─── Header ─── */}
        <section className="page-header">
          <div className="header-left">
            <Link href="/" className="back-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Tableau de bord
            </Link>
            <h1 className="page-title">Calendrier des Congés</h1>
            <p className="page-subtitle">Gestion des demandes de congés et absences</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-primary" onClick={openCreate}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nouvelle demande
            </button>
          </div>
        </section>

        {/* ─── Navigation mois ─── */}
        <section className="month-navigation">
          <button type="button" className="month-nav-btn" onClick={handlePrevMonth}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h2 className="month-title">{MONTH_NAMES[month]} {year}</h2>
          <button type="button" className="month-nav-btn" onClick={handleNextMonth}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </section>

        {/* ─── Stats ─── */}
        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Demandes ce mois</span>
          </div>
          <div className="stat-card">
            <span className="stat-value stat-value--warning">{stats.pending}</span>
            <span className="stat-label">En attente</span>
          </div>
          <div className="stat-card">
            <span className="stat-value stat-value--good">{stats.approved}</span>
            <span className="stat-label">Approuvées</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.totalDays}j</span>
            <span className="stat-label">Jours validés</span>
          </div>
        </section>

        {/* ─── Filtre statut ─── */}
        <section className="filter-bar">
          {['all', 'pending', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              type="button"
              className={`filter-btn ${statusFilter === s ? 'filter-btn--active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'Tous' : STATUS_LABELS[s]}
              {s === 'pending' && stats.pending > 0 && (
                <span className="filter-count">{stats.pending}</span>
              )}
            </button>
          ))}
        </section>

        {/* ─── Liste ─── */}
        <section className="content-section">
          {filteredLeaves.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p className="empty-text">
                {statusFilter === 'all'
                  ? `Aucune demande de congé pour ${MONTH_NAMES[month]} ${year}`
                  : `Aucune demande avec le statut "${STATUS_LABELS[statusFilter]}"`}
              </p>
            </div>
          ) : (
            <div className="leaves-list">
              {filteredLeaves.map((leave) => {
                const emp = employeeMap.get(leave.employee_id);
                const empName = emp ? getEmployeeName(emp) : 'Employé inconnu';
                return (
                  <div key={leave.id} className="leave-card">
                    <div className="leave-main">
                      <div className="leave-employee">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        <span className="emp-name">{empName}</span>
                        {emp && <span className="emp-category">{emp.category}</span>}
                      </div>
                      <div className="leave-info">
                        <span className="leave-dates">
                          {new Date(leave.start_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          {' \u2192 '}
                          {new Date(leave.end_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="leave-days">{leave.business_days || 0} jour{(leave.business_days || 0) !== 1 ? 's' : ''} ouvré{(leave.business_days || 0) !== 1 ? 's' : ''}</span>
                        <span className={`leave-type type-${leave.type}`}>{LEAVE_TYPES[leave.type] || leave.type}</span>
                      </div>
                      {leave.notes && <p className="leave-notes">{leave.notes}</p>}
                    </div>
                    <div className="leave-actions">
                      <span className={`status-badge status-${leave.status}`}>{STATUS_LABELS[leave.status] || leave.status}</span>
                      <div className="action-buttons">
                        {leave.status === 'pending' && (
                          <>
                            <button type="button" className="action-btn action-btn--approve" onClick={() => handleApprove(leave.id)} title="Approuver">
                              {'\u2713'}
                            </button>
                            <button type="button" className="action-btn action-btn--reject" onClick={() => handleReject(leave.id)} title="Refuser">
                              {'\u2717'}
                            </button>
                          </>
                        )}
                        <button type="button" className="action-btn action-btn--edit" onClick={() => openEdit(leave)} title="Modifier">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button type="button" className="action-btn action-btn--delete" onClick={() => handleDelete(leave.id)} title="Supprimer">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ─── Modal Création / Édition ─── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Modifier la demande' : 'Nouvelle demande de congé'}
        size="md"
        footer={
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="btn-submit"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Enregistrement...' : editingId ? 'Modifier' : 'Créer'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="leave-form">
          {formError && <div className="form-error">{formError}</div>}

          <div className="form-group">
            <label htmlFor="leave-employee" className="form-label">Employé *</label>
            <select
              id="leave-employee"
              className="form-select"
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              disabled={!!editingId}
            >
              <option value="">Sélectionner un employé</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {getEmployeeName(emp)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="leave-start" className="form-label">Date de début *</label>
              <input
                id="leave-start"
                type="date"
                className="form-input"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label htmlFor="leave-end" className="form-label">Date de fin *</label>
              <input
                id="leave-end"
                type="date"
                className="form-input"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          {formData.startDate && formData.endDate && formData.endDate >= formData.startDate && (
            <div className="form-info">
              {countBusinessDays(formData.startDate, formData.endDate)} jours ouvrés
            </div>
          )}

          <div className="form-group">
            <label htmlFor="leave-type" className="form-label">Type de congé</label>
            <select
              id="leave-type"
              className="form-select"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              {Object.entries(LEAVE_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="leave-notes" className="form-label">Notes</label>
            <textarea
              id="leave-notes"
              className="form-textarea"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Motif, commentaire..."
            />
          </div>
        </form>
      </Modal>

      <style jsx>{`
        .conges-page { display: flex; flex-direction: column; gap: var(--spacing-6); max-width: 1100px; }

        /* ─── Header ─── */
        .page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-3); }
        .header-left { display: flex; flex-direction: column; gap: var(--spacing-1); }
        .header-left :global(.back-link) {
          display: inline-flex; align-items: center; gap: var(--spacing-1);
          font-size: var(--font-size-xs); color: var(--color-primary-600);
          text-decoration: none; margin-bottom: var(--spacing-2);
        }
        .header-left :global(.back-link:hover) { color: var(--color-primary-700); }
        .page-title { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); color: var(--color-neutral-900); margin: 0; }
        .page-subtitle { font-size: var(--font-size-sm); color: var(--color-neutral-500); margin: 0; }

        .btn-primary {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4); background: var(--color-primary-600);
          border: 1px solid var(--color-primary-600); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold); color: white;
          cursor: pointer; transition: all 0.15s ease;
        }
        .btn-primary:hover { background: var(--color-primary-700); }

        /* ─── Month nav ─── */
        .month-navigation {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg);
        }
        .month-nav-btn {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          cursor: pointer; color: var(--color-neutral-600); transition: all 0.15s ease;
        }
        .month-nav-btn:hover { background: var(--color-neutral-50); border-color: var(--color-neutral-300); }
        .month-title { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-neutral-900); margin: 0; }

        /* ─── Stats ─── */
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-4); }
        .stat-card {
          display: flex; flex-direction: column; align-items: center; gap: var(--spacing-1);
          padding: var(--spacing-4); background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
        }
        .stat-value { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-primary-600); }
        .stat-value--warning { color: var(--color-warning-500); }
        .stat-value--good { color: var(--color-success-600); }
        .stat-label { font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); color: var(--color-neutral-500); }

        /* ─── Filtre ─── */
        .filter-bar { display: flex; gap: var(--spacing-2); }
        .filter-btn {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium); color: var(--color-neutral-600);
          cursor: pointer; transition: all 0.15s ease;
        }
        .filter-btn:hover { border-color: var(--color-neutral-300); }
        .filter-btn--active { background: var(--color-primary-600); border-color: var(--color-primary-600); color: white; }
        .filter-count {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 20px; height: 20px; padding: 0 4px;
          background: rgba(255,255,255,0.2); border-radius: var(--radius-full);
          font-size: 11px; font-weight: var(--font-weight-bold);
        }

        /* ─── Content ─── */
        .content-section {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); padding: var(--spacing-5);
        }
        .empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-3); padding: var(--spacing-8); text-align: center; }
        .empty-text { font-size: var(--font-size-sm); color: var(--color-neutral-500); margin: 0; }

        /* ─── Leave cards ─── */
        .leaves-list { display: flex; flex-direction: column; gap: var(--spacing-3); }
        .leave-card {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: var(--spacing-4); border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md); transition: all 0.15s ease; gap: var(--spacing-4);
        }
        .leave-card:hover { border-color: var(--color-primary-200); box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .leave-main { flex: 1; display: flex; flex-direction: column; gap: var(--spacing-2); min-width: 0; }
        .leave-employee { display: flex; align-items: center; gap: var(--spacing-2); color: var(--color-neutral-600); }
        .emp-name { font-weight: var(--font-weight-semibold); color: var(--color-neutral-800); font-size: var(--font-size-sm); }
        .emp-category {
          padding: 1px 8px; background: var(--color-neutral-100); border-radius: var(--radius-sm);
          font-size: 11px; color: var(--color-neutral-600);
        }
        .leave-info { display: flex; align-items: center; gap: var(--spacing-3); flex-wrap: wrap; }
        .leave-dates { font-weight: var(--font-weight-bold); font-size: var(--font-size-sm); color: var(--color-neutral-900); }
        .leave-days { font-size: var(--font-size-xs); color: var(--color-neutral-500); }
        .leave-type {
          padding: 2px 10px; border-radius: var(--radius-full);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
          background: var(--color-neutral-100); color: var(--color-neutral-700);
        }
        .type-conge_paye { background: var(--color-primary-50); color: var(--color-primary-700); }
        .type-rtt { background: #ede9fe; color: #7c3aed; }
        .type-maladie { background: var(--color-danger-50); color: var(--color-danger-700); }
        .type-formation { background: var(--color-warning-50); color: var(--color-warning-700); }
        .leave-notes { font-size: var(--font-size-xs); color: var(--color-neutral-400); font-style: italic; margin: 0; }

        .leave-actions { display: flex; flex-direction: column; align-items: flex-end; gap: var(--spacing-2); flex-shrink: 0; }
        .status-badge {
          padding: 4px 12px; border-radius: var(--radius-full);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-bold);
          white-space: nowrap;
        }
        .status-pending { background: var(--color-warning-100); color: var(--color-warning-700); }
        .status-approved { background: var(--color-primary-100); color: var(--color-primary-700); }
        .status-rejected { background: var(--color-danger-100); color: var(--color-danger-700); }
        .status-cancelled { background: var(--color-neutral-100); color: var(--color-neutral-600); }

        .action-buttons { display: flex; gap: var(--spacing-1); }
        .action-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md); background: white; cursor: pointer;
          font-size: 14px; transition: all 0.15s ease; color: var(--color-neutral-500);
        }
        .action-btn:hover { border-color: var(--color-neutral-300); }
        .action-btn--approve:hover { background: var(--color-primary-50); color: var(--color-primary-600); border-color: var(--color-primary-300); }
        .action-btn--reject:hover { background: var(--color-danger-50); color: var(--color-danger-500); border-color: var(--color-danger-300); }
        .action-btn--edit:hover { background: var(--color-warning-50); color: var(--color-warning-600); border-color: var(--color-warning-300); }
        .action-btn--delete:hover { background: var(--color-danger-50); color: var(--color-danger-500); border-color: var(--color-danger-300); }

        /* ─── Modal form ─── */
        .leave-form { display: flex; flex-direction: column; gap: var(--spacing-4); }
        .form-error {
          padding: var(--spacing-3); background: var(--color-danger-50);
          border-left: 3px solid var(--color-danger-500); border-radius: var(--radius-sm);
          font-size: var(--font-size-sm); color: var(--color-danger-700);
        }
        .form-group { display: flex; flex-direction: column; gap: var(--spacing-1); }
        .form-label {
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600); text-transform: uppercase; letter-spacing: 0.03em;
        }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4); }
        .form-input, .form-select, .form-textarea {
          padding: var(--spacing-2) var(--spacing-3); border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md); font-family: var(--font-family-primary);
          font-size: var(--font-size-sm); color: var(--color-neutral-700); transition: border-color 0.15s ease;
          background: white;
        }
        .form-input:focus, .form-select:focus, .form-textarea:focus {
          outline: none; border-color: var(--color-primary-500); box-shadow: 0 0 0 2px var(--color-primary-100);
        }
        .form-textarea { resize: vertical; min-height: 60px; }
        .form-info {
          padding: var(--spacing-2) var(--spacing-3); background: var(--color-primary-50);
          border-radius: var(--radius-sm); font-size: var(--font-size-sm);
          color: var(--color-primary-700); font-weight: var(--font-weight-semibold);
        }

        .modal-actions { display: flex; gap: var(--spacing-3); width: 100%; justify-content: flex-end; }
        .btn-cancel {
          padding: var(--spacing-2) var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium); color: var(--color-neutral-600);
          cursor: pointer; transition: all 0.15s ease;
        }
        .btn-cancel:hover { background: var(--color-neutral-50); }
        .btn-submit {
          padding: var(--spacing-2) var(--spacing-4); background: var(--color-primary-600);
          border: 1px solid var(--color-primary-600); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold); color: white;
          cursor: pointer; transition: all 0.15s ease;
        }
        .btn-submit:hover:not(:disabled) { background: var(--color-primary-700); }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .page-header { flex-direction: column; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .filter-bar { flex-wrap: wrap; }
          .leave-card { flex-direction: column; }
          .leave-actions { flex-direction: row; align-items: center; width: 100%; justify-content: space-between; }
          .form-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
