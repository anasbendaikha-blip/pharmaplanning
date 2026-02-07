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
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function RecapPage() {
  const { organizationId, organization, isLoading: orgLoading } = useOrganization();
  const pharmacyName = organization?.name || 'Pharmacie';

  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const weekLabel = getWeekLabel(currentMonday);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
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
    } catch (err) {
      console.error('Erreur chargement recap:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, weekDates]);

  useEffect(() => {
    if (!orgLoading && organizationId) fetchData();
  }, [orgLoading, organizationId, fetchData]);

  const recapData = useMemo(() => {
    return employees.map(emp => {
      const empShifts = shifts.filter(s => s.employee_id === emp.id);
      const dayHours = weekDates.map(d => {
        const dateStr = toISODateString(d);
        const dayShifts = empShifts.filter(s => s.date === dateStr);
        return dayShifts.reduce((sum, s) => sum + s.effective_hours, 0);
      });
      const totalHours = dayHours.reduce((sum, h) => sum + h, 0);
      return { employee: emp, dayHours, totalHours };
    }).filter(r => r.totalHours > 0 || employees.length <= 30);
  }, [employees, shifts, weekDates]);

  const handlePrev = () => setCurrentMonday(prev => addDays(prev, -7));
  const handleNext = () => setCurrentMonday(prev => addDays(prev, 7));
  const handleToday = () => setCurrentMonday(getMonday(new Date()));

  if (orgLoading || (loading && employees.length === 0)) {
    return <LoadingSpinner size="lg" message="Chargement du recapitulatif..." />;
  }

  return (
    <>
      <div className="recap-page">
        <div className="recap-header">
          <div>
            <h1 className="page-title">Recapitulatif hebdomadaire</h1>
            <p className="page-subtitle">{pharmacyName}</p>
          </div>
          <div className="week-nav">
            <button className="nav-btn" onClick={handlePrev} type="button" title="Semaine precedente">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="week-label">{weekLabel}</span>
            <button className="nav-btn" onClick={handleNext} type="button" title="Semaine suivante">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className="today-btn" onClick={handleToday} type="button">Aujourd&apos;hui</button>
          </div>
        </div>

        {recapData.length === 0 ? (
          <EmptyState
            icon="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            title="Aucune donnee pour cette semaine"
            description="Aucun shift planifie pour cette semaine. Utilisez le planning ou l'assistant pour creer des shifts."
          />
        ) : (
          <div className="table-wrapper">
            <table className="recap-table">
              <thead>
                <tr>
                  <th className="col-employee">Employe</th>
                  {DAYS.map((day, i) => (
                    <th key={day} className="col-day">
                      <span className="day-name">{day}</span>
                      <span className="day-date">{weekDates[i].getDate()}</span>
                    </th>
                  ))}
                  <th className="col-total">Total</th>
                  <th className="col-contract">Contrat</th>
                  <th className="col-diff">Ecart</th>
                </tr>
              </thead>
              <tbody>
                {recapData.map(({ employee, dayHours, totalHours }) => {
                  const diff = totalHours - employee.contract_hours;
                  return (
                    <tr key={employee.id}>
                      <td className="cell-employee">
                        <span className="emp-name">{employee.first_name} {employee.last_name}</span>
                        <span className="emp-role">{employee.role}</span>
                      </td>
                      {dayHours.map((h, i) => (
                        <td key={i} className={`cell-hours ${h === 0 ? 'cell-hours--empty' : ''}`}>
                          {h > 0 ? formatHours(h) : '-'}
                        </td>
                      ))}
                      <td className="cell-total">{formatHours(totalHours)}</td>
                      <td className="cell-contract">{employee.contract_hours}h</td>
                      <td className={`cell-diff ${diff > 0 ? 'cell-diff--over' : diff < 0 ? 'cell-diff--under' : ''}`}>
                        {diff > 0 ? '+' : ''}{formatHours(diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .recap-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-5);
        }

        .recap-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--spacing-3);
        }

        .page-title {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          margin: 0;
        }

        .page-subtitle {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
          margin: var(--spacing-1) 0 0;
        }

        .week-nav {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .nav-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          cursor: pointer;
          color: var(--color-neutral-600);
          transition: all 0.15s ease;
        }

        .nav-btn:hover {
          background: var(--color-neutral-50);
        }

        .week-label {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-700);
          min-width: 200px;
          text-align: center;
        }

        .today-btn {
          padding: 6px 14px;
          background: var(--color-primary-600);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          cursor: pointer;
        }

        .today-btn:hover {
          background: var(--color-primary-700);
        }

        .table-wrapper {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          overflow-x: auto;
        }

        .recap-table {
          width: 100%;
          border-collapse: collapse;
          font-size: var(--font-size-sm);
        }

        .recap-table th {
          padding: var(--spacing-3);
          text-align: center;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
          background: var(--color-neutral-50);
          border-bottom: 1px solid var(--color-neutral-200);
          white-space: nowrap;
        }

        .col-employee { text-align: left !important; min-width: 160px; }
        .col-day { min-width: 56px; }

        .day-name {
          display: block;
          font-size: var(--font-size-xs);
          text-transform: uppercase;
        }

        .day-date {
          display: block;
          font-size: var(--font-size-xs);
          color: var(--color-neutral-400);
          font-weight: var(--font-weight-regular);
        }

        .recap-table td {
          padding: var(--spacing-2) var(--spacing-3);
          text-align: center;
          border-bottom: 1px solid var(--color-neutral-100);
          color: var(--color-neutral-700);
        }

        .cell-employee {
          text-align: left !important;
        }

        .emp-name {
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
          display: block;
        }

        .emp-role {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        .cell-hours { font-variant-numeric: tabular-nums; }
        .cell-hours--empty { color: var(--color-neutral-300); }
        .cell-total { font-weight: var(--font-weight-bold); color: var(--color-neutral-900); }
        .cell-contract { color: var(--color-neutral-500); }
        .cell-diff { font-weight: var(--font-weight-semibold); }
        .cell-diff--over { color: var(--color-warning-600); }
        .cell-diff--under { color: var(--color-danger-600); }

        .recap-table tbody tr:hover { background: var(--color-neutral-50); }

        @media (max-width: 768px) {
          .recap-header { flex-direction: column; }
          .week-label { min-width: auto; }
        }
      `}</style>
    </>
  );
}
