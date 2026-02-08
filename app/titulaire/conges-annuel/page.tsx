/**
 * Page Calendrier des Conges — 3 Vues
 *
 * Toggle entre vue Hebdomadaire, Mensuelle et Annuelle.
 * Vue annuelle = calendrier mural 12 mois avec pastilles colorees.
 * Vue mensuelle = grille grand format avec noms des absents.
 * Vue hebdomadaire = detail semaine avec employes x jours.
 *
 * styled-jsx uniquement, CSS variables, pas de date-fns.
 */
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import {
  getMonday,
  getWeekDates,
  getWeekLabel,
  addDays,
  toISODateString,
  getDayShortFr,
} from '@/lib/utils/dateUtils';
import Link from 'next/link';

// ─── Types & constantes ───

type ViewMode = 'week' | 'month' | 'year';

interface AnnualLeave {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  type: string;
  status: string;
  business_days: number;
  notes: string | null;
  employee: {
    name: string;
    first_name: string;
    last_name: string;
    role: string;
  };
}

interface AnnualEmployee {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface AnnualStats {
  total: number;
  byType: Record<string, number>;
  byMonth: number[];
  totalDays: number;
}

const LEAVE_TYPES: Record<string, string> = {
  conge_paye: 'Conge paye',
  rtt: 'RTT',
  maladie: 'Maladie',
  sans_solde: 'Sans solde',
  formation: 'Formation',
  autre: 'Autre',
};

const LEAVE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  conge_paye: { bg: 'var(--color-primary-50)', text: 'var(--color-primary-700)', bar: 'var(--color-primary-500)' },
  rtt: { bg: '#ede9fe', text: '#7c3aed', bar: '#8b5cf6' },
  maladie: { bg: 'var(--color-danger-50)', text: 'var(--color-danger-700)', bar: 'var(--color-danger-500)' },
  sans_solde: { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-700)', bar: 'var(--color-neutral-500)' },
  formation: { bg: 'var(--color-warning-50)', text: 'var(--color-warning-700)', bar: 'var(--color-warning-500)' },
  autre: { bg: 'var(--color-secondary-50)', text: 'var(--color-secondary-700)', bar: 'var(--color-secondary-500)' },
};

const MONTHS_FR_SHORT = [
  'Janv.', 'Fevr.', 'Mars', 'Avr.', 'Mai', 'Juin',
  'Juil.', 'Aout', 'Sept.', 'Oct.', 'Nov.', 'Dec.',
];

const MONTHS_FULL = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// ─── Helpers ───

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getEmployeeDisplayName(emp: AnnualEmployee | AnnualLeave['employee']): string {
  if (emp.first_name || emp.last_name) {
    return `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
  }
  return emp.name || 'Inconnu';
}

function makeDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ─── Composant ───

export default function CongesAnnuelPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();

  // Vue
  const [viewMode, setViewMode] = useState<ViewMode>('year');

  // Annee
  const [year, setYear] = useState(new Date().getFullYear());

  // Navigation mois (vue mensuelle)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  // Navigation semaine (vue hebdomadaire)
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  // Donnees
  const [leaves, setLeaves] = useState<AnnualLeave[]>([]);
  const [employees, setEmployees] = useState<AnnualEmployee[]>([]);
  const [stats, setStats] = useState<AnnualStats>({ total: 0, byType: {}, byMonth: Array(12).fill(0), totalDays: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Filtres
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('approved');

  // Popover jour
  const [selectedDay, setSelectedDay] = useState<{
    dateStr: string;
    day: number;
    month: number;
    leaves: AnnualLeave[];
    x: number;
    y: number;
  } | null>(null);

  // ─── Chargement ───

  const loadData = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        organizationId,
        year: String(year),
      });

      if (filterEmployee !== 'all') params.set('employeeId', filterEmployee);
      if (filterType !== 'all') params.set('type', filterType);
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`/api/leaves/annual?${params.toString()}`);
      if (!res.ok) throw new Error('Erreur chargement');

      const data = await res.json();
      setLeaves(data.leaves || []);
      setEmployees(data.employees || []);
      setStats(data.stats || { total: 0, byType: {}, byMonth: Array(12).fill(0), totalDays: 0 });
    } catch (error) {
      console.error('Erreur chargement conges annuels:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, year, filterEmployee, filterType, filterStatus]);

  useEffect(() => {
    if (!orgLoading && organizationId) loadData();
  }, [orgLoading, organizationId, loadData]);

  // ─── Leaves par jour (Map<dateStr, AnnualLeave[]>) ───

  const leavesPerDay = useMemo(() => {
    const map = new Map<string, AnnualLeave[]>();
    for (const leave of leaves) {
      const start = new Date(leave.start_date + 'T12:00:00');
      const end = new Date(leave.end_date + 'T12:00:00');
      const d = new Date(start);
      while (d <= end) {
        const key = toISODateString(d);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(leave);
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [leaves]);

  // ─── Employes avec conges (pour stats) ───

  const employeesWithLeaves = useMemo(() => {
    const empLeavesMap = new Map<string, AnnualLeave[]>();
    for (const leave of leaves) {
      if (!empLeavesMap.has(leave.employee_id)) {
        empLeavesMap.set(leave.employee_id, []);
      }
      empLeavesMap.get(leave.employee_id)!.push(leave);
    }

    const employeesToShow = filterEmployee === 'all'
      ? employees
      : employees.filter(e => e.id === filterEmployee);

    const result: Array<{
      employee: AnnualEmployee;
      leaves: AnnualLeave[];
      totalDays: number;
    }> = [];

    for (const emp of employeesToShow) {
      const empLeaves = empLeavesMap.get(emp.id) || [];
      result.push({
        employee: emp,
        leaves: empLeaves,
        totalDays: empLeaves.reduce((sum, l) => sum + (l.business_days || 0), 0),
      });
    }

    result.sort((a, b) => {
      if (a.leaves.length > 0 && b.leaves.length === 0) return -1;
      if (a.leaves.length === 0 && b.leaves.length > 0) return 1;
      return getEmployeeDisplayName(a.employee).localeCompare(getEmployeeDisplayName(b.employee));
    });

    return result;
  }, [leaves, employees, filterEmployee]);

  // ─── Navigation ───

  const handlePrevYear = () => setYear(y => y - 1);
  const handleNextYear = () => setYear(y => y + 1);
  const handleCurrentYear = () => setYear(new Date().getFullYear());

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const handlePrevWeek = () => setWeekStart(w => addDays(w, -7));
  const handleNextWeek = () => setWeekStart(w => addDays(w, 7));
  const handleCurrentWeek = () => setWeekStart(getMonday(new Date()));

  // ─── Popover handlers ───

  const handleDayClick = (
    dateStr: string,
    day: number,
    month: number,
    dayLeaves: AnnualLeave[],
    event: React.MouseEvent,
  ) => {
    if (dayLeaves.length === 0) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setSelectedDay({
      dateStr,
      day,
      month,
      leaves: dayLeaves,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 4,
    });
  };

  useEffect(() => {
    if (!selectedDay) return;
    const handleClose = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.day-popover')) setSelectedDay(null);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedDay(null);
    };
    document.addEventListener('mousedown', handleClose);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClose);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [selectedDay]);

  // ─── Stats ───

  const busiestMonth = useMemo(() => {
    const maxIdx = stats.byMonth.indexOf(Math.max(...stats.byMonth));
    return stats.byMonth[maxIdx] > 0 ? MONTHS_FULL[maxIdx] : '-';
  }, [stats.byMonth]);

  const handlePrint = () => window.print();

  // ─── Week view data ───

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const weekDateStrs = useMemo(() => weekDates.map(d => toISODateString(d)), [weekDates]);

  const weekEmployees = useMemo(() => {
    // Get employees who have leaves during this week
    const empIds = new Set<string>();
    for (const dateStr of weekDateStrs) {
      const dayLeaves = leavesPerDay.get(dateStr) || [];
      for (const l of dayLeaves) empIds.add(l.employee_id);
    }

    const employeesToShow = filterEmployee === 'all'
      ? employees.filter(e => empIds.has(e.id))
      : employees.filter(e => e.id === filterEmployee && empIds.has(e.id));

    return employeesToShow.sort((a, b) =>
      getEmployeeDisplayName(a).localeCompare(getEmployeeDisplayName(b))
    );
  }, [weekDateStrs, leavesPerDay, employees, filterEmployee]);

  // ─── Rendu ───

  if (orgLoading || (isLoading && leaves.length === 0)) {
    return (
      <>
        <div className="loading-page">
          <span className="loading-spinner" />
          <span>Chargement du calendrier...</span>
        </div>
        <style jsx>{`
          .loading-page {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: var(--spacing-3); height: 400px; color: var(--color-neutral-500);
          }
          .loading-spinner {
            width: 36px; height: 36px; border: 3px solid var(--color-neutral-200);
            border-top-color: var(--color-primary-500); border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </>
    );
  }

  // ─── Rendu vue annuelle ───
  const renderYearView = () => {
    const today = new Date();

    return (
      <section className="calendar-section">
        <div className="calendar-wall">
          {Array.from({ length: 12 }, (_, monthIndex) => {
            const daysInMonth = getDaysInMonth(year, monthIndex);
            const firstDay = new Date(year, monthIndex, 1);
            const firstDayCol = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

            return (
              <div key={monthIndex} className="month-card">
                <div className="month-card-header">
                  <span className="month-card-title">{MONTHS_FULL[monthIndex]}</span>
                  {stats.byMonth[monthIndex] > 0 && (
                    <span className="month-card-badge">{stats.byMonth[monthIndex]}</span>
                  )}
                </div>

                <div className="month-grid">
                  {DAY_LETTERS.map((d, i) => (
                    <div key={i} className={`day-header ${i >= 5 ? 'day-header--weekend' : ''}`}>{d}</div>
                  ))}

                  {Array.from({ length: firstDayCol }, (_, i) => (
                    <div key={`e-${i}`} className="day-cell day-cell--empty" />
                  ))}

                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dateStr = makeDateStr(year, monthIndex, day);
                    const colIndex = (firstDayCol + i) % 7;
                    const isWeekend = colIndex >= 5;
                    const isTodayCell = year === today.getFullYear() && monthIndex === today.getMonth() && day === today.getDate();
                    const dayLeaves = leavesPerDay.get(dateStr) || [];
                    const maxDots = 4;
                    const extraCount = dayLeaves.length > maxDots ? dayLeaves.length - maxDots : 0;

                    return (
                      <div
                        key={day}
                        className={[
                          'day-cell',
                          isWeekend ? 'day-cell--weekend' : '',
                          isTodayCell ? 'day-cell--today' : '',
                          dayLeaves.length > 0 ? 'day-cell--has-leaves' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={(e) => handleDayClick(dateStr, day, monthIndex, dayLeaves, e)}
                      >
                        <span className="day-number">{day}</span>
                        {dayLeaves.length > 0 && (
                          <div className="day-dots">
                            {dayLeaves.slice(0, maxDots).map((leave, li) => (
                              <span
                                key={li}
                                className="day-dot"
                                style={{ backgroundColor: (LEAVE_COLORS[leave.type] || LEAVE_COLORS.autre).bar }}
                              />
                            ))}
                            {extraCount > 0 && (
                              <span className="day-dot-extra">+{extraCount}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  // ─── Rendu vue mensuelle ───
  const renderMonthView = () => {
    const today = new Date();
    const daysInMonth = getDaysInMonth(year, selectedMonth);
    const firstDay = new Date(year, selectedMonth, 1);
    const firstDayCol = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    return (
      <section className="calendar-section">
        {/* Navigation mois */}
        <div className="sub-nav">
          <button type="button" className="nav-btn" onClick={handlePrevMonth}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h3 className="sub-nav-title">{MONTHS_FULL[selectedMonth]} {year}</h3>
          <button type="button" className="nav-btn" onClick={handleNextMonth}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div className="month-large-grid">
          {DAY_LETTERS.map((d, i) => (
            <div key={i} className={`ml-day-header ${i >= 5 ? 'ml-day-header--weekend' : ''}`}>
              {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][i]}
            </div>
          ))}

          {Array.from({ length: firstDayCol }, (_, i) => (
            <div key={`e-${i}`} className="ml-cell ml-cell--empty" />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = makeDateStr(year, selectedMonth, day);
            const colIndex = (firstDayCol + i) % 7;
            const isWeekend = colIndex >= 5;
            const isTodayCell = year === today.getFullYear() && selectedMonth === today.getMonth() && day === today.getDate();
            const dayLeaves = leavesPerDay.get(dateStr) || [];
            const maxVisible = 3;
            const extraCount = dayLeaves.length > maxVisible ? dayLeaves.length - maxVisible : 0;

            return (
              <div
                key={day}
                className={[
                  'ml-cell',
                  isWeekend ? 'ml-cell--weekend' : '',
                  isTodayCell ? 'ml-cell--today' : '',
                  dayLeaves.length > 0 ? 'ml-cell--has-leaves' : '',
                ].filter(Boolean).join(' ')}
                onClick={(e) => handleDayClick(dateStr, day, selectedMonth, dayLeaves, e)}
              >
                <span className="ml-day-number">{day}</span>
                {dayLeaves.length > 0 && (
                  <div className="ml-leaves-list">
                    {dayLeaves.slice(0, maxVisible).map((leave, li) => {
                      const colors = LEAVE_COLORS[leave.type] || LEAVE_COLORS.autre;
                      return (
                        <div key={li} className="ml-leave-item">
                          <span className="ml-leave-dot" style={{ backgroundColor: colors.bar }} />
                          <span className="ml-leave-name">{getEmployeeDisplayName(leave.employee)}</span>
                        </div>
                      );
                    })}
                    {extraCount > 0 && (
                      <span className="ml-leave-extra">+{extraCount} autre{extraCount > 1 ? 's' : ''}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  // ─── Rendu vue hebdomadaire ───
  const renderWeekView = () => {
    const today = new Date();

    return (
      <section className="calendar-section">
        {/* Navigation semaine */}
        <div className="sub-nav">
          <button type="button" className="nav-btn" onClick={handlePrevWeek}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="sub-nav-center">
            <h3 className="sub-nav-title">{getWeekLabel(weekStart)}</h3>
            <button type="button" className="today-btn-sm" onClick={handleCurrentWeek}>
              Cette semaine
            </button>
          </div>
          <button type="button" className="nav-btn" onClick={handleNextWeek}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div className="week-grid">
          {/* Header */}
          <div className="wk-header-corner">Employe</div>
          {weekDates.map((date, i) => {
            const dateStr = weekDateStrs[i];
            const isTodayCol = toISODateString(today) === dateStr;
            const isWeekend = i >= 5;
            const dayLeaves = leavesPerDay.get(dateStr) || [];
            return (
              <div
                key={i}
                className={[
                  'wk-header-day',
                  isTodayCol ? 'wk-header-day--today' : '',
                  isWeekend ? 'wk-header-day--weekend' : '',
                ].filter(Boolean).join(' ')}
              >
                <span className="wk-header-dayname">{getDayShortFr(date)}</span>
                <span className="wk-header-date">{date.getDate()}/{date.getMonth() + 1}</span>
                {dayLeaves.length > 0 && (
                  <span className="wk-header-count">{dayLeaves.length}</span>
                )}
              </div>
            );
          })}

          {/* Rows par employe */}
          {weekEmployees.length === 0 ? (
            <div className="wk-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <p>Aucune absence cette semaine</p>
            </div>
          ) : (
            weekEmployees.map(emp => (
              <React.Fragment key={emp.id}>
                <div className="wk-cell-emp">
                  <span className="wk-emp-name">{getEmployeeDisplayName(emp)}</span>
                  <span className="wk-emp-role">{emp.role}</span>
                </div>
                {weekDateStrs.map((dateStr, i) => {
                  const dayLeaves = (leavesPerDay.get(dateStr) || []).filter(l => l.employee_id === emp.id);
                  const isWeekend = i >= 5;
                  const isTodayCol = toISODateString(today) === dateStr;

                  return (
                    <div
                      key={dateStr}
                      className={[
                        'wk-cell',
                        isWeekend ? 'wk-cell--weekend' : '',
                        isTodayCol ? 'wk-cell--today' : '',
                        dayLeaves.length > 0 ? 'wk-cell--active' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={(e) => {
                        if (dayLeaves.length > 0) {
                          const d = new Date(dateStr + 'T12:00:00');
                          handleDayClick(dateStr, d.getDate(), d.getMonth(), dayLeaves, e);
                        }
                      }}
                    >
                      {dayLeaves.map((leave, li) => {
                        const colors = LEAVE_COLORS[leave.type] || LEAVE_COLORS.autre;
                        return (
                          <div
                            key={li}
                            className="wk-leave-bar"
                            style={{ backgroundColor: colors.bar }}
                            title={LEAVE_TYPES[leave.type] || leave.type}
                          >
                            <span className="wk-leave-label">{LEAVE_TYPES[leave.type] || leave.type}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </React.Fragment>
            ))
          )}
        </div>
      </section>
    );
  };

  return (
    <>
      <div className="annual-page">
        {/* ─── Header ─── */}
        <section className="page-header">
          <div className="header-left">
            <Link href="/" className="back-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Tableau de bord
            </Link>
            <h1 className="page-title">Calendrier des Conges</h1>
            <p className="page-subtitle">Vue d&#39;ensemble des absences — {year}</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-outline" onClick={handlePrint}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Exporter PDF
            </button>
          </div>
        </section>

        {/* ─── Navigation annee ─── */}
        <section className="year-navigation">
          <button type="button" className="nav-btn" onClick={handlePrevYear}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="year-center">
            <h2 className="year-title">{year}</h2>
            {year !== new Date().getFullYear() && (
              <button type="button" className="today-btn" onClick={handleCurrentYear}>
                Aujourd&#39;hui
              </button>
            )}
          </div>
          <button type="button" className="nav-btn" onClick={handleNextYear}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </section>

        {/* ─── Stats ─── */}
        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total conges</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.totalDays}j</span>
            <span className="stat-label">Jours d&#39;absence</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{employeesWithLeaves.filter(e => e.leaves.length > 0).length}</span>
            <span className="stat-label">Employes concernes</span>
          </div>
          <div className="stat-card">
            <span className="stat-value stat-value--accent">{busiestMonth}</span>
            <span className="stat-label">Mois le plus charge</span>
          </div>
        </section>

        {/* ─── Filtres ─── */}
        <section className="filters-section">
          <div className="filter-group">
            <label htmlFor="filter-employee" className="filter-label">Employe</label>
            <select id="filter-employee" className="filter-select" value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}>
              <option value="all">Tous les employes</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{getEmployeeDisplayName(emp)}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-type" className="filter-label">Type</label>
            <select id="filter-type" className="filter-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">Tous les types</option>
              {Object.entries(LEAVE_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="filter-status" className="filter-label">Statut</label>
            <select id="filter-status" className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="all">Tous les statuts</option>
              <option value="approved">Approuve</option>
              <option value="pending">En attente</option>
              <option value="rejected">Refuse</option>
            </select>
          </div>
        </section>

        {/* ─── Toggle de vue ─── */}
        <section className="view-toggle">
          <button
            type="button"
            className={`toggle-btn ${viewMode === 'week' ? 'toggle-btn--active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Semaine
          </button>
          <button
            type="button"
            className={`toggle-btn ${viewMode === 'month' ? 'toggle-btn--active' : ''}`}
            onClick={() => setViewMode('month')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            Mois
          </button>
          <button
            type="button"
            className={`toggle-btn ${viewMode === 'year' ? 'toggle-btn--active' : ''}`}
            onClick={() => setViewMode('year')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"/>
              <path d="M4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z"/>
              <path d="M16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
            </svg>
            Annee
          </button>
        </section>

        {/* ─── Legende ─── */}
        <section className="legend-section">
          {Object.entries(LEAVE_TYPES).map(([key, label]) => {
            const colors = LEAVE_COLORS[key];
            return (
              <div key={key} className="legend-item">
                <span className="legend-color" style={{ backgroundColor: colors?.bar || 'var(--color-neutral-400)' }} />
                <span className="legend-label">{label}</span>
                {stats.byType[key] ? <span className="legend-count">{stats.byType[key]}</span> : null}
              </div>
            );
          })}
        </section>

        {/* ─── Contenu conditionnel ─── */}
        {viewMode === 'year' && renderYearView()}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}

        {/* ─── Repartition mensuelle ─── */}
        <section className="monthly-chart">
          <h3 className="section-title">Repartition mensuelle</h3>
          <div className="chart-bars">
            {stats.byMonth.map((count, i) => {
              const maxCount = Math.max(...stats.byMonth, 1);
              const heightPct = (count / maxCount) * 100;
              return (
                <div key={i} className="chart-col">
                  <div className="chart-bar-wrapper">
                    <div className="chart-bar" style={{ height: `${heightPct}%` }} />
                  </div>
                  <span className="chart-label">{MONTHS_FR_SHORT[i]}</span>
                  {count > 0 && <span className="chart-value">{count}</span>}
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── Detail par type ─── */}
        {Object.keys(stats.byType).length > 0 && (
          <section className="type-breakdown">
            <h3 className="section-title">Detail par type de conge</h3>
            <div className="type-grid">
              {Object.entries(stats.byType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const colors = LEAVE_COLORS[type] || LEAVE_COLORS.autre;
                  const percentage = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <div key={type} className="type-card">
                      <div className="type-header">
                        <span className="type-dot" style={{ backgroundColor: colors.bar }} />
                        <span className="type-name">{LEAVE_TYPES[type] || type}</span>
                      </div>
                      <div className="type-stats">
                        <span className="type-count">{count}</span>
                        <span className="type-pct">{percentage}%</span>
                      </div>
                      <div className="type-progress-track">
                        <div className="type-progress-fill" style={{ width: `${percentage}%`, backgroundColor: colors.bar }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}
      </div>

      {/* ─── Popover detail jour ─── */}
      {selectedDay && (
        <div
          className="day-popover"
          style={{ left: `${selectedDay.x}px`, top: `${selectedDay.y}px` }}
        >
          <div className="popover-header">
            <span className="popover-date">
              {selectedDay.day} {MONTHS_FULL[selectedDay.month]} {year}
            </span>
            <span className="popover-count">
              {selectedDay.leaves.length} absence{selectedDay.leaves.length !== 1 ? 's' : ''}
            </span>
            <button type="button" className="popover-close" onClick={() => setSelectedDay(null)}>
              &times;
            </button>
          </div>
          <div className="popover-body">
            {selectedDay.leaves.map((leave, i) => {
              const colors = LEAVE_COLORS[leave.type] || LEAVE_COLORS.autre;
              return (
                <div key={`${leave.id}-${i}`} className="popover-leave">
                  <span className="popover-dot" style={{ backgroundColor: colors.bar }} />
                  <div className="popover-leave-info">
                    <span className="popover-emp-name">{getEmployeeDisplayName(leave.employee)}</span>
                    <span className="popover-leave-type" style={{ color: colors.text }}>
                      {LEAVE_TYPES[leave.type] || leave.type}
                    </span>
                    <span className="popover-leave-dates">
                      {new Date(leave.start_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {' - '}
                      {new Date(leave.end_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {' '}({leave.business_days || 0}j)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style jsx global>{`
        /* ─── Page layout ─── */
        .annual-page { display: flex; flex-direction: column; gap: var(--spacing-5); }

        /* ─── Header ─── */
        .annual-page .page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--spacing-3); }
        .annual-page .header-left { display: flex; flex-direction: column; gap: var(--spacing-1); }
        .annual-page .header-left .back-link {
          display: inline-flex; align-items: center; gap: var(--spacing-1);
          font-size: var(--font-size-xs); color: var(--color-primary-600);
          text-decoration: none; margin-bottom: var(--spacing-2);
        }
        .annual-page .header-left .back-link:hover { color: var(--color-primary-700); }
        .annual-page .page-title { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); color: var(--color-neutral-900); margin: 0; }
        .annual-page .page-subtitle { font-size: var(--font-size-sm); color: var(--color-neutral-500); margin: 0; }
        .annual-page .header-actions { display: flex; gap: var(--spacing-2); flex-wrap: wrap; }
        .annual-page .btn-outline {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-300); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold); color: var(--color-neutral-700);
          cursor: pointer; transition: all 0.15s ease;
        }
        .annual-page .btn-outline:hover { background: var(--color-neutral-50); border-color: var(--color-neutral-400); }

        /* ─── Year nav ─── */
        .annual-page .year-navigation {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--spacing-3) var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg);
        }
        .annual-page .nav-btn {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          cursor: pointer; color: var(--color-neutral-600); transition: all 0.15s ease;
        }
        .annual-page .nav-btn:hover { background: var(--color-neutral-50); border-color: var(--color-neutral-300); }
        .annual-page .year-center { display: flex; align-items: center; gap: var(--spacing-3); }
        .annual-page .year-title { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-neutral-900); margin: 0; }
        .annual-page .today-btn {
          padding: var(--spacing-1) var(--spacing-3);
          background: var(--color-primary-50); border: 1px solid var(--color-primary-200);
          border-radius: var(--radius-md); font-family: var(--font-family-primary);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
          color: var(--color-primary-700); cursor: pointer; transition: all 0.15s ease;
        }
        .annual-page .today-btn:hover { background: var(--color-primary-100); }

        /* ─── Stats ─── */
        .annual-page .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-4); }
        .annual-page .stat-card {
          display: flex; flex-direction: column; align-items: center; gap: var(--spacing-1);
          padding: var(--spacing-4); background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg);
        }
        .annual-page .stat-value { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-primary-600); }
        .annual-page .stat-value--accent { font-size: var(--font-size-base); color: var(--color-warning-600); }
        .annual-page .stat-label { font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); color: var(--color-neutral-500); text-align: center; }

        /* ─── Filters ─── */
        .annual-page .filters-section {
          display: flex; gap: var(--spacing-4); flex-wrap: wrap; padding: var(--spacing-4);
          background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg);
        }
        .annual-page .filter-group { display: flex; flex-direction: column; gap: var(--spacing-1); flex: 1; min-width: 160px; }
        .annual-page .filter-label { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--color-neutral-600); text-transform: uppercase; letter-spacing: 0.03em; }
        .annual-page .filter-select {
          padding: var(--spacing-2) var(--spacing-3); border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md); font-family: var(--font-family-primary);
          font-size: var(--font-size-sm); color: var(--color-neutral-700);
          background: white; cursor: pointer; transition: border-color 0.15s ease;
        }
        .annual-page .filter-select:focus { outline: none; border-color: var(--color-primary-500); box-shadow: 0 0 0 2px var(--color-primary-100); }

        /* ─── View toggle ─── */
        .annual-page .view-toggle { display: flex; gap: var(--spacing-2); }
        .annual-page .toggle-btn {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium); color: var(--color-neutral-600);
          cursor: pointer; transition: all 0.15s ease;
        }
        .annual-page .toggle-btn:hover { border-color: var(--color-neutral-300); background: var(--color-neutral-50); }
        .annual-page .toggle-btn--active { background: var(--color-primary-600); border-color: var(--color-primary-600); color: white; }
        .annual-page .toggle-btn--active:hover { background: var(--color-primary-700); }

        /* ─── Legend ─── */
        .annual-page .legend-section {
          display: flex; flex-wrap: wrap; gap: var(--spacing-4);
          padding: var(--spacing-3) var(--spacing-4);
          background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg);
        }
        .annual-page .legend-item { display: flex; align-items: center; gap: var(--spacing-2); }
        .annual-page .legend-color { width: 12px; height: 12px; border-radius: var(--radius-sm); flex-shrink: 0; }
        .annual-page .legend-label { font-size: var(--font-size-xs); color: var(--color-neutral-600); font-weight: var(--font-weight-medium); }
        .annual-page .legend-count {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 18px; height: 18px; padding: 0 4px;
          background: var(--color-neutral-100); border-radius: var(--radius-full);
          font-size: 11px; font-weight: var(--font-weight-bold); color: var(--color-neutral-600);
        }

        /* ─── Sub navigation (month/week) ─── */
        .annual-page .sub-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--spacing-3) var(--spacing-4);
          border-bottom: 1px solid var(--color-neutral-200);
        }
        .annual-page .sub-nav-center { display: flex; align-items: center; gap: var(--spacing-3); }
        .annual-page .sub-nav-title { font-size: var(--font-size-md); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); margin: 0; }
        .annual-page .today-btn-sm {
          padding: 2px var(--spacing-2); background: var(--color-primary-50);
          border: 1px solid var(--color-primary-200); border-radius: var(--radius-sm);
          font-family: var(--font-family-primary); font-size: 11px;
          font-weight: var(--font-weight-semibold); color: var(--color-primary-700);
          cursor: pointer; transition: all 0.15s ease;
        }
        .annual-page .today-btn-sm:hover { background: var(--color-primary-100); }

        /* ─── Calendar section (shared) ─── */
        .annual-page .calendar-section {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); overflow: hidden;
        }

        /* ════════════════════════════════════════════════
           VUE ANNUELLE — Calendrier mural 12 mois
           ════════════════════════════════════════════════ */
        .annual-page .calendar-wall {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 0; padding: 0;
        }
        .annual-page .month-card {
          padding: var(--spacing-3);
          border-right: 1px solid var(--color-neutral-100);
          border-bottom: 1px solid var(--color-neutral-100);
        }
        .annual-page .month-card:nth-child(4n) { border-right: none; }
        .annual-page .month-card:nth-child(n+9) { border-bottom: none; }

        .annual-page .month-card-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: var(--spacing-2); padding-bottom: var(--spacing-1);
          border-bottom: 1px solid var(--color-neutral-100);
        }
        .annual-page .month-card-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); }
        .annual-page .month-card-badge {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 20px; height: 20px; padding: 0 5px;
          background: var(--color-primary-100); color: var(--color-primary-700);
          border-radius: var(--radius-full); font-size: 11px; font-weight: var(--font-weight-bold);
        }

        .annual-page .month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }

        .annual-page .day-header {
          text-align: center; font-size: 9px; font-weight: var(--font-weight-bold);
          color: var(--color-neutral-400); padding: 2px 0 3px; text-transform: uppercase;
        }
        .annual-page .day-header--weekend { color: var(--color-neutral-300); }

        .annual-page .day-cell {
          display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
          min-height: 32px; padding: 1px; border-radius: 3px;
          cursor: default; transition: background-color 0.1s ease;
        }
        .annual-page .day-cell--empty { min-height: 0; }
        .annual-page .day-cell--weekend { background: var(--color-neutral-50); }
        .annual-page .day-cell--weekend .day-number { color: var(--color-neutral-400); }
        .annual-page .day-cell--today { background: var(--color-primary-50); outline: 1px solid var(--color-primary-300); outline-offset: -1px; }
        .annual-page .day-cell--today .day-number { color: var(--color-primary-700); font-weight: var(--font-weight-bold); }
        .annual-page .day-cell--has-leaves { cursor: pointer; }
        .annual-page .day-cell--has-leaves:hover { background: var(--color-neutral-100); }
        .annual-page .day-cell--today.day-cell--has-leaves:hover { background: var(--color-primary-100); }

        .annual-page .day-number { font-size: 10px; font-weight: var(--font-weight-medium); color: var(--color-neutral-600); line-height: 1; margin-bottom: 1px; }
        .annual-page .day-dots { display: flex; flex-wrap: wrap; gap: 1px; justify-content: center; }
        .annual-page .day-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .annual-page .day-dot-extra { font-size: 7px; font-weight: var(--font-weight-bold); color: var(--color-neutral-500); line-height: 5px; }

        /* ════════════════════════════════════════════════
           VUE MENSUELLE — Un mois en grand
           ════════════════════════════════════════════════ */
        .annual-page .month-large-grid {
          display: grid; grid-template-columns: repeat(7, 1fr);
          gap: 0;
        }
        .annual-page .ml-day-header {
          text-align: center; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-500); padding: var(--spacing-2);
          border-bottom: 2px solid var(--color-neutral-200);
          background: var(--color-neutral-50);
        }
        .annual-page .ml-day-header--weekend { color: var(--color-neutral-400); background: var(--color-neutral-100); }

        .annual-page .ml-cell {
          min-height: 90px; padding: var(--spacing-2);
          border-right: 1px solid var(--color-neutral-100);
          border-bottom: 1px solid var(--color-neutral-100);
          cursor: default; transition: background-color 0.1s ease;
          display: flex; flex-direction: column; gap: 2px;
        }
        .annual-page .ml-cell:nth-child(7n + 7) { border-right: none; }
        .annual-page .ml-cell--empty { min-height: 40px; background: var(--color-neutral-50); }
        .annual-page .ml-cell--weekend { background: var(--color-neutral-50); }
        .annual-page .ml-cell--today { background: var(--color-primary-50); }
        .annual-page .ml-cell--has-leaves { cursor: pointer; }
        .annual-page .ml-cell--has-leaves:hover { background: var(--color-neutral-100); }
        .annual-page .ml-cell--today.ml-cell--has-leaves:hover { background: var(--color-primary-100); }

        .annual-page .ml-day-number {
          font-size: var(--font-size-sm); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-700); margin-bottom: 2px;
        }
        .annual-page .ml-cell--today .ml-day-number { color: var(--color-primary-700); }
        .annual-page .ml-cell--weekend .ml-day-number { color: var(--color-neutral-400); }

        .annual-page .ml-leaves-list { display: flex; flex-direction: column; gap: 2px; }
        .annual-page .ml-leave-item { display: flex; align-items: center; gap: 4px; overflow: hidden; }
        .annual-page .ml-leave-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .annual-page .ml-leave-name {
          font-size: 11px; color: var(--color-neutral-700); font-weight: var(--font-weight-medium);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .annual-page .ml-leave-extra { font-size: 10px; color: var(--color-neutral-500); font-weight: var(--font-weight-semibold); }

        /* ════════════════════════════════════════════════
           VUE HEBDOMADAIRE — Semaine detaillee
           ════════════════════════════════════════════════ */
        .annual-page .week-grid {
          display: grid; grid-template-columns: 160px repeat(7, 1fr);
          overflow-x: auto;
        }
        .annual-page .wk-header-corner {
          padding: var(--spacing-3); font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold); color: var(--color-neutral-600);
          text-transform: uppercase; letter-spacing: 0.03em;
          border-right: 1px solid var(--color-neutral-200);
          border-bottom: 2px solid var(--color-neutral-200);
          background: var(--color-neutral-50);
          display: flex; align-items: center;
        }
        .annual-page .wk-header-day {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          padding: var(--spacing-2); border-bottom: 2px solid var(--color-neutral-200);
          border-right: 1px solid var(--color-neutral-100);
          background: var(--color-neutral-50);
        }
        .annual-page .wk-header-day:last-child { border-right: none; }
        .annual-page .wk-header-day--today { background: var(--color-primary-50); border-bottom-color: var(--color-primary-500); }
        .annual-page .wk-header-day--weekend { background: var(--color-neutral-100); }
        .annual-page .wk-header-dayname { font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: var(--color-neutral-700); }
        .annual-page .wk-header-date { font-size: 11px; color: var(--color-neutral-500); }
        .annual-page .wk-header-count {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 18px; height: 16px; padding: 0 4px;
          background: var(--color-primary-100); color: var(--color-primary-700);
          border-radius: var(--radius-full); font-size: 10px; font-weight: var(--font-weight-bold);
        }

        .annual-page .wk-cell-emp {
          display: flex; flex-direction: column; justify-content: center; gap: 1px;
          padding: var(--spacing-2) var(--spacing-3);
          border-right: 1px solid var(--color-neutral-200);
          border-bottom: 1px solid var(--color-neutral-100);
          min-height: 48px;
        }
        .annual-page .wk-emp-name { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .annual-page .wk-emp-role { font-size: 11px; color: var(--color-neutral-400); }

        .annual-page .wk-cell {
          display: flex; flex-direction: column; align-items: stretch; justify-content: center;
          gap: 2px; padding: var(--spacing-1);
          border-right: 1px solid var(--color-neutral-100);
          border-bottom: 1px solid var(--color-neutral-100);
          min-height: 48px; transition: background-color 0.1s ease;
        }
        .annual-page .wk-cell:last-child { border-right: none; }
        .annual-page .wk-cell--weekend { background: var(--color-neutral-50); }
        .annual-page .wk-cell--today { background: var(--color-primary-50); }
        .annual-page .wk-cell--active { cursor: pointer; }
        .annual-page .wk-cell--active:hover { background: var(--color-neutral-100); }
        .annual-page .wk-cell--today.wk-cell--active:hover { background: var(--color-primary-100); }

        .annual-page .wk-leave-bar {
          padding: 2px 6px; border-radius: var(--radius-sm);
          display: flex; align-items: center; opacity: 0.9;
        }
        .annual-page .wk-leave-label { font-size: 10px; font-weight: var(--font-weight-semibold); color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .annual-page .wk-empty {
          grid-column: 1 / -1; display: flex; flex-direction: column;
          align-items: center; gap: var(--spacing-3); padding: var(--spacing-8);
          text-align: center; color: var(--color-neutral-500); font-size: var(--font-size-sm);
        }
        .annual-page .wk-empty p { margin: 0; }

        /* ─── Popover ─── */
        .day-popover {
          position: fixed; z-index: 1000; transform: translateX(-50%);
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); box-shadow: var(--shadow-xl);
          min-width: 240px; max-width: 320px; max-height: 300px; overflow-y: auto;
        }
        .day-popover .popover-header {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-3); border-bottom: 1px solid var(--color-neutral-100);
          position: sticky; top: 0; background: white;
        }
        .day-popover .popover-date { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); flex: 1; }
        .day-popover .popover-count { font-size: var(--font-size-xs); color: var(--color-neutral-500); white-space: nowrap; }
        .day-popover .popover-close {
          display: flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; background: transparent; border: none;
          border-radius: var(--radius-sm); cursor: pointer; color: var(--color-neutral-400);
          font-size: 16px; line-height: 1; transition: all 0.1s ease;
        }
        .day-popover .popover-close:hover { background: var(--color-neutral-100); color: var(--color-neutral-600); }
        .day-popover .popover-body { padding: var(--spacing-2) var(--spacing-3) var(--spacing-3); display: flex; flex-direction: column; gap: var(--spacing-2); }
        .day-popover .popover-leave { display: flex; align-items: flex-start; gap: var(--spacing-2); }
        .day-popover .popover-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 3px; flex-shrink: 0; }
        .day-popover .popover-leave-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .day-popover .popover-emp-name { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-800); }
        .day-popover .popover-leave-type { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); }
        .day-popover .popover-leave-dates { font-size: var(--font-size-xs); color: var(--color-neutral-400); }

        /* ─── Monthly chart ─── */
        .annual-page .monthly-chart { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: var(--spacing-5); }
        .annual-page .section-title { font-size: var(--font-size-md); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); margin: 0 0 var(--spacing-4); }
        .annual-page .chart-bars { display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--spacing-2); align-items: end; }
        .annual-page .chart-col { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-1); }
        .annual-page .chart-bar-wrapper { width: 100%; height: 100px; display: flex; align-items: flex-end; justify-content: center; }
        .annual-page .chart-bar { width: 70%; min-height: 2px; background: var(--color-primary-400); border-radius: 3px 3px 0 0; transition: height 0.3s ease; }
        .annual-page .chart-label { font-size: 10px; color: var(--color-neutral-500); font-weight: var(--font-weight-medium); text-align: center; }
        .annual-page .chart-value { font-size: 11px; color: var(--color-primary-600); font-weight: var(--font-weight-bold); }

        /* ─── Type breakdown ─── */
        .annual-page .type-breakdown { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: var(--spacing-5); }
        .annual-page .type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--spacing-3); }
        .annual-page .type-card { padding: var(--spacing-3); border: 1px solid var(--color-neutral-100); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: var(--spacing-2); }
        .annual-page .type-header { display: flex; align-items: center; gap: var(--spacing-2); }
        .annual-page .type-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .annual-page .type-name { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-700); }
        .annual-page .type-stats { display: flex; justify-content: space-between; align-items: baseline; }
        .annual-page .type-count { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); }
        .annual-page .type-pct { font-size: var(--font-size-xs); color: var(--color-neutral-500); }
        .annual-page .type-progress-track { height: 4px; background: var(--color-neutral-100); border-radius: 2px; overflow: hidden; }
        .annual-page .type-progress-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease; }

        /* ─── Print ─── */
        @media print {
          .annual-page .page-header, .annual-page .filters-section, .annual-page .header-actions, .annual-page .view-toggle,
          .annual-page .nav-btn, .annual-page .today-btn, .annual-page .sub-nav { display: none !important; }
          .annual-page { gap: var(--spacing-3); }
          .annual-page .stats-grid, .annual-page .calendar-section, .annual-page .monthly-chart, .annual-page .type-breakdown { break-inside: avoid; }
          .day-popover { display: none !important; }
          .annual-page .day-cell--has-leaves:hover, .annual-page .ml-cell--has-leaves:hover, .annual-page .wk-cell--active:hover { background: transparent; }
        }

        /* ─── Responsive ─── */
        @media (max-width: 1200px) {
          .annual-page .calendar-wall { grid-template-columns: repeat(3, 1fr); }
          .annual-page .month-card:nth-child(3n) { border-right: none; }
          .annual-page .month-card:nth-child(4n) { border-right: 1px solid var(--color-neutral-100); }
          .annual-page .month-card:nth-child(n+10) { border-bottom: none; }
          .annual-page .month-card:nth-child(n+9) { border-bottom: 1px solid var(--color-neutral-100); }
        }

        @media (max-width: 900px) {
          .annual-page .page-header { flex-direction: column; }
          .annual-page .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .annual-page .filters-section { flex-direction: column; }
          .annual-page .filter-group { min-width: 0; }
          .annual-page .view-toggle { flex-wrap: wrap; }
          .annual-page .chart-bars { grid-template-columns: repeat(6, 1fr); }
          .annual-page .chart-bar-wrapper { height: 60px; }
          .annual-page .type-grid { grid-template-columns: 1fr; }

          .annual-page .calendar-wall { grid-template-columns: repeat(2, 1fr); }
          .annual-page .month-card { border-right: 1px solid var(--color-neutral-100) !important; border-bottom: 1px solid var(--color-neutral-100) !important; }
          .annual-page .month-card:nth-child(2n) { border-right: none !important; }
          .annual-page .month-card:nth-child(n+11) { border-bottom: none !important; }

          .annual-page .ml-day-header { font-size: 11px; padding: var(--spacing-1); }
          .annual-page .ml-cell { min-height: 70px; padding: var(--spacing-1); }
          .annual-page .ml-leave-name { font-size: 10px; }

          .annual-page .week-grid { grid-template-columns: 120px repeat(7, minmax(60px, 1fr)); }
          .annual-page .wk-emp-name { font-size: var(--font-size-xs); }
        }

        @media (max-width: 640px) {
          .annual-page .header-actions { width: 100%; }
          .annual-page .btn-outline { flex: 1; justify-content: center; }

          .annual-page .calendar-wall { grid-template-columns: 1fr; }
          .annual-page .month-card { border-right: none !important; border-bottom: 1px solid var(--color-neutral-100) !important; }
          .annual-page .month-card:last-child { border-bottom: none !important; }

          .annual-page .ml-day-header { font-size: 10px; }
          .annual-page .ml-cell { min-height: 60px; }
          .annual-page .ml-leave-item { display: none; }
          .annual-page .ml-cell--has-leaves .ml-day-number::after {
            content: ''; display: inline-block; width: 6px; height: 6px;
            background: var(--color-primary-500); border-radius: 50%; margin-left: 4px; vertical-align: middle;
          }

          .annual-page .week-grid { grid-template-columns: 90px repeat(7, minmax(45px, 1fr)); }
          .annual-page .wk-emp-name { font-size: 11px; }
          .annual-page .wk-emp-role { display: none; }
          .annual-page .wk-leave-label { font-size: 8px; }
        }
      `}</style>
    </>
  );
}
