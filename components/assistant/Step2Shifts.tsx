'use client';

import { useState } from 'react';
import type { WizardConfig, Shift, ShiftRoles } from '@/lib/assistant/types';
import { SHIFT_TEMPLATES } from '@/lib/assistant/templates';
import { calculateShiftHours } from '@/lib/assistant/validation';
import ShiftEditModal from './ShiftEditModal';

interface Step2ShiftsProps {
  config: WizardConfig;
  setConfig: (config: WizardConfig) => void;
}

const ROLE_LABELS: Record<keyof ShiftRoles, string> = {
  Pharmacien: 'PH',
  Preparateur: 'PR',
  Conditionneur: 'CO',
  Apprenti: 'AP',
  Etudiant: 'ET',
};

const ROLE_FULL_LABELS: Record<keyof ShiftRoles, string> = {
  Pharmacien: 'Pharmaciens',
  Preparateur: 'Préparateurs',
  Conditionneur: 'Conditionneurs',
  Apprenti: 'Apprentis',
  Etudiant: 'Étudiants',
};

const ROLE_KEYS: (keyof ShiftRoles)[] = [
  'Pharmacien',
  'Preparateur',
  'Conditionneur',
  'Apprenti',
  'Etudiant',
];

export default function Step2Shifts({ config, setConfig }: Step2ShiftsProps) {
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [showModal, setShowModal] = useState(false);

  // ─── Templates ───
  const applyTemplate = (index: number) => {
    const tpl = SHIFT_TEMPLATES[index];
    // Générer de nouveaux IDs pour éviter les conflits
    const newShifts = tpl.shifts.map((s) => ({
      ...s,
      id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    }));
    setConfig({ ...config, shifts: newShifts });
  };

  // ─── CRUD créneaux ───
  const openAddModal = () => {
    setEditingShift(null);
    setShowModal(true);
  };

  const openEditModal = (shift: Shift) => {
    setEditingShift(shift);
    setShowModal(true);
  };

  const handleSaveShift = (saved: Shift) => {
    const exists = config.shifts.find(s => s.id === saved.id);
    let newShifts: Shift[];
    if (exists) {
      newShifts = config.shifts.map(s => s.id === saved.id ? saved : s);
    } else {
      newShifts = [...config.shifts, saved];
    }
    setConfig({ ...config, shifts: newShifts });
    setShowModal(false);
    setEditingShift(null);
  };

  const deleteShift = (id: string) => {
    if (confirm('Supprimer ce créneau ?')) {
      setConfig({ ...config, shifts: config.shifts.filter(s => s.id !== id) });
    }
  };

  const duplicateShift = (shift: Shift) => {
    const dup: Shift = {
      ...shift,
      id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${shift.name} (copie)`,
    };
    setConfig({ ...config, shifts: [...config.shifts, dup] });
  };

  // ─── Stats ───
  const totalMinStaff = config.shifts.reduce(
    (sum, s) => sum + ROLE_KEYS.reduce((rs, k) => rs + s.roles[k].min, 0),
    0
  );
  const totalMaxStaff = config.shifts.reduce(
    (sum, s) => sum + ROLE_KEYS.reduce((rs, k) => rs + s.roles[k].max, 0),
    0
  );
  const totalHours = config.shifts.reduce(
    (sum, s) => sum + calculateShiftHours(s.startTime, s.endTime),
    0
  );

  return (
    <div className="step2">
      {/* ─── En-tête ─── */}
      <div className="step-header">
        <h2 className="step-title">Définition des créneaux</h2>
        <p className="step-desc">
          Configurez les créneaux horaires et les effectifs requis par rôle
        </p>
      </div>

      {/* ─── Templates ─── */}
      {config.shifts.length === 0 && (
        <div className="templates-section">
          <h3 className="templates-title">Démarrer avec un modèle</h3>
          <div className="templates-grid">
            {SHIFT_TEMPLATES.map((tpl, index) => (
              <button
                key={index}
                className="template-card"
                onClick={() => applyTemplate(index)}
                type="button"
              >
                <span className="template-name">{tpl.name}</span>
                <span className="template-desc">{tpl.description}</span>
                <span className="template-meta">
                  {tpl.shifts.length} créneau{tpl.shifts.length > 1 ? 'x' : ''}
                </span>
              </button>
            ))}
          </div>
          <div className="templates-divider">
            <span>ou</span>
          </div>
        </div>
      )}

      {/* ─── Bouton ajouter ─── */}
      <div className="add-row">
        <button className="btn-add" onClick={openAddModal} type="button">
          + Ajouter un créneau
        </button>
        {config.shifts.length > 0 && (
          <div className="templates-dropdown">
            <span className="dropdown-label">Modèles :</span>
            {SHIFT_TEMPLATES.map((tpl, i) => (
              <button
                key={i}
                className="dropdown-btn"
                onClick={() => applyTemplate(i)}
                type="button"
                title={tpl.description}
              >
                {tpl.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Liste des créneaux ─── */}
      {config.shifts.length > 0 && (
        <div className="shifts-list">
          {config.shifts.map((shift) => {
            const hours = calculateShiftHours(shift.startTime, shift.endTime);
            const minStaff = ROLE_KEYS.reduce((s, k) => s + shift.roles[k].min, 0);
            const maxStaff = ROLE_KEYS.reduce((s, k) => s + shift.roles[k].max, 0);

            return (
              <div key={shift.id} className="shift-card">
                <div className="shift-main">
                  <div className="shift-info">
                    <span className="shift-name">{shift.name}</span>
                    <span className="shift-time">
                      {shift.startTime} &mdash; {shift.endTime}
                      <span className="shift-duration">{hours}h</span>
                    </span>
                  </div>

                  <div className="shift-roles">
                    {ROLE_KEYS.map((roleKey) => {
                      const cfg = shift.roles[roleKey];
                      if (cfg.max === 0) return null;
                      return (
                        <span key={roleKey} className="role-badge" title={ROLE_FULL_LABELS[roleKey]}>
                          <span className="rb-label">{ROLE_LABELS[roleKey]}</span>
                          <span className="rb-value">{cfg.min}-{cfg.max}</span>
                        </span>
                      );
                    })}
                  </div>

                  <div className="shift-staff">
                    {minStaff}-{maxStaff} pers.
                  </div>

                  <div className="shift-actions">
                    <button
                      className="action-btn"
                      onClick={() => openEditModal(shift)}
                      type="button"
                      title="Modifier"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => duplicateShift(shift)}
                      type="button"
                      title="Dupliquer"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" strokeWidth="1.5"/></svg>
                    </button>
                    <button
                      className="action-btn action-btn--danger"
                      onClick={() => deleteShift(shift.id)}
                      type="button"
                      title="Supprimer"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M5.5 4V2.5a1 1 0 011-1h3a1 1 0 011 1V4M6.5 7v4M9.5 7v4M3.5 4l.77 9.2a1.5 1.5 0 001.49 1.3h4.48a1.5 1.5 0 001.49-1.3L12.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Résumé ─── */}
      {config.shifts.length > 0 && (
        <div className="summary">
          <div className="summary-stat">
            <span className="summary-value">{config.shifts.length}</span>
            <span className="summary-label">Créneau{config.shifts.length > 1 ? 'x' : ''}</span>
          </div>
          <div className="summary-stat">
            <span className="summary-value">{totalMinStaff}-{totalMaxStaff}</span>
            <span className="summary-label">Effectif / jour</span>
          </div>
          <div className="summary-stat">
            <span className="summary-value">{Math.round(totalHours * 10) / 10}h</span>
            <span className="summary-label">Amplitude totale</span>
          </div>
        </div>
      )}

      {/* ─── Modal ─── */}
      {showModal && (
        <ShiftEditModal
          key={editingShift?.id ?? 'new'}
          shift={editingShift}
          onSave={handleSaveShift}
          onClose={() => { setShowModal(false); setEditingShift(null); }}
        />
      )}

      <style jsx>{`
        .step2 {
          max-width: 860px;
          margin: 0 auto;
        }

        .step-header {
          text-align: center;
          margin-bottom: var(--spacing-6);
        }

        .step-title {
          margin: 0 0 var(--spacing-2) 0;
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
        }

        .step-desc {
          margin: 0;
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
        }

        /* ─── Templates ─── */
        .templates-section {
          margin-bottom: var(--spacing-6);
        }

        .templates-title {
          margin: 0 0 var(--spacing-3) 0;
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
          text-align: center;
        }

        .templates-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-3);
        }

        .template-card {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-1);
          padding: var(--spacing-4);
          background: var(--color-neutral-50);
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }

        .template-card:hover {
          border-color: var(--color-primary-400);
          background: var(--color-primary-50);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
        }

        .template-name {
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
          color: var(--color-neutral-800);
        }

        .template-desc {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        .template-meta {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-primary-600);
          margin-top: var(--spacing-1);
        }

        .templates-divider {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          margin-top: var(--spacing-5);
        }

        .templates-divider::before,
        .templates-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--color-neutral-200);
        }

        .templates-divider span {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-400);
          text-transform: uppercase;
          font-weight: var(--font-weight-semibold);
        }

        /* ─── Bouton ajouter ─── */
        .add-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-4);
        }

        .btn-add {
          padding: 10px 24px;
          background: var(--color-primary-600);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-sm);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-add:hover {
          background: var(--color-primary-700);
        }

        .templates-dropdown {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .dropdown-label {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        .dropdown-btn {
          padding: 4px 12px;
          background: var(--color-neutral-100);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-sm);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          color: var(--color-neutral-600);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .dropdown-btn:hover {
          background: var(--color-neutral-200);
        }

        /* ─── Liste créneaux ─── */
        .shifts-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3);
          margin-bottom: var(--spacing-5);
        }

        .shift-card {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-4) var(--spacing-5);
          transition: border-color 0.15s ease;
        }

        .shift-card:hover {
          border-color: var(--color-primary-200);
        }

        .shift-main {
          display: flex;
          align-items: center;
          gap: var(--spacing-4);
        }

        .shift-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 160px;
        }

        .shift-name {
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
          color: var(--color-neutral-900);
        }

        .shift-time {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .shift-duration {
          padding: 1px 8px;
          background: var(--color-primary-50);
          color: var(--color-primary-700);
          border-radius: var(--radius-full);
          font-weight: var(--font-weight-semibold);
          font-size: 11px;
        }

        .shift-roles {
          display: flex;
          gap: var(--spacing-1);
          flex: 1;
          flex-wrap: wrap;
        }

        .role-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          background: var(--color-neutral-100);
          border-radius: var(--radius-sm);
          font-size: 11px;
        }

        .rb-label {
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-600);
        }

        .rb-value {
          color: var(--color-neutral-500);
        }

        .shift-staff {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
          white-space: nowrap;
          min-width: 60px;
          text-align: right;
        }

        .shift-actions {
          display: flex;
          gap: var(--spacing-1);
        }

        .action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: var(--color-neutral-50);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          cursor: pointer;
          color: var(--color-neutral-500);
          transition: all 0.15s ease;
        }

        .action-btn:hover {
          background: var(--color-neutral-100);
          color: var(--color-neutral-700);
        }

        .action-btn--danger:hover {
          background: var(--color-danger-50);
          border-color: var(--color-danger-200);
          color: var(--color-danger-600);
        }

        /* ─── Résumé ─── */
        .summary {
          display: flex;
          justify-content: center;
          gap: var(--spacing-6);
          padding: var(--spacing-4);
          background: var(--color-neutral-50);
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
        }

        .summary-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .summary-value {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-primary-600);
        }

        .summary-label {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        @media (max-width: 768px) {
          .templates-grid {
            grid-template-columns: 1fr;
          }

          .shift-main {
            flex-direction: column;
            align-items: flex-start;
          }

          .shift-roles {
            width: 100%;
          }

          .shift-actions {
            width: 100%;
            justify-content: flex-end;
          }

          .add-row {
            flex-direction: column;
            gap: var(--spacing-3);
          }

          .summary {
            flex-direction: column;
            gap: var(--spacing-3);
          }
        }
      `}</style>
    </div>
  );
}
