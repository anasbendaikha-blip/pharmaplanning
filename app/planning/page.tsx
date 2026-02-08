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
import type { Shift, Conflict, WeeklyOpeningHours, Employee, EmployeeCategory } from '@/lib/types';

import WeekNavigation from './components/WeekNavigation';
import WeekView from './components/WeekView';
import DayView from './components/DayView';
import PaperView from './components/PaperView';
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
type ViewMode = 'week' | 'day' | 'paper';

/** Filtre catégorie */
type FilterType = 'all' | EmployeeCategory;

/** Noms courts des jours */
const DAY_TABS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** Couleurs de légende */
const LEGEND_ITEMS = [
  { color: '#2563eb', label: 'Pharmacien' },
  { color: '#10b981', label: 'Préparateur' },
  { color: '#f59e0b', label: 'Rayonniste' },
  { color: '#8b5cf6', label: 'Apprenti' },
  { color: '#ec4899', label: 'Étudiant' },
];

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

  // Mode de vue : semaine, jour ou papier
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  // Filtre catégorie
  const [filter, setFilter] = useState<FilterType>('all');

  // Masquer employés sans shifts
  const [hideEmpty, setHideEmpty] = useState(false);

  // Nombre de jours affichés en mode papier (3, 5 ou 6)
  const [paperDaysCount, setPaperDaysCount] = useState(3);

  // Persister les préférences
  useEffect(() => {
    const saved = localStorage.getItem('planning_view_mode');
    if (saved === 'week' || saved === 'day' || saved === 'paper') {
      setViewMode(saved);
    }
    const savedDays = localStorage.getItem('planning_paper_days');
    if (savedDays) {
      const n = Number(savedDays);
      if (n === 3 || n === 5 || n === 6) setPaperDaysCount(n);
    }
    const savedFilter = localStorage.getItem('planning_filter');
    if (savedFilter) setFilter(savedFilter as FilterType);
    const savedHide = localStorage.getItem('planning_hide_empty');
    if (savedHide === 'true') setHideEmpty(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('planning_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('planning_paper_days', String(paperDaysCount));
  }, [paperDaysCount]);

  useEffect(() => {
    localStorage.setItem('planning_filter', filter);
  }, [filter]);

  useEffect(() => {
    localStorage.setItem('planning_hide_empty', String(hideEmpty));
  }, [hideEmpty]);

  // Jour sélectionné (index 0-5 = Lun-Sam) pour la vue jour
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const dow = today.getDay();
    if (dow >= 1 && dow <= 6) return dow - 1;
    return 0;
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

  useEffect(() => {
    if (!organizationId || orgLoading) return;
    getEmployees(organizationId).then(setEmployees);
  }, [organizationId, orgLoading]);

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

  const handleWeekChange = useCallback((newMonday: Date) => {
    setCurrentMonday(newMonday);
  }, []);

  // ─── État du modal ───
  const [modalState, setModalState] = useState<ModalState>(INITIAL_MODAL_STATE);

  // ─── Validation ───
  const validationResult = useMemo(() => {
    if (!organizationId || employees.length === 0) {
      return { conflicts: [] as Conflict[], pharmacistCoveragePercent: 100 };
    }
    return validateWeeklyPlanning(
      shifts, employees, weekDates, OPENING_HOURS, organizationId,
      { maxDailyHours: 10, minRestHours: 35, minPharmacists: 1 }
    );
  }, [shifts, weekDates, employees, organizationId]);

  // ─── Statistiques ───
  const stats = useMemo(() => {
    const totalHours = shifts.reduce((sum, s) => sum + s.effective_hours, 0);
    const uniqueEmployees = new Set(shifts.map(s => s.employee_id)).size;
    const totalSlots = shifts.filter(s =>
      s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split'
    ).length;
    return { totalHours, uniqueEmployees, totalEmployees: employees.length, totalSlots };
  }, [shifts, employees]);

  // ─── Navigation ───
  const handlePrevious = useCallback(() => {
    handleWeekChange(addDays(currentMonday, -7));
  }, [currentMonday, handleWeekChange]);

  const handleNext = useCallback(() => {
    handleWeekChange(addDays(currentMonday, 7));
  }, [currentMonday, handleWeekChange]);

  const handleToday = useCallback(() => {
    handleWeekChange(getMonday(new Date()));
  }, [handleWeekChange]);

  // ─── Handlers ───
  const handleCellClick = useCallback((employeeId: string, date: string, shift: Shift | null) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    setModalState({ isOpen: true, employee, date, existingShift: shift });
  }, [employees]);

  const handleDayViewCellClick = useCallback((employeeId: string, date: string, shift: Shift | null) => {
    handleCellClick(employeeId, date, shift);
  }, [handleCellClick]);

  const handleModalClose = useCallback(() => {
    setModalState(INITIAL_MODAL_STATE);
  }, []);

  const handleSaveShift = useCallback(async (savedShift: Shift) => {
    if (!organizationId) return;
    const isNew = !modalState.existingShift;
    const empName = `${modalState.employee?.first_name} ${modalState.employee?.last_name}`;

    if (isNew) {
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

  const handleDeleteShift = useCallback(async (shiftId: string) => {
    const deletedShift = shifts.find(s => s.id === shiftId);
    const employee = deletedShift ? employees.find(e => e.id === deletedShift.employee_id) : null;
    const success = await dbDeleteShift(shiftId);
    if (success) {
      setShifts(prev => prev.filter(s => s.id !== shiftId));
      addToast('success', employee ? `Shift supprimé pour ${employee.first_name} ${employee.last_name}` : 'Shift supprimé');
    } else {
      addToast('error', 'Erreur lors de la suppression du shift');
    }
    setModalState(INITIAL_MODAL_STATE);
  }, [addToast, shifts, employees]);

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
    const hasErrors = [...dailyResult.conflicts, ...restResult.conflicts].some(c => c.severity === 'error');

    const updated = await dbUpdateShift(shiftId, { date: toDate });
    if (!updated) {
      addToast('error', 'Erreur lors du déplacement du shift');
      return;
    }
    if (hasErrors) {
      addToast('warning', 'Déplacement effectué — des conflits ont été détectés');
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
        {/* ═══ Header ═══ */}
        <div className="pl-header">
          <div className="pl-header-top">
            <h1 className="pl-title">Planning</h1>

            <div className="pl-nav-area">
              <WeekNavigation
                monday={currentMonday}
                onPrevious={handlePrevious}
                onNext={handleNext}
                onToday={handleToday}
                isCurrentWeek={isCurrentWeek}
              />
            </div>

            <div className="pl-header-actions">
              {/* Toggle vue */}
              <div className="pl-view-tabs">
                <button
                  className={`pl-view-tab ${viewMode === 'week' ? 'pl-view-tab--active' : ''}`}
                  onClick={() => setViewMode('week')}
                  type="button"
                >
                  Semaine
                </button>
                <button
                  className={`pl-view-tab ${viewMode === 'day' ? 'pl-view-tab--active' : ''}`}
                  onClick={() => setViewMode('day')}
                  type="button"
                >
                  Jour
                </button>
                <button
                  className={`pl-view-tab ${viewMode === 'paper' ? 'pl-view-tab--active' : ''}`}
                  onClick={() => setViewMode('paper')}
                  type="button"
                >
                  Papier
                </button>
              </div>

              {/* Filtre catégorie */}
              <select
                className="pl-filter-select"
                value={filter}
                onChange={e => setFilter(e.target.value as FilterType)}
              >
                <option value="all">Tous les rôles</option>
                <option value="pharmacien_titulaire">Pharmaciens Tit.</option>
                <option value="pharmacien_adjoint">Pharmaciens Adj.</option>
                <option value="preparateur">Préparateurs</option>
                <option value="rayonniste">Rayonnistes</option>
                <option value="apprenti">Apprentis</option>
                <option value="etudiant">Étudiants</option>
              </select>

              {/* Masquer vides */}
              <button
                className={`pl-toggle-btn ${hideEmpty ? 'pl-toggle-btn--active' : ''}`}
                onClick={() => setHideEmpty(v => !v)}
                type="button"
                title={hideEmpty ? 'Afficher tous les employés' : 'Masquer les employés sans shift'}
              >
                {hideEmpty ? '\uD83D\uDC41\uFE0F Actifs' : '\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8\uFE0F Tous'}
              </button>
            </div>
          </div>

          {/* Sub-header : stats + légende */}
          <div className="pl-subheader">
            <div className="pl-stats">
              <span className="pl-stat-pill">{stats.uniqueEmployees} présents</span>
              <span className="pl-stat-pill">{stats.totalSlots} créneaux</span>
              <span className="pl-stat-pill">{formatHours(stats.totalHours)} planifiées</span>
            </div>

            <div className="pl-legend">
              {LEGEND_ITEMS.map(item => (
                <span key={item.label} className="pl-legend-item">
                  <span className="pl-legend-bar" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>

          {/* Day tabs (vue jour uniquement) */}
          {viewMode === 'day' && (
            <div className="pl-day-tabs">
              {DAY_TABS.map((label, i) => (
                <button
                  key={i}
                  className={`pl-day-tab ${selectedDayIndex === i ? 'pl-day-tab--active' : ''} ${weekDates[i] === todayStr ? 'pl-day-tab--today' : ''}`}
                  onClick={() => setSelectedDayIndex(i)}
                  type="button"
                >
                  <span className="pl-day-tab-name">{label}</span>
                  <span className="pl-day-tab-date">{formatDayNum(weekDates[i])}</span>
                </button>
              ))}
            </div>
          )}

          {/* Conflits */}
          <ConflictSummary
            conflicts={validationResult.conflicts}
            pharmacistCoveragePercent={validationResult.pharmacistCoveragePercent}
          />
        </div>

        {/* ═══ Content ═══ */}
        <div className="pl-content">
          {(orgLoading || isLoadingData) ? (
            <div className="pl-loading">
              <span className="pl-spinner" />
              <span className="pl-loading-text">Chargement du planning...</span>
            </div>
          ) : viewMode === 'paper' ? (
            <div className="pl-paper-wrap">
              <div className="pl-paper-toolbar">
                <select
                  className="pl-paper-days"
                  value={paperDaysCount}
                  onChange={(e) => setPaperDaysCount(Number(e.target.value))}
                >
                  <option value={3}>3 jours (Lun-Mer)</option>
                  <option value={5}>5 jours (Lun-Ven)</option>
                  <option value={6}>6 jours (Lun-Sam)</option>
                </select>
                <button className="pl-print-btn" onClick={() => window.print()} type="button">
                  {'\uD83D\uDDA8\uFE0F'} Imprimer
                </button>
              </div>
              <PaperView
                employees={employees}
                shifts={shifts}
                weekDates={weekDates}
                visibleDays={paperDaysCount}
              />
            </div>
          ) : viewMode === 'week' ? (
            <WeekView
              employees={employees}
              shifts={shifts}
              conflicts={validationResult.conflicts}
              weekDates={weekDates}
              todayStr={todayStr}
              filter={filter}
              hideEmpty={hideEmpty}
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

        {/* Conflits détaillés */}
        {validationResult.conflicts.length > 0 && (
          <ConflictDetails conflicts={validationResult.conflicts} />
        )}
      </div>

      {/* Modal */}
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
          height: calc(100vh - var(--header-height, 64px) - var(--spacing-12, 48px));
          gap: 0;
        }

        /* ═══ Header ═══ */
        .pl-header {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: white;
          border-bottom: 2px solid var(--color-neutral-200);
        }

        .pl-header-top {
          display: flex;
          align-items: center;
          gap: var(--spacing-4);
          padding: var(--spacing-2) 0;
          flex-wrap: wrap;
        }

        .pl-title {
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          margin: 0;
          color: var(--color-neutral-900);
        }

        .pl-nav-area {
          flex: 1;
          min-width: 200px;
        }

        .pl-header-actions {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          flex-wrap: wrap;
        }

        /* View tabs */
        .pl-view-tabs {
          display: flex;
          gap: 2px;
          background: var(--color-neutral-100);
          padding: 3px;
          border-radius: var(--radius-md);
        }

        .pl-view-tab {
          padding: 5px 14px;
          border-radius: calc(var(--radius-md) - 2px);
          border: none;
          background: transparent;
          cursor: pointer;
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
          transition: all 0.15s;
        }

        .pl-view-tab:hover:not(.pl-view-tab--active) {
          color: var(--color-neutral-700);
        }

        .pl-view-tab--active {
          background: white;
          color: var(--color-primary-600);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        /* Filter select */
        .pl-filter-select {
          padding: 5px 10px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-700);
          background: white;
          cursor: pointer;
        }

        .pl-filter-select:focus {
          outline: none;
          border-color: var(--color-primary-400);
        }

        /* Toggle button */
        .pl-toggle-btn {
          padding: 5px 12px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          background: white;
          cursor: pointer;
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
          transition: all 0.15s;
          white-space: nowrap;
        }

        .pl-toggle-btn:hover {
          background: var(--color-neutral-50);
        }

        .pl-toggle-btn--active {
          background: var(--color-primary-50);
          border-color: var(--color-primary-300);
          color: var(--color-primary-700);
        }

        /* Sub-header */
        .pl-subheader {
          display: flex;
          align-items: center;
          gap: var(--spacing-4);
          padding: var(--spacing-2) 0;
          flex-wrap: wrap;
        }

        .pl-stats {
          display: flex;
          gap: var(--spacing-2);
        }

        .pl-stat-pill {
          padding: 3px 10px;
          background: var(--color-neutral-100);
          border-radius: var(--radius-full);
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
        }

        .pl-legend {
          display: flex;
          gap: var(--spacing-4);
          flex: 1;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .pl-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--color-neutral-500);
          font-weight: 500;
        }

        .pl-legend-bar {
          width: 14px;
          height: 6px;
          border-radius: 2px;
          flex-shrink: 0;
        }

        /* Day tabs (vue jour) */
        .pl-day-tabs {
          display: flex;
          gap: 2px;
          background: var(--color-neutral-100);
          border-radius: var(--radius-md);
          padding: 2px;
          margin: var(--spacing-1) 0;
        }

        .pl-day-tab {
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
          transition: all 0.15s;
        }

        .pl-day-tab:hover:not(.pl-day-tab--active) {
          background: var(--color-neutral-200);
        }

        .pl-day-tab--active {
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .pl-day-tab--today:not(.pl-day-tab--active) {
          background: var(--color-primary-50);
        }

        .pl-day-tab-name {
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
        }

        .pl-day-tab--active .pl-day-tab-name {
          color: var(--color-primary-600);
        }

        .pl-day-tab-date {
          font-size: 13px;
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
        }

        .pl-day-tab--active .pl-day-tab-date {
          color: var(--color-primary-700);
        }

        /* ═══ Content ═══ */
        .pl-content {
          flex: 1;
          min-height: 0;
          padding-top: var(--spacing-2);
        }

        .pl-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-3);
          height: 100%;
          min-height: 200px;
          color: var(--color-neutral-500);
        }

        .pl-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--color-neutral-200);
          border-top-color: var(--color-primary-500);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .pl-loading-text {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Paper view wrapper */
        .pl-paper-wrap {
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: white;
        }

        .pl-paper-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-2) var(--spacing-4);
          background: var(--color-neutral-50);
          border-bottom: 1px solid var(--color-neutral-200);
          gap: var(--spacing-3);
        }

        .pl-paper-days {
          padding: 5px 10px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-neutral-700);
          background: white;
          cursor: pointer;
        }

        .pl-print-btn {
          padding: 5px 14px;
          background: white;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }

        .pl-print-btn:hover {
          background: var(--color-neutral-100);
        }

        /* ═══ Print ═══ */
        @media print {
          .pl-header,
          .pl-paper-toolbar {
            display: none !important;
          }

          .planning-page {
            height: auto;
          }

          .pl-content {
            flex: none;
            padding-top: 0;
          }

          .pl-paper-wrap {
            border: none;
            border-radius: 0;
          }
        }

        /* ═══ Responsive ═══ */
        @media (max-width: 768px) {
          .pl-header-top {
            flex-direction: column;
            align-items: flex-start;
          }

          .pl-header-actions {
            width: 100%;
          }

          .pl-legend {
            display: none;
          }
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
          margin-top: var(--spacing-2);
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
