'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import { getEmployees } from '@/lib/supabase/queries';
import type { Employee, EmployeeCategory } from '@/lib/types';
import { toast } from 'sonner';

/** Labels francais des categories */
const CATEGORY_LABELS: Record<EmployeeCategory, string> = {
  pharmacien_titulaire: 'Pharmacien Titulaire',
  pharmacien_adjoint: 'Pharmacien Adjoint',
  preparateur: 'Preparateur',
  rayonniste: 'Rayonniste',
  apprenti: 'Apprenti',
  etudiant: 'Etudiant',
};

/** Couleurs des pastilles par categorie */
const CATEGORY_COLORS: Record<EmployeeCategory, string> = {
  pharmacien_titulaire: '#2563eb',
  pharmacien_adjoint: '#3b82f6',
  preparateur: '#10b981',
  rayonniste: '#f59e0b',
  apprenti: '#8b5cf6',
  etudiant: '#ec4899',
};

/** Ordre d'affichage des categories */
const CATEGORY_ORDER: EmployeeCategory[] = [
  'pharmacien_titulaire',
  'pharmacien_adjoint',
  'preparateur',
  'rayonniste',
  'apprenti',
  'etudiant',
];

/** Roles DB disponibles */
const DB_ROLES = [
  { value: 'Pharmacien', label: 'Pharmacien' },
  { value: 'Preparateur', label: 'Preparateur' },
  { value: 'Conditionneur', label: 'Rayonniste / Conditionneur' },
  { value: 'Apprenti', label: 'Apprenti' },
  { value: 'Etudiant', label: 'Etudiant' },
];

function getAccountStatusLabel(status: string | null): { label: string; className: string } {
  switch (status) {
    case 'active':
      return { label: 'Actif', className: 'status-active' };
    case 'pending':
      return { label: 'En attente', className: 'status-pending' };
    case 'suspended':
      return { label: 'Suspendu', className: 'status-suspended' };
    case 'deactivated':
      return { label: 'Desactive', className: 'status-deactivated' };
    default:
      return { label: 'Non invite', className: 'status-none' };
  }
}

export default function EmployesPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<EmployeeCategory | 'all'>('all');

  // Modal creation
  const [showModal, setShowModal] = useState(false);
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('Preparateur');
  const [formContractHours, setFormContractHours] = useState(35);
  const [formSendInvitation, setFormSendInvitation] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Resend state
  const [resendingId, setResendingId] = useState<string | null>(null);

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

  /** Employes groupes par categorie */
  const grouped = useMemo(() => {
    const filtered = filterCategory === 'all'
      ? employees
      : employees.filter(e => e.category === filterCategory);

    const groups: Partial<Record<EmployeeCategory, Employee[]>> = {};
    for (const emp of filtered) {
      if (!groups[emp.category]) groups[emp.category] = [];
      groups[emp.category]!.push(emp);
    }
    return groups;
  }, [employees, filterCategory]);

  /** Compteur par categorie */
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<EmployeeCategory, number>> = {};
    for (const emp of employees) {
      counts[emp.category] = (counts[emp.category] || 0) + 1;
    }
    return counts;
  }, [employees]);

  function resetForm() {
    setFormFirstName('');
    setFormLastName('');
    setFormEmail('');
    setFormRole('Preparateur');
    setFormContractHours(35);
    setFormSendInvitation(true);
    setFormError('');
  }

  async function handleCreateEmployee(e: React.FormEvent) {
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
        toast.success(`Employe cree et invitation envoyee a ${formEmail}`);
      } else if (data.invitationError) {
        toast.warning(`Employe cree mais erreur d'invitation: ${data.invitationError}`);
      } else {
        toast.success('Employe cree avec succes');
      }

      await loadEmployees();
      setShowModal(false);
      resetForm();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendInvitation(employeeId: string) {
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

      toast.success('Invitation renvoyee avec succes');
      await loadEmployees();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setResendingId(null);
    }
  }

  if (orgLoading || isLoading) {
    return (
      <>
        <div className="loading-state">
          <span className="loading-spinner" />
          <span className="loading-text">Chargement des employes...</span>
        </div>
        <style jsx>{`
          .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: var(--spacing-3);
            height: 300px;
            color: var(--color-neutral-500);
          }
          .loading-spinner {
            width: 32px;
            height: 32px;
            border: 3px solid var(--color-neutral-200);
            border-top-color: var(--color-primary-500);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          .loading-text {
            font-size: var(--font-size-sm);
            font-weight: var(--font-weight-medium);
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div className="employes-page">
        {/* En-tete */}
        <div className="page-header">
          <div className="header-left">
            <h1 className="page-title">Gestion des Employes</h1>
            <p className="page-subtitle">
              {employees.length} employe{employees.length > 1 ? 's' : ''} actif{employees.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            className="btn-add"
            onClick={() => setShowModal(true)}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Ajouter un employe
          </button>
        </div>

        {/* Filtres par categorie */}
        <div className="category-filters">
          <button
            className={`filter-chip ${filterCategory === 'all' ? 'filter-chip--active' : ''}`}
            onClick={() => setFilterCategory('all')}
            type="button"
          >
            Tous ({employees.length})
          </button>
          {CATEGORY_ORDER.map(cat => {
            const count = categoryCounts[cat] || 0;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                className={`filter-chip ${filterCategory === cat ? 'filter-chip--active' : ''}`}
                onClick={() => setFilterCategory(cat)}
                type="button"
              >
                <span
                  className="filter-dot"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                />
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            );
          })}
        </div>

        {/* Liste des employes */}
        {employees.length === 0 ? (
          <div className="empty-state-wrapper">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="empty-title">Aucun employe</h3>
            <p className="empty-desc">Ajoutez votre premier employe pour commencer.</p>
            <button className="btn-add-empty" onClick={() => setShowModal(true)} type="button">
              Ajouter un employe
            </button>
          </div>
        ) : (
          <div className="employees-grid">
            {CATEGORY_ORDER.map(cat => {
              const group = grouped[cat];
              if (!group || group.length === 0) return null;

              return (
                <div key={cat} className="category-section">
                  <div className="category-header">
                    <span
                      className="category-dot"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                    />
                    <h2 className="category-title">{CATEGORY_LABELS[cat]}</h2>
                    <span className="category-count">{group.length}</span>
                  </div>

                  <div className="employee-cards">
                    {group.map(emp => {
                      const status = getAccountStatusLabel(emp.account_status);
                      return (
                        <div key={emp.id} className="employee-card">
                          <div className="card-avatar" style={{ backgroundColor: CATEGORY_COLORS[emp.category] }}>
                            {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
                          </div>
                          <div className="card-info">
                            <div className="card-name">
                              {emp.first_name} {emp.last_name}
                            </div>
                            <div className="card-details">
                              <span className="card-contract">{emp.contract_type}</span>
                              <span className="card-separator">&middot;</span>
                              <span className="card-hours">{emp.contract_hours}h/sem</span>
                            </div>
                            {emp.email && (
                              <div className="card-email">{emp.email}</div>
                            )}
                          </div>
                          <div className="card-actions">
                            <span className={`status-badge ${status.className}`}>
                              {status.label}
                            </span>
                            {emp.account_status === 'pending' && emp.email && (
                              <button
                                className="resend-btn"
                                onClick={() => handleResendInvitation(emp.id)}
                                disabled={resendingId === emp.id}
                                title="Renvoyer l'invitation"
                                type="button"
                              >
                                {resendingId === emp.id ? (
                                  <span className="resend-spinner" />
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                  </svg>
                                )}
                                Renvoyer
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal creation employe */}
      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ajouter un employe</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }} type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="emp-firstname">Prenom *</label>
                  <input
                    id="emp-firstname"
                    type="text"
                    value={formFirstName}
                    onChange={(e) => setFormFirstName(e.target.value)}
                    placeholder="Marie"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="emp-lastname">Nom *</label>
                  <input
                    id="emp-lastname"
                    type="text"
                    value={formLastName}
                    onChange={(e) => setFormLastName(e.target.value)}
                    placeholder="Dupont"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="emp-email">Email professionnel</label>
                <input
                  id="emp-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="marie.dupont@pharmacie.fr"
                />
                <p className="form-hint">
                  Requis pour envoyer une invitation au portail employe
                </p>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="emp-role">Role *</label>
                  <select
                    id="emp-role"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    required
                  >
                    {DB_ROLES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="emp-hours">Heures/semaine</label>
                  <input
                    id="emp-hours"
                    type="number"
                    value={formContractHours}
                    onChange={(e) => setFormContractHours(Number(e.target.value))}
                    min={1}
                    max={48}
                  />
                </div>
              </div>

              {formEmail.trim() && (
                <div className="invitation-box">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formSendInvitation}
                      onChange={(e) => setFormSendInvitation(e.target.checked)}
                    />
                    <span className="checkbox-text">
                      Envoyer un email d&apos;invitation
                    </span>
                  </label>
                  <p className="invitation-hint">
                    L&apos;employe recevra un email avec un lien pour activer son compte
                    et definir son mot de passe. Le lien expire dans 7 jours.
                  </p>
                </div>
              )}

              {formError && (
                <div className="form-error">{formError}</div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  disabled={submitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="submit-spinner" />
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

      <style jsx>{`
        .employes-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-5);
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--spacing-3);
        }

        .page-title {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          margin: 0;
        }

        .page-subtitle {
          color: var(--color-neutral-500);
          font-size: var(--font-size-sm);
          margin: var(--spacing-1) 0 0;
        }

        .btn-add {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: var(--color-primary-500);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-add:hover {
          background: var(--color-primary-600);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);
        }

        /* ─── Filtres ─── */
        .category-filters {
          display: flex;
          flex-wrap: wrap;
          gap: var(--spacing-2);
        }

        .filter-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-full);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-600);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .filter-chip:hover {
          border-color: var(--color-primary-300);
          color: var(--color-primary-600);
        }

        .filter-chip--active {
          background: var(--color-primary-50);
          border-color: var(--color-primary-300);
          color: var(--color-primary-700);
          font-weight: var(--font-weight-semibold);
        }

        .filter-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* ─── Grille ─── */
        .employees-grid {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-6);
        }

        .category-section {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3);
        }

        .category-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .category-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .category-title {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-700);
          margin: 0;
        }

        .category-count {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-400);
          font-weight: var(--font-weight-medium);
        }

        .employee-cards {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: var(--spacing-3);
        }

        .employee-card {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          padding: var(--spacing-3) var(--spacing-4);
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          transition: all 0.15s ease;
        }

        .employee-card:hover {
          border-color: var(--color-primary-200);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .card-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 13px;
          font-weight: var(--font-weight-bold);
          flex-shrink: 0;
          text-transform: uppercase;
        }

        .card-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
          flex: 1;
        }

        .card-name {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-details {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        .card-separator {
          color: var(--color-neutral-300);
        }

        .card-email {
          font-size: 11px;
          color: var(--color-neutral-400);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-actions {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          flex-shrink: 0;
        }

        /* ─── Status Badges ─── */
        .status-badge {
          padding: 3px 10px;
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: var(--font-weight-bold);
          white-space: nowrap;
        }

        .status-active {
          background: #d1fae5;
          color: #065f46;
        }

        .status-pending {
          background: #fef3c7;
          color: #92400e;
        }

        .status-suspended {
          background: #fee2e2;
          color: #991b1b;
        }

        .status-deactivated {
          background: #f3f4f6;
          color: #6b7280;
        }

        .status-none {
          background: #f1f5f9;
          color: #94a3b8;
        }

        /* ─── Resend Button ─── */
        .resend-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: white;
          border: 1.5px solid #3b82f6;
          color: #3b82f6;
          border-radius: var(--radius-sm);
          font-family: var(--font-family-primary);
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .resend-btn:hover:not(:disabled) {
          background: #3b82f6;
          color: white;
        }

        .resend-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .resend-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid currentColor;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        /* ─── Empty State ─── */
        .empty-state-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: var(--spacing-12) var(--spacing-6);
          min-height: 300px;
        }

        .empty-title {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-700);
          margin: var(--spacing-4) 0 var(--spacing-2) 0;
        }

        .empty-desc {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
          margin: 0 0 var(--spacing-4) 0;
        }

        .btn-add-empty {
          padding: 10px 24px;
          background: var(--color-primary-500);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-add-empty:hover {
          background: var(--color-primary-600);
        }

        /* ─── Modal ─── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
          animation: fadeIn 0.15s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          background: white;
          border-radius: var(--radius-lg);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
          width: 100%;
          max-width: 540px;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.2s ease;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--color-neutral-200);
        }

        .modal-header h2 {
          margin: 0;
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
        }

        .modal-close {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: var(--color-neutral-400);
          border-radius: var(--radius-sm);
          transition: all 0.15s ease;
        }

        .modal-close:hover {
          background: var(--color-neutral-100);
          color: var(--color-neutral-600);
        }

        .modal-form {
          padding: 24px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-4);
        }

        .form-group {
          margin-bottom: var(--spacing-4);
        }

        .form-group label {
          display: block;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-700);
          margin-bottom: 6px;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px 14px;
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          transition: all 0.15s ease;
          box-sizing: border-box;
          background: white;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: var(--color-primary-400);
          box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
        }

        .form-hint {
          margin: 4px 0 0 0;
          font-size: 12px;
          color: var(--color-neutral-400);
        }

        /* ─── Invitation Box ─── */
        .invitation-box {
          background: var(--color-neutral-50);
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          padding: 16px;
          margin-bottom: var(--spacing-4);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--color-primary-500);
        }

        .checkbox-text {
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
          font-size: var(--font-size-sm);
        }

        .invitation-hint {
          margin: 8px 0 0 28px;
          font-size: 12px;
          color: var(--color-neutral-500);
          line-height: 1.5;
        }

        /* ─── Error ─── */
        .form-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          padding: 10px 14px;
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-4);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
        }

        /* ─── Modal Actions ─── */
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-3);
          padding-top: var(--spacing-2);
          border-top: 1px solid var(--color-neutral-100);
        }

        .btn-cancel {
          padding: 10px 20px;
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-600);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-cancel:hover {
          background: var(--color-neutral-50);
        }

        .btn-submit {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: var(--color-primary-500);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-submit:hover:not(:disabled) {
          background: var(--color-primary-600);
        }

        .btn-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .submit-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid white;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .page-header {
            flex-direction: column;
            align-items: stretch;
          }

          .btn-add {
            justify-content: center;
          }

          .employee-cards {
            grid-template-columns: 1fr;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .employee-card {
            flex-wrap: wrap;
          }

          .card-actions {
            flex-direction: row;
            width: 100%;
            justify-content: flex-start;
            margin-top: 4px;
            padding-top: 8px;
            border-top: 1px solid var(--color-neutral-100);
          }
        }
      `}</style>
    </>
  );
}
