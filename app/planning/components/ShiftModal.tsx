'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Employee, Shift } from '@/lib/types';
import { formatHours, calculateEffectiveHours, timeToMinutes } from '@/lib/utils/hourUtils';
import { formatDate, parseISODate } from '@/lib/utils/dateUtils';
import { validateDailyLimit } from '@/lib/constraints/dailyLimit';
import { validateRestPeriod } from '@/lib/constraints/restPeriod';

/** Labels des catégories en français */
const CATEGORY_LABELS: Record<string, string> = {
  pharmacien_titulaire: 'Pharmacien Titulaire',
  pharmacien_adjoint: 'Pharmacien Adjoint',
  preparateur: 'Préparateur',
  rayonniste: 'Rayonniste',
  apprenti: 'Apprenti',
  etudiant: 'Étudiant',
};

/** Options de durée de pause */
const BREAK_OPTIONS = [
  { value: 0, label: 'Pas de pause' },
  { value: 15, label: '15 min' },
  { value: 20, label: '20 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1h00' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2h00' },
];

interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
}

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  date: string;
  existingShift: Shift | null;
  allShifts: Shift[];
  organizationId: string;
  onSave: (shift: Shift) => void;
  onDelete: (shiftId: string) => void;
}

export default function ShiftModal({
  isOpen,
  onClose,
  employee,
  date,
  existingShift,
  allShifts,
  organizationId,
  onSave,
  onDelete,
}: ShiftModalProps) {
  const isEdit = existingShift !== null;

  // Form state — initialisé à chaque ouverture du modal via key prop
  const [startTime, setStartTime] = useState(existingShift?.start_time ?? '08:30');
  const [endTime, setEndTime] = useState(existingShift?.end_time ?? '19:30');
  const [breakDuration, setBreakDuration] = useState(existingShift?.break_duration ?? 60);
  const [notes, setNotes] = useState(existingShift?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Calculs dérivés
  const effectiveHours = useMemo(() => {
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) return 0;
    return calculateEffectiveHours(startTime, endTime, breakDuration);
  }, [startTime, endTime, breakDuration]);

  const totalDuration = useMemo(() => {
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) return 0;
    return (endMin - startMin) / 60;
  }, [startTime, endTime]);

  // Validation temps réel
  const validationIssues = useMemo((): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    // Heures cohérentes
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin <= startMin) {
      issues.push({ type: 'error', message: 'L\'heure de fin doit être après l\'heure de début' });
      return issues; // Pas la peine de valider plus
    }

    // Pause incohérente
    if (breakDuration > 0 && breakDuration >= (endMin - startMin)) {
      issues.push({ type: 'error', message: 'La pause est plus longue que la durée du shift' });
      return issues;
    }

    // Construire le shift candidat pour validation
    const candidateShift: Shift = {
      id: existingShift?.id || 'temp-new-shift',
      organization_id: organizationId,
      employee_id: employee.id,
      date,
      start_time: startTime,
      end_time: endTime,
      break_duration: breakDuration,
      effective_hours: effectiveHours,
      type: 'regular',
      status: 'draft',
      notes: notes || null,
      created_by: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Obtenir les shifts de cet employé sans celui qu'on édite
    const otherShifts = allShifts.filter(
      s => s.employee_id === employee.id && s.id !== existingShift?.id
    );

    // Validation 10h max journalier
    const shiftsWithCandidate = [...otherShifts, candidateShift];
    const dailyResult = validateDailyLimit(employee.id, shiftsWithCandidate, organizationId);
    for (const conflict of dailyResult.conflicts) {
      if (conflict.date === date) {
        issues.push({ type: conflict.severity === 'error' ? 'error' : 'warning', message: conflict.message });
      }
    }

    // Validation 35h repos hebdomadaire
    const restResult = validateRestPeriod(employee.id, shiftsWithCandidate, organizationId);
    for (const conflict of restResult.conflicts) {
      issues.push({ type: 'error', message: conflict.message });
    }

    // Pause obligatoire si > 6h
    if (effectiveHours > 6 && breakDuration < 20) {
      issues.push({
        type: 'warning',
        message: `Pause de 20 min obligatoire après 6h de travail (${formatHours(effectiveHours)} effectives)`,
      });
    }

    return issues;
  }, [startTime, endTime, breakDuration, effectiveHours, date, employee.id, existingShift, allShifts, organizationId, notes]);

  const hasErrors = validationIssues.some(v => v.type === 'error');

  // Fermer avec Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Handlers
  const handleSave = useCallback(() => {
    if (hasErrors) return;
    setIsSaving(true);

    const shift: Shift = {
      id: existingShift?.id || `shift-new-${Date.now()}`,
      organization_id: organizationId,
      employee_id: employee.id,
      date,
      start_time: startTime,
      end_time: endTime,
      break_duration: breakDuration,
      effective_hours: effectiveHours,
      type: effectiveHours <= 5 ? 'morning' : 'regular',
      status: 'draft',
      notes: notes || null,
      created_by: 'current-user',
      created_at: existingShift?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Simuler un léger délai comme si on sauvegardait
    setTimeout(() => {
      onSave(shift);
      setIsSaving(false);
    }, 200);
  }, [hasErrors, existingShift, organizationId, employee.id, date, startTime, endTime, breakDuration, effectiveHours, notes, onSave]);

  const handleDelete = useCallback(() => {
    if (!existingShift) return;
    setIsSaving(true);
    setTimeout(() => {
      onDelete(existingShift.id);
      setIsSaving(false);
    }, 200);
  }, [existingShift, onDelete]);

  if (!isOpen) return null;

  const dateObj = parseISODate(date);
  const dateLabel = formatDate(dateObj, 'long');

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="shift-modal-title">
        {/* Header */}
        <div className="modal-header">
          <h2 id="shift-modal-title" className="modal-title">
            {isEdit ? 'Modifier le shift' : 'Nouveau shift'}
          </h2>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Fermer">
            &#10005;
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {/* Infos employé + date (non modifiables) */}
          <div className="info-row">
            <div className="info-block">
              <span className="info-label">Employé</span>
              <div className="info-employee">
                <span className="info-dot" style={{ backgroundColor: employee.display_color }} />
                <div>
                  <span className="info-name">{employee.first_name} {employee.last_name}</span>
                  <span className="info-category">{CATEGORY_LABELS[employee.category] || employee.category}</span>
                </div>
              </div>
            </div>
            <div className="info-block">
              <span className="info-label">Date</span>
              <span className="info-date">{dateLabel}</span>
            </div>
          </div>

          {/* Horaires */}
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="shift-start" className="field-label">Heure de début</label>
              <input
                id="shift-start"
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="time-input"
                step="900"
              />
            </div>
            <div className="form-field">
              <label htmlFor="shift-end" className="field-label">Heure de fin</label>
              <input
                id="shift-end"
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="time-input"
                step="900"
              />
            </div>
            <div className="form-field">
              <label htmlFor="shift-break" className="field-label">Pause</label>
              <select
                id="shift-break"
                value={breakDuration}
                onChange={e => setBreakDuration(Number(e.target.value))}
                className="break-select"
              >
                {BREAK_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview heures */}
          <div className="hours-preview">
            <div className="preview-item">
              <span className="preview-label">Durée totale</span>
              <span className="preview-value">{totalDuration > 0 ? formatHours(totalDuration) : '—'}</span>
            </div>
            <div className="preview-sep" />
            <div className="preview-item">
              <span className="preview-label">Pause</span>
              <span className="preview-value">{breakDuration > 0 ? `${breakDuration} min` : '—'}</span>
            </div>
            <div className="preview-sep" />
            <div className="preview-item preview-item--main">
              <span className="preview-label">Heures effectives</span>
              <span className="preview-value preview-value--bold">
                {effectiveHours > 0 ? formatHours(effectiveHours) : '—'}
              </span>
            </div>
          </div>

          {/* Notes */}
          <div className="form-field">
            <label htmlFor="shift-notes" className="field-label">Notes (optionnel)</label>
            <textarea
              id="shift-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Remarques, détails particuliers..."
              rows={2}
              className="notes-textarea"
            />
          </div>

          {/* Validation issues */}
          {validationIssues.length > 0 && (
            <div className="validation-panel">
              {validationIssues.map((issue, i) => (
                <div key={i} className={`validation-item validation-item--${issue.type}`}>
                  <span className="validation-icon">
                    {issue.type === 'error' ? '\u2717' : '\u26A0'}
                  </span>
                  <span className="validation-msg">{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} type="button" disabled={isSaving}>
            Annuler
          </button>

          {isEdit && !showDeleteConfirm && (
            <button
              className="btn btn-danger-outline"
              onClick={() => setShowDeleteConfirm(true)}
              type="button"
              disabled={isSaving}
            >
              Supprimer
            </button>
          )}

          {isEdit && showDeleteConfirm && (
            <div className="delete-confirm">
              <span className="delete-confirm-text">Confirmer ?</span>
              <button className="btn btn-danger" onClick={handleDelete} type="button" disabled={isSaving}>
                {isSaving ? 'Suppression...' : 'Oui, supprimer'}
              </button>
              <button className="btn btn-ghost-sm" onClick={() => setShowDeleteConfirm(false)} type="button">
                Non
              </button>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleSave}
            type="button"
            disabled={hasErrors || isSaving || effectiveHours <= 0}
          >
            {isSaving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer le shift'}
          </button>
        </div>
      </div>

      <style jsx>{`
        /* Backdrop */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.4);
          z-index: var(--z-modal-backdrop);
          animation: fadeIn 150ms ease;
        }

        /* Modal container */
        .modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 540px;
          max-width: 95vw;
          max-height: 90vh;
          background: white;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-xl);
          z-index: var(--z-modal);
          display: flex;
          flex-direction: column;
          animation: slideUp 200ms ease;
        }

        /* Header */
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-4) var(--spacing-5);
          border-bottom: 1px solid var(--color-neutral-200);
        }

        .modal-title {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-900);
          margin: 0;
        }

        .modal-close {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          border-radius: var(--radius-md);
          color: var(--color-neutral-500);
          font-size: var(--font-size-md);
          cursor: pointer;
        }
        .modal-close:hover {
          background-color: var(--color-neutral-100);
          color: var(--color-neutral-700);
        }

        /* Body */
        .modal-body {
          padding: var(--spacing-5);
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-4);
        }

        /* Info row (employé + date) */
        .info-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-4);
        }

        .info-block {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-1);
        }

        .info-label {
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .info-employee {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .info-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .info-name {
          display: block;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-900);
        }

        .info-category {
          display: block;
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        .info-date {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-900);
        }

        /* Form fields */
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: var(--spacing-3);
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-1);
        }

        .field-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-700);
        }

        .time-input,
        .break-select,
        .notes-textarea {
          padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-base);
          color: var(--color-neutral-900);
          background-color: white;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .time-input:focus,
        .break-select:focus,
        .notes-textarea:focus {
          outline: none;
          border-color: var(--color-primary-500);
          box-shadow: 0 0 0 3px var(--color-primary-50);
        }

        .break-select {
          appearance: none;
          cursor: pointer;
        }

        .notes-textarea {
          resize: vertical;
          min-height: 52px;
        }

        /* Hours preview */
        .hours-preview {
          display: flex;
          align-items: center;
          gap: var(--spacing-4);
          padding: var(--spacing-3) var(--spacing-4);
          background-color: var(--color-neutral-50);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-neutral-200);
        }

        .preview-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .preview-item--main {
          flex: 1;
          text-align: right;
        }

        .preview-label {
          font-size: 10px;
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .preview-value {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-700);
          font-weight: var(--font-weight-medium);
        }

        .preview-value--bold {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-bold);
          color: var(--color-primary-700);
        }

        .preview-sep {
          width: 1px;
          height: 28px;
          background-color: var(--color-neutral-300);
        }

        /* Validation panel */
        .validation-panel {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-1);
        }

        .validation-item {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-3);
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
          line-height: 1.4;
        }

        .validation-item--error {
          background-color: var(--color-danger-50);
          border-left: 3px solid var(--color-danger-500);
          color: var(--color-danger-700);
        }

        .validation-item--warning {
          background-color: var(--color-warning-50);
          border-left: 3px solid var(--color-warning-500);
          color: var(--color-warning-700);
        }

        .validation-icon {
          flex-shrink: 0;
          font-size: 11px;
          margin-top: 1px;
        }

        .validation-msg {
          flex: 1;
        }

        /* Footer */
        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: var(--spacing-2);
          padding: var(--spacing-3) var(--spacing-5);
          border-top: 1px solid var(--color-neutral-200);
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: var(--spacing-2) var(--spacing-4);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          cursor: pointer;
          transition: all var(--transition-fast);
          border: 1px solid transparent;
          white-space: nowrap;
        }
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background-color: var(--color-primary-600);
          color: white;
        }
        .btn-primary:hover:not(:disabled) {
          background-color: var(--color-primary-700);
        }

        .btn-ghost {
          background: transparent;
          color: var(--color-neutral-600);
          border-color: transparent;
        }
        .btn-ghost:hover:not(:disabled) {
          background-color: var(--color-neutral-100);
        }

        .btn-ghost-sm {
          background: transparent;
          color: var(--color-neutral-600);
          border: none;
          padding: var(--spacing-1) var(--spacing-2);
          font-size: var(--font-size-xs);
        }

        .btn-danger-outline {
          background: transparent;
          color: var(--color-danger-600);
          border-color: var(--color-danger-300);
        }
        .btn-danger-outline:hover:not(:disabled) {
          background-color: var(--color-danger-50);
        }

        .btn-danger {
          background-color: var(--color-danger-600);
          color: white;
        }
        .btn-danger:hover:not(:disabled) {
          background-color: var(--color-danger-700);
        }

        /* Delete confirm inline */
        .delete-confirm {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          margin-right: auto;
        }

        .delete-confirm-text {
          font-size: var(--font-size-xs);
          color: var(--color-danger-600);
          font-weight: var(--font-weight-medium);
        }

        /* Animations */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, -48%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>
    </>
  );
}
