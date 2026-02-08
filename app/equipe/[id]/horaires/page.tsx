'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useOrganization } from '@/lib/supabase/client';
import { getEmployees } from '@/lib/supabase/queries';
import { useToast } from '@/components/ui/Toast';
import type { Employee, EmployeeCategory } from '@/lib/types';
import type { HoraireFixes } from '@/lib/types/horaires-fixes';
import { getFixedForEmployee } from '@/lib/horaires-fixes-service';
import { MOCK_HORAIRES_FIXES } from '@/app/planning/data/mockHorairesFixes';

const CATEGORY_CONFIG: Record<EmployeeCategory, { label: string; color: string }> = {
  pharmacien_titulaire: { label: 'Pharmacien Titulaire', color: '#2563eb' },
  pharmacien_adjoint: { label: 'Pharmacien Adjoint', color: '#3b82f6' },
  preparateur: { label: 'Pr\u00e9parateur', color: '#10b981' },
  rayonniste: { label: 'Rayonniste', color: '#f59e0b' },
  apprenti: { label: 'Apprenti', color: '#8b5cf6' },
  etudiant: { label: '\u00C9tudiant', color: '#ec4899' },
};

const JOURS = [
  { num: 0, label: 'Lundi', short: 'Lun' },
  { num: 1, label: 'Mardi', short: 'Mar' },
  { num: 2, label: 'Mercredi', short: 'Mer' },
  { num: 3, label: 'Jeudi', short: 'Jeu' },
  { num: 4, label: 'Vendredi', short: 'Ven' },
  { num: 5, label: 'Samedi', short: 'Sam' },
];

const PRESETS = [
  { label: 'Matin\u00e9e', start: '08:30', end: '14:00', breakMin: 0, type: 'morning' as const },
  { label: 'Apr\u00e8s-midi', start: '13:00', end: '19:30', breakMin: 0, type: 'afternoon' as const },
  { label: 'Journ\u00e9e', start: '08:30', end: '18:30', breakMin: 60, type: 'regular' as const },
  { label: 'Sam matin', start: '08:30', end: '13:00', breakMin: 0, type: 'morning' as const },
];

export default function HorairesPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { addToast } = useToast();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [horaires, setHoraires] = useState<HoraireFixes[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Load employee
  useEffect(() => {
    if (!organizationId || orgLoading) return;
    getEmployees(organizationId).then(data => {
      const emp = data.find(e => e.id === employeeId);
      setEmployee(emp || null);
      if (emp) {
        const fixed = getFixedForEmployee(MOCK_HORAIRES_FIXES, emp.id);
        setHoraires(fixed);
      }
      setIsLoading(false);
    });
  }, [organizationId, orgLoading, employeeId]);

  // Helpers
  const getInitials = (fn: string, ln: string) => `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase();

  const getHoraireForDay = useCallback((dayNum: number): HoraireFixes | undefined => {
    return horaires.find(h => h.day_of_week === dayNum);
  }, [horaires]);

  // Stats
  const weeklyStats = useMemo(() => {
    const totalHours = horaires.reduce((sum, h) => {
      const [sh, sm] = h.start_time.split(':').map(Number);
      const [eh, em] = h.end_time.split(':').map(Number);
      return sum + ((eh * 60 + em) - (sh * 60 + sm) - h.break_duration) / 60;
    }, 0);
    return { days: horaires.length, hours: Math.round(totalHours * 10) / 10 };
  }, [horaires]);

  // Handlers
  const handleTimeChange = useCallback((dayNum: number, field: 'start_time' | 'end_time', value: string) => {
    const existing = horaires.find(h => h.day_of_week === dayNum);
    if (existing) {
      setHoraires(prev => prev.map(h =>
        h.day_of_week === dayNum ? { ...h, [field]: value } : h
      ));
    } else {
      const newH: HoraireFixes = {
        id: `hf-new-${dayNum}-${Date.now()}`,
        employee_id: employeeId,
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
  }, [horaires, employeeId]);

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
        employee_id: employeeId,
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
  }, [horaires, employeeId]);

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
    addToast('success', 'Horaires copi\u00e9s vers Lun-Ven');
  }, [horaires, addToast]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    // Mock save — simulate 500ms delay
    await new Promise(r => setTimeout(r, 500));
    setHasChanges(false);
    setIsSaving(false);
    addToast('success', 'Horaires fixes sauvegard\u00e9s');
  }, [addToast]);

  const handleReset = useCallback(() => {
    if (employee) {
      const fixed = getFixedForEmployee(MOCK_HORAIRES_FIXES, employee.id);
      setHoraires(fixed);
      setHasChanges(false);
      addToast('warning', 'Horaires r\u00e9initialis\u00e9s');
    }
  }, [employee, addToast]);

  if (orgLoading || isLoading) {
    return (
      <div className="hf-loading">
        <span className="hf-spinner" />
        <span>Chargement...</span>
        <style jsx>{`
          .hf-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; min-height: 400px; color: var(--color-neutral-500); }
          .hf-spinner { width: 32px; height: 32px; border: 3px solid var(--color-neutral-200); border-top-color: var(--color-primary-500); border-radius: 50%; animation: hfspin 0.8s linear infinite; }
          @keyframes hfspin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="hf-not-found">
        <h2>Employ\u00e9 non trouv\u00e9</h2>
        <Link href="/equipe">Retour \u00e0 l&apos;\u00e9quipe</Link>
        <style jsx>{`
          .hf-not-found { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 60px; color: var(--color-neutral-600); }
        `}</style>
      </div>
    );
  }

  const catCfg = CATEGORY_CONFIG[employee.category];

  return (
    <>
      <div className="hf-page">
        {/* Header */}
        <div className="hf-header">
          <Link href="/equipe" className="hf-back">\u2190 Retour \u00e9quipe</Link>
          <div className="hf-emp-info">
            <div className="hf-avatar" style={{ backgroundColor: catCfg.color }}>
              {getInitials(employee.first_name, employee.last_name)}
            </div>
            <div>
              <h1 className="hf-emp-name">{employee.first_name} {employee.last_name}</h1>
              <div className="hf-emp-role">{catCfg.label} \u2022 {employee.contract_hours}h/sem</div>
            </div>
          </div>
          <div className="hf-header-actions">
            <button className="hf-btn hf-btn--outline" onClick={handleReset} type="button">
              \uD83D\uDD04 R\u00e9initialiser
            </button>
            <button
              className="hf-btn hf-btn--primary"
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              type="button"
            >
              {isSaving ? 'Sauvegarde...' : '\uD83D\uDCBE Sauvegarder'}
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="hf-instructions">
          <span className="hf-instructions-icon">\uD83D\uDCA1</span>
          <div>
            <strong>D\u00e9finissez la semaine type de {employee.first_name}</strong>
            <span>Ces horaires seront automatiquement pr\u00e9-remplis chaque semaine dans le planning.</span>
          </div>
        </div>

        {/* Presets */}
        <div className="hf-presets">
          <span className="hf-presets-label">Raccourcis :</span>
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              className="hf-preset-btn"
              onClick={() => selectedDay !== null && handlePresetApply(selectedDay, preset)}
              disabled={selectedDay === null}
              type="button"
              title={`${preset.start}\u2013${preset.end}`}
            >
              {preset.label}
            </button>
          ))}
          {selectedDay === null && (
            <span className="hf-presets-hint">S\u00e9lectionnez un jour d&apos;abord</span>
          )}
        </div>

        {/* Grid */}
        <div className="hf-grid">
          {JOURS.map(jour => {
            const horaire = getHoraireForDay(jour.num);
            const hasHoraire = !!horaire;
            const isSelected = selectedDay === jour.num;

            // Duration calculation
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
                className={`hf-day-card ${hasHoraire ? 'hf-day-card--filled' : 'hf-day-card--empty'} ${isSelected ? 'hf-day-card--selected' : ''}`}
                onClick={() => setSelectedDay(jour.num === selectedDay ? null : jour.num)}
              >
                <div className="hf-day-header">
                  <span className="hf-day-label">{jour.label}</span>
                  {hasHoraire && (
                    <button
                      className="hf-day-remove"
                      onClick={e => { e.stopPropagation(); handleRemoveDay(jour.num); }}
                      type="button"
                      title="Supprimer"
                    >
                      \u2715
                    </button>
                  )}
                </div>

                {hasHoraire && horaire ? (
                  <div className="hf-day-content">
                    <div className="hf-time-row">
                      <div className="hf-time-group">
                        <label className="hf-time-label">D\u00e9but</label>
                        <input
                          type="time"
                          className="hf-time-input"
                          value={horaire.start_time}
                          onChange={e => handleTimeChange(jour.num, 'start_time', e.target.value)}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      <span className="hf-time-sep">\u2192</span>
                      <div className="hf-time-group">
                        <label className="hf-time-label">Fin</label>
                        <input
                          type="time"
                          className="hf-time-input"
                          value={horaire.end_time}
                          onChange={e => handleTimeChange(jour.num, 'end_time', e.target.value)}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>

                    <div className="hf-break-row">
                      <label className="hf-time-label">Pause</label>
                      <select
                        className="hf-break-select"
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

                    <div className="hf-day-footer">
                      <span className="hf-duration">{durationLabel}</span>
                      {isSelected && (
                        <button
                          className="hf-copy-btn"
                          onClick={e => { e.stopPropagation(); handleCopyToWeekdays(jour.num); }}
                          type="button"
                        >
                          \uD83D\uDCCB Copier Lun\u2013Ven
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="hf-day-empty">
                    <span className="hf-add-icon">\u2795</span>
                    <span className="hf-add-text">Cliquer pour ajouter</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div className="hf-stats">
          <div className="hf-stat">
            <span className="hf-stat-label">Jours travaill\u00e9s :</span>
            <span className="hf-stat-value">{weeklyStats.days} / 6</span>
          </div>
          <div className="hf-stat">
            <span className="hf-stat-label">Heures hebdo estim\u00e9es :</span>
            <span className="hf-stat-value">{weeklyStats.hours}h</span>
          </div>
          <div className="hf-stat">
            <span className="hf-stat-label">Contrat :</span>
            <span className="hf-stat-value">{employee.contract_hours}h</span>
          </div>
          <div className="hf-stat">
            <span className="hf-stat-label">Diff\u00e9rence :</span>
            <span className={`hf-stat-value ${weeklyStats.hours > employee.contract_hours ? 'hf-stat-value--over' : weeklyStats.hours < employee.contract_hours ? 'hf-stat-value--under' : ''}`}>
              {weeklyStats.hours > employee.contract_hours ? '+' : ''}{Math.round((weeklyStats.hours - employee.contract_hours) * 10) / 10}h
            </span>
          </div>
        </div>

        {/* Unsaved changes warning */}
        {hasChanges && (
          <div className="hf-warning">
            \u26A0\uFE0F Modifications non sauvegard\u00e9es
          </div>
        )}
      </div>

      <style jsx global>{`
        .hf-page {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Header */
        .hf-header {
          display: flex;
          align-items: center;
          gap: 16px;
          background: white;
          padding: 16px 20px;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-neutral-200);
          flex-wrap: wrap;
        }

        .hf-back {
          padding: 6px 12px;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-neutral-300);
          background: white;
          color: var(--color-neutral-600);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .hf-back:hover {
          background: var(--color-neutral-50);
          color: var(--color-neutral-800);
        }

        .hf-emp-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 200px;
        }

        .hf-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 18px;
          flex-shrink: 0;
        }

        .hf-emp-name {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
          color: var(--color-neutral-900);
        }

        .hf-emp-role {
          font-size: 13px;
          color: var(--color-neutral-500);
          margin-top: 2px;
        }

        .hf-header-actions {
          display: flex;
          gap: 8px;
        }

        .hf-btn {
          padding: 8px 16px;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
          white-space: nowrap;
        }

        .hf-btn--primary {
          background: var(--color-primary-600);
          color: white;
        }

        .hf-btn--primary:hover:not(:disabled) {
          background: var(--color-primary-700);
        }

        .hf-btn--primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .hf-btn--outline {
          background: white;
          color: var(--color-neutral-600);
          border: 1px solid var(--color-neutral-300);
        }

        .hf-btn--outline:hover {
          background: var(--color-neutral-50);
        }

        /* Instructions */
        .hf-instructions {
          display: flex;
          gap: 12px;
          background: rgba(59, 130, 246, 0.06);
          border-left: 3px solid #3b82f6;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          align-items: flex-start;
        }

        .hf-instructions-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .hf-instructions strong {
          display: block;
          font-size: 13px;
          color: #1e40af;
          margin-bottom: 2px;
        }

        .hf-instructions span {
          font-size: 12px;
          color: #3b82f6;
        }

        /* Presets */
        .hf-presets {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: white;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-neutral-200);
          flex-wrap: wrap;
        }

        .hf-presets-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-500);
        }

        .hf-preset-btn {
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

        .hf-preset-btn:hover:not(:disabled) {
          border-color: var(--color-primary-400);
          color: var(--color-primary-600);
          background: var(--color-primary-50);
        }

        .hf-preset-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .hf-presets-hint {
          font-size: 11px;
          color: var(--color-neutral-400);
          font-style: italic;
        }

        /* Grid */
        .hf-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }

        .hf-day-card {
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: 14px;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
        }

        .hf-day-card--empty {
          border-style: dashed;
        }

        .hf-day-card--filled {
          background: rgba(99, 102, 241, 0.03);
          border-color: var(--color-primary-300);
        }

        .hf-day-card--selected {
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
          border-color: var(--color-primary-500);
        }

        .hf-day-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        .hf-day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .hf-day-label {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-neutral-900);
        }

        .hf-day-remove {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: none;
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .hf-day-remove:hover {
          background: #ef4444;
          color: white;
        }

        /* Day content */
        .hf-day-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .hf-time-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .hf-time-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .hf-time-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .hf-time-input {
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

        .hf-time-input:focus {
          outline: none;
          border-color: var(--color-primary-400);
        }

        .hf-time-sep {
          color: var(--color-neutral-300);
          font-size: 16px;
          padding-bottom: 6px;
        }

        .hf-break-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hf-break-select {
          flex: 1;
          padding: 5px 8px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-sm);
          font-family: var(--font-family-primary);
          font-size: 12px;
          color: var(--color-neutral-700);
          cursor: pointer;
        }

        .hf-day-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
        }

        .hf-duration {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-primary-600);
        }

        .hf-copy-btn {
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

        .hf-copy-btn:hover {
          background: #10b981;
          color: white;
        }

        /* Empty day */
        .hf-day-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 0;
          gap: 6px;
        }

        .hf-add-icon {
          font-size: 24px;
          color: var(--color-neutral-300);
        }

        .hf-add-text {
          font-size: 11px;
          color: var(--color-neutral-400);
        }

        /* Stats */
        .hf-stats {
          display: flex;
          gap: 24px;
          padding: 12px 16px;
          background: white;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-neutral-200);
          flex-wrap: wrap;
        }

        .hf-stat {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .hf-stat-label {
          font-size: 12px;
          color: var(--color-neutral-500);
        }

        .hf-stat-value {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-primary-600);
        }

        .hf-stat-value--over {
          color: var(--color-warning-600);
        }

        .hf-stat-value--under {
          color: var(--color-secondary-600);
        }

        /* Warning */
        .hf-warning {
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
          animation: hf-slide-up 0.3s ease;
        }

        @keyframes hf-slide-up {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .hf-header {
            flex-direction: column;
            align-items: stretch;
          }

          .hf-grid {
            grid-template-columns: 1fr;
          }

          .hf-stats {
            flex-direction: column;
            gap: 8px;
          }

          .hf-presets {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </>
  );
}
