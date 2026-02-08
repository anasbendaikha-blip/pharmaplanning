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
} from '@/lib/utils/dateUtils';
import { formatHours } from '@/lib/utils/hourUtils';
import type { Employee, Shift } from '@/lib/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default function PortailEmployePage() {
  const { organizationId, user, isLoading: orgLoading } = useOrganization();

  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const weekLabel = getWeekLabel(currentMonday);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const weekDates = useMemo(() => getWeekDates(currentMonday), [currentMonday]);

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

      if (!selectedEmployee && user?.email && emps.length > 0) {
        const match = emps.find(e => {
          const genEmail = `${(e.first_name || '').toLowerCase().replace(/\s/g, '')}@pharmacie-coquelicots.fr`;
          return genEmail === user.email;
        });
        if (match) setSelectedEmployee(match.id);
        else setSelectedEmployee(emps[0].id);
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

  const myShifts = useMemo(() => {
    if (!selectedEmployee) return [];
    return shifts.filter(s => s.employee_id === selectedEmployee);
  }, [shifts, selectedEmployee]);

  const selectedEmp = employees.find(e => e.id === selectedEmployee);
  const totalHours = myShifts.reduce((sum, s) => sum + s.effective_hours, 0);

  const handlePrev = () => setCurrentMonday(prev => addDays(prev, -7));
  const handleNext = () => setCurrentMonday(prev => addDays(prev, 7));

  if (orgLoading || (loading && employees.length === 0)) {
    return <LoadingSpinner size="lg" message="Chargement du portail..." />;
  }

  return (
    <>
      <div className="portail-page">
        <div className="portail-header">
          <div>
            <h1 className="page-title">Mon planning</h1>
            {selectedEmp && (
              <p className="page-subtitle">
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

        <div className="week-nav">
          <button className="nav-btn" onClick={handlePrev} type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <span className="week-label">{weekLabel}</span>
          <button className="nav-btn" onClick={handleNext} type="button">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {selectedEmp && (
          <div className="stats-row">
            <div className="stat-card">
              <span className="stat-value">{formatHours(totalHours)}</span>
              <span className="stat-label">Heures cette semaine</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{myShifts.length}</span>
              <span className="stat-label">Shifts planifies</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{selectedEmp.contract_hours}h</span>
              <span className="stat-label">Heures contrat</span>
            </div>
          </div>
        )}

        {myShifts.length === 0 ? (
          <EmptyState
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            title="Aucun shift cette semaine"
            description="Aucun shift planifie pour vous cette semaine."
          />
        ) : (
          <div className="days-grid">
            {weekDates.map((date, i) => {
              const dateStr = toISODateString(date);
              const dayShifts = myShifts.filter(s => s.date === dateStr);
              const dayTotal = dayShifts.reduce((sum, s) => sum + s.effective_hours, 0);

              return (
                <div key={dateStr} className={`day-card ${dayShifts.length === 0 ? 'day-card--off' : ''}`}>
                  <div className="day-header">
                    <span className="day-name">{DAYS[i]}</span>
                    <span className="day-date">{date.getDate()}/{date.getMonth() + 1}</span>
                  </div>
                  {dayShifts.length === 0 ? (
                    <span className="day-off">Repos</span>
                  ) : (
                    <div className="day-shifts">
                      {dayShifts.map(s => (
                        <div key={s.id} className="shift-item">
                          <span className="shift-time">{s.start_time} - {s.end_time}</span>
                          <span className="shift-hours">{formatHours(s.effective_hours)}</span>
                        </div>
                      ))}
                      <div className="day-total">Total: {formatHours(dayTotal)}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .portail-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-5);
          max-width: 900px;
        }

        .portail-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--spacing-3);
        }

        .page-title { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); margin: 0; }
        .page-subtitle { font-size: var(--font-size-sm); color: var(--color-neutral-500); margin: var(--spacing-1) 0 0; }

        .employee-select {
          padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          background: white;
          color: var(--color-neutral-700);
        }

        .week-nav { display: flex; align-items: center; justify-content: center; gap: var(--spacing-3); }

        .nav-btn {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px;
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md); cursor: pointer; color: var(--color-neutral-600);
        }
        .nav-btn:hover { background: var(--color-neutral-50); }

        .week-label { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-700); }

        .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--spacing-3); }

        .stat-card {
          display: flex; flex-direction: column; align-items: center;
          padding: var(--spacing-4);
          background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
        }
        .stat-value { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-primary-700); }
        .stat-label { font-size: var(--font-size-xs); color: var(--color-neutral-500); margin-top: var(--spacing-1); }

        .days-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--spacing-3); }

        .day-card { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-4); }
        .day-card--off { opacity: 0.6; background: var(--color-neutral-50); }

        .day-header { display: flex; justify-content: space-between; margin-bottom: var(--spacing-3); padding-bottom: var(--spacing-2); border-bottom: 1px solid var(--color-neutral-100); }
        .day-name { font-weight: var(--font-weight-semibold); color: var(--color-neutral-800); font-size: var(--font-size-sm); }
        .day-date { font-size: var(--font-size-xs); color: var(--color-neutral-500); }
        .day-off { font-size: var(--font-size-sm); color: var(--color-neutral-400); text-align: center; display: block; padding: var(--spacing-2) 0; }
        .day-shifts { display: flex; flex-direction: column; gap: var(--spacing-2); }

        .shift-item { display: flex; justify-content: space-between; padding: var(--spacing-2); background: var(--color-primary-50); border-radius: var(--radius-sm); }
        .shift-time { font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--color-primary-800); }
        .shift-hours { font-size: var(--font-size-xs); color: var(--color-primary-600); font-weight: var(--font-weight-semibold); }
        .day-total { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--color-neutral-600); text-align: right; margin-top: var(--spacing-1); }

        @media (max-width: 640px) {
          .stats-row { grid-template-columns: 1fr; }
          .days-grid { grid-template-columns: 1fr; }
          .portail-header { flex-direction: column; }
        }
      `}</style>
    </>
  );
}
