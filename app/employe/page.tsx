'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import { getShiftsForWeek, getEmployees } from '@/lib/supabase/queries';
import {
  getMonday,
  getWeekDates,
  toISODateString,
  addDays,
  getWeekLabel,
  getDayOfWeekFr,
  isToday,
  formatDate,
} from '@/lib/utils/dateUtils';
import { formatHours, hoursPercentage } from '@/lib/utils/hourUtils';
import type { Employee, Shift } from '@/lib/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const ROLE_COLORS: Record<string, string> = {
  titulaire: '#10b981',
  adjoint: '#10b981',
  preparateur: '#3b82f6',
  apprenti: '#8b5cf6',
  etudiant: '#f59e0b',
  rayonniste: '#6366f1',
};

export default function EmployePlanningPage() {
  const { organizationId, user, isLoading: orgLoading } = useOrganization();

  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const weekLabel = getWeekLabel(currentMonday);
  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [dailyTasks, setDailyTasks] = useState<Array<{ id: string; task_name: string; date: string; assigned_employee_id: string }>>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const weekStart = toISODateString(weekDates[0]);
      const weekEnd = toISODateString(weekDates[6]);
      const [emps, shfs] = await Promise.all([
        getEmployees(organizationId),
        getShiftsForWeek(organizationId, weekStart, weekEnd),
      ]);
      setEmployees(emps);
      setShifts(shfs);

      // Charger daily tasks
      try {
        const params = new URLSearchParams({
          organizationId,
          startDate: weekStart,
          endDate: weekEnd,
        });
        const res = await fetch(`/api/daily-tasks?${params.toString()}`);
        if (res.ok) {
          setDailyTasks(await res.json());
        }
      } catch {
        // Silencieux si la table n'existe pas encore
      }

      // Auto-select employee matching user email
      if (!selectedEmployee && user?.email && emps.length > 0) {
        const match = emps.find(e => {
          const genEmail = `${(e.first_name || '').toLowerCase().replace(/\s/g, '')}@pharmacie-maurer.fr`;
          return genEmail === user.email;
        });
        setSelectedEmployee(match ? match.id : emps[0].id);
      }
    } catch (err) {
      console.error('Erreur portail employe:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, weekDates, selectedEmployee, user?.email]);

  useEffect(() => {
    if (!orgLoading && organizationId) fetchData();
  }, [orgLoading, organizationId, fetchData]);

  const selectedEmp = employees.find(e => e.id === selectedEmployee);
  const roleColor = selectedEmp ? (ROLE_COLORS[selectedEmp.role] || '#64748b') : '#64748b';

  const myShifts = useMemo(() => {
    if (!selectedEmployee) return [];
    return shifts.filter(s => s.employee_id === selectedEmployee);
  }, [shifts, selectedEmployee]);

  const myTasks = useMemo(() => {
    if (!selectedEmployee) return [];
    return dailyTasks.filter(t => t.assigned_employee_id === selectedEmployee);
  }, [dailyTasks, selectedEmployee]);

  const totalHours = myShifts.reduce((sum, s) => sum + s.effective_hours, 0);
  const contractHours = selectedEmp?.contract_hours || 35;
  const pct = hoursPercentage(totalHours, contractHours);

  const handlePrev = () => setCurrentMonday(prev => addDays(prev, -7));
  const handleNext = () => setCurrentMonday(prev => addDays(prev, 7));
  const handleToday = () => setCurrentMonday(getMonday(new Date()));

  if (orgLoading || (loading && employees.length === 0)) {
    return <LoadingSpinner size="lg" message="Chargement de votre planning..." />;
  }

  return (
    <>
      <div className="planning-page">
        {/* Header */}
        <div className="planning-header">
          <div>
            <h1 className="page-title">Mon Planning</h1>
            {selectedEmp && (
              <p className="page-subtitle">
                <span className="role-dot" />
                {selectedEmp.first_name} {selectedEmp.last_name} - {selectedEmp.role}
              </p>
            )}
          </div>
          <select
            className="employee-select"
            value={selectedEmployee}
            onChange={e => setSelectedEmployee(e.target.value)}
          >
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
              </option>
            ))}
          </select>
        </div>

        {/* Week nav */}
        <div className="week-nav">
          <button className="nav-btn" onClick={handlePrev} type="button" aria-label="Semaine precedente">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="week-center">
            <span className="week-label">{weekLabel}</span>
            <button className="today-btn" onClick={handleToday} type="button">Aujourd&apos;hui</button>
          </div>
          <button className="nav-btn" onClick={handleNext} type="button" aria-label="Semaine suivante">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {/* Hours summary */}
        <div className="hours-summary">
          <div className="hours-text">
            <span className="hours-value">{formatHours(totalHours)}</span>
            <span className="hours-label">/ {contractHours}h cette semaine</span>
          </div>
          <div className="hours-bar">
            <div className="hours-progress" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
        </div>

        {/* Day cards */}
        {myShifts.length === 0 && !loading ? (
          <EmptyState
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            title="Aucun shift cette semaine"
            description="Aucun shift planifie pour vous cette semaine. Consultez une autre semaine."
          />
        ) : (
          <div className="days-list">
            {weekDates.slice(0, 6).map((date) => {
              const dateStr = toISODateString(date);
              const dayShifts = myShifts.filter(s => s.date === dateStr);
              const dayTasks = myTasks.filter(t => t.date === dateStr);
              const isTodayDate = isToday(date);
              const dayTotal = dayShifts.reduce((sum, s) => sum + s.effective_hours, 0);

              return (
                <div key={dateStr} className={`day-card ${isTodayDate ? 'day-card--today' : ''} ${dayShifts.length === 0 ? 'day-card--off' : ''}`}>
                  <div className="day-header">
                    <span className="day-name">{getDayOfWeekFr(date)}</span>
                    <span className="day-date">{formatDate(date, 'medium')}</span>
                  </div>

                  {dayShifts.length > 0 ? (
                    <div className="day-body">
                      {dayShifts.map(shift => (
                        <div key={shift.id} className="shift-content">
                          <div className="shift-row">
                            <span className="shift-time">{shift.start_time} - {shift.end_time}</span>
                            <span className="shift-duration">{formatHours(shift.effective_hours)}</span>
                          </div>
                          <div className="shift-bar" style={{ width: `${(shift.effective_hours / 12) * 100}%`, backgroundColor: roleColor }} />
                        </div>
                      ))}
                      {dayTasks.length > 0 && (
                        <div className="tasks-badges">
                          {dayTasks.map(task => (
                            <span key={task.id} className="task-badge">{task.task_name}</span>
                          ))}
                        </div>
                      )}
                      {dayShifts.length > 1 && (
                        <div className="day-total">Total: {formatHours(dayTotal)}</div>
                      )}
                    </div>
                  ) : (
                    <div className="rest-day">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 18a5 5 0 00-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/></svg>
                      <span className="rest-text">Repos</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .planning-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-5);
        }

        .planning-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--spacing-3);
        }

        .page-title { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); margin: 0; color: var(--color-neutral-900); }
        .page-subtitle {
          font-size: var(--font-size-sm); color: var(--color-neutral-500); margin: var(--spacing-1) 0 0;
          display: flex; align-items: center; gap: var(--spacing-2);
        }

        .role-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background-color: ${roleColor};
          display: inline-block;
        }

        .employee-select {
          padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          background: white; color: var(--color-neutral-700);
        }

        .week-nav {
          display: flex; align-items: center; justify-content: center; gap: var(--spacing-3);
        }

        .week-center {
          display: flex; flex-direction: column; align-items: center; gap: var(--spacing-1);
        }

        .nav-btn {
          display: flex; align-items: center; justify-content: center;
          width: 40px; height: 40px;
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md); cursor: pointer; color: var(--color-neutral-600);
          transition: all var(--transition-fast);
        }
        .nav-btn:hover { background: var(--color-neutral-50); border-color: var(--color-primary-400); }

        .week-label {
          font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-700);
        }

        .today-btn {
          padding: var(--spacing-1) var(--spacing-3);
          border: 1px solid var(--color-primary-400);
          border-radius: var(--radius-md);
          background: white; color: var(--color-primary-600);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
          cursor: pointer; transition: all var(--transition-fast);
        }
        .today-btn:hover { background: var(--color-primary-600); color: white; }

        .hours-summary {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); padding: var(--spacing-4);
        }

        .hours-text { display: flex; align-items: baseline; gap: var(--spacing-2); margin-bottom: var(--spacing-3); }
        .hours-value { font-size: var(--font-size-3xl); font-weight: var(--font-weight-bold); color: var(--color-primary-700); }
        .hours-label { font-size: var(--font-size-sm); color: var(--color-neutral-500); }

        .hours-bar {
          height: 8px; background: var(--color-neutral-100);
          border-radius: var(--radius-full); overflow: hidden;
        }
        .hours-progress {
          height: 100%;
          background: linear-gradient(90deg, var(--color-primary-500), var(--color-primary-700));
          border-radius: var(--radius-full);
          transition: width 0.3s ease;
        }

        .days-list {
          display: flex; flex-direction: column; gap: var(--spacing-3);
        }

        .day-card {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); padding: var(--spacing-4);
          transition: all var(--transition-fast);
        }
        .day-card--today {
          border-color: var(--color-primary-400);
          box-shadow: 0 4px 12px rgba(76, 175, 80, 0.15);
        }
        .day-card--off { opacity: 0.6; background: var(--color-neutral-50); }

        .day-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: var(--spacing-3);
          padding-bottom: var(--spacing-2);
          border-bottom: 1px solid var(--color-neutral-100);
        }
        .day-name {
          font-size: var(--font-size-md); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800); text-transform: capitalize;
        }
        .day-date { font-size: var(--font-size-sm); color: var(--color-neutral-500); }

        .day-body { display: flex; flex-direction: column; gap: var(--spacing-3); }

        .shift-content {
          padding: var(--spacing-3); background: var(--color-neutral-50);
          border-radius: var(--radius-md);
        }
        .shift-row {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: var(--spacing-2);
        }
        .shift-time {
          font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--color-neutral-800);
        }
        .shift-duration { font-size: var(--font-size-sm); color: var(--color-neutral-500); font-weight: var(--font-weight-semibold); }
        .shift-bar {
          height: 6px; border-radius: var(--radius-full);
          transition: width 0.3s ease;
        }

        .tasks-badges { display: flex; flex-wrap: wrap; gap: var(--spacing-2); }
        .task-badge {
          padding: var(--spacing-1) var(--spacing-3);
          background: var(--color-secondary-50); color: var(--color-secondary-800);
          border-radius: var(--radius-full); font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
        }

        .day-total {
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600); text-align: right;
        }

        .rest-day {
          display: flex; flex-direction: column; align-items: center;
          padding: var(--spacing-4); gap: var(--spacing-2); color: var(--color-neutral-400);
        }
        .rest-text { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-400); }

        @media (max-width: 640px) {
          .planning-header { flex-direction: column; }
          .employee-select { width: 100%; }
          .hours-value { font-size: var(--font-size-2xl); }
          .nav-btn { width: 36px; height: 36px; }
        }
      `}</style>
    </>
  );
}
