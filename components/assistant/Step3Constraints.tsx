'use client';

import { useState, useEffect, useRef } from 'react';
import type { WizardConfig, EmployeeConstraint } from '@/lib/assistant/types';
import type { Employee } from '@/lib/types';
import { useOrganization } from '@/lib/supabase/client';
import { getEmployees } from '@/lib/supabase/queries';

interface Step3ConstraintsProps {
  config: WizardConfig;
  setConfig: (config: WizardConfig) => void;
}

const DAYS_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const CATEGORY_LABELS: Record<string, string> = {
  pharmacien_titulaire: 'Pharmacien Titulaire',
  pharmacien_adjoint: 'Pharmacien Adjoint',
  preparateur: 'Préparateur',
  rayonniste: 'Conditionneur',
  apprenti: 'Apprenti',
  etudiant: 'Étudiant',
};

function getInitials(emp: Employee): string {
  return `${(emp.first_name?.[0] ?? '').toUpperCase()}${(emp.last_name?.[0] ?? '').toUpperCase()}`;
}

function getCategoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat] ?? cat;
}

export default function Step3Constraints({ config, setConfig }: Step3ConstraintsProps) {
  const { organizationId } = useOrganization();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Track if initial constraints were set
  const initDoneRef = useRef(false);

  // Charger employés depuis Supabase
  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;

    getEmployees(organizationId).then((emps) => {
      if (cancelled) return;
      setEmployees(emps);

      // Initialiser contraintes par défaut pour les nouveaux employés
      if (!initDoneRef.current) {
        initDoneRef.current = true;
        const updated = { ...config.employeeConstraints };
        let changed = false;
        for (const emp of emps) {
          if (!updated[emp.id]) {
            changed = true;
            const isStudent = emp.category === 'etudiant';
            const isApprentice = emp.category === 'apprenti';
            updated[emp.id] = {
              employeeId: emp.id,
              minHoursPerWeek: isStudent ? 0 : isApprentice ? 20 : Math.min(emp.contract_hours, 28),
              maxHoursPerWeek: isStudent ? 20 : isApprentice ? 35 : Math.min(emp.contract_hours + 4, 48),
              unavailableDates: [],
              preferredShifts: [],
              restDays: [],
            };
          }
        }
        if (changed) {
          setConfig({ ...config, employeeConstraints: updated });
        }
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // ─── Helpers ───

  const updateConstraint = (empId: string, field: keyof EmployeeConstraint, value: EmployeeConstraint[keyof EmployeeConstraint]) => {
    setConfig({
      ...config,
      employeeConstraints: {
        ...config.employeeConstraints,
        [empId]: {
          ...config.employeeConstraints[empId],
          [field]: value,
        },
      },
    });
  };

  const toggleRestDay = (empId: string, dayIndex: number) => {
    const current = config.employeeConstraints[empId]?.restDays ?? [];
    const next = current.includes(dayIndex)
      ? current.filter(d => d !== dayIndex)
      : [...current, dayIndex];
    updateConstraint(empId, 'restDays', next);
  };

  const togglePreferredShift = (empId: string, shiftId: string) => {
    const current = config.employeeConstraints[empId]?.preferredShifts ?? [];
    const next = current.includes(shiftId)
      ? current.filter(id => id !== shiftId)
      : [...current, shiftId];
    updateConstraint(empId, 'preferredShifts', next);
  };

  const addUnavailableDate = (empId: string, date: string) => {
    if (!date) return;
    const current = config.employeeConstraints[empId]?.unavailableDates ?? [];
    if (!current.includes(date)) {
      updateConstraint(empId, 'unavailableDates', [...current, date].sort());
    }
  };

  const removeUnavailableDate = (empId: string, date: string) => {
    const current = config.employeeConstraints[empId]?.unavailableDates ?? [];
    updateConstraint(empId, 'unavailableDates', current.filter(d => d !== date));
  };

  const applyHoursToAll = (field: 'minHoursPerWeek' | 'maxHoursPerWeek', value: number) => {
    if (!confirm(`Appliquer ${value}h à tous les employés ?`)) return;
    const updated = { ...config.employeeConstraints };
    for (const empId of Object.keys(updated)) {
      updated[empId] = { ...updated[empId], [field]: value };
    }
    setConfig({ ...config, employeeConstraints: updated });
  };

  const exportConstraints = () => {
    const data = JSON.stringify(config.employeeConstraints, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contraintes-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importConstraints = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setConfig({ ...config, employeeConstraints: imported });
      } catch {
        alert('Erreur : fichier JSON invalide');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // ─── Render ───

  if (loading) {
    return (
      <div className="loading">
        <span className="spinner" />
        <span>Chargement des employés...</span>
        <style jsx>{`
          .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; gap: var(--spacing-3); color: var(--color-neutral-500); }
          .spinner { width: 36px; height: 36px; border: 3px solid var(--color-neutral-200); border-top-color: var(--color-primary-500); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  const categories = [...new Set(employees.map(e => e.category))];
  const filtered = filterCategory === 'all'
    ? employees
    : employees.filter(e => e.category === filterCategory);

  const selected = selectedId ? employees.find(e => e.id === selectedId) ?? null : null;
  const constraint = selectedId ? config.employeeConstraints[selectedId] ?? null : null;

  const configuredCount = Object.values(config.employeeConstraints).filter(
    c => c.restDays.length > 0 || c.unavailableDates.length > 0 || c.preferredShifts.length > 0
  ).length;

  const totalUnavailable = Object.values(config.employeeConstraints).reduce(
    (sum, c) => sum + c.unavailableDates.length, 0
  );

  return (
    <div className="step3">
      {/* ─── Header ─── */}
      <div className="step-header">
        <div>
          <h2 className="step-title">Contraintes des employés</h2>
          <p className="step-desc">
            Configurez les heures, repos et indisponibilités pour chaque employé
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-action" onClick={exportConstraints} type="button">
            Exporter
          </button>
          <label className="btn-action">
            Importer
            <input type="file" accept=".json" onChange={importConstraints} hidden />
          </label>
        </div>
      </div>

      {/* ─── Layout 2 colonnes ─── */}
      <div className="layout">
        {/* Sidebar - Liste employés */}
        <aside className="sidebar">
          <div className="sidebar-top">
            <h3 className="sidebar-title">
              Employés ({filtered.length}/{employees.length})
            </h3>
            <select
              className="filter-select"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="all">Tous les rôles</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
              ))}
            </select>
          </div>

          <div className="emp-list">
            {filtered.map(emp => {
              const isSelected = selectedId === emp.id;
              const c = config.employeeConstraints[emp.id];
              const isConfigured = c && (c.restDays.length > 0 || c.unavailableDates.length > 0 || c.preferredShifts.length > 0);

              return (
                <button
                  key={emp.id}
                  className={`emp-item ${isSelected ? 'emp-item--selected' : ''}`}
                  onClick={() => setSelectedId(emp.id)}
                  type="button"
                >
                  <span className="emp-avatar">{getInitials(emp)}</span>
                  <span className="emp-info">
                    <span className="emp-name">{emp.first_name} {emp.last_name}</span>
                    <span className="emp-role">{getCategoryLabel(emp.category)}</span>
                  </span>
                  {isConfigured && <span className="emp-check">{'\u2713'}</span>}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main - Config */}
        {selected && constraint ? (
          <div className="config-panel">
            {/* Banner employé */}
            <div className="config-banner">
              <span className="banner-avatar">{getInitials(selected)}</span>
              <div className="banner-info">
                <h3 className="banner-name">{selected.first_name} {selected.last_name}</h3>
                <p className="banner-meta">{getCategoryLabel(selected.category)} &middot; {selected.contract_hours}h/semaine</p>
              </div>
            </div>

            <div className="config-body">
              {/* ── Heures min/max ── */}
              <section className="section">
                <h4 className="section-title">Heures de travail hebdomadaires</h4>
                <p className="section-hint">Nombre minimum et maximum d{"'"}heures par semaine</p>
                <div className="hours-row">
                  <div className="hour-field">
                    <label>Minimum</label>
                    <div className="hour-input-wrap">
                      <input
                        type="number"
                        className="hour-input"
                        min={0}
                        max={48}
                        value={constraint.minHoursPerWeek}
                        onChange={e => updateConstraint(selected.id, 'minHoursPerWeek', parseInt(e.target.value) || 0)}
                      />
                      <span className="hour-unit">h</span>
                    </div>
                  </div>
                  <span className="hour-sep">&mdash;</span>
                  <div className="hour-field">
                    <label>Maximum</label>
                    <div className="hour-input-wrap">
                      <input
                        type="number"
                        className="hour-input"
                        min={0}
                        max={48}
                        value={constraint.maxHoursPerWeek}
                        onChange={e => updateConstraint(selected.id, 'maxHoursPerWeek', parseInt(e.target.value) || 0)}
                      />
                      <span className="hour-unit">h</span>
                    </div>
                  </div>
                  <button
                    className="btn-apply-all"
                    onClick={() => applyHoursToAll('maxHoursPerWeek', constraint.maxHoursPerWeek)}
                    type="button"
                  >
                    Appliquer max. à tous
                  </button>
                </div>
              </section>

              {/* ── Jours de repos ── */}
              <section className="section">
                <h4 className="section-title">Jours de repos hebdomadaires</h4>
                <p className="section-hint">Jours où cet employé ne peut pas travailler chaque semaine</p>
                <div className="days-grid">
                  {DAYS_LABELS.map((day, idx) => {
                    const isRest = constraint.restDays.includes(idx);
                    return (
                      <button
                        key={idx}
                        className={`day-btn ${isRest ? 'day-btn--rest' : ''}`}
                        onClick={() => toggleRestDay(selected.id, idx)}
                        type="button"
                        aria-pressed={isRest}
                      >
                        <span className="day-label">{day}</span>
                        <span className="day-icon">{isRest ? '\u2717' : '\u2713'}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ── Indisponibilités ── */}
              <section className="section">
                <h4 className="section-title">Indisponibilités (dates spécifiques)</h4>
                <p className="section-hint">Congés, formations ou absences prévues</p>

                <div className="date-add-row">
                  <input
                    type="date"
                    className="date-input"
                    id={`unavail-date-${selected.id}`}
                    min={config.startDate}
                    max={config.endDate}
                  />
                  <button
                    className="btn-add-date"
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`unavail-date-${selected.id}`) as HTMLInputElement;
                      if (el?.value) { addUnavailableDate(selected.id, el.value); el.value = ''; }
                    }}
                  >
                    + Ajouter
                  </button>
                </div>

                {constraint.unavailableDates.length > 0 ? (
                  <div className="dates-list">
                    {constraint.unavailableDates.map(date => (
                      <div key={date} className="date-chip">
                        <span className="date-text">
                          {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
                            weekday: 'short', day: 'numeric', month: 'short',
                          })}
                        </span>
                        <button
                          className="date-remove"
                          onClick={() => removeUnavailableDate(selected.id, date)}
                          type="button"
                          aria-label="Supprimer"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-hint">Aucune indisponibilité définie</p>
                )}
              </section>

              {/* ── Préférences créneaux ── */}
              <section className="section">
                <h4 className="section-title">Préférences de créneaux</h4>
                <p className="section-hint">{"L'algorithme favorisera ces affectations quand c'est possible"}</p>

                {config.shifts.length > 0 ? (
                  <div className="pref-list">
                    {config.shifts.map(shift => {
                      const isPref = constraint.preferredShifts.includes(shift.id);
                      return (
                        <button
                          key={shift.id}
                          className={`pref-btn ${isPref ? 'pref-btn--active' : ''}`}
                          onClick={() => togglePreferredShift(selected.id, shift.id)}
                          type="button"
                        >
                          <span className="pref-star">{isPref ? '\u2605' : '\u2606'}</span>
                          <span className="pref-info">
                            <span className="pref-name">{shift.name}</span>
                            <span className="pref-time">{shift.startTime} &mdash; {shift.endTime}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="empty-hint">Retournez au Step 2 pour définir des créneaux</p>
                )}
              </section>
            </div>
          </div>
        ) : (
          <div className="no-selection">
            <p className="no-sel-text">Sélectionnez un employé dans la liste pour configurer ses contraintes</p>
          </div>
        )}
      </div>

      {/* ─── Résumé ─── */}
      <div className="summary">
        <h4 className="summary-title">Résumé</h4>
        <div className="summary-grid">
          <div className="summary-card">
            <span className="summary-value">{employees.length}</span>
            <span className="summary-label">Employés</span>
          </div>
          <div className="summary-card">
            <span className="summary-value">{configuredCount}</span>
            <span className="summary-label">Configurés</span>
          </div>
          <div className="summary-card">
            <span className="summary-value">{totalUnavailable}</span>
            <span className="summary-label">Indisponibilités</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .step3 { max-width: 1200px; margin: 0 auto; }

        /* ─── Header ─── */
        .step-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--spacing-6); }
        .step-title { margin: 0 0 var(--spacing-1) 0; font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-neutral-900); }
        .step-desc { margin: 0; font-size: var(--font-size-sm); color: var(--color-neutral-500); }
        .header-actions { display: flex; gap: var(--spacing-2); }
        .btn-action {
          padding: 8px 16px; background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-weight: var(--font-weight-semibold); font-size: var(--font-size-xs);
          color: var(--color-neutral-600); cursor: pointer; transition: all 0.15s ease;
        }
        .btn-action:hover { border-color: var(--color-primary-400); color: var(--color-primary-600); }

        /* ─── Layout ─── */
        .layout { display: grid; grid-template-columns: 300px 1fr; gap: var(--spacing-4); margin-bottom: var(--spacing-5); min-height: 560px; }

        /* ─── Sidebar ─── */
        .sidebar { background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); overflow: hidden; display: flex; flex-direction: column; }
        .sidebar-top { padding: var(--spacing-4); border-bottom: 1px solid var(--color-neutral-200); background: white; }
        .sidebar-title { margin: 0 0 var(--spacing-2) 0; font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); }
        .filter-select {
          width: 100%; padding: 8px 10px; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-xs); background: white; cursor: pointer;
        }
        .emp-list { flex: 1; overflow-y: auto; padding: var(--spacing-2); }
        .emp-item {
          width: 100%; display: flex; align-items: center; gap: var(--spacing-2); padding: var(--spacing-2) var(--spacing-3);
          background: white; border: 2px solid var(--color-neutral-200); border-radius: var(--radius-md);
          cursor: pointer; transition: all 0.15s ease; margin-bottom: var(--spacing-1); text-align: left;
        }
        .emp-item:hover { border-color: var(--color-neutral-300); }
        .emp-item--selected { border-color: var(--color-primary-500); background: var(--color-primary-50); }
        .emp-avatar {
          width: 36px; height: 36px; border-radius: 50%; background: var(--color-primary-500); color: white;
          display: flex; align-items: center; justify-content: center; font-weight: var(--font-weight-bold); font-size: 12px; flex-shrink: 0;
        }
        .emp-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .emp-name { font-weight: var(--font-weight-semibold); font-size: var(--font-size-xs); color: var(--color-neutral-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .emp-role { font-size: 11px; color: var(--color-neutral-500); }
        .emp-check {
          width: 20px; height: 20px; border-radius: 50%; background: var(--color-primary-500); color: white;
          display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;
        }

        /* ─── Config panel ─── */
        .config-panel { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); overflow: hidden; display: flex; flex-direction: column; }
        .config-banner {
          display: flex; align-items: center; gap: var(--spacing-3); padding: var(--spacing-4) var(--spacing-5);
          background: linear-gradient(135deg, var(--color-primary-600) 0%, var(--color-primary-700) 100%);
        }
        .banner-avatar {
          width: 52px; height: 52px; border-radius: 50%; background: white; color: var(--color-primary-600);
          display: flex; align-items: center; justify-content: center; font-weight: var(--font-weight-bold); font-size: var(--font-size-lg); flex-shrink: 0;
        }
        .banner-name { margin: 0; font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: white; }
        .banner-meta { margin: var(--spacing-1) 0 0 0; color: rgba(255,255,255,0.85); font-size: var(--font-size-xs); }
        .config-body { flex: 1; overflow-y: auto; padding: var(--spacing-5); }

        /* ─── Sections ─── */
        .section { margin-bottom: var(--spacing-6); }
        .section:last-child { margin-bottom: 0; }
        .section-title { margin: 0 0 var(--spacing-1) 0; font-size: var(--font-size-md); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); }
        .section-hint { margin: 0 0 var(--spacing-3) 0; font-size: var(--font-size-xs); color: var(--color-neutral-500); }

        /* ─── Heures ─── */
        .hours-row { display: flex; align-items: flex-end; gap: var(--spacing-3); }
        .hour-field { flex: 1; display: flex; flex-direction: column; gap: var(--spacing-1); }
        .hour-field label { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--color-neutral-600); }
        .hour-input-wrap { position: relative; }
        .hour-input {
          width: 100%; padding: 10px 36px 10px 14px; border: 2px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-md); font-weight: var(--font-weight-bold); text-align: center;
          transition: border-color 0.15s ease;
        }
        .hour-input:focus { outline: none; border-color: var(--color-primary-500); }
        .hour-unit { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--color-neutral-400); font-weight: var(--font-weight-bold); font-size: var(--font-size-sm); }
        .hour-sep { color: var(--color-neutral-300); font-weight: var(--font-weight-bold); font-size: var(--font-size-lg); margin-bottom: 10px; }
        .btn-apply-all {
          padding: 10px 14px; background: var(--color-neutral-100); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-weight: var(--font-weight-semibold); font-size: var(--font-size-xs);
          color: var(--color-neutral-600); cursor: pointer; white-space: nowrap; transition: all 0.15s ease; margin-bottom: 2px;
        }
        .btn-apply-all:hover { border-color: var(--color-primary-400); color: var(--color-primary-600); }

        /* ─── Jours repos ─── */
        .days-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--spacing-2); }
        .day-btn {
          padding: var(--spacing-3) var(--spacing-1); background: white; border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-md); cursor: pointer; transition: all 0.15s ease;
          display: flex; flex-direction: column; align-items: center; gap: var(--spacing-1);
        }
        .day-btn:hover { border-color: var(--color-neutral-300); }
        .day-btn--rest { background: var(--color-danger-50); border-color: var(--color-danger-400); }
        .day-label { font-weight: var(--font-weight-bold); font-size: var(--font-size-xs); color: var(--color-neutral-700); }
        .day-btn--rest .day-label { color: var(--color-danger-600); }
        .day-icon { font-size: var(--font-size-md); }

        /* ─── Indisponibilités ─── */
        .date-add-row { display: flex; gap: var(--spacing-2); margin-bottom: var(--spacing-3); }
        .date-input {
          flex: 1; padding: 10px 12px; border: 2px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
        }
        .date-input:focus { outline: none; border-color: var(--color-primary-500); }
        .btn-add-date {
          padding: 10px 18px; background: var(--color-primary-600); color: white; border: none; border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-weight: var(--font-weight-semibold); font-size: var(--font-size-sm);
          cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
        }
        .btn-add-date:hover { background: var(--color-primary-700); }
        .dates-list { display: flex; flex-wrap: wrap; gap: var(--spacing-2); }
        .date-chip {
          display: flex; align-items: center; gap: var(--spacing-2); padding: 6px 10px 6px 14px;
          background: var(--color-neutral-100); border: 1px solid var(--color-neutral-200); border-radius: var(--radius-full);
          font-size: var(--font-size-xs); color: var(--color-neutral-700);
        }
        .date-remove {
          width: 20px; height: 20px; border: none; background: var(--color-danger-100); color: var(--color-danger-600);
          border-radius: 50%; cursor: pointer; font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center;
          transition: background 0.15s ease;
        }
        .date-remove:hover { background: var(--color-danger-200); }
        .empty-hint { margin: 0; font-size: var(--font-size-xs); color: var(--color-neutral-400); font-style: italic; }

        /* ─── Préférences ─── */
        .pref-list { display: flex; flex-direction: column; gap: var(--spacing-2); }
        .pref-btn {
          display: flex; align-items: center; gap: var(--spacing-3); padding: var(--spacing-3);
          background: white; border: 2px solid var(--color-neutral-200); border-radius: var(--radius-md);
          cursor: pointer; transition: all 0.15s ease; text-align: left;
        }
        .pref-btn:hover { border-color: var(--color-neutral-300); }
        .pref-btn--active { border-color: var(--color-warning-400); background: var(--color-warning-50); }
        .pref-star { font-size: var(--font-size-xl); color: var(--color-warning-500); flex-shrink: 0; }
        .pref-info { display: flex; flex-direction: column; gap: 1px; }
        .pref-name { font-weight: var(--font-weight-semibold); font-size: var(--font-size-sm); color: var(--color-neutral-800); }
        .pref-time { font-size: var(--font-size-xs); color: var(--color-neutral-500); }

        /* ─── No selection ─── */
        .no-selection {
          background: var(--color-neutral-50); border: 2px dashed var(--color-neutral-300); border-radius: var(--radius-lg);
          display: flex; align-items: center; justify-content: center; min-height: 560px;
        }
        .no-sel-text { color: var(--color-neutral-400); font-size: var(--font-size-sm); text-align: center; max-width: 250px; }

        /* ─── Résumé ─── */
        .summary { background: var(--color-neutral-50); border: 2px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: var(--spacing-5); }
        .summary-title { margin: 0 0 var(--spacing-3) 0; font-size: var(--font-size-md); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); text-align: center; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-3); }
        .summary-card {
          display: flex; flex-direction: column; align-items: center; gap: var(--spacing-1);
          padding: var(--spacing-3); background: white; border-radius: var(--radius-md); box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .summary-value { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-primary-600); line-height: 1; }
        .summary-label { font-size: var(--font-size-xs); color: var(--color-neutral-500); }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .layout { grid-template-columns: 1fr; }
          .sidebar { max-height: 260px; }
          .hours-row { flex-direction: column; }
          .days-grid { grid-template-columns: repeat(4, 1fr); }
          .summary-grid { grid-template-columns: 1fr; }
          .step-header { flex-direction: column; gap: var(--spacing-3); }
        }
      `}</style>
    </div>
  );
}
