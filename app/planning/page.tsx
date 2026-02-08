'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  getMonday,
  getWeekDates,
  addDays,
  toISODateString,
  isSameDay,
} from '@/lib/utils/dateUtils';
import { useToast } from '@/components/ui/Toast';
import { useOrganization } from '@/lib/supabase/client';
import {
  getEmployees,
  getShiftsForWeek,
  createShift as dbCreateShift,
  updateShift as dbUpdateShift,
  deleteShift as dbDeleteShift,
} from '@/lib/supabase/queries';
import type { Shift, Employee } from '@/lib/types';

import WeekNavigation from './components/WeekNavigation';
import GanttDayView from './components/GanttDayView';
import WeekGanttView from './components/WeekGanttView';
import ShiftModal from './components/ShiftModal';

/** Mode de vue : jour (Gantt detaille) ou semaine (Gantt global) */
type ViewMode = 'jour' | 'semaine';

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

  // Mode de vue : jour (defaut) ou semaine
  const [viewMode, setViewMode] = useState<ViewMode>('jour');

  // Jour sélectionné (index 0-5 = Lun-Sam) pour la vue jour
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    const dow = today.getDay();
    if (dow >= 1 && dow <= 6) return dow - 1;
    return 0;
  });

  // Persister vue
  useEffect(() => {
    const saved = localStorage.getItem('planning_view_mode');
    if (saved === 'jour' || saved === 'semaine') {
      setViewMode(saved);
    }
  }, []);

  useEffect(() => { localStorage.setItem('planning_view_mode', viewMode); }, [viewMode]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      // ← → Week navigation
      if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setCurrentMonday(prev => addDays(prev, -7));
        return;
      }
      if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setCurrentMonday(prev => addDays(prev, 7));
        return;
      }

      // T → Today
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setCurrentMonday(getMonday(new Date()));
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // ─── Handler : clic sur une cellule → ouvre modal ───
  const handleCellClick = useCallback((employeeId: string, date: string, shift: Shift | null) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    setModalState({ isOpen: true, employee, date, existingShift: shift });
  }, [employees]);

  // ─── Handler : clic sur timeline vide (Gantt) → ouvre modal avec heure pre-remplie ───
  const handleCreateAtTime = useCallback((employeeId: string, date: string, _startTime: string) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    // Ouvrir le modal en mode creation pour cet employe et cette date
    setModalState({ isOpen: true, employee, date, existingShift: null });
  }, [employees]);

  // ─── Handler : clic sur jour en semaine → switch vue jour ───
  const handleDayClick = useCallback((dayIndex: number) => {
    setSelectedDayIndex(dayIndex);
    setViewMode('jour');
  }, []);

  // ─── Modal handlers ───
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

  // ─── Handler : ouvrir modal creation sans employe pre-selectionne ───
  const handleAddShift = useCallback(() => {
    if (employees.length === 0) return;
    const emp = employees.find(e => e.is_active) || employees[0];
    setModalState({ isOpen: true, employee: emp, date: selectedDate, existingShift: null });
  }, [employees, selectedDate]);

  return (
    <>
      <div className="planning-page">
        {/* ═══ Header epure ═══ */}
        <header className="pl-header">
          <div className="pl-header-row">
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
              {/* Tabs Jour / Semaine */}
              <div className="pl-view-tabs">
                <button
                  className={`pl-view-tab ${viewMode === 'jour' ? 'pl-view-tab--active' : ''}`}
                  onClick={() => setViewMode('jour')}
                  type="button"
                >
                  Jour
                </button>
                <button
                  className={`pl-view-tab ${viewMode === 'semaine' ? 'pl-view-tab--active' : ''}`}
                  onClick={() => setViewMode('semaine')}
                  type="button"
                >
                  Semaine
                </button>
              </div>

              {/* Bouton + Ajouter */}
              <button
                className="pl-add-btn"
                onClick={handleAddShift}
                type="button"
              >
                + Ajouter
              </button>
            </div>
          </div>

          {/* Day tabs (vue jour uniquement) */}
          {viewMode === 'jour' && (
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
        </header>

        {/* ═══ Content ═══ */}
        <div className="pl-content">
          {(orgLoading || isLoadingData) ? (
            <div className="pl-loading">
              <span className="pl-spinner" />
              <span className="pl-loading-text">Chargement du planning...</span>
            </div>
          ) : viewMode === 'jour' ? (
            <GanttDayView
              employees={employees}
              shifts={shifts}
              date={selectedDate}
              todayStr={todayStr}
              onCellClick={handleCellClick}
              onCreateAtTime={handleCreateAtTime}
            />
          ) : (
            <WeekGanttView
              employees={employees}
              shifts={shifts}
              weekDates={weekDates}
              todayStr={todayStr}
              onDayClick={handleDayClick}
              onCellClick={handleCellClick}
            />
          )}
        </div>
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

        /* Header */
        .pl-header {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: white;
          border-bottom: 1px solid var(--color-neutral-200, #e5e7eb);
        }

        .pl-header-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 8px 0;
          flex-wrap: wrap;
        }

        .pl-title {
          font-size: 20px;
          font-weight: 700;
          margin: 0;
          color: var(--color-neutral-900, #111827);
        }

        .pl-nav-area {
          flex: 1;
          min-width: 200px;
        }

        .pl-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* View tabs */
        .pl-view-tabs {
          display: flex;
          gap: 2px;
          background: var(--color-neutral-100, #f3f4f6);
          padding: 3px;
          border-radius: 8px;
        }

        .pl-view-tab {
          padding: 6px 18px;
          border-radius: 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-500, #6b7280);
          transition: all 0.15s;
        }

        .pl-view-tab:hover:not(.pl-view-tab--active) {
          color: var(--color-neutral-700, #374151);
        }

        .pl-view-tab--active {
          background: white;
          color: var(--color-primary-600, #4f46e5);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        /* Add button */
        .pl-add-btn {
          padding: 6px 16px;
          background: var(--color-primary-600, #4f46e5);
          color: white;
          border: none;
          border-radius: 8px;
          font-family: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }

        .pl-add-btn:hover {
          background: var(--color-primary-700, #4338ca);
        }

        /* Day tabs */
        .pl-day-tabs {
          display: flex;
          gap: 2px;
          background: var(--color-neutral-100, #f3f4f6);
          border-radius: 8px;
          padding: 2px;
          margin: 4px 0;
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
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }

        .pl-day-tab:hover:not(.pl-day-tab--active) {
          background: var(--color-neutral-200, #e5e7eb);
        }

        .pl-day-tab--active {
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }

        .pl-day-tab--today:not(.pl-day-tab--active) {
          background: rgba(99, 102, 241, 0.08);
        }

        .pl-day-tab-name {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-neutral-500, #6b7280);
        }

        .pl-day-tab--active .pl-day-tab-name {
          color: var(--color-primary-600, #4f46e5);
        }

        .pl-day-tab-date {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-neutral-800, #1f2937);
        }

        .pl-day-tab--active .pl-day-tab-date {
          color: var(--color-primary-700, #4338ca);
        }

        /* Content */
        .pl-content {
          flex: 1;
          min-height: 0;
          padding-top: 8px;
        }

        .pl-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          height: 100%;
          min-height: 200px;
          color: var(--color-neutral-500, #6b7280);
        }

        .pl-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--color-neutral-200, #e5e7eb);
          border-top-color: var(--color-primary-500, #6366f1);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .pl-loading-text {
          font-size: 14px;
          font-weight: 500;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Print */
        @media print {
          .pl-header { display: none !important; }
          .planning-page { height: auto; }
          .pl-content { flex: none; padding-top: 0; }
        }

        /* Responsive */
        @media (max-width: 768px) {
          .pl-header-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .pl-header-actions { width: 100%; }
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

