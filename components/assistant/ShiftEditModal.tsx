'use client';

import { useState } from 'react';
import type { Shift, ShiftRoles, RoleConfig } from '@/lib/assistant/types';
import { calculateShiftHours } from '@/lib/assistant/validation';

interface ShiftEditModalProps {
  shift: Shift | null; // null = création
  onSave: (shift: Shift) => void;
  onClose: () => void;
}

const ROLE_LABELS: Record<keyof ShiftRoles, string> = {
  Pharmacien: 'Pharmaciens',
  Preparateur: 'Préparateurs',
  Apprenti: 'Apprentis',
  Etudiant: 'Étudiants',
  Conditionneur: 'Conditionneurs',
};

const ROLE_KEYS: (keyof ShiftRoles)[] = [
  'Pharmacien',
  'Preparateur',
  'Conditionneur',
  'Apprenti',
  'Etudiant',
];

const DEFAULT_ROLES: ShiftRoles = {
  Pharmacien: { min: 1, max: 2 },
  Preparateur: { min: 2, max: 4 },
  Apprenti: { min: 0, max: 1 },
  Etudiant: { min: 0, max: 1 },
  Conditionneur: { min: 1, max: 2 },
};

export default function ShiftEditModal({ shift, onSave, onClose }: ShiftEditModalProps) {
  const isEdit = shift !== null;

  const [name, setName] = useState(shift?.name ?? '');
  const [startTime, setStartTime] = useState(shift?.startTime ?? '08:30');
  const [endTime, setEndTime] = useState(shift?.endTime ?? '14:00');
  const [roles, setRoles] = useState<ShiftRoles>(shift?.roles ?? { ...DEFAULT_ROLES });
  const [localErrors, setLocalErrors] = useState<string[]>([]);

  const hours = calculateShiftHours(startTime, endTime);

  const updateRole = (roleKey: keyof ShiftRoles, field: 'min' | 'max', value: number) => {
    const clamped = Math.max(0, Math.min(value, 20));
    setRoles(prev => ({
      ...prev,
      [roleKey]: { ...prev[roleKey], [field]: clamped },
    }));
  };

  const handleSave = () => {
    const errs: string[] = [];

    if (!name.trim()) errs.push('Le nom du créneau est requis');
    if (hours <= 0) errs.push("L'heure de fin doit être après l'heure de début");
    if (roles.Pharmacien.min < 1) errs.push('Au moins 1 pharmacien est obligatoire');

    (Object.entries(roles) as [keyof ShiftRoles, RoleConfig][]).forEach(([role, cfg]) => {
      if (cfg.min > cfg.max) {
        errs.push(`${ROLE_LABELS[role]} : min > max`);
      }
    });

    if (errs.length > 0) {
      setLocalErrors(errs);
      return;
    }

    onSave({
      id: shift?.id ?? `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      startTime,
      endTime,
      roles,
    });
  };

  const totalMin = ROLE_KEYS.reduce((s, k) => s + roles[k].min, 0);
  const totalMax = ROLE_KEYS.reduce((s, k) => s + roles[k].max, 0);

  return (
    <>
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3 className="modal-title">
            {isEdit ? 'Modifier le créneau' : 'Nouveau créneau'}
          </h3>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Fermer">
            &times;
          </button>
        </div>

        <div className="modal-body">
          {/* Erreurs locales */}
          {localErrors.length > 0 && (
            <div className="modal-errors">
              {localErrors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          {/* Nom */}
          <div className="field">
            <label htmlFor="shift-name">
              Nom du créneau <span className="req">*</span>
            </label>
            <input
              id="shift-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Matin, Après-midi, Journée..."
            />
          </div>

          {/* Horaires */}
          <div className="time-row">
            <div className="field">
              <label htmlFor="shift-start">Début</label>
              <input
                id="shift-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="shift-end">Fin</label>
              <input
                id="shift-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div className="duration-badge">
              {hours > 0 ? `${hours}h` : '—'}
            </div>
          </div>

          {/* Effectifs par rôle */}
          <div className="roles-section">
            <h4 className="roles-title">Effectifs requis par rôle</h4>

            <div className="roles-header-row">
              <span className="rh-role">Rôle</span>
              <span className="rh-val">Min</span>
              <span className="rh-val">Max</span>
            </div>

            {ROLE_KEYS.map((roleKey) => (
              <div key={roleKey} className="role-row">
                <span className="role-label">{ROLE_LABELS[roleKey]}</span>
                <input
                  type="number"
                  className="role-input"
                  value={roles[roleKey].min}
                  onChange={(e) => updateRole(roleKey, 'min', parseInt(e.target.value) || 0)}
                  min={0}
                  max={20}
                />
                <input
                  type="number"
                  className="role-input"
                  value={roles[roleKey].max}
                  onChange={(e) => updateRole(roleKey, 'max', parseInt(e.target.value) || 0)}
                  min={0}
                  max={20}
                />
              </div>
            ))}

            <div className="roles-total">
              <span>Total effectif</span>
              <span>{totalMin} — {totalMax} personnes</span>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose} type="button">
            Annuler
          </button>
          <button className="btn-save" onClick={handleSave} type="button">
            {isEdit ? 'Enregistrer' : 'Ajouter le créneau'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 100;
        }

        .modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 560px;
          max-width: 95vw;
          max-height: 90vh;
          overflow-y: auto;
          background: white;
          border-radius: var(--radius-lg);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
          z-index: 101;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-5) var(--spacing-6);
          border-bottom: 1px solid var(--color-neutral-200);
        }

        .modal-title {
          margin: 0;
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          color: var(--color-neutral-400);
          cursor: pointer;
          padding: 4px 8px;
          line-height: 1;
        }

        .modal-close:hover {
          color: var(--color-neutral-700);
        }

        .modal-body {
          padding: var(--spacing-5) var(--spacing-6);
        }

        .modal-errors {
          background: var(--color-danger-50);
          border: 1px solid var(--color-danger-200);
          border-radius: var(--radius-md);
          padding: var(--spacing-3);
          margin-bottom: var(--spacing-4);
        }

        .modal-errors p {
          margin: 0 0 2px 0;
          font-size: var(--font-size-xs);
          color: var(--color-danger-700);
        }

        /* ─── Fields ─── */
        .field {
          display: flex;
          flex-direction: column;
          margin-bottom: var(--spacing-4);
        }

        .field label {
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-sm);
          color: var(--color-neutral-700);
          margin-bottom: var(--spacing-1);
        }

        .req {
          color: var(--color-danger-500);
        }

        .field input[type="text"],
        .field input[type="time"] {
          padding: 10px 12px;
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          transition: border-color 0.15s ease;
        }

        .field input:focus {
          outline: none;
          border-color: var(--color-primary-500);
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        .time-row {
          display: flex;
          gap: var(--spacing-3);
          align-items: flex-end;
          margin-bottom: var(--spacing-5);
        }

        .time-row .field {
          flex: 1;
          margin-bottom: 0;
        }

        .duration-badge {
          padding: 10px 16px;
          background: var(--color-primary-50);
          color: var(--color-primary-700);
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-md);
          border-radius: var(--radius-md);
          white-space: nowrap;
        }

        /* ─── Roles ─── */
        .roles-section {
          margin-top: var(--spacing-4);
        }

        .roles-title {
          margin: 0 0 var(--spacing-3) 0;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
        }

        .roles-header-row {
          display: grid;
          grid-template-columns: 1fr 70px 70px;
          gap: var(--spacing-2);
          padding-bottom: var(--spacing-2);
          border-bottom: 1px solid var(--color-neutral-200);
          margin-bottom: var(--spacing-2);
        }

        .rh-role {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .rh-val {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
          text-align: center;
          text-transform: uppercase;
        }

        .role-row {
          display: grid;
          grid-template-columns: 1fr 70px 70px;
          gap: var(--spacing-2);
          align-items: center;
          padding: var(--spacing-2) 0;
          border-bottom: 1px solid var(--color-neutral-100);
        }

        .role-label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-700);
        }

        .role-input {
          width: 100%;
          padding: 8px;
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          text-align: center;
          transition: border-color 0.15s ease;
        }

        .role-input:focus {
          outline: none;
          border-color: var(--color-primary-500);
        }

        .roles-total {
          display: flex;
          justify-content: space-between;
          padding: var(--spacing-3) 0;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-700);
        }

        /* ─── Footer ─── */
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-3);
          padding: var(--spacing-4) var(--spacing-6);
          border-top: 1px solid var(--color-neutral-200);
        }

        .btn-cancel,
        .btn-save {
          padding: 10px 24px;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-sm);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-cancel {
          background: var(--color-neutral-100);
          color: var(--color-neutral-600);
        }

        .btn-cancel:hover {
          background: var(--color-neutral-200);
        }

        .btn-save {
          background: var(--color-primary-600);
          color: white;
        }

        .btn-save:hover {
          background: var(--color-primary-700);
        }
      `}</style>
    </>
  );
}
