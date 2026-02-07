'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import { getEmployees } from '@/lib/supabase/queries';
import { formatDate, parseISODate } from '@/lib/utils/dateUtils';
import type { Employee } from '@/lib/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from 'sonner';

type RequestType = 'leave' | 'shift_swap' | 'sick_leave' | 'other';
type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
type FilterStatus = 'all' | RequestStatus;

interface AppRequest {
  id: string;
  employee_id: string;
  organization_id: string;
  type: RequestType;
  status: RequestStatus;
  start_date: string;
  end_date: string | null;
  target_employee_id: string | null;
  target_employee_name?: string;
  reason: string | null;
  manager_comment: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<RequestType, string> = {
  leave: 'Conge',
  shift_swap: 'Echange shift',
  sick_leave: 'Arret maladie',
  other: 'Autre',
};

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'En attente',
  approved: 'Approuve',
  rejected: 'Refuse',
  cancelled: 'Annule',
};

export default function DemandesPage() {
  const { organizationId, user, isLoading: orgLoading } = useOrganization();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [requests, setRequests] = useState<AppRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>('leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const emps = await getEmployees(organizationId);
      setEmployees(emps);

      let empId = selectedEmployee;
      if (!empId && user?.email && emps.length > 0) {
        const match = emps.find(e => {
          const genEmail = `${(e.first_name || '').toLowerCase().replace(/\s/g, '')}@pharmacie-maurer.fr`;
          return genEmail === user.email;
        });
        empId = match ? match.id : emps[0].id;
        setSelectedEmployee(empId);
      }

      if (!empId) { setLoading(false); return; }

      // Fetch requests
      const params = new URLSearchParams({ organizationId, employeeId: empId });
      const res = await fetch(`/api/requests?${params.toString()}`);
      if (res.ok) {
        setRequests(await res.json());
      }
    } catch (err) {
      console.error('Erreur chargement demandes:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, selectedEmployee, user?.email]);

  useEffect(() => {
    if (!orgLoading && organizationId) fetchData();
  }, [orgLoading, organizationId, fetchData]);

  const otherEmployees = useMemo(() => {
    return employees.filter(e => e.id !== selectedEmployee);
  }, [employees, selectedEmployee]);

  const filteredRequests = useMemo(() => {
    if (filterStatus === 'all') return requests;
    return requests.filter(r => r.status === filterStatus);
  }, [requests, filterStatus]);

  const counts = useMemo(() => ({
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }), [requests]);

  function resetForm() {
    setRequestType('leave');
    setStartDate('');
    setEndDate('');
    setTargetEmployeeId('');
    setReason('');
  }

  async function handleSubmitRequest() {
    if (!selectedEmployee || !organizationId) return;

    if (!startDate) {
      toast.error('Date de debut requise');
      return;
    }
    if (requestType === 'shift_swap' && !targetEmployeeId) {
      toast.error('Veuillez selectionner un employe pour l\'echange');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          employeeId: selectedEmployee,
          type: requestType,
          startDate,
          endDate: endDate || startDate,
          targetEmployeeId: requestType === 'shift_swap' ? targetEmployeeId : null,
          reason: reason || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Erreur lors de l\'envoi');
        return;
      }

      toast.success('Demande envoyee avec succes');
      setShowModal(false);
      resetForm();
      await fetchData();
    } catch (err) {
      console.error('Erreur soumission demande:', err);
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelRequest(requestId: string) {
    try {
      const res = await fetch(`/api/requests?id=${encodeURIComponent(requestId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (!res.ok) {
        toast.error('Erreur lors de l\'annulation');
        return;
      }

      toast.success('Demande annulee');
      await fetchData();
    } catch {
      toast.error('Erreur lors de l\'annulation');
    }
  }

  if (orgLoading || (loading && employees.length === 0)) {
    return <LoadingSpinner size="lg" message="Chargement des demandes..." />;
  }

  return (
    <>
      <div className="demandes-page">
        <div className="page-header">
          <div className="header-left">
            <h1 className="page-title">Mes Demandes</h1>
            <select
              className="employee-select"
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
              ))}
            </select>
          </div>
          <button className="new-request-btn" onClick={() => setShowModal(true)} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nouvelle demande
          </button>
        </div>

        {/* Filters */}
        <div className="filters">
          {(['all', 'pending', 'approved', 'rejected'] as FilterStatus[]).map(st => (
            <button
              key={st}
              className={`filter-btn ${filterStatus === st ? 'active' : ''}`}
              onClick={() => setFilterStatus(st)}
              type="button"
            >
              {st === 'all' && `Toutes (${counts.all})`}
              {st === 'pending' && `En attente (${counts.pending})`}
              {st === 'approved' && `Approuvees (${counts.approved})`}
              {st === 'rejected' && `Refusees (${counts.rejected})`}
            </button>
          ))}
        </div>

        {/* Request list */}
        {filteredRequests.length === 0 ? (
          <EmptyState
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            title="Aucune demande"
            description={filterStatus === 'all' ? 'Vous n\'avez encore aucune demande.' : 'Aucune demande avec ce filtre.'}
            action={{ label: 'Nouvelle demande', onClick: () => setShowModal(true) }}
          />
        ) : (
          <div className="requests-list">
            {filteredRequests.map(req => (
              <div key={req.id} className="request-card">
                <div className="request-header">
                  <span className={`type-badge type-badge--${req.type}`}>
                    {TYPE_LABELS[req.type]}
                  </span>
                  <span className={`status-badge status-badge--${req.status}`}>
                    {STATUS_LABELS[req.status]}
                  </span>
                </div>

                <div className="request-body">
                  <div className="request-dates">
                    {formatDate(parseISODate(req.start_date), 'long')}
                    {req.end_date && req.end_date !== req.start_date && (
                      <> &rarr; {formatDate(parseISODate(req.end_date), 'long')}</>
                    )}
                  </div>
                  {req.target_employee_name && (
                    <div className="request-target">Echange avec : {req.target_employee_name}</div>
                  )}
                  {req.reason && <div className="request-reason">{req.reason}</div>}
                  {req.manager_comment && (
                    <div className="manager-comment">
                      <strong>Commentaire manager :</strong> {req.manager_comment}
                    </div>
                  )}
                </div>

                <div className="request-footer">
                  <span className="request-date">
                    Demande le {formatDate(new Date(req.created_at), 'medium')}
                  </span>
                  {req.status === 'pending' && (
                    <button
                      className="cancel-btn"
                      onClick={() => handleCancelRequest(req.id)}
                      type="button"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nouvelle demande */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} role="dialog" aria-modal="true">
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nouvelle Demande</h2>
              <button className="close-btn" onClick={() => setShowModal(false)} type="button" aria-label="Fermer">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="req-type">Type de demande</label>
                <select id="req-type" value={requestType} onChange={e => setRequestType(e.target.value as RequestType)}>
                  <option value="leave">Conge</option>
                  <option value="shift_swap">Echange de shift</option>
                  <option value="sick_leave">Arret maladie</option>
                  <option value="other">Autre</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="req-start">Date de debut</label>
                <input id="req-start" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>

              {(requestType === 'leave' || requestType === 'sick_leave') && (
                <div className="form-group">
                  <label htmlFor="req-end">Date de fin (optionnel)</label>
                  <input id="req-end" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} />
                </div>
              )}

              {requestType === 'shift_swap' && (
                <div className="form-group">
                  <label htmlFor="req-target">Echanger avec</label>
                  <select id="req-target" value={targetEmployeeId} onChange={e => setTargetEmployeeId(e.target.value)}>
                    <option value="">Selectionner un employe</option>
                    {otherEmployees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="req-reason">Motif (optionnel)</label>
                <textarea id="req-reason" value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Precisions..." />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)} type="button">Annuler</button>
              <button className="btn-primary" onClick={handleSubmitRequest} disabled={submitting} type="button">
                {submitting ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .demandes-page { display: flex; flex-direction: column; gap: var(--spacing-5); }

        .page-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          flex-wrap: wrap; gap: var(--spacing-3);
        }
        .header-left { display: flex; align-items: center; gap: var(--spacing-3); flex-wrap: wrap; }
        .page-title { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); margin: 0; }

        .employee-select {
          padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          background: white; color: var(--color-neutral-700);
        }

        .new-request-btn {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4);
          background: var(--color-primary-600); color: white;
          border: none; border-radius: var(--radius-md);
          font-weight: var(--font-weight-semibold); font-size: var(--font-size-sm);
          font-family: var(--font-family-primary); cursor: pointer;
          transition: all var(--transition-fast);
        }
        .new-request-btn:hover { background: var(--color-primary-700); }

        .filters { display: flex; gap: var(--spacing-2); flex-wrap: wrap; }

        .filter-btn {
          padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          background: white; font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-xs); cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-family-primary); color: var(--color-neutral-600);
        }
        .filter-btn:hover { border-color: var(--color-primary-400); }
        .filter-btn.active { border-color: var(--color-primary-500); background: var(--color-primary-50); color: var(--color-primary-800); }

        .requests-list { display: flex; flex-direction: column; gap: var(--spacing-3); }

        .request-card {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); padding: var(--spacing-4);
        }

        .request-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: var(--spacing-3);
        }

        .type-badge, .status-badge {
          padding: var(--spacing-1) var(--spacing-3);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-bold);
        }

        .type-badge--leave { background: var(--color-secondary-50); color: var(--color-secondary-800); }
        .type-badge--shift_swap { background: #e0e7ff; color: #3730a3; }
        .type-badge--sick_leave { background: var(--color-danger-50); color: var(--color-danger-800); }
        .type-badge--other { background: var(--color-neutral-100); color: var(--color-neutral-700); }

        .status-badge--pending { background: var(--color-warning-50); color: var(--color-warning-800); }
        .status-badge--approved { background: var(--color-success-50); color: var(--color-success-800); }
        .status-badge--rejected { background: var(--color-danger-50); color: var(--color-danger-800); }
        .status-badge--cancelled { background: var(--color-neutral-100); color: var(--color-neutral-500); }

        .request-body { margin-bottom: var(--spacing-3); }

        .request-dates {
          font-size: var(--font-size-md); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800); margin-bottom: var(--spacing-2);
        }
        .request-target { font-size: var(--font-size-sm); color: var(--color-neutral-500); margin-bottom: var(--spacing-2); }

        .request-reason {
          font-size: var(--font-size-sm); color: var(--color-neutral-600);
          padding: var(--spacing-3); background: var(--color-neutral-50);
          border-radius: var(--radius-md); margin-top: var(--spacing-2);
        }

        .manager-comment {
          font-size: var(--font-size-sm); color: var(--color-neutral-800);
          padding: var(--spacing-3); background: var(--color-warning-50);
          border-radius: var(--radius-md); margin-top: var(--spacing-2);
        }

        .request-footer {
          display: flex; justify-content: space-between; align-items: center;
          padding-top: var(--spacing-3); border-top: 1px solid var(--color-neutral-100);
        }
        .request-date { font-size: var(--font-size-xs); color: var(--color-neutral-400); }

        .cancel-btn {
          padding: var(--spacing-1) var(--spacing-3);
          background: transparent; color: var(--color-danger-600);
          border: 1px solid var(--color-danger-400);
          border-radius: var(--radius-md); font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-xs); cursor: pointer;
          font-family: var(--font-family-primary);
          transition: all var(--transition-fast);
        }
        .cancel-btn:hover { background: var(--color-danger-50); }

        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex; align-items: center; justify-content: center;
          z-index: var(--z-modal); padding: var(--spacing-4);
        }

        .modal-content {
          background: white; border-radius: var(--radius-xl);
          max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto;
          box-shadow: var(--shadow-xl);
        }

        .modal-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: var(--spacing-4) var(--spacing-5);
          border-bottom: 1px solid var(--color-neutral-100);
        }
        .modal-title { margin: 0; font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); }

        .close-btn {
          width: 32px; height: 32px;
          border: none; background: var(--color-neutral-100);
          border-radius: var(--radius-md); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--color-neutral-600); transition: all var(--transition-fast);
        }
        .close-btn:hover { background: var(--color-neutral-200); }

        .modal-body { padding: var(--spacing-5); display: flex; flex-direction: column; gap: var(--spacing-4); }

        .form-group { display: flex; flex-direction: column; gap: var(--spacing-1); }
        .form-group label {
          font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
        }
        .form-group select,
        .form-group input,
        .form-group textarea {
          padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-size: var(--font-size-sm); font-family: var(--font-family-primary);
        }
        .form-group select:focus,
        .form-group input:focus,
        .form-group textarea:focus { outline: none; border-color: var(--color-primary-400); }

        .modal-footer {
          display: flex; gap: var(--spacing-3);
          padding: var(--spacing-4) var(--spacing-5);
          border-top: 1px solid var(--color-neutral-100);
        }

        .btn-secondary {
          flex: 1; padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          background: white; font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-sm); cursor: pointer;
          font-family: var(--font-family-primary);
        }
        .btn-secondary:hover { background: var(--color-neutral-50); }

        .btn-primary {
          flex: 1; padding: var(--spacing-2) var(--spacing-3);
          background: var(--color-primary-600); color: white;
          border: none; border-radius: var(--radius-md);
          font-weight: var(--font-weight-semibold); font-size: var(--font-size-sm);
          cursor: pointer; font-family: var(--font-family-primary);
          transition: all var(--transition-fast);
        }
        .btn-primary:hover:not(:disabled) { background: var(--color-primary-700); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 640px) {
          .page-header { flex-direction: column; }
          .header-left { flex-direction: column; align-items: stretch; }
          .new-request-btn { width: 100%; justify-content: center; }
          .request-header { flex-direction: column; align-items: flex-start; gap: var(--spacing-2); }
          .request-footer { flex-direction: column; align-items: stretch; gap: var(--spacing-2); }
          .cancel-btn { width: 100%; text-align: center; }
        }
      `}</style>
    </>
  );
}
