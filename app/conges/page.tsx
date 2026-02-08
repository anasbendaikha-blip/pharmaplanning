/**
 * Page Conges unifiee — 3 onglets
 *
 * Onglet Demandes : CRUD complet sur leave_requests (ex calendrier-conges)
 * Onglet Calendrier Annuel : Vue mur 12 mois (ex conges-annuel vue year)
 * Onglet Calendrier Mensuel : Grille mensuelle grand format (ex conges-annuel vue month)
 *
 * styled-jsx global uniquement, prefixe cg-, CSS variables, pas d'emojis.
 */
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import {
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveRequest,
  deleteLeaveRequest,
  getEmployees,
} from '@/lib/supabase/queries';
import type { LeaveRequest } from '@/lib/supabase/queries';
import type { Employee } from '@/lib/types';
import { toISODateString } from '@/lib/utils/dateUtils';
import Modal from '@/components/ui/Modal';
import Link from 'next/link';

// ─── Types & constantes ───

type TabId = 'demandes' | 'annuel' | 'mensuel';

const LEAVE_TYPES: Record<string, string> = {
  conge_paye: 'Conge paye',
  rtt: 'RTT',
  maladie: 'Maladie',
  sans_solde: 'Sans solde',
  formation: 'Formation',
  autre: 'Autre',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuve',
  rejected: 'Refuse',
  cancelled: 'Annule',
};

const LEAVE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  conge_paye: { bg: 'var(--color-primary-50)', text: 'var(--color-primary-700)', bar: 'var(--color-primary-500)' },
  rtt: { bg: '#ede9fe', text: '#7c3aed', bar: '#8b5cf6' },
  maladie: { bg: 'var(--color-danger-50)', text: 'var(--color-danger-700)', bar: 'var(--color-danger-500)' },
  sans_solde: { bg: 'var(--color-neutral-100)', text: 'var(--color-neutral-700)', bar: 'var(--color-neutral-500)' },
  formation: { bg: 'var(--color-warning-50)', text: 'var(--color-warning-700)', bar: 'var(--color-warning-500)' },
  autre: { bg: 'var(--color-secondary-50)', text: 'var(--color-secondary-700)', bar: 'var(--color-secondary-500)' },
};

const MONTH_NAMES = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre',
];

const MONTHS_FR_SHORT = [
  'Janv.', 'Fevr.', 'Mars', 'Avr.', 'Mai', 'Juin',
  'Juil.', 'Aout', 'Sept.', 'Oct.', 'Nov.', 'Dec.',
];

const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface FormData {
  employeeId: string;
  startDate: string;
  endDate: string;
  type: string;
  notes: string;
}

const INITIAL_FORM: FormData = {
  employeeId: '',
  startDate: '',
  endDate: '',
  type: 'conge_paye',
  notes: '',
};

// ─── Types pour vue annuelle ───

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

// ─── Helpers ───

function countBusinessDays(start: string, end: string): number {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  let count = 0;
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function getEmployeeName(emp: Employee): string {
  return `${emp.first_name} ${emp.last_name}`;
}

function getAnnualEmployeeDisplayName(emp: AnnualEmployee | AnnualLeave['employee']): string {
  if (emp.first_name || emp.last_name) {
    return `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
  }
  return emp.name || 'Inconnu';
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function makeDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ─── Sous-composants ───

function DemandesTab({
  leaveRequests,
  employees,
  employeeMap,
  statusFilter,
  setStatusFilter,
  stats,
  year,
  month,
  handlePrevMonth,
  handleNextMonth,
  openCreate,
  openEdit,
  handleApprove,
  handleReject,
  handleDelete,
}: {
  leaveRequests: LeaveRequest[];
  employees: Employee[];
  employeeMap: Map<string, Employee>;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  stats: { total: number; pending: number; approved: number; totalDays: number };
  year: number;
  month: number;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  openCreate: () => void;
  openEdit: (leave: LeaveRequest) => void;
  handleApprove: (id: string) => void;
  handleReject: (id: string) => void;
  handleDelete: (id: string) => void;
}) {
  const filteredLeaves = useMemo(() => {
    if (statusFilter === 'all') return leaveRequests;
    return leaveRequests.filter((l) => l.status === statusFilter);
  }, [leaveRequests, statusFilter]);

  return (
    <>
      {/* Actions */}
      <div className="cg-demandes-actions">
        <button type="button" className="cg-btn-primary" onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nouvelle demande
        </button>
      </div>

      {/* Navigation mois */}
      <div className="cg-month-nav">
        <button type="button" className="cg-nav-btn" onClick={handlePrevMonth}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h3 className="cg-month-title">{MONTH_NAMES[month]} {year}</h3>
        <button type="button" className="cg-nav-btn" onClick={handleNextMonth}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Stats */}
      <div className="cg-stats-grid">
        <div className="cg-stat-card">
          <span className="cg-stat-value">{stats.total}</span>
          <span className="cg-stat-label">Demandes ce mois</span>
        </div>
        <div className="cg-stat-card">
          <span className="cg-stat-value cg-stat-value--warning">{stats.pending}</span>
          <span className="cg-stat-label">En attente</span>
        </div>
        <div className="cg-stat-card">
          <span className="cg-stat-value cg-stat-value--good">{stats.approved}</span>
          <span className="cg-stat-label">Approuvees</span>
        </div>
        <div className="cg-stat-card">
          <span className="cg-stat-value">{stats.totalDays}j</span>
          <span className="cg-stat-label">Jours valides</span>
        </div>
      </div>

      {/* Filtre statut */}
      <div className="cg-filter-bar">
        {['all', 'pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            type="button"
            className={`cg-filter-btn ${statusFilter === s ? 'cg-filter-btn--active' : ''}`}
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'Tous' : STATUS_LABELS[s]}
            {s === 'pending' && stats.pending > 0 && (
              <span className="cg-filter-count">{stats.pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="cg-content-section">
        {filteredLeaves.length === 0 ? (
          <div className="cg-empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <p className="cg-empty-text">
              {statusFilter === 'all'
                ? `Aucune demande de conge pour ${MONTH_NAMES[month]} ${year}`
                : `Aucune demande avec le statut "${STATUS_LABELS[statusFilter]}"`}
            </p>
          </div>
        ) : (
          <div className="cg-leaves-list">
            {filteredLeaves.map((leave) => {
              const emp = employeeMap.get(leave.employee_id);
              const empName = emp ? getEmployeeName(emp) : 'Employe inconnu';
              return (
                <div key={leave.id} className="cg-leave-card">
                  <div className="cg-leave-main">
                    <div className="cg-leave-employee">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                      <span className="cg-emp-name">{empName}</span>
                      {emp && <span className="cg-emp-category">{emp.category}</span>}
                    </div>
                    <div className="cg-leave-info">
                      <span className="cg-leave-dates">
                        {new Date(leave.start_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {' \u2192 '}
                        {new Date(leave.end_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="cg-leave-days">{leave.business_days || 0} jour{(leave.business_days || 0) !== 1 ? 's' : ''} ouvre{(leave.business_days || 0) !== 1 ? 's' : ''}</span>
                      <span className={`cg-leave-type cg-type-${leave.type}`}>{LEAVE_TYPES[leave.type] || leave.type}</span>
                    </div>
                    {leave.notes && <p className="cg-leave-notes">{leave.notes}</p>}
                  </div>
                  <div className="cg-leave-actions">
                    <span className={`cg-status-badge cg-status-${leave.status}`}>{STATUS_LABELS[leave.status] || leave.status}</span>
                    <div className="cg-action-buttons">
                      {leave.status === 'pending' && (
                        <>
                          <button type="button" className="cg-action-btn cg-action-btn--approve" onClick={() => handleApprove(leave.id)} title="Approuver">
                            {'\u2713'}
                          </button>
                          <button type="button" className="cg-action-btn cg-action-btn--reject" onClick={() => handleReject(leave.id)} title="Refuser">
                            {'\u2717'}
                          </button>
                        </>
                      )}
                      <button type="button" className="cg-action-btn cg-action-btn--edit" onClick={() => openEdit(leave)} title="Modifier">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button type="button" className="cg-action-btn cg-action-btn--delete" onClick={() => handleDelete(leave.id)} title="Supprimer">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function AnnuelTab({
  year,
  annualStats,
  leavesPerDay,
  handleDayClick,
}: {
  year: number;
  annualStats: AnnualStats;
  leavesPerDay: Map<string, AnnualLeave[]>;
  handleDayClick: (dateStr: string, day: number, month: number, dayLeaves: AnnualLeave[], event: React.MouseEvent) => void;
}) {
  const today = new Date();

  return (
    <>
      {/* Legende */}
      <div className="cg-legend-section">
        {Object.entries(LEAVE_TYPES).map(([key, label]) => {
          const colors = LEAVE_COLORS[key];
          return (
            <div key={key} className="cg-legend-item">
              <span className="cg-legend-color" style={{ backgroundColor: colors?.bar || 'var(--color-neutral-400)' }} />
              <span className="cg-legend-label">{label}</span>
              {annualStats.byType[key] ? <span className="cg-legend-count">{annualStats.byType[key]}</span> : null}
            </div>
          );
        })}
      </div>

      {/* Calendrier mural */}
      <div className="cg-calendar-section">
        <div className="cg-calendar-wall">
          {Array.from({ length: 12 }, (_, monthIndex) => {
            const daysInMonth = getDaysInMonth(year, monthIndex);
            const firstDay = new Date(year, monthIndex, 1);
            const firstDayCol = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

            return (
              <div key={monthIndex} className="cg-month-card">
                <div className="cg-month-card-header">
                  <span className="cg-month-card-title">{MONTH_NAMES[monthIndex]}</span>
                  {annualStats.byMonth[monthIndex] > 0 && (
                    <span className="cg-month-card-badge">{annualStats.byMonth[monthIndex]}</span>
                  )}
                </div>

                <div className="cg-month-grid">
                  {DAY_LETTERS.map((d, i) => (
                    <div key={i} className={`cg-day-header ${i >= 5 ? 'cg-day-header--weekend' : ''}`}>{d}</div>
                  ))}

                  {Array.from({ length: firstDayCol }, (_, i) => (
                    <div key={`e-${i}`} className="cg-day-cell cg-day-cell--empty" />
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
                          'cg-day-cell',
                          isWeekend ? 'cg-day-cell--weekend' : '',
                          isTodayCell ? 'cg-day-cell--today' : '',
                          dayLeaves.length > 0 ? 'cg-day-cell--has-leaves' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={(e) => handleDayClick(dateStr, day, monthIndex, dayLeaves, e)}
                      >
                        <span className="cg-day-number">{day}</span>
                        {dayLeaves.length > 0 && (
                          <div className="cg-day-dots">
                            {dayLeaves.slice(0, maxDots).map((leave, li) => (
                              <span
                                key={li}
                                className="cg-day-dot"
                                style={{ backgroundColor: (LEAVE_COLORS[leave.type] || LEAVE_COLORS.autre).bar }}
                              />
                            ))}
                            {extraCount > 0 && (
                              <span className="cg-day-dot-extra">+{extraCount}</span>
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
      </div>

      {/* Repartition mensuelle */}
      <div className="cg-monthly-chart">
        <h3 className="cg-section-title">Repartition mensuelle</h3>
        <div className="cg-chart-bars">
          {annualStats.byMonth.map((count, i) => {
            const maxCount = Math.max(...annualStats.byMonth, 1);
            const heightPct = (count / maxCount) * 100;
            return (
              <div key={i} className="cg-chart-col">
                <div className="cg-chart-bar-wrapper">
                  <div className="cg-chart-bar" style={{ height: `${heightPct}%` }} />
                </div>
                <span className="cg-chart-label">{MONTHS_FR_SHORT[i]}</span>
                {count > 0 && <span className="cg-chart-value">{count}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail par type */}
      {Object.keys(annualStats.byType).length > 0 && (
        <div className="cg-type-breakdown">
          <h3 className="cg-section-title">Detail par type de conge</h3>
          <div className="cg-type-grid">
            {Object.entries(annualStats.byType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const colors = LEAVE_COLORS[type] || LEAVE_COLORS.autre;
                const percentage = annualStats.total > 0 ? Math.round((count / annualStats.total) * 100) : 0;
                return (
                  <div key={type} className="cg-type-card">
                    <div className="cg-type-header">
                      <span className="cg-type-dot" style={{ backgroundColor: colors.bar }} />
                      <span className="cg-type-name">{LEAVE_TYPES[type] || type}</span>
                    </div>
                    <div className="cg-type-stats">
                      <span className="cg-type-count">{count}</span>
                      <span className="cg-type-pct">{percentage}%</span>
                    </div>
                    <div className="cg-type-progress-track">
                      <div className="cg-type-progress-fill" style={{ width: `${percentage}%`, backgroundColor: colors.bar }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </>
  );
}

function MensuelTab({
  year,
  selectedMonth,
  handlePrevMonth,
  handleNextMonth,
  leavesPerDay,
  handleDayClick,
}: {
  year: number;
  selectedMonth: number;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  leavesPerDay: Map<string, AnnualLeave[]>;
  handleDayClick: (dateStr: string, day: number, month: number, dayLeaves: AnnualLeave[], event: React.MouseEvent) => void;
}) {
  const today = new Date();
  const daysInMonth = getDaysInMonth(year, selectedMonth);
  const firstDay = new Date(year, selectedMonth, 1);
  const firstDayCol = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

  return (
    <>
      {/* Navigation mois */}
      <div className="cg-month-nav">
        <button type="button" className="cg-nav-btn" onClick={handlePrevMonth}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h3 className="cg-month-title">{MONTH_NAMES[selectedMonth]} {year}</h3>
        <button type="button" className="cg-nav-btn" onClick={handleNextMonth}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Legende */}
      <div className="cg-legend-section">
        {Object.entries(LEAVE_TYPES).map(([key, label]) => {
          const colors = LEAVE_COLORS[key];
          return (
            <div key={key} className="cg-legend-item">
              <span className="cg-legend-color" style={{ backgroundColor: colors?.bar || 'var(--color-neutral-400)' }} />
              <span className="cg-legend-label">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Grille mensuelle grand format */}
      <div className="cg-calendar-section">
        <div className="cg-month-large-grid">
          {DAY_LETTERS.map((d, i) => (
            <div key={i} className={`cg-ml-day-header ${i >= 5 ? 'cg-ml-day-header--weekend' : ''}`}>
              {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][i]}
            </div>
          ))}

          {Array.from({ length: firstDayCol }, (_, i) => (
            <div key={`e-${i}`} className="cg-ml-cell cg-ml-cell--empty" />
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
                  'cg-ml-cell',
                  isWeekend ? 'cg-ml-cell--weekend' : '',
                  isTodayCell ? 'cg-ml-cell--today' : '',
                  dayLeaves.length > 0 ? 'cg-ml-cell--has-leaves' : '',
                ].filter(Boolean).join(' ')}
                onClick={(e) => handleDayClick(dateStr, day, selectedMonth, dayLeaves, e)}
              >
                <span className="cg-ml-day-number">{day}</span>
                {dayLeaves.length > 0 && (
                  <div className="cg-ml-leaves-list">
                    {dayLeaves.slice(0, maxVisible).map((leave, li) => {
                      const colors = LEAVE_COLORS[leave.type] || LEAVE_COLORS.autre;
                      return (
                        <div key={li} className="cg-ml-leave-item">
                          <span className="cg-ml-leave-dot" style={{ backgroundColor: colors.bar }} />
                          <span className="cg-ml-leave-name">{getAnnualEmployeeDisplayName(leave.employee)}</span>
                        </div>
                      );
                    })}
                    {extraCount > 0 && (
                      <span className="cg-ml-leave-extra">+{extraCount} autre{extraCount > 1 ? 's' : ''}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── Composant principal ───

export default function CongesPage() {
  const { organizationId, isLoading: orgLoading } = useOrganization();

  // Onglet actif
  const [activeTab, setActiveTab] = useState<TabId>('demandes');

  // ─── Etat Demandes ───
  const [demYear, setDemYear] = useState(new Date().getFullYear());
  const [demMonth, setDemMonth] = useState(new Date().getMonth());
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [demLoading, setDemLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // ─── Etat Annuel/Mensuel ───
  const [annYear, setAnnYear] = useState(new Date().getFullYear());
  const [annSelectedMonth, setAnnSelectedMonth] = useState(new Date().getMonth());
  const [annLeaves, setAnnLeaves] = useState<AnnualLeave[]>([]);
  const [annEmployees, setAnnEmployees] = useState<AnnualEmployee[]>([]);
  const [annStats, setAnnStats] = useState<AnnualStats>({ total: 0, byType: {}, byMonth: Array(12).fill(0), totalDays: 0 });
  const [annLoading, setAnnLoading] = useState(true);
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

  // ─── Dates du mois (Demandes) ───
  const demMonthStart = `${demYear}-${String(demMonth + 1).padStart(2, '0')}-01`;
  const demNextMonth = demMonth === 11 ? `${demYear + 1}-01-01` : `${demYear}-${String(demMonth + 2).padStart(2, '0')}-01`;
  const demLastDay = new Date(new Date(demNextMonth + 'T12:00:00').getTime() - 86400000);
  const demMonthEnd = toISODateString(demLastDay);

  // ─── Chargement Demandes ───
  const loadDemandes = useCallback(async () => {
    if (!organizationId) return;
    setDemLoading(true);
    try {
      const [leaves, emps] = await Promise.all([
        getLeaveRequests(organizationId, demMonthStart, demMonthEnd),
        getEmployees(organizationId),
      ]);
      setLeaveRequests(leaves);
      setEmployees(emps);
    } catch (error) {
      console.error('Erreur chargement conges:', error);
    } finally {
      setDemLoading(false);
    }
  }, [organizationId, demMonthStart, demMonthEnd]);

  useEffect(() => {
    if (!orgLoading && organizationId && activeTab === 'demandes') loadDemandes();
  }, [orgLoading, organizationId, loadDemandes, activeTab]);

  // ─── Chargement Annuel/Mensuel ───
  const loadAnnual = useCallback(async () => {
    if (!organizationId) return;
    setAnnLoading(true);
    try {
      const params = new URLSearchParams({ organizationId, year: String(annYear) });
      if (filterEmployee !== 'all') params.set('employeeId', filterEmployee);
      if (filterType !== 'all') params.set('type', filterType);
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`/api/leaves/annual?${params.toString()}`);
      if (!res.ok) throw new Error('Erreur chargement');

      const data = await res.json();
      setAnnLeaves(data.leaves || []);
      setAnnEmployees(data.employees || []);
      setAnnStats(data.stats || { total: 0, byType: {}, byMonth: Array(12).fill(0), totalDays: 0 });
    } catch (error) {
      console.error('Erreur chargement conges annuels:', error);
    } finally {
      setAnnLoading(false);
    }
  }, [organizationId, annYear, filterEmployee, filterType, filterStatus]);

  useEffect(() => {
    if (!orgLoading && organizationId && (activeTab === 'annuel' || activeTab === 'mensuel')) loadAnnual();
  }, [orgLoading, organizationId, loadAnnual, activeTab]);

  // ─── Leaves par jour (Map) ───
  const leavesPerDay = useMemo(() => {
    const map = new Map<string, AnnualLeave[]>();
    for (const leave of annLeaves) {
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
  }, [annLeaves]);

  // ─── Demandes : navigation mois ───
  const handleDemPrevMonth = () => {
    if (demMonth === 0) { setDemMonth(11); setDemYear((y) => y - 1); }
    else { setDemMonth((m) => m - 1); }
  };
  const handleDemNextMonth = () => {
    if (demMonth === 11) { setDemMonth(0); setDemYear((y) => y + 1); }
    else { setDemMonth((m) => m + 1); }
  };

  // ─── Annuel : navigation annee ───
  const handlePrevYear = () => setAnnYear(y => y - 1);
  const handleNextYear = () => setAnnYear(y => y + 1);

  // ─── Mensuel : navigation mois ───
  const handleAnnPrevMonth = () => {
    if (annSelectedMonth === 0) { setAnnSelectedMonth(11); setAnnYear(y => y - 1); }
    else { setAnnSelectedMonth(m => m - 1); }
  };
  const handleAnnNextMonth = () => {
    if (annSelectedMonth === 11) { setAnnSelectedMonth(0); setAnnYear(y => y + 1); }
    else { setAnnSelectedMonth(m => m + 1); }
  };

  // ─── Employee map (Demandes) ───
  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const emp of employees) map.set(emp.id, emp);
    return map;
  }, [employees]);

  // ─── Stats Demandes ───
  const demStats = useMemo(() => {
    const total = leaveRequests.length;
    const pending = leaveRequests.filter((l) => l.status === 'pending').length;
    const approved = leaveRequests.filter((l) => l.status === 'approved').length;
    const totalDays = leaveRequests
      .filter((l) => l.status === 'approved')
      .reduce((sum, l) => sum + (l.business_days || 0), 0);
    return { total, pending, approved, totalDays };
  }, [leaveRequests]);

  // ─── Annuel stats ───
  const employeesWithLeaves = useMemo(() => {
    return annLeaves.reduce((set, l) => { set.add(l.employee_id); return set; }, new Set<string>()).size;
  }, [annLeaves]);

  const busiestMonth = useMemo(() => {
    const maxIdx = annStats.byMonth.indexOf(Math.max(...annStats.byMonth));
    return annStats.byMonth[maxIdx] > 0 ? MONTH_NAMES[maxIdx] : '-';
  }, [annStats.byMonth]);

  // ─── CRUD handlers ───
  const openCreate = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (leave: LeaveRequest) => {
    setEditingId(leave.id);
    setFormData({
      employeeId: leave.employee_id,
      startDate: leave.start_date,
      endDate: leave.end_date,
      type: leave.type,
      notes: leave.notes || '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;
    if (!formData.employeeId || !formData.startDate || !formData.endDate) {
      setFormError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (formData.endDate < formData.startDate) {
      setFormError('La date de fin doit etre apres la date de debut.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const businessDays = countBusinessDays(formData.startDate, formData.endDate);
      if (editingId) {
        await updateLeaveRequest(editingId, {
          start_date: formData.startDate,
          end_date: formData.endDate,
          type: formData.type,
          business_days: businessDays,
          notes: formData.notes,
        });
      } else {
        await createLeaveRequest(organizationId, {
          employee_id: formData.employeeId,
          start_date: formData.startDate,
          end_date: formData.endDate,
          type: formData.type,
          business_days: businessDays,
          notes: formData.notes,
        });
      }
      setShowModal(false);
      loadDemandes();
    } catch (error) {
      console.error('Erreur soumission:', error);
      setFormError('Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => { await updateLeaveRequest(id, { status: 'approved' }); loadDemandes(); };
  const handleReject = async (id: string) => { await updateLeaveRequest(id, { status: 'rejected' }); loadDemandes(); };
  const handleDelete = async (id: string) => {
    if (!window.confirm('Supprimer cette demande de conge ?')) return;
    await deleteLeaveRequest(id);
    loadDemandes();
  };

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
      if (!target.closest('.cg-day-popover')) setSelectedDay(null);
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

  // ─── Navigation contextuelle ───
  const renderNavContext = () => {
    if (activeTab === 'annuel') {
      return (
        <div className="cg-year-nav">
          <button type="button" className="cg-nav-btn" onClick={handlePrevYear}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="cg-year-center">
            <h2 className="cg-year-title">{annYear}</h2>
            {annYear !== new Date().getFullYear() && (
              <button type="button" className="cg-today-btn" onClick={() => setAnnYear(new Date().getFullYear())}>
                Aujourd&apos;hui
              </button>
            )}
          </div>
          <button type="button" className="cg-nav-btn" onClick={handleNextYear}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      );
    }
    return null;
  };

  // ─── Loading ───
  if (orgLoading) {
    return (
      <>
        <div className="cg-loading-page">
          <span className="cg-loading-spinner" />
          <span>Chargement des conges...</span>
        </div>
        <style jsx global>{`
          .cg-loading-page {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: var(--spacing-3); height: 400px; color: var(--color-neutral-500);
          }
          .cg-loading-spinner {
            width: 36px; height: 36px; border: 3px solid var(--color-neutral-200);
            border-top-color: var(--color-primary-500); border-radius: 50%;
            animation: cg-spin 0.8s linear infinite;
          }
          @keyframes cg-spin { to { transform: rotate(360deg); } }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div className="cg-page">
        {/* ─── Header Card ─── */}
        <section className="cg-header-card">
          <div className="cg-header-top">
            <div className="cg-header-left">
              <Link href="/" className="cg-back-link">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Tableau de bord
              </Link>
              <h1 className="cg-page-title">Conges</h1>
              <p className="cg-page-subtitle">Gestion des demandes, calendrier annuel et mensuel</p>
            </div>
          </div>

          {/* Navigation contextuelle */}
          {renderNavContext()}

          {/* Onglets */}
          <div className="cg-tabs">
            <button
              type="button"
              className={`cg-tab ${activeTab === 'demandes' ? 'cg-tab--active' : ''}`}
              onClick={() => setActiveTab('demandes')}
            >
              Demandes
              {demStats.pending > 0 && <span className="cg-tab-badge">{demStats.pending}</span>}
            </button>
            <button
              type="button"
              className={`cg-tab ${activeTab === 'annuel' ? 'cg-tab--active' : ''}`}
              onClick={() => setActiveTab('annuel')}
            >
              Calendrier Annuel
            </button>
            <button
              type="button"
              className={`cg-tab ${activeTab === 'mensuel' ? 'cg-tab--active' : ''}`}
              onClick={() => setActiveTab('mensuel')}
            >
              Calendrier Mensuel
            </button>
          </div>
        </section>

        {/* ─── Filtres partages Annuel/Mensuel ─── */}
        {(activeTab === 'annuel' || activeTab === 'mensuel') && (
          <>
            {/* Stats annuelles */}
            <section className="cg-stats-grid">
              <div className="cg-stat-card">
                <span className="cg-stat-value">{annStats.total}</span>
                <span className="cg-stat-label">Total conges</span>
              </div>
              <div className="cg-stat-card">
                <span className="cg-stat-value">{annStats.totalDays}j</span>
                <span className="cg-stat-label">Jours d&apos;absence</span>
              </div>
              <div className="cg-stat-card">
                <span className="cg-stat-value">{employeesWithLeaves}</span>
                <span className="cg-stat-label">Employes concernes</span>
              </div>
              <div className="cg-stat-card">
                <span className="cg-stat-value cg-stat-value--accent">{busiestMonth}</span>
                <span className="cg-stat-label">Mois le plus charge</span>
              </div>
            </section>

            <section className="cg-filters-section">
              <div className="cg-filter-group">
                <label htmlFor="cg-filter-employee" className="cg-filter-label">Employe</label>
                <select id="cg-filter-employee" className="cg-filter-select" value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)}>
                  <option value="all">Tous les employes</option>
                  {annEmployees.map(emp => (
                    <option key={emp.id} value={emp.id}>{getAnnualEmployeeDisplayName(emp)}</option>
                  ))}
                </select>
              </div>
              <div className="cg-filter-group">
                <label htmlFor="cg-filter-type" className="cg-filter-label">Type</label>
                <select id="cg-filter-type" className="cg-filter-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="all">Tous les types</option>
                  {Object.entries(LEAVE_TYPES).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="cg-filter-group">
                <label htmlFor="cg-filter-status" className="cg-filter-label">Statut</label>
                <select id="cg-filter-status" className="cg-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="all">Tous les statuts</option>
                  <option value="approved">Approuve</option>
                  <option value="pending">En attente</option>
                  <option value="rejected">Refuse</option>
                </select>
              </div>
            </section>
          </>
        )}

        {/* ─── Contenu conditionnel ─── */}
        {activeTab === 'demandes' && (
          <DemandesTab
            leaveRequests={leaveRequests}
            employees={employees}
            employeeMap={employeeMap}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            stats={demStats}
            year={demYear}
            month={demMonth}
            handlePrevMonth={handleDemPrevMonth}
            handleNextMonth={handleDemNextMonth}
            openCreate={openCreate}
            openEdit={openEdit}
            handleApprove={handleApprove}
            handleReject={handleReject}
            handleDelete={handleDelete}
          />
        )}

        {activeTab === 'annuel' && (
          <AnnuelTab
            year={annYear}
            annualStats={annStats}
            leavesPerDay={leavesPerDay}
            handleDayClick={handleDayClick}
          />
        )}

        {activeTab === 'mensuel' && (
          <MensuelTab
            year={annYear}
            selectedMonth={annSelectedMonth}
            handlePrevMonth={handleAnnPrevMonth}
            handleNextMonth={handleAnnNextMonth}
            leavesPerDay={leavesPerDay}
            handleDayClick={handleDayClick}
          />
        )}
      </div>

      {/* ─── Modal Creation / Edition ─── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Modifier la demande' : 'Nouvelle demande de conge'}
        size="md"
        footer={
          <div className="cg-modal-actions">
            <button type="button" className="cg-btn-cancel" onClick={() => setShowModal(false)}>
              Annuler
            </button>
            <button
              type="button"
              className="cg-btn-submit"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Enregistrement...' : editingId ? 'Modifier' : 'Creer'}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="cg-leave-form">
          {formError && <div className="cg-form-error">{formError}</div>}

          <div className="cg-form-group">
            <label htmlFor="cg-leave-employee" className="cg-form-label">Employe *</label>
            <select
              id="cg-leave-employee"
              className="cg-form-select"
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              disabled={!!editingId}
            >
              <option value="">Selectionner un employe</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {getEmployeeName(emp)}
                </option>
              ))}
            </select>
          </div>

          <div className="cg-form-row">
            <div className="cg-form-group">
              <label htmlFor="cg-leave-start" className="cg-form-label">Date de debut *</label>
              <input
                id="cg-leave-start"
                type="date"
                className="cg-form-input"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            <div className="cg-form-group">
              <label htmlFor="cg-leave-end" className="cg-form-label">Date de fin *</label>
              <input
                id="cg-leave-end"
                type="date"
                className="cg-form-input"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
          </div>

          {formData.startDate && formData.endDate && formData.endDate >= formData.startDate && (
            <div className="cg-form-info">
              {countBusinessDays(formData.startDate, formData.endDate)} jours ouvres
            </div>
          )}

          <div className="cg-form-group">
            <label htmlFor="cg-leave-type" className="cg-form-label">Type de conge</label>
            <select
              id="cg-leave-type"
              className="cg-form-select"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              {Object.entries(LEAVE_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="cg-form-group">
            <label htmlFor="cg-leave-notes" className="cg-form-label">Notes</label>
            <textarea
              id="cg-leave-notes"
              className="cg-form-textarea"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Motif, commentaire..."
            />
          </div>
        </form>
      </Modal>

      {/* ─── Popover detail jour ─── */}
      {selectedDay && (
        <div
          className="cg-day-popover"
          style={{ left: `${selectedDay.x}px`, top: `${selectedDay.y}px` }}
        >
          <div className="cg-popover-header">
            <span className="cg-popover-date">
              {selectedDay.day} {MONTH_NAMES[selectedDay.month]} {annYear}
            </span>
            <span className="cg-popover-count">
              {selectedDay.leaves.length} absence{selectedDay.leaves.length !== 1 ? 's' : ''}
            </span>
            <button type="button" className="cg-popover-close" onClick={() => setSelectedDay(null)}>
              &times;
            </button>
          </div>
          <div className="cg-popover-body">
            {selectedDay.leaves.map((leave, i) => {
              const colors = LEAVE_COLORS[leave.type] || LEAVE_COLORS.autre;
              return (
                <div key={`${leave.id}-${i}`} className="cg-popover-leave">
                  <span className="cg-popover-dot" style={{ backgroundColor: colors.bar }} />
                  <div className="cg-popover-leave-info">
                    <span className="cg-popover-emp-name">{getAnnualEmployeeDisplayName(leave.employee)}</span>
                    <span className="cg-popover-leave-type" style={{ color: colors.text }}>
                      {LEAVE_TYPES[leave.type] || leave.type}
                    </span>
                    <span className="cg-popover-leave-dates">
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
        /* ═══════════════════════════════════════════════════════
           CONGES PAGE — Prefixe cg-
           ═══════════════════════════════════════════════════════ */
        .cg-page { display: flex; flex-direction: column; gap: var(--spacing-5); }

        /* ─── Header Card ─── */
        .cg-header-card {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); overflow: hidden;
        }
        .cg-header-top { padding: var(--spacing-5) var(--spacing-5) 0; }
        .cg-header-left { display: flex; flex-direction: column; gap: var(--spacing-1); }
        .cg-back-link {
          display: inline-flex; align-items: center; gap: var(--spacing-1);
          font-size: var(--font-size-xs); color: var(--color-primary-600);
          text-decoration: none; margin-bottom: var(--spacing-2);
        }
        .cg-back-link:hover { color: var(--color-primary-700); }
        .cg-page-title { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); color: var(--color-neutral-900); margin: 0; }
        .cg-page-subtitle { font-size: var(--font-size-sm); color: var(--color-neutral-500); margin: 0; }

        /* ─── Year nav ─── */
        .cg-year-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--spacing-3) var(--spacing-5);
        }
        .cg-year-center { display: flex; align-items: center; gap: var(--spacing-3); }
        .cg-year-title { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-neutral-900); margin: 0; }
        .cg-today-btn {
          padding: var(--spacing-1) var(--spacing-3);
          background: var(--color-primary-50); border: 1px solid var(--color-primary-200);
          border-radius: var(--radius-md); font-family: var(--font-family-primary);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
          color: var(--color-primary-700); cursor: pointer; transition: all 0.15s ease;
        }
        .cg-today-btn:hover { background: var(--color-primary-100); }

        /* ─── Tabs ─── */
        .cg-tabs {
          display: flex; gap: 0; border-top: 1px solid var(--color-neutral-200);
        }
        .cg-tab {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: var(--spacing-2);
          padding: var(--spacing-3) var(--spacing-4);
          background: none; border: none; border-bottom: 2px solid transparent;
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold); color: var(--color-neutral-500);
          cursor: pointer; transition: all 0.15s ease;
        }
        .cg-tab:hover { color: var(--color-neutral-700); background: var(--color-neutral-50); }
        .cg-tab--active { color: var(--color-primary-700); border-bottom-color: var(--color-primary-600); }
        .cg-tab-badge {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 20px; height: 20px; padding: 0 5px;
          background: var(--color-warning-100); color: var(--color-warning-700);
          border-radius: var(--radius-full); font-size: 11px; font-weight: var(--font-weight-bold);
        }

        /* ─── Nav buttons ─── */
        .cg-nav-btn {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          cursor: pointer; color: var(--color-neutral-600); transition: all 0.15s ease;
        }
        .cg-nav-btn:hover { background: var(--color-neutral-50); border-color: var(--color-neutral-300); }

        /* ─── Month nav ─── */
        .cg-month-nav {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg);
        }
        .cg-month-title { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-neutral-900); margin: 0; }

        /* ─── Stats grid ─── */
        .cg-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-4); }
        .cg-stat-card {
          display: flex; flex-direction: column; align-items: center; gap: var(--spacing-1);
          padding: var(--spacing-4); background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
        }
        .cg-stat-value { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-primary-600); }
        .cg-stat-value--warning { color: var(--color-warning-500); }
        .cg-stat-value--good { color: var(--color-success-600); }
        .cg-stat-value--accent { font-size: var(--font-size-base); color: var(--color-warning-600); }
        .cg-stat-label { font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); color: var(--color-neutral-500); text-align: center; }

        /* ─── Demandes actions ─── */
        .cg-demandes-actions { display: flex; justify-content: flex-end; }
        .cg-btn-primary {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4); background: var(--color-primary-600);
          border: 1px solid var(--color-primary-600); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold); color: white;
          cursor: pointer; transition: all 0.15s ease;
        }
        .cg-btn-primary:hover { background: var(--color-primary-700); }

        /* ─── Filter bar ─── */
        .cg-filter-bar { display: flex; gap: var(--spacing-2); }
        .cg-filter-btn {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium); color: var(--color-neutral-600);
          cursor: pointer; transition: all 0.15s ease;
        }
        .cg-filter-btn:hover { border-color: var(--color-neutral-300); }
        .cg-filter-btn--active { background: var(--color-primary-600); border-color: var(--color-primary-600); color: white; }
        .cg-filter-count {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 20px; height: 20px; padding: 0 4px;
          background: rgba(255,255,255,0.2); border-radius: var(--radius-full);
          font-size: 11px; font-weight: var(--font-weight-bold);
        }

        /* ─── Filters section (shared Annuel/Mensuel) ─── */
        .cg-filters-section {
          display: flex; gap: var(--spacing-4); flex-wrap: wrap; padding: var(--spacing-4);
          background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg);
        }
        .cg-filter-group { display: flex; flex-direction: column; gap: var(--spacing-1); flex: 1; min-width: 160px; }
        .cg-filter-label { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); color: var(--color-neutral-600); text-transform: uppercase; letter-spacing: 0.03em; }
        .cg-filter-select {
          padding: var(--spacing-2) var(--spacing-3); border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md); font-family: var(--font-family-primary);
          font-size: var(--font-size-sm); color: var(--color-neutral-700);
          background: white; cursor: pointer; transition: border-color 0.15s ease;
        }
        .cg-filter-select:focus { outline: none; border-color: var(--color-primary-500); box-shadow: 0 0 0 2px var(--color-primary-100); }

        /* ─── Content section ─── */
        .cg-content-section {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); padding: var(--spacing-5);
        }
        .cg-empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-3); padding: var(--spacing-8); text-align: center; }
        .cg-empty-text { font-size: var(--font-size-sm); color: var(--color-neutral-500); margin: 0; }

        /* ─── Leave cards ─── */
        .cg-leaves-list { display: flex; flex-direction: column; gap: var(--spacing-3); }
        .cg-leave-card {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: var(--spacing-4); border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md); transition: all 0.15s ease; gap: var(--spacing-4);
        }
        .cg-leave-card:hover { border-color: var(--color-primary-200); box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .cg-leave-main { flex: 1; display: flex; flex-direction: column; gap: var(--spacing-2); min-width: 0; }
        .cg-leave-employee { display: flex; align-items: center; gap: var(--spacing-2); color: var(--color-neutral-600); }
        .cg-emp-name { font-weight: var(--font-weight-semibold); color: var(--color-neutral-800); font-size: var(--font-size-sm); }
        .cg-emp-category {
          padding: 1px 8px; background: var(--color-neutral-100); border-radius: var(--radius-sm);
          font-size: 11px; color: var(--color-neutral-600);
        }
        .cg-leave-info { display: flex; align-items: center; gap: var(--spacing-3); flex-wrap: wrap; }
        .cg-leave-dates { font-weight: var(--font-weight-bold); font-size: var(--font-size-sm); color: var(--color-neutral-900); }
        .cg-leave-days { font-size: var(--font-size-xs); color: var(--color-neutral-500); }
        .cg-leave-type {
          padding: 2px 10px; border-radius: var(--radius-full);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
          background: var(--color-neutral-100); color: var(--color-neutral-700);
        }
        .cg-type-conge_paye { background: var(--color-primary-50); color: var(--color-primary-700); }
        .cg-type-rtt { background: #ede9fe; color: #7c3aed; }
        .cg-type-maladie { background: var(--color-danger-50); color: var(--color-danger-700); }
        .cg-type-formation { background: var(--color-warning-50); color: var(--color-warning-700); }
        .cg-leave-notes { font-size: var(--font-size-xs); color: var(--color-neutral-400); font-style: italic; margin: 0; }

        .cg-leave-actions { display: flex; flex-direction: column; align-items: flex-end; gap: var(--spacing-2); flex-shrink: 0; }
        .cg-status-badge {
          padding: 4px 12px; border-radius: var(--radius-full);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-bold);
          white-space: nowrap;
        }
        .cg-status-pending { background: var(--color-warning-100); color: var(--color-warning-700); }
        .cg-status-approved { background: var(--color-primary-100); color: var(--color-primary-700); }
        .cg-status-rejected { background: var(--color-danger-100); color: var(--color-danger-700); }
        .cg-status-cancelled { background: var(--color-neutral-100); color: var(--color-neutral-600); }

        .cg-action-buttons { display: flex; gap: var(--spacing-1); }
        .cg-action-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md); background: white; cursor: pointer;
          font-size: 14px; transition: all 0.15s ease; color: var(--color-neutral-500);
        }
        .cg-action-btn:hover { border-color: var(--color-neutral-300); }
        .cg-action-btn--approve:hover { background: var(--color-primary-50); color: var(--color-primary-600); border-color: var(--color-primary-300); }
        .cg-action-btn--reject:hover { background: var(--color-danger-50); color: var(--color-danger-500); border-color: var(--color-danger-300); }
        .cg-action-btn--edit:hover { background: var(--color-warning-50); color: var(--color-warning-600); border-color: var(--color-warning-300); }
        .cg-action-btn--delete:hover { background: var(--color-danger-50); color: var(--color-danger-500); border-color: var(--color-danger-300); }

        /* ─── Legend ─── */
        .cg-legend-section {
          display: flex; flex-wrap: wrap; gap: var(--spacing-4);
          padding: var(--spacing-3) var(--spacing-4);
          background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg);
        }
        .cg-legend-item { display: flex; align-items: center; gap: var(--spacing-2); }
        .cg-legend-color { width: 12px; height: 12px; border-radius: var(--radius-sm); flex-shrink: 0; }
        .cg-legend-label { font-size: var(--font-size-xs); color: var(--color-neutral-600); font-weight: var(--font-weight-medium); }
        .cg-legend-count {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 18px; height: 18px; padding: 0 4px;
          background: var(--color-neutral-100); border-radius: var(--radius-full);
          font-size: 11px; font-weight: var(--font-weight-bold); color: var(--color-neutral-600);
        }

        /* ─── Calendar section ─── */
        .cg-calendar-section {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); overflow: hidden;
        }

        /* ─── Calendrier mural 12 mois ─── */
        .cg-calendar-wall {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 0; padding: 0;
        }
        .cg-month-card {
          padding: var(--spacing-3);
          border-right: 1px solid var(--color-neutral-100);
          border-bottom: 1px solid var(--color-neutral-100);
        }
        .cg-month-card:nth-child(4n) { border-right: none; }
        .cg-month-card:nth-child(n+9) { border-bottom: none; }

        .cg-month-card-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: var(--spacing-2); padding-bottom: var(--spacing-1);
          border-bottom: 1px solid var(--color-neutral-100);
        }
        .cg-month-card-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); }
        .cg-month-card-badge {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 20px; height: 20px; padding: 0 5px;
          background: var(--color-primary-100); color: var(--color-primary-700);
          border-radius: var(--radius-full); font-size: 11px; font-weight: var(--font-weight-bold);
        }

        .cg-month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }

        .cg-day-header {
          text-align: center; font-size: 9px; font-weight: var(--font-weight-bold);
          color: var(--color-neutral-400); padding: 2px 0 3px; text-transform: uppercase;
        }
        .cg-day-header--weekend { color: var(--color-neutral-300); }

        .cg-day-cell {
          display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
          min-height: 32px; padding: 1px; border-radius: 3px;
          cursor: default; transition: background-color 0.1s ease;
        }
        .cg-day-cell--empty { min-height: 0; }
        .cg-day-cell--weekend { background: var(--color-neutral-50); }
        .cg-day-cell--weekend .cg-day-number { color: var(--color-neutral-400); }
        .cg-day-cell--today { background: var(--color-primary-50); outline: 1px solid var(--color-primary-300); outline-offset: -1px; }
        .cg-day-cell--today .cg-day-number { color: var(--color-primary-700); font-weight: var(--font-weight-bold); }
        .cg-day-cell--has-leaves { cursor: pointer; }
        .cg-day-cell--has-leaves:hover { background: var(--color-neutral-100); }
        .cg-day-cell--today.cg-day-cell--has-leaves:hover { background: var(--color-primary-100); }

        .cg-day-number { font-size: 10px; font-weight: var(--font-weight-medium); color: var(--color-neutral-600); line-height: 1; margin-bottom: 1px; }
        .cg-day-dots { display: flex; flex-wrap: wrap; gap: 1px; justify-content: center; }
        .cg-day-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .cg-day-dot-extra { font-size: 7px; font-weight: var(--font-weight-bold); color: var(--color-neutral-500); line-height: 5px; }

        /* ─── Vue mensuelle grand format ─── */
        .cg-month-large-grid {
          display: grid; grid-template-columns: repeat(7, 1fr); gap: 0;
        }
        .cg-ml-day-header {
          text-align: center; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-500); padding: var(--spacing-2);
          border-bottom: 2px solid var(--color-neutral-200);
          background: var(--color-neutral-50);
        }
        .cg-ml-day-header--weekend { color: var(--color-neutral-400); background: var(--color-neutral-100); }

        .cg-ml-cell {
          min-height: 90px; padding: var(--spacing-2);
          border-right: 1px solid var(--color-neutral-100);
          border-bottom: 1px solid var(--color-neutral-100);
          cursor: default; transition: background-color 0.1s ease;
          display: flex; flex-direction: column; gap: 2px;
        }
        .cg-ml-cell:nth-child(7n + 7) { border-right: none; }
        .cg-ml-cell--empty { min-height: 40px; background: var(--color-neutral-50); }
        .cg-ml-cell--weekend { background: var(--color-neutral-50); }
        .cg-ml-cell--today { background: var(--color-primary-50); }
        .cg-ml-cell--has-leaves { cursor: pointer; }
        .cg-ml-cell--has-leaves:hover { background: var(--color-neutral-100); }
        .cg-ml-cell--today.cg-ml-cell--has-leaves:hover { background: var(--color-primary-100); }

        .cg-ml-day-number {
          font-size: var(--font-size-sm); font-weight: var(--font-weight-bold);
          color: var(--color-neutral-700); margin-bottom: 2px;
        }
        .cg-ml-cell--today .cg-ml-day-number { color: var(--color-primary-700); }
        .cg-ml-cell--weekend .cg-ml-day-number { color: var(--color-neutral-400); }

        .cg-ml-leaves-list { display: flex; flex-direction: column; gap: 2px; }
        .cg-ml-leave-item { display: flex; align-items: center; gap: 4px; overflow: hidden; }
        .cg-ml-leave-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .cg-ml-leave-name {
          font-size: 11px; color: var(--color-neutral-700); font-weight: var(--font-weight-medium);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cg-ml-leave-extra { font-size: 10px; color: var(--color-neutral-500); font-weight: var(--font-weight-semibold); }

        /* ─── Monthly chart ─── */
        .cg-monthly-chart { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: var(--spacing-5); }
        .cg-section-title { font-size: var(--font-size-md); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); margin: 0 0 var(--spacing-4); }
        .cg-chart-bars { display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--spacing-2); align-items: end; }
        .cg-chart-col { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-1); }
        .cg-chart-bar-wrapper { width: 100%; height: 100px; display: flex; align-items: flex-end; justify-content: center; }
        .cg-chart-bar { width: 70%; min-height: 2px; background: var(--color-primary-400); border-radius: 3px 3px 0 0; transition: height 0.3s ease; }
        .cg-chart-label { font-size: 10px; color: var(--color-neutral-500); font-weight: var(--font-weight-medium); text-align: center; }
        .cg-chart-value { font-size: 11px; color: var(--color-primary-600); font-weight: var(--font-weight-bold); }

        /* ─── Type breakdown ─── */
        .cg-type-breakdown { background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); padding: var(--spacing-5); }
        .cg-type-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--spacing-3); }
        .cg-type-card { padding: var(--spacing-3); border: 1px solid var(--color-neutral-100); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: var(--spacing-2); }
        .cg-type-header { display: flex; align-items: center; gap: var(--spacing-2); }
        .cg-type-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .cg-type-name { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-700); }
        .cg-type-stats { display: flex; justify-content: space-between; align-items: baseline; }
        .cg-type-count { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); }
        .cg-type-pct { font-size: var(--font-size-xs); color: var(--color-neutral-500); }
        .cg-type-progress-track { height: 4px; background: var(--color-neutral-100); border-radius: 2px; overflow: hidden; }
        .cg-type-progress-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease; }

        /* ─── Popover ─── */
        .cg-day-popover {
          position: fixed; z-index: 1000; transform: translateX(-50%);
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); box-shadow: var(--shadow-xl);
          min-width: 240px; max-width: 320px; max-height: 300px; overflow-y: auto;
        }
        .cg-popover-header {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-3); border-bottom: 1px solid var(--color-neutral-100);
          position: sticky; top: 0; background: white;
        }
        .cg-popover-date { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); flex: 1; }
        .cg-popover-count { font-size: var(--font-size-xs); color: var(--color-neutral-500); white-space: nowrap; }
        .cg-popover-close {
          display: flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; background: transparent; border: none;
          border-radius: var(--radius-sm); cursor: pointer; color: var(--color-neutral-400);
          font-size: 16px; line-height: 1; transition: all 0.1s ease;
        }
        .cg-popover-close:hover { background: var(--color-neutral-100); color: var(--color-neutral-600); }
        .cg-popover-body { padding: var(--spacing-2) var(--spacing-3) var(--spacing-3); display: flex; flex-direction: column; gap: var(--spacing-2); }
        .cg-popover-leave { display: flex; align-items: flex-start; gap: var(--spacing-2); }
        .cg-popover-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 3px; flex-shrink: 0; }
        .cg-popover-leave-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .cg-popover-emp-name { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-800); }
        .cg-popover-leave-type { font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); }
        .cg-popover-leave-dates { font-size: var(--font-size-xs); color: var(--color-neutral-400); }

        /* ─── Modal form ─── */
        .cg-leave-form { display: flex; flex-direction: column; gap: var(--spacing-4); }
        .cg-form-error {
          padding: var(--spacing-3); background: var(--color-danger-50);
          border-left: 3px solid var(--color-danger-500); border-radius: var(--radius-sm);
          font-size: var(--font-size-sm); color: var(--color-danger-700);
        }
        .cg-form-group { display: flex; flex-direction: column; gap: var(--spacing-1); }
        .cg-form-label {
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600); text-transform: uppercase; letter-spacing: 0.03em;
        }
        .cg-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4); }
        .cg-form-input, .cg-form-select, .cg-form-textarea {
          padding: var(--spacing-2) var(--spacing-3); border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md); font-family: var(--font-family-primary);
          font-size: var(--font-size-sm); color: var(--color-neutral-700); transition: border-color 0.15s ease;
          background: white;
        }
        .cg-form-input:focus, .cg-form-select:focus, .cg-form-textarea:focus {
          outline: none; border-color: var(--color-primary-500); box-shadow: 0 0 0 2px var(--color-primary-100);
        }
        .cg-form-textarea { resize: vertical; min-height: 60px; }
        .cg-form-info {
          padding: var(--spacing-2) var(--spacing-3); background: var(--color-primary-50);
          border-radius: var(--radius-sm); font-size: var(--font-size-sm);
          color: var(--color-primary-700); font-weight: var(--font-weight-semibold);
        }

        .cg-modal-actions { display: flex; gap: var(--spacing-3); width: 100%; justify-content: flex-end; }
        .cg-btn-cancel {
          padding: var(--spacing-2) var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium); color: var(--color-neutral-600);
          cursor: pointer; transition: all 0.15s ease;
        }
        .cg-btn-cancel:hover { background: var(--color-neutral-50); }
        .cg-btn-submit {
          padding: var(--spacing-2) var(--spacing-4); background: var(--color-primary-600);
          border: 1px solid var(--color-primary-600); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold); color: white;
          cursor: pointer; transition: all 0.15s ease;
        }
        .cg-btn-submit:hover:not(:disabled) { background: var(--color-primary-700); }
        .cg-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ─── Print ─── */
        @media print {
          .cg-header-card, .cg-filters-section, .cg-demandes-actions, .cg-filter-bar { display: none !important; }
          .cg-page { gap: var(--spacing-3); }
          .cg-calendar-section, .cg-monthly-chart, .cg-type-breakdown { break-inside: avoid; }
          .cg-day-popover { display: none !important; }
        }

        /* ─── Responsive ─── */
        @media (max-width: 1200px) {
          .cg-calendar-wall { grid-template-columns: repeat(3, 1fr); }
          .cg-month-card:nth-child(3n) { border-right: none; }
          .cg-month-card:nth-child(4n) { border-right: 1px solid var(--color-neutral-100); }
        }

        @media (max-width: 900px) {
          .cg-stats-grid { grid-template-columns: repeat(2, 1fr); }
          .cg-filter-bar { flex-wrap: wrap; }
          .cg-leave-card { flex-direction: column; }
          .cg-leave-actions { flex-direction: row; align-items: center; width: 100%; justify-content: space-between; }
          .cg-form-row { grid-template-columns: 1fr; }
          .cg-filters-section { flex-direction: column; }
          .cg-filter-group { min-width: 0; }
          .cg-chart-bars { grid-template-columns: repeat(6, 1fr); }
          .cg-chart-bar-wrapper { height: 60px; }
          .cg-type-grid { grid-template-columns: 1fr; }

          .cg-calendar-wall { grid-template-columns: repeat(2, 1fr); }
          .cg-month-card { border-right: 1px solid var(--color-neutral-100) !important; border-bottom: 1px solid var(--color-neutral-100) !important; }
          .cg-month-card:nth-child(2n) { border-right: none !important; }

          .cg-ml-day-header { font-size: 11px; padding: var(--spacing-1); }
          .cg-ml-cell { min-height: 70px; padding: var(--spacing-1); }
          .cg-ml-leave-name { font-size: 10px; }
        }

        @media (max-width: 640px) {
          .cg-calendar-wall { grid-template-columns: 1fr; }
          .cg-month-card { border-right: none !important; border-bottom: 1px solid var(--color-neutral-100) !important; }
          .cg-month-card:last-child { border-bottom: none !important; }

          .cg-ml-day-header { font-size: 10px; }
          .cg-ml-cell { min-height: 60px; }
          .cg-ml-leave-item { display: none; }
          .cg-ml-cell--has-leaves .cg-ml-day-number::after {
            content: ''; display: inline-block; width: 6px; height: 6px;
            background: var(--color-primary-500); border-radius: 50%; margin-left: 4px; vertical-align: middle;
          }

          .cg-tabs { overflow-x: auto; }
          .cg-tab { white-space: nowrap; font-size: var(--font-size-xs); padding: var(--spacing-2) var(--spacing-3); }
        }
      `}</style>
    </>
  );
}
