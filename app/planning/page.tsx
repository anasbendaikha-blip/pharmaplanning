'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  getMonday,
  getWeekDates,
  addDays,
  toISODateString,
  isSameDay,
} from '@/lib/utils/dateUtils';
import { formatHours } from '@/lib/utils/hourUtils';
import { validateWeeklyPlanning } from '@/lib/constraints';
import { validateDailyLimit } from '@/lib/constraints/dailyLimit';
import { validateRestPeriod } from '@/lib/constraints/restPeriod';
import { useToast } from '@/components/ui/Toast';
import { useOrganization } from '@/lib/supabase/client';
import {
  getEmployees,
  getShiftsForWeek,
  createShift as dbCreateShift,
  updateShift as dbUpdateShift,
  deleteShift as dbDeleteShift,
} from '@/lib/supabase/queries';
import type { Shift, Conflict, WeeklyOpeningHours, Employee } from '@/lib/types';

import WeekNavigation from './components/WeekNavigation';
import GanttChart from './components/GanttChart';
import DayView from './components/DayView';
import ConflictSummary from './components/ConflictSummary';
import ShiftModal from './components/ShiftModal';

/**
 * Horaires d'ouverture de la Pharmacie Isabelle MAURER
 */
const OPENING_HOURS: WeeklyOpeningHours = {
  0: { is_open: true, slots: [{ start: '08:30', end: '19:30' }] },
  1: { is_open: true, slots: [{ start: '08:30', end: '19:30' }] },
  2: { is_open: true, slots: [{ start: '08:30', end: '19:30' }] },
  3: { is_open: true, slots: [{ start: '08:30', end: '19:30' }] },
  4: { is_open: true, slots: [{ start: '08:30', end: '19:30' }] },
  5: { is_open: true, slots: [{ start: '08:30', end: '19:30' }] },
  6: { is_open: false, slots: [] },
};

/** Mode de vue */
type ViewMode = 'week' | 'day';

/** Noms courts des jours */
const DAY_TABS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** État du modal d'édition */
interface ModalState {
  isOpen: boolean;
  employee: Employee | null;
  date: string;
  existingShift: Shift | null;
}

const INITIAL_MODAL_STATE: ModalState = {
  isOpen: false,
  employee: null,
  date: '',
  existingShift: null,
};

export default function PlanningPage() {
  const { addToast } = useToast();
  const { organizationId, isLoading: orgLoading } = useOrganization();

  // Navigation semaine
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const today = new Date();
  const todayMonday = getMonday(today);
  const isCurrentWeek = isSameDay(currentMonday, todayMonday);
  const todayStr = toISODateString(today);

  // Mode de vue : semaine ou jour
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  // Jour sélectionné (index 0-5 = Lun-Sam) pour la vue jour
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    // Par défaut : jour courant si c'est un jour ouvré, sinon lundi
    const dow = today.getDay(); // 0=dim, 1=lun, ..., 6=sam
    if (dow >= 1 && dow <= 6) return dow - 1; // lun=0, sam=5
    return 0; // dimanche → on sélectionne lundi
  });

  // Dates de la semaine courante (Lun-Dim, 7 dates)
  const weekDates = useMemo(() => {
    return getWeekDates(currentMonday).map(d => toISODateString(d));
  }, [currentMonday]);

  // Date sélectionnée pour la vue jour
  const selectedDate = weekDates[selectedDayIndex] || weekDates[0];

  // ─── Données Supabase ───
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Charger les employés une seule fois (quand l'org est prête)
  useEffect(() => {
    if (!organizationId || orgLoading) return;
    getEmployees(organizationId).then(setEmployees);
  }, [organizationId, orgLoading]);

  // Charger les shifts quand la semaine ou l'org change
  useEffect(() => {
    if (!organizationId || orgLoading) return;
    let cancelled = false;
    const weekStart = weekDates[0];
    const weekEnd = weekDates[6];
    getShiftsForWeek(organizationId, weekStart, weekEnd)
      .then(data => { if (!cancelled) setShifts(data); })
      .finally(() => { if (!cancelled) setIsLoadingData(false); });
    return () => { cancelled = true; };
  }, [organizationId, orgLoading, weekDates]);

  // Navigation semaine
  const handleWeekChange = useCallback((newMonday: Date) => {
    setCurrentMonday(newMonday);
  }, []);

  // ─── État du modal ───
  const [modalState, setModalState] = useState<ModalState>(INITIAL_MODAL_STATE);

  // ─── Validation des contraintes pharmaceutiques ───
  const validationResult = useMemo(() => {
    if (!organizationId || employees.length === 0) {
      return { conflicts: [] as Conflict[], pharmacistCoveragePercent: 100 };
    }
    return validateWeeklyPlanning(
      shifts,
      employees,
      weekDates,
      OPENING_HOURS,
      organizationId,
      {
        maxDailyHours: 10,
        minRestHours: 35,
        minPharmacists: 1,
      }
    );
  }, [shifts, weekDates, employees, organizationId]);

  // Statistiques rapides
  const stats = useMemo(() => {
    const totalHours = shifts.reduce((sum, s) => sum + s.effective_hours, 0);
    const uniqueEmployees = new Set(shifts.map(s => s.employee_id)).size;
    return {
      totalHours,
      uniqueEmployees,
      totalEmployees: employees.length,
    };
  }, [shifts, employees]);

  // ─── Navigation semaine ───
  const handlePrevious = useCallback(() => {
    handleWeekChange(addDays(currentMonday, -7));
  }, [currentMonday, handleWeekChange]);

  const handleNext = useCallback(() => {
    handleWeekChange(addDays(currentMonday, 7));
  }, [currentMonday, handleWeekChange]);

  const handleToday = useCallback(() => {
    handleWeekChange(getMonday(new Date()));
  }, [handleWeekChange]);

  // ─── Handlers d'interaction ───

  /** Clic sur une cellule → ouvre le modal */
  const handleCellClick = useCallback((employeeId: string, date: string, shift: Shift | null) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;

    setModalState({
      isOpen: true,
      employee,
      date,
      existingShift: shift,
    });
  }, [employees]);

  /** Clic en vue jour → ouvre modal + switch en vue jour si nécessaire */
  const handleDayViewCellClick = useCallback((employeeId: string, date: string, shift: Shift | null) => {
    handleCellClick(employeeId, date, shift);
  }, [handleCellClick]);

  /** Fermer le modal */
  const handleModalClose = useCallback(() => {
    setModalState(INITIAL_MODAL_STATE);
  }, []);

  /** Sauvegarde d'un shift (création ou mise à jour via Supabase) */
  const handleSaveShift = useCallback(async (savedShift: Shift) => {
    if (!organizationId) return;

    const isNew = !modalState.existingShift;
    const empName = `${modalState.employee?.first_name} ${modalState.employee?.last_name}`;

    if (isNew) {
      // Création en base
      const created = await dbCreateShift(organizationId, {
        employee_id: savedShift.employee_id,
        date: savedShift.date,
        start_time: savedShift.start_time,
        end_time: savedShift.end_time,
        break_duration: savedShift.break_duration,
      });
      if (created) {
        setShifts(prev => [...prev, created]);
        addToast('success', `Shift créé pour ${empName}`);
      } else {
        addToast('error', `Erreur lors de la création du shift`);
      }
    } else {
      // Mise à jour en base
      const updated = await dbUpdateShift(savedShift.id, {
        start_time: savedShift.start_time,
        end_time: savedShift.end_time,
        break_duration: savedShift.break_duration,
        date: savedShift.date,
      });
      if (updated) {
        setShifts(prev => prev.map(s => s.id === updated.id ? { ...updated, organization_id: organizationId } : s));
        addToast('success', `Shift modifié pour ${empName}`);
      } else {
        addToast('error', `Erreur lors de la modification du shift`);
      }
    }

    setModalState(INITIAL_MODAL_STATE);
  }, [addToast, modalState.existingShift, modalState.employee, organizationId]);

  /** Suppression d'un shift via Supabase */
  const handleDeleteShift = useCallback(async (shiftId: string) => {
    const deletedShift = shifts.find(s => s.id === shiftId);
    const employee = deletedShift
      ? employees.find(e => e.id === deletedShift.employee_id)
      : null;

    const success = await dbDeleteShift(shiftId);
    if (success) {
      setShifts(prev => prev.filter(s => s.id !== shiftId));
      addToast(
        'success',
        employee
          ? `Shift supprimé pour ${employee.first_name} ${employee.last_name}`
          : 'Shift supprimé'
      );
    } else {
      addToast('error', 'Erreur lors de la suppression du shift');
    }
    setModalState(INITIAL_MODAL_STATE);
  }, [addToast, shifts, employees]);

  /** Déplacement d'un shift par drag & drop (persiste via Supabase) */
  const handleShiftDrop = useCallback(async (shiftId: string, employeeId: string, toDate: string) => {
    if (!organizationId) return;

    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) return;

    if (shift.employee_id !== employeeId) {
      addToast('error', 'Le déplacement inter-employé n\'est pas autorisé');
      return;
    }

    if (shift.date === toDate) return;

    const movedShift: Shift = { ...shift, date: toDate, updated_at: new Date().toISOString() };
    const otherShifts = shifts.filter(s => s.id !== shiftId);
    const employeeShifts = [...otherShifts.filter(s => s.employee_id === employeeId), movedShift];

    const dailyResult = validateDailyLimit(employeeId, employeeShifts, organizationId);
    const restResult = validateRestPeriod(employeeId, employeeShifts, organizationId);

    const hasErrors = [
      ...dailyResult.conflicts,
      ...restResult.conflicts,
    ].some(c => c.severity === 'error');

    // Persister en base
    const updated = await dbUpdateShift(shiftId, { date: toDate });
    if (!updated) {
      addToast('error', 'Erreur lors du déplacement du shift');
      return;
    }

    if (hasErrors) {
      addToast('warning', 'Déplacement effectué — des conflits ont été détectés, vérifiez le planning');
    }

    setShifts(prev => prev.map(s => s.id === shiftId ? { ...movedShift, organization_id: organizationId } : s));

    const employee = employees.find(e => e.id === employeeId);
    if (!hasErrors && employee) {
      addToast('success', `Shift de ${employee.first_name} déplacé au ${formatDateShort(toDate)}`);
    }
  }, [shifts, addToast, organizationId, employees]);

  return (
    <>
      <div className="planning-page">
        {/* En-tête Planning */}
        <div className="planning-header">
          <div className="planning-title-row">
            <h1 className="planning-title">Planning</h1>
            <div className="planning-title-right">
              {/* Toggle Semaine / Jour */}
              <div className="view-toggle">
                <button
                  className={`view-toggle-btn ${viewMode === 'week' ? 'view-toggle-btn--active' : ''}`}
                  onClick={() => setViewMode('week')}
                  type="button"
                >
                  Semaine
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'day' ? 'view-toggle-btn--active' : ''}`}
                  onClick={() => setViewMode('day')}
                  type="button"
                >
                  Jour
                </button>
              </div>
              <div className="planning-stats">
                <span className="stat-pill">
                  {stats.uniqueEmployees}/{stats.totalEmployees} employés
                </span>
                <span className="stat-pill">
                  {formatHours(stats.totalHours)} planifiées
                </span>
              </div>
            </div>
          </div>

          {/* Navigation semaine */}
          <WeekNavigation
            monday={currentMonday}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onToday={handleToday}
            isCurrentWeek={isCurrentWeek}
          />

          {/* Tabs de jours (affichés uniquement en vue Jour) */}
          {viewMode === 'day' && (
            <div className="day-tabs">
              {DAY_TABS.map((label, i) => (
                <button
                  key={i}
                  className={`day-tab ${selectedDayIndex === i ? 'day-tab--active' : ''} ${weekDates[i] === todayStr ? 'day-tab--today' : ''}`}
                  onClick={() => setSelectedDayIndex(i)}
                  type="button"
                >
                  <span className="day-tab-name">{label}</span>
                  <span className="day-tab-date">{formatDayNum(weekDates[i])}</span>
                </button>
              ))}
            </div>
          )}

          {/* Barre de résumé des conflits */}
          <ConflictSummary
            conflicts={validationResult.conflicts}
            pharmacistCoveragePercent={validationResult.pharmacistCoveragePercent}
          />
        </div>

        {/* ─── Zone de contenu : Semaine ou Jour ─── */}
        <div className="planning-content">
          {(orgLoading || isLoadingData) ? (
            <div className="loading-state">
              <span className="loading-spinner" />
              <span className="loading-text">Chargement du planning...</span>
            </div>
          ) : viewMode === 'week' ? (
            <GanttChart
              employees={employees}
              shifts={shifts}
              conflicts={validationResult.conflicts}
              weekDates={weekDates}
              todayStr={todayStr}
              onCellClick={handleCellClick}
              onShiftDrop={handleShiftDrop}
            />
          ) : (
            <DayView
              employees={employees}
              shifts={shifts}
              conflicts={validationResult.conflicts}
              date={selectedDate}
              onCellClick={handleDayViewCellClick}
            />
          )}
        </div>

        {/* Liste des conflits détaillée */}
        {validationResult.conflicts.length > 0 && (
          <ConflictDetails conflicts={validationResult.conflicts} />
        )}
      </div>

      {/* Modal de création/édition de shift */}
      {modalState.employee && (
        <ShiftModal
          key={`${modalState.employee?.id}-${modalState.date}-${modalState.existingShift?.id ?? 'new'}`}
          isOpen={modalState.isOpen}
          onClose={handleModalClose}
          employee={modalState.employee}
          date={modalState.date}
          existingShift={modalState.existingShift}
          allShifts={shifts}
          organizationId={organizationId || ''}
          onSave={handleSaveShift}
          onDelete={handleDeleteShift}
        />
      )}

      <style jsx>{`
        .planning-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-4);
          height: calc(100vh - var(--header-height) - var(--spacing-12));
        }

        .planning-header {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
        }

        .planning-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .planning-title {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          margin: 0;
        }

        .planning-title-right {
          display: flex;
          align-items: center;
          gap: var(--spacing-4);
        }

        /* ─── Toggle Semaine / Jour ─── */
        .view-toggle {
          display: flex;
          background: var(--color-neutral-100);
          border-radius: var(--radius-md);
          padding: 2px;
        }

        .view-toggle-btn {
          padding: 5px 14px;
          background: transparent;
          border: none;
          border-radius: calc(var(--radius-md) - 2px);
          cursor: pointer;
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
          transition: all 0.15s ease;
        }

        .view-toggle-btn:hover:not(.view-toggle-btn--active) {
          color: var(--color-neutral-700);
        }

        .view-toggle-btn--active {
          background: white;
          color: var(--color-primary-600);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        /* ─── Onglets jours (vue jour) ─── */
        .day-tabs {
          display: flex;
          gap: 2px;
          background: var(--color-neutral-100);
          border-radius: var(--radius-md);
          padding: 2px;
        }

        .day-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          padding: 6px 8px;
          background: transparent;
          border: none;
          border-radius: calc(var(--radius-md) - 2px);
          cursor: pointer;
          font-family: var(--font-family-primary);
          transition: all 0.15s ease;
        }

        .day-tab:hover:not(.day-tab--active) {
          background: var(--color-neutral-200);
        }

        .day-tab--active {
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .day-tab--today:not(.day-tab--active) {
          background: var(--color-primary-50);
        }

        .day-tab-name {
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
        }

        .day-tab--active .day-tab-name {
          color: var(--color-primary-600);
        }

        .day-tab-date {
          font-size: 13px;
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
        }

        .day-tab--active .day-tab-date {
          color: var(--color-primary-700);
        }

        .planning-stats {
          display: flex;
          gap: var(--spacing-2);
        }

        .stat-pill {
          padding: 2px var(--spacing-3);
          background-color: var(--color-neutral-100);
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-600);
        }

        .planning-content {
          flex: 1;
          min-height: 0;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-3);
          height: 100%;
          min-height: 200px;
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

/** Extrait le numéro de jour d'une date ISO "YYYY-MM-DD" → "03/02" */
function formatDayNum(isoDate: string): string {
  if (!isoDate) return '';
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}

/** Formatage court d'une date ISO → "lun 03/02" */
function formatDateShort(isoDate: string): string {
  const days = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${days[date.getDay()]} ${d.toString().padStart(2, '0')}/${m.toString().padStart(2, '0')}`;
}

/**
 * Panneau détaillé des conflits (collapsible)
 */
function ConflictDetails({ conflicts }: { conflicts: Conflict[] }) {
  const [isOpen, setIsOpen] = useState(false);

  const errors = conflicts.filter(c => c.severity === 'error');
  const warnings = conflicts.filter(c => c.severity === 'warning');

  return (
    <>
      <div className="conflict-details">
        <button
          className="conflict-toggle"
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          <span className="toggle-icon">{isOpen ? '\u25BC' : '\u25B6'}</span>
          <span className="toggle-label">
            Détail des conflits ({conflicts.length})
          </span>
        </button>

        {isOpen && (
          <div className="conflict-list">
            {errors.length > 0 && (
              <div className="conflict-group">
                <h4 className="conflict-group-title conflict-group-title--error">
                  Violations légales ({errors.length})
                </h4>
                {errors.map(c => (
                  <div key={c.id} className="conflict-item conflict-item--error">
                    <span className="conflict-item-icon">{'\u2717'}</span>
                    <span className="conflict-item-message">{c.message}</span>
                  </div>
                ))}
              </div>
            )}

            {warnings.length > 0 && (
              <div className="conflict-group">
                <h4 className="conflict-group-title conflict-group-title--warning">
                  Avertissements ({warnings.length})
                </h4>
                {warnings.map(c => (
                  <div key={c.id} className="conflict-item conflict-item--warning">
                    <span className="conflict-item-icon">{'\u26A0'}</span>
                    <span className="conflict-item-message">{c.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .conflict-details {
          flex-shrink: 0;
          background-color: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .conflict-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4);
          background: none;
          border: none;
          cursor: pointer;
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          color: var(--color-neutral-700);
          text-align: left;
        }

        .conflict-toggle:hover {
          background-color: var(--color-neutral-50);
        }

        .toggle-icon {
          font-size: 10px;
          color: var(--color-neutral-500);
        }

        .toggle-label {
          font-weight: var(--font-weight-medium);
        }

        .conflict-list {
          padding: 0 var(--spacing-4) var(--spacing-3);
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3);
          max-height: 200px;
          overflow-y: auto;
        }

        .conflict-group-title {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0 0 var(--spacing-1) 0;
        }

        .conflict-group-title--error {
          color: var(--color-danger-600);
        }

        .conflict-group-title--warning {
          color: var(--color-warning-600);
        }

        .conflict-item {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-2);
          padding: var(--spacing-1) var(--spacing-2);
          border-radius: var(--radius-sm);
          font-size: var(--font-size-xs);
        }

        .conflict-item--error {
          background-color: var(--color-danger-50);
          color: var(--color-danger-700);
        }

        .conflict-item--warning {
          background-color: var(--color-warning-50);
          color: var(--color-warning-700);
        }

        .conflict-item-icon {
          flex-shrink: 0;
          font-size: 10px;
          margin-top: 1px;
        }

        .conflict-item-message {
          line-height: 1.4;
        }
      `}</style>
    </>
  );
}
