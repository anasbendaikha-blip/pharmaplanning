'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import { getEmployees } from '@/lib/supabase/queries';
import {
  getMonday,
  addDays,
  toISODateString,
  getDayOfWeekFr,
  formatDate,
  getWeekLabel,
} from '@/lib/utils/dateUtils';
import type { Employee } from '@/lib/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from 'sonner';

type AvailabilityStatus = 'available' | 'unavailable' | 'uncertain';
type SlotType = 'morning' | 'afternoon' | 'full' | 'custom';

interface DayAvailability {
  dayOfWeek: number;
  status: AvailabilityStatus;
  slotType?: SlotType;
  startTime?: string;
  endTime?: string;
  comment?: string;
}

function detectSlotType(startTime?: string, endTime?: string): SlotType | undefined {
  if (!startTime || !endTime) return undefined;
  if (startTime === '08:30' && endTime === '14:00') return 'morning';
  if (startTime === '14:00' && endTime === '20:30') return 'afternoon';
  if (startTime === '08:30' && endTime === '20:30') return 'full';
  return 'custom';
}

export default function DisponibilitesPage() {
  const { organizationId, user, isLoading: orgLoading } = useOrganization();

  // Target: next week by default
  const [targetMonday, setTargetMonday] = useState<Date>(() => addDays(getMonday(new Date()), 7));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [availabilities, setAvailabilities] = useState<DayAvailability[]>([]);
  const [locked, setLocked] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Build week options (next 4 weeks)
  const weekOptions = Array.from({ length: 4 }, (_, i) => {
    const monday = addDays(getMonday(new Date()), 7 * (i + 1));
    return { value: toISODateString(monday), label: getWeekLabel(monday), monday };
  });

  const fetchData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const emps = await getEmployees(organizationId);
      setEmployees(emps);

      let empId = selectedEmployee;
      if (!empId && user?.email && emps.length > 0) {
        const match = emps.find(e => {
          const genEmail = `${(e.first_name || '').toLowerCase().replace(/\s/g, '')}@pharmacie-coquelicots.fr`;
          return genEmail === user.email;
        });
        empId = match ? match.id : emps[0].id;
        setSelectedEmployee(empId);
      }

      if (!empId) { setLoading(false); return; }

      // Fetch existing availabilities
      const weekStart = toISODateString(targetMonday);
      const params = new URLSearchParams({ organizationId, employeeId: empId, weekStart });
      const res = await fetch(`/api/availabilities?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          const localAvails: DayAvailability[] = data.map((a: { day_of_week: number; status: AvailabilityStatus; start_time?: string; end_time?: string; comment?: string; locked?: boolean }) => ({
            dayOfWeek: a.day_of_week,
            status: a.status,
            slotType: detectSlotType(a.start_time?.slice(0, 5), a.end_time?.slice(0, 5)),
            startTime: a.start_time?.slice(0, 5),
            endTime: a.end_time?.slice(0, 5),
            comment: a.comment,
          }));
          setAvailabilities(localAvails);
          setLocked(data[0]?.locked || false);
          setSubmitted(true);
        } else {
          initEmpty();
        }
      } else {
        initEmpty();
      }
    } catch (err) {
      console.error('Erreur chargement dispos:', err);
      initEmpty();
    } finally {
      setLoading(false);
    }
  }, [organizationId, targetMonday, selectedEmployee, user?.email]);

  function initEmpty() {
    setAvailabilities(
      Array.from({ length: 6 }, (_, i) => ({
        dayOfWeek: i + 1,
        status: 'uncertain' as AvailabilityStatus,
      }))
    );
    setLocked(false);
    setSubmitted(false);
  }

  useEffect(() => {
    if (!orgLoading && organizationId) fetchData();
  }, [orgLoading, organizationId, fetchData]);

  function updateDayStatus(dayOfWeek: number, status: AvailabilityStatus) {
    setAvailabilities(prev =>
      prev.map(a =>
        a.dayOfWeek === dayOfWeek
          ? { ...a, status, slotType: undefined, startTime: undefined, endTime: undefined }
          : a
      )
    );
  }

  function updateDaySlot(dayOfWeek: number, slotType: SlotType) {
    const slots: Record<SlotType, { start: string; end: string }> = {
      morning: { start: '08:30', end: '14:00' },
      afternoon: { start: '14:00', end: '20:30' },
      full: { start: '08:30', end: '20:30' },
      custom: { start: '08:30', end: '17:00' },
    };
    const slot = slots[slotType];
    setAvailabilities(prev =>
      prev.map(a =>
        a.dayOfWeek === dayOfWeek
          ? { ...a, slotType, startTime: slot.start, endTime: slot.end }
          : a
      )
    );
  }

  function updateDayTime(dayOfWeek: number, field: 'startTime' | 'endTime', value: string) {
    setAvailabilities(prev =>
      prev.map(a => (a.dayOfWeek === dayOfWeek ? { ...a, [field]: value } : a))
    );
  }

  function updateDayComment(dayOfWeek: number, comment: string) {
    setAvailabilities(prev =>
      prev.map(a => (a.dayOfWeek === dayOfWeek ? { ...a, comment } : a))
    );
  }

  async function handleSubmit() {
    if (!selectedEmployee || !organizationId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/availabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          employeeId: selectedEmployee,
          weekStart: toISODateString(targetMonday),
          days: availabilities,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Erreur lors de l\'envoi');
        return;
      }

      setSubmitted(true);
      toast.success('Disponibilites envoyees avec succes');
    } catch (err) {
      console.error('Erreur soumission dispos:', err);
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setSaving(false);
    }
  }

  if (orgLoading || (loading && employees.length === 0)) {
    return <LoadingSpinner size="lg" message="Chargement des disponibilites..." />;
  }

  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(targetMonday, i));

  return (
    <>
      <div className="dispos-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Mes Disponibilites</h1>
            {submitted && !locked && <span className="status-badge status-badge--submitted">Envoye</span>}
            {locked && <span className="status-badge status-badge--locked">Verrouille</span>}
          </div>
          <select
            className="employee-select"
            value={selectedEmployee}
            onChange={e => setSelectedEmployee(e.target.value)}
          >
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
            ))}
          </select>
        </div>

        {locked && (
          <div className="locked-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Planning valide — Contactez votre responsable pour toute modification
          </div>
        )}

        <div className="week-selector">
          <label htmlFor="week-select">Semaine :</label>
          <select
            id="week-select"
            className="week-select"
            value={toISODateString(targetMonday)}
            onChange={e => {
              const d = new Date(e.target.value + 'T00:00:00');
              setTargetMonday(d);
              setSubmitted(false);
            }}
            disabled={locked}
          >
            {weekOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="days-grid">
          {weekDays.map((date, idx) => {
            const dayOfWeek = idx + 1;
            const avail = availabilities.find(a => a.dayOfWeek === dayOfWeek);
            if (!avail) return null;

            return (
              <div key={dayOfWeek} className="day-section">
                <div className="day-title">
                  {getDayOfWeekFr(date)} {formatDate(date, 'medium')}
                </div>

                {/* Status toggles */}
                <div className="status-buttons">
                  {(['available', 'unavailable', 'uncertain'] as AvailabilityStatus[]).map(st => (
                    <button
                      key={st}
                      className={`status-btn status-btn--${st} ${avail.status === st ? 'active' : ''}`}
                      onClick={() => !locked && updateDayStatus(dayOfWeek, st)}
                      disabled={locked}
                      type="button"
                    >
                      {st === 'available' && 'Disponible'}
                      {st === 'unavailable' && 'Indisponible'}
                      {st === 'uncertain' && 'Pas sur'}
                    </button>
                  ))}
                </div>

                {/* Slot selection when available */}
                {avail.status === 'available' && (
                  <div className="slots-section">
                    <div className="slots-buttons">
                      <button
                        className={`slot-btn ${avail.slotType === 'morning' ? 'active' : ''}`}
                        onClick={() => !locked && updateDaySlot(dayOfWeek, 'morning')}
                        disabled={locked} type="button"
                      >
                        <span className="slot-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                        </span>
                        Matin<br /><small>8h30-14h</small>
                      </button>
                      <button
                        className={`slot-btn ${avail.slotType === 'afternoon' ? 'active' : ''}`}
                        onClick={() => !locked && updateDaySlot(dayOfWeek, 'afternoon')}
                        disabled={locked} type="button"
                      >
                        <span className="slot-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                        </span>
                        Apres-midi<br /><small>14h-20h30</small>
                      </button>
                      <button
                        className={`slot-btn ${avail.slotType === 'full' ? 'active' : ''}`}
                        onClick={() => !locked && updateDaySlot(dayOfWeek, 'full')}
                        disabled={locked} type="button"
                      >
                        <span className="slot-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="12" x2="16" y2="12"/></svg>
                        </span>
                        Journee<br /><small>8h30-20h30</small>
                      </button>
                      <button
                        className={`slot-btn ${avail.slotType === 'custom' ? 'active' : ''}`}
                        onClick={() => !locked && updateDaySlot(dayOfWeek, 'custom')}
                        disabled={locked} type="button"
                      >
                        <span className="slot-icon">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                        </span>
                        Personnalise
                      </button>
                    </div>

                    {avail.slotType === 'custom' && (
                      <div className="custom-times">
                        <input
                          type="time"
                          className="time-input"
                          value={avail.startTime || ''}
                          onChange={e => !locked && updateDayTime(dayOfWeek, 'startTime', e.target.value)}
                          disabled={locked}
                        />
                        <span className="time-separator">a</span>
                        <input
                          type="time"
                          className="time-input"
                          value={avail.endTime || ''}
                          onChange={e => !locked && updateDayTime(dayOfWeek, 'endTime', e.target.value)}
                          disabled={locked}
                        />
                      </div>
                    )}

                    <textarea
                      className="comment-input"
                      placeholder="Commentaire (optionnel)..."
                      value={avail.comment || ''}
                      onChange={e => !locked && updateDayComment(dayOfWeek, e.target.value)}
                      disabled={locked}
                      rows={2}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!locked && (
          <button
            className="submit-btn"
            onClick={handleSubmit}
            disabled={saving}
            type="button"
          >
            {saving ? 'Envoi en cours...' : submitted ? 'Mettre a jour mes disponibilites' : 'Envoyer mes disponibilites'}
          </button>
        )}
      </div>

      <style jsx>{`
        .dispos-page {
          display: flex; flex-direction: column; gap: var(--spacing-5);
        }

        .page-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          flex-wrap: wrap; gap: var(--spacing-3);
        }
        .page-header > div { display: flex; align-items: center; gap: var(--spacing-3); flex-wrap: wrap; }
        .page-title { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); margin: 0; }

        .status-badge {
          padding: var(--spacing-1) var(--spacing-3);
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
        }
        .status-badge--submitted { background: var(--color-success-100); color: var(--color-success-800); }
        .status-badge--locked { background: var(--color-danger-100); color: var(--color-danger-800); }

        .employee-select {
          padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          background: white; color: var(--color-neutral-700);
        }

        .locked-banner {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-3) var(--spacing-4);
          background: var(--color-warning-50); border: 1px solid var(--color-warning-300);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
          color: var(--color-warning-800);
        }

        .week-selector {
          display: flex; align-items: center; gap: var(--spacing-3);
        }
        .week-selector label {
          font-weight: var(--font-weight-semibold); color: var(--color-neutral-600);
          font-size: var(--font-size-sm);
        }
        .week-select {
          flex: 1; padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold);
        }

        .days-grid {
          display: flex; flex-direction: column; gap: var(--spacing-4);
        }

        .day-section {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); padding: var(--spacing-4);
        }

        .day-title {
          font-size: var(--font-size-md); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800); margin-bottom: var(--spacing-3);
          text-transform: capitalize;
        }

        .status-buttons { display: flex; gap: var(--spacing-2); }

        .status-btn {
          flex: 1; padding: var(--spacing-2) var(--spacing-3);
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          background: white; font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-sm); cursor: pointer;
          transition: all var(--transition-fast);
          font-family: var(--font-family-primary);
        }
        .status-btn:not(:disabled):hover { border-color: var(--color-primary-400); background: var(--color-primary-50); }
        .status-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .status-btn--available.active { border-color: var(--color-success-500); background: var(--color-success-50); color: var(--color-success-800); }
        .status-btn--unavailable.active { border-color: var(--color-danger-500); background: var(--color-danger-50); color: var(--color-danger-800); }
        .status-btn--uncertain.active { border-color: var(--color-warning-500); background: var(--color-warning-50); color: var(--color-warning-800); }

        .slots-section {
          margin-top: var(--spacing-3); padding-top: var(--spacing-3);
          border-top: 1px solid var(--color-neutral-100);
          display: flex; flex-direction: column; gap: var(--spacing-3);
        }

        .slots-buttons { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-2); }

        .slot-btn {
          padding: var(--spacing-3) var(--spacing-2);
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          background: white; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold);
          line-height: 1.4; cursor: pointer; transition: all var(--transition-fast);
          font-family: var(--font-family-primary); text-align: center;
        }
        .slot-btn :global(small) { font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); color: var(--color-neutral-500); }
        .slot-btn:not(:disabled):hover { border-color: var(--color-secondary-400); background: var(--color-secondary-50); }
        .slot-btn.active { border-color: var(--color-secondary-500); background: var(--color-secondary-50); color: var(--color-secondary-800); }
        .slot-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .slot-icon { display: flex; justify-content: center; margin-bottom: var(--spacing-1); }

        .custom-times {
          display: flex; align-items: center; gap: var(--spacing-2);
        }
        .time-input {
          flex: 1; padding: var(--spacing-2);
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-size: var(--font-size-sm); font-family: var(--font-family-primary);
        }
        .time-input:focus { outline: none; border-color: var(--color-secondary-400); }
        .time-separator { font-size: var(--font-size-sm); color: var(--color-neutral-500); }

        .comment-input {
          width: 100%; padding: var(--spacing-2);
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-size: var(--font-size-sm); font-family: var(--font-family-primary);
          resize: vertical;
        }
        .comment-input:focus { outline: none; border-color: var(--color-secondary-400); }

        .submit-btn {
          width: 100%; padding: var(--spacing-3) var(--spacing-4);
          background: var(--color-primary-600); color: white;
          border: none; border-radius: var(--radius-lg);
          font-size: var(--font-size-md); font-weight: var(--font-weight-bold);
          font-family: var(--font-family-primary);
          cursor: pointer; transition: all var(--transition-fast);
          position: sticky; bottom: var(--spacing-4);
          box-shadow: var(--shadow-lg);
        }
        .submit-btn:hover:not(:disabled) { background: var(--color-primary-700); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        @media (max-width: 640px) {
          .page-header { flex-direction: column; }
          .employee-select { width: 100%; }
          .status-buttons { flex-direction: column; }
          .slots-buttons { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
