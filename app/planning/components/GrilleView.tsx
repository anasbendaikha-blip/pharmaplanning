/**
 * GrilleView — Vue grille Excel simplifie
 *
 * Grille cliquable 6 jours x 2 creneaux (Matin / Aprem) par employe.
 * Chaque cellule est un toggle : clic = assigner/desassigner.
 * Utilise le store central localStorage pour la persistance.
 *
 * Conventions : pas d'emojis, styled-jsx, prefix "gv-"
 */
'use client';

import { useState, useMemo, useCallback } from 'react';
import { usePlanningStore } from '@/lib/hooks/usePlanningStore';
import type { Employee, EmployeeCategory } from '@/lib/types';
import type { CreneauType } from '@/lib/store/planning-store';

interface GrilleViewProps {
  employees: Employee[];
  weekDates: string[];
  todayStr: string;
  filter: 'all' | EmployeeCategory;
}

/** Jours affiches dans la grille (Lun-Sam) */
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** Creneaux */
const CRENEAUX: { key: CreneauType; label: string; short: string }[] = [
  { key: 'matin', label: 'Matin', short: 'M' },
  { key: 'aprem', label: 'Aprem', short: 'A' },
];

/** Couleurs par categorie */
const CATEGORY_COLORS: Record<EmployeeCategory, string> = {
  pharmacien_titulaire: '#2563eb',
  pharmacien_adjoint: '#3b82f6',
  preparateur: '#10b981',
  rayonniste: '#f59e0b',
  apprenti: '#8b5cf6',
  etudiant: '#ec4899',
};

/** Label court par categorie */
const CATEGORY_LABELS: Record<EmployeeCategory, string> = {
  pharmacien_titulaire: 'Pharmacien Tit.',
  pharmacien_adjoint: 'Pharmacien Adj.',
  preparateur: 'Preparateur',
  rayonniste: 'Rayonniste',
  apprenti: 'Apprenti',
  etudiant: 'Etudiant',
};

/** Grouper les employes par categorie */
function groupByCategory(employees: Employee[]): Map<EmployeeCategory, Employee[]> {
  const groups = new Map<EmployeeCategory, Employee[]>();
  const order: EmployeeCategory[] = [
    'pharmacien_titulaire',
    'pharmacien_adjoint',
    'preparateur',
    'rayonniste',
    'apprenti',
    'etudiant',
  ];

  for (const cat of order) {
    const emps = employees.filter(e => e.category === cat && e.is_active);
    if (emps.length > 0) {
      groups.set(cat, emps);
    }
  }
  return groups;
}

/** Formater date "YYYY-MM-DD" -> "03/02" */
function formatDayNum(iso: string): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function GrilleView({ employees, weekDates, todayStr, filter }: GrilleViewProps) {
  const store = usePlanningStore();
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  // Filtrer les employes
  const filteredEmployees = useMemo(() => {
    if (filter === 'all') return employees.filter(e => e.is_active);
    return employees.filter(e => e.is_active && e.category === filter);
  }, [employees, filter]);

  // Grouper par categorie
  const grouped = useMemo(() => groupByCategory(filteredEmployees), [filteredEmployees]);

  // Slots de la semaine en cours (pour detecter les cases cochees)
  const weekSlots = useMemo(() => {
    return store.getForWeek(weekDates.slice(0, 6));
  }, [store, weekDates]);

  // Index des slots pour un acces rapide
  const slotIndex = useMemo(() => {
    const idx = new Set<string>();
    for (const s of weekSlots) {
      idx.add(`${s.employeeId}|${s.date}|${s.creneau}`);
    }
    return idx;
  }, [weekSlots]);

  // Heures hebdomadaires par employe
  const weeklyHoursMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const emp of filteredEmployees) {
      const h = store.weeklyHours(emp.id, weekDates.slice(0, 6));
      map.set(emp.id, h);
    }
    return map;
  }, [store, filteredEmployees, weekDates]);

  // Compteur d'employes par jour/creneau
  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    for (let di = 0; di < 6; di++) {
      const date = weekDates[di];
      if (!date) continue;
      for (const cr of CRENEAUX) {
        const count = weekSlots.filter(s => s.date === date && s.creneau === cr.key).length;
        map.set(`${date}|${cr.key}`, count);
      }
    }
    return map;
  }, [weekSlots, weekDates]);

  // Handler clic sur cellule
  const handleCellClick = useCallback((employeeId: string, date: string, creneau: CreneauType) => {
    store.toggle(employeeId, date, creneau);
  }, [store]);

  // Handler : generer depuis horaires fixes
  const handleApplyHoraires = useCallback(() => {
    const result = store.applyHoraires(weekDates.slice(0, 6), employees);
    return result;
  }, [store, weekDates, employees]);

  // Handler : effacer la semaine
  const handleClearWeek = useCallback(() => {
    store.clearWeek(weekDates.slice(0, 6));
  }, [store, weekDates]);

  // Preview des horaires fixes
  const horairePreview = useMemo(() => {
    return store.previewFromHoraires(weekDates.slice(0, 6), employees);
  }, [store, weekDates, employees]);

  return (
    <>
      <div className="gv-container">
        {/* Toolbar */}
        <div className="gv-toolbar">
          <div className="gv-toolbar-left">
            <span className="gv-toolbar-info">
              {weekSlots.length} creneaux assignes
            </span>
          </div>
          <div className="gv-toolbar-right">
            {horairePreview.length > 0 && (
              <button
                className="gv-btn gv-btn--secondary"
                onClick={handleApplyHoraires}
                type="button"
                title={`Generer ${horairePreview.length} creneaux depuis les horaires fixes`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Generer ({horairePreview.length})
              </button>
            )}
            {weekSlots.length > 0 && (
              <button
                className="gv-btn gv-btn--danger"
                onClick={handleClearWeek}
                type="button"
                title="Effacer tous les creneaux de cette semaine"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Effacer semaine
              </button>
            )}
          </div>
        </div>

        {/* Grille */}
        <div className="gv-table-wrap">
          <table className="gv-table">
            <thead>
              <tr>
                <th className="gv-th gv-th--name">Employe</th>
                {DAY_LABELS.map((label, di) => (
                  <th
                    key={di}
                    className={`gv-th gv-th--day ${weekDates[di] === todayStr ? 'gv-th--today' : ''}`}
                    colSpan={2}
                  >
                    <span className="gv-th-label">{label}</span>
                    <span className="gv-th-date">{formatDayNum(weekDates[di])}</span>
                  </th>
                ))}
                <th className="gv-th gv-th--hours">H/sem</th>
              </tr>
              {/* Sous-header Matin/Aprem */}
              <tr className="gv-sub-header">
                <th className="gv-th gv-th--name gv-sub-cell"></th>
                {DAY_LABELS.map((_, di) => (
                  CRENEAUX.map(cr => (
                    <th
                      key={`${di}-${cr.key}`}
                      className={`gv-th gv-sub-cell ${weekDates[di] === todayStr ? 'gv-th--today' : ''}`}
                    >
                      {cr.short}
                    </th>
                  ))
                ))}
                <th className="gv-th gv-sub-cell"></th>
              </tr>
            </thead>
            <tbody>
              {Array.from(grouped.entries()).map(([category, emps]) => (
                <CategoryGroup
                  key={category}
                  category={category}
                  employees={emps}
                  weekDates={weekDates}
                  todayStr={todayStr}
                  slotIndex={slotIndex}
                  weeklyHoursMap={weeklyHoursMap}
                  hoveredCell={hoveredCell}
                  onCellClick={handleCellClick}
                  onCellHover={setHoveredCell}
                />
              ))}
            </tbody>
            {/* Footer : totaux par jour/creneau */}
            <tfoot>
              <tr className="gv-footer-row">
                <td className="gv-td gv-td--name gv-footer-label">Total</td>
                {DAY_LABELS.map((_, di) => (
                  CRENEAUX.map(cr => {
                    const count = countMap.get(`${weekDates[di]}|${cr.key}`) || 0;
                    return (
                      <td
                        key={`footer-${di}-${cr.key}`}
                        className={`gv-td gv-footer-cell ${count === 0 ? 'gv-footer-cell--empty' : ''}`}
                      >
                        {count > 0 ? count : '-'}
                      </td>
                    );
                  })
                ))}
                <td className="gv-td gv-footer-cell"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <style jsx>{`
        .gv-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
          height: 100%;
        }

        /* ── Toolbar ── */
        .gv-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .gv-toolbar-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .gv-toolbar-info {
          font-size: 12px;
          color: var(--color-neutral-500);
          font-weight: 500;
        }

        .gv-toolbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .gv-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          background: white;
          cursor: pointer;
          font-family: var(--font-family-primary);
          font-size: 12px;
          font-weight: 600;
          transition: all 0.15s;
        }

        .gv-btn--secondary {
          color: var(--color-primary-600);
          border-color: var(--color-primary-300);
          background: var(--color-primary-50);
        }

        .gv-btn--secondary:hover {
          background: var(--color-primary-100);
        }

        .gv-btn--danger {
          color: var(--color-danger-600);
          border-color: var(--color-danger-200);
        }

        .gv-btn--danger:hover {
          background: var(--color-danger-50);
        }

        /* ── Table ── */
        .gv-table-wrap {
          flex: 1;
          overflow: auto;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          background: white;
        }

        .gv-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-family: var(--font-family-primary);
        }

        /* ── Header ── */
        .gv-th {
          padding: 6px 4px;
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-neutral-600);
          background: var(--color-neutral-50);
          border-bottom: 1px solid var(--color-neutral-200);
          user-select: none;
          white-space: nowrap;
        }

        .gv-th--name {
          text-align: left;
          padding-left: 12px;
          width: 160px;
          min-width: 120px;
          position: sticky;
          left: 0;
          z-index: 2;
          background: var(--color-neutral-50);
        }

        .gv-th--day {
          border-left: 1px solid var(--color-neutral-200);
        }

        .gv-th--today {
          background: var(--color-primary-50);
          color: var(--color-primary-700);
        }

        .gv-th-label {
          display: block;
          font-weight: 700;
          font-size: 12px;
        }

        .gv-th-date {
          display: block;
          font-weight: 500;
          font-size: 10px;
          color: var(--color-neutral-400);
        }

        .gv-th--today .gv-th-date {
          color: var(--color-primary-500);
        }

        .gv-th--hours {
          width: 60px;
          min-width: 50px;
          border-left: 1px solid var(--color-neutral-200);
        }

        .gv-sub-header .gv-sub-cell {
          padding: 2px 0;
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--color-neutral-400);
          border-bottom: 2px solid var(--color-neutral-200);
        }

        /* ── Category separator ── */
        .gv-cat-row td {
          padding: 4px 12px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: var(--color-neutral-100);
          border-bottom: 1px solid var(--color-neutral-200);
        }

        .gv-cat-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .gv-cat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* ── Body ── */
        .gv-td {
          padding: 0;
          text-align: center;
          border-bottom: 1px solid var(--color-neutral-100);
          vertical-align: middle;
          height: 32px;
        }

        .gv-td--name {
          text-align: left;
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-neutral-800);
          position: sticky;
          left: 0;
          z-index: 1;
          background: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gv-td--hours {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-600);
          border-left: 1px solid var(--color-neutral-200);
          padding: 0 6px;
        }

        .gv-td--hours-over {
          color: var(--color-danger-600);
        }

        .gv-td--hours-under {
          color: var(--color-warning-600);
        }

        /* ── Cellule cliquable ── */
        .gv-cell {
          width: 100%;
          height: 100%;
          min-height: 28px;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.1s;
          position: relative;
          border-left: 1px solid var(--color-neutral-100);
        }

        .gv-cell:hover {
          background: var(--color-neutral-100);
        }

        .gv-cell--active {
          background: var(--color-primary-100);
        }

        .gv-cell--active:hover {
          background: var(--color-primary-200);
        }

        .gv-cell--today {
          background: rgba(99, 102, 241, 0.04);
        }

        .gv-cell--hovered {
          box-shadow: inset 0 0 0 2px var(--color-primary-300);
        }

        /* Indicateur de slot actif */
        .gv-dot {
          width: 16px;
          height: 16px;
          border-radius: 3px;
        }

        .gv-dot--active {
          background: var(--color-primary-500);
          box-shadow: 0 1px 3px rgba(99, 102, 241, 0.3);
        }

        /* ── Footer ── */
        .gv-footer-row td {
          background: var(--color-neutral-50);
          border-top: 2px solid var(--color-neutral-200);
        }

        .gv-footer-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          position: sticky;
          left: 0;
          z-index: 1;
          background: var(--color-neutral-50);
        }

        .gv-footer-cell {
          font-size: 12px;
          font-weight: 700;
          color: var(--color-primary-600);
          border-left: 1px solid var(--color-neutral-200);
        }

        .gv-footer-cell--empty {
          color: var(--color-neutral-300);
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .gv-th--name {
            width: 100px;
            min-width: 80px;
          }
        }

        @media print {
          .gv-toolbar {
            display: none;
          }
          .gv-cell--active {
            background: #ddd !important;
          }
        }
      `}</style>
    </>
  );
}

// ─── Sous-composant : groupe de categorie ───

interface CategoryGroupProps {
  category: EmployeeCategory;
  employees: Employee[];
  weekDates: string[];
  todayStr: string;
  slotIndex: Set<string>;
  weeklyHoursMap: Map<string, number>;
  hoveredCell: string | null;
  onCellClick: (employeeId: string, date: string, creneau: CreneauType) => void;
  onCellHover: (key: string | null) => void;
}

function CategoryGroup({
  category,
  employees,
  weekDates,
  todayStr,
  slotIndex,
  weeklyHoursMap,
  hoveredCell,
  onCellClick,
  onCellHover,
}: CategoryGroupProps) {
  const totalCols = 6 * 2 + 2; // 6 jours x 2 creneaux + nom + heures

  return (
    <>
      {/* Categorie header */}
      <tr className="gv-cat-row">
        <td colSpan={totalCols}>
          <span className="gv-cat-label">
            <span
              className="gv-cat-dot"
              style={{ backgroundColor: CATEGORY_COLORS[category] }}
            />
            {CATEGORY_LABELS[category]} ({employees.length})
          </span>
        </td>
      </tr>

      {/* Lignes employes */}
      {employees.map(emp => {
        const weekHours = weeklyHoursMap.get(emp.id) || 0;
        const hoursDiff = weekHours - emp.contract_hours;
        const hoursClass = hoursDiff > 0
          ? 'gv-td--hours-over'
          : hoursDiff < -5
            ? 'gv-td--hours-under'
            : '';

        return (
          <tr key={emp.id}>
            <td className="gv-td gv-td--name">
              <span
                style={{
                  borderLeft: `3px solid ${CATEGORY_COLORS[emp.category]}`,
                  paddingLeft: '8px',
                  display: 'inline-block',
                }}
              >
                {emp.first_name} {emp.last_name.charAt(0)}.
              </span>
            </td>

            {DAY_LABELS.map((_, di) => {
              const date = weekDates[di];
              if (!date) return null;
              const isToday = date === todayStr;

              return CRENEAUX.map(cr => {
                const cellKey = `${emp.id}|${date}|${cr.key}`;
                const isActive = slotIndex.has(cellKey);
                const isHovered = hoveredCell === cellKey;

                return (
                  <td key={cellKey} className="gv-td">
                    <button
                      className={[
                        'gv-cell',
                        isActive ? 'gv-cell--active' : '',
                        isToday ? 'gv-cell--today' : '',
                        isHovered ? 'gv-cell--hovered' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => onCellClick(emp.id, date, cr.key)}
                      onMouseEnter={() => onCellHover(cellKey)}
                      onMouseLeave={() => onCellHover(null)}
                      type="button"
                      title={`${emp.first_name} ${emp.last_name} - ${DAY_LABELS[di]} ${cr.label}`}
                      aria-label={`${isActive ? 'Desassigner' : 'Assigner'} ${emp.first_name} ${DAY_LABELS[di]} ${cr.label}`}
                      aria-pressed={isActive}
                    >
                      {isActive && (
                        <span
                          className="gv-dot gv-dot--active"
                          style={{ backgroundColor: CATEGORY_COLORS[emp.category] }}
                        />
                      )}
                    </button>
                  </td>
                );
              });
            })}

            <td className={`gv-td gv-td--hours ${hoursClass}`}>
              {weekHours > 0 ? `${weekHours.toFixed(1)}h` : '-'}
              {weekHours > 0 && (
                <span style={{ fontSize: '9px', display: 'block', fontWeight: 400, color: 'var(--color-neutral-400)' }}>
                  /{emp.contract_hours}h
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
