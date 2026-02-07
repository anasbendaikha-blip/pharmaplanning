/**
 * Page Gardes Pharmacie
 *
 * 3 vues :
 *  - Calendrier : liste mensuelle des gardes avec navigation mois
 *  - Statistiques : tableau équité par pharmacien + barres visuelles
 *  - Configuration : période, types de garde, horaires
 *
 * styled-jsx uniquement, CSS variables, pas d'emojis.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import { getEmployees, getShiftsForWeek } from '@/lib/supabase/queries';
import { generateGardeRotation, calculateStats } from '@/lib/gardes/rotation';
import { GARDE_TYPE_LABELS } from '@/lib/gardes/types';
import type { GardeAssignment, RotationConfig, PharmacienStats } from '@/lib/gardes/types';
import type { Shift } from '@/lib/types';
import { toISODateString, formatDate, parseISODate } from '@/lib/utils/dateUtils';
import Link from 'next/link';
import { exportGardesPDF } from '@/lib/export/pdf-generator';

type ViewMode = 'calendar' | 'stats' | 'config';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export default function GardesPage() {
  const { organizationId, organization, isLoading: orgLoading } = useOrganization();
  const organizationName = organization?.name || 'Pharmacie';
  const [view, setView] = useState<ViewMode>('calendar');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  // Données
  const [assignments, setAssignments] = useState<GardeAssignment[]>([]);
  const [stats, setStats] = useState<PharmacienStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Config
  const [config, setConfig] = useState<RotationConfig>({
    startDate: `${new Date().getFullYear()}-01-01`,
    endDate: `${new Date().getFullYear()}-12-31`,
    includeDimanches: true,
    includeNuits: false,
    includeFeries: true,
    heureDebutNuit: '20:00',
    heureFinNuit: '08:00',
    heureDebutDimanche: '09:00',
    heureFinDimanche: '19:00',
  });

  const loadGardes = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);

    try {
      // Charger employés
      const employees = await getEmployees(organizationId);

      // Charger shifts de la période par tranches de 3 mois
      const allShifts: Shift[] = [];
      const configStart = parseISODate(config.startDate);
      const configEnd = parseISODate(config.endDate);

      let chunkStart = configStart;
      while (chunkStart <= configEnd) {
        const chunkEnd = new Date(chunkStart);
        chunkEnd.setMonth(chunkEnd.getMonth() + 3);
        if (chunkEnd > configEnd) {
          chunkEnd.setTime(configEnd.getTime());
        }

        const shifts = await getShiftsForWeek(
          organizationId,
          toISODateString(chunkStart),
          toISODateString(chunkEnd),
        );
        allShifts.push(...shifts);

        chunkStart = new Date(chunkEnd);
        chunkStart.setDate(chunkStart.getDate() + 1);
      }

      // Générer la rotation
      const result = generateGardeRotation(config, employees, [], allShifts);

      setAssignments(result.assignments);

      // Calculer stats avec les pharmaciens filtrés
      const pharmaciens = employees.filter(
        e => e.category === 'pharmacien_titulaire' || e.category === 'pharmacien_adjoint',
      );
      setStats(calculateStats(pharmaciens, result.assignments));
    } catch (error) {
      console.error('Erreur chargement gardes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, config]);

  useEffect(() => {
    if (!orgLoading && organizationId) loadGardes();
  }, [orgLoading, organizationId, loadGardes]);

  // Navigation mois
  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };

  // Export PDF
  const handleExportPDF = () => {
    exportGardesPDF(monthGardes, month, year, organizationName);
  };

  // Gardes du mois courant
  const monthGardes = useMemo(() => {
    return assignments.filter(g => {
      const d = parseISODate(g.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [assignments, year, month]);

  // Grouper par date
  const gardesByDate = useMemo(() => {
    const map = new Map<string, GardeAssignment[]>();
    for (const g of monthGardes) {
      const existing = map.get(g.date) || [];
      existing.push(g);
      map.set(g.date, existing);
    }
    return map;
  }, [monthGardes]);

  const sortedDates = useMemo(
    () => [...gardesByDate.keys()].sort(),
    [gardesByDate],
  );

  if (orgLoading || (isLoading && assignments.length === 0)) {
    return (
      <>
        <div className="loading-page">
          <span className="loading-spinner" />
          <span>Chargement des gardes...</span>
        </div>
        <style jsx>{`
          .loading-page {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: var(--spacing-3);
            height: 400px;
            color: var(--color-neutral-500);
          }
          .loading-spinner {
            width: 36px;
            height: 36px;
            border: 3px solid var(--color-neutral-200);
            border-top-color: var(--color-primary-500);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div className="gardes-page">
        {/* ─── Header ─── */}
        <section className="page-header">
          <div className="header-left">
            <Link href="/" className="back-link">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Tableau de bord
            </Link>
            <h1 className="page-title">Gardes Pharmacie</h1>
            <p className="page-subtitle">Planning des gardes de nuit, dimanche et jours fériés</p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-secondary" onClick={handleExportPDF}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Export PDF
            </button>
            <button type="button" className="btn-primary" onClick={loadGardes}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
              </svg>
              {"Régénérer"}
            </button>
          </div>
        </section>

        {/* ─── Tabs ─── */}
        <section className="view-tabs">
          <button type="button" className={`tab ${view === 'calendar' ? 'tab--active' : ''}`} onClick={() => setView('calendar')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Calendrier
          </button>
          <button type="button" className={`tab ${view === 'stats' ? 'tab--active' : ''}`} onClick={() => setView('stats')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            Statistiques
          </button>
          <button type="button" className={`tab ${view === 'config' ? 'tab--active' : ''}`} onClick={() => setView('config')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            Configuration
          </button>
        </section>

        {/* ─── VUE CALENDRIER ─── */}
        {view === 'calendar' && (
          <section className="content-section">
            <div className="month-navigation">
              <button type="button" className="month-nav-btn" onClick={handlePrevMonth}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <h2 className="month-title">{MONTH_NAMES[month]} {year}</h2>
              <button type="button" className="month-nav-btn" onClick={handleNextMonth}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            {sortedDates.length > 0 ? (
              <div className="gardes-list">
                {sortedDates.map(date => {
                  const gardes = gardesByDate.get(date) || [];
                  const dateObj = parseISODate(date);
                  return (
                    <div key={date} className="garde-day">
                      <div className="day-header">
                        <span className="day-date">{formatDate(dateObj, 'long')}</span>
                        <span className="day-count">{gardes.length} garde{gardes.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="gardes-day-list">
                        {gardes.map((garde, idx) => (
                          <div key={`${date}-${idx}`} className={`garde-item garde-item--${garde.type}`}>
                            <span className="garde-type-badge">{GARDE_TYPE_LABELS[garde.type]}</span>
                            <span className="garde-hours">{garde.heureDebut} - {garde.heureFin}</span>
                            <span className="garde-pharmacien">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                              </svg>
                              {garde.pharmacienName}
                            </span>
                            {garde.hasConflict && (
                              <span className="garde-conflict" title={garde.conflictReason || ''}>{'\u26A0'}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-neutral-300)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p className="empty-text">Aucune garde planifiée pour {MONTH_NAMES[month]} {year}</p>
              </div>
            )}
          </section>
        )}

        {/* ─── VUE STATISTIQUES ─── */}
        {view === 'stats' && (
          <section className="content-section">
            <h2 className="section-title">{"Répartition par pharmacien"}</h2>
            {stats.length === 0 ? (
              <div className="empty-state"><p className="empty-text">Aucun pharmacien trouvé.</p></div>
            ) : (
              <>
                <div className="stats-table-wrapper">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th className="th-left">Pharmacien</th>
                        <th>Total</th>
                        <th>Nuits</th>
                        <th>Dimanches</th>
                        <th>{"Fériés"}</th>
                        <th>{"Dernière"}</th>
                        <th>Prochaine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map(s => (
                        <tr key={s.pharmacienId}>
                          <td className="cell-pharmacien"><span className="pharma-name">{s.pharmacienName}</span></td>
                          <td className="cell-center"><span className="total-badge">{s.totalGardes}</span></td>
                          <td className="cell-center">{s.gardesNuit}</td>
                          <td className="cell-center">{s.gardesDimanche}</td>
                          <td className="cell-center">{s.gardesFerie}</td>
                          <td className="cell-center cell-date">{s.lastGardeDate ? formatDate(parseISODate(s.lastGardeDate), 'short') : '\u2014'}</td>
                          <td className="cell-center cell-date">{s.nextGardeDate ? formatDate(parseISODate(s.nextGardeDate), 'short') : '\u2014'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="equity-section">
                  <h3 className="equity-title">{"Équité de la répartition"}</h3>
                  <div className="equity-bars">
                    {stats.map(s => {
                      const maxGardes = Math.max(...stats.map(x => x.totalGardes), 1);
                      const pct = (s.totalGardes / maxGardes) * 100;
                      return (
                        <div key={s.pharmacienId} className="equity-row">
                          <span className="equity-name">{s.pharmacienName}</span>
                          <div className="equity-bar-track">
                            <div className="equity-bar-fill" style={{ width: `${Math.max(pct, 4)}%` }} />
                          </div>
                          <span className="equity-count">{s.totalGardes}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* ─── VUE CONFIGURATION ─── */}
        {view === 'config' && (
          <section className="content-section">
            <h2 className="section-title">Configuration de la rotation</h2>
            <div className="config-form">
              <fieldset className="form-section">
                <legend className="form-legend">{"Période"}</legend>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="config-start" className="form-label">Date de début</label>
                    <input id="config-start" type="date" className="form-input" value={config.startDate} onChange={e => setConfig(c => ({ ...c, startDate: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="config-end" className="form-label">Date de fin</label>
                    <input id="config-end" type="date" className="form-input" value={config.endDate} onChange={e => setConfig(c => ({ ...c, endDate: e.target.value }))} />
                  </div>
                </div>
              </fieldset>

              <fieldset className="form-section">
                <legend className="form-legend">Types de garde</legend>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input type="checkbox" className="checkbox-input" checked={config.includeDimanches} onChange={e => setConfig(c => ({ ...c, includeDimanches: e.target.checked }))} />
                    <span className="checkbox-text">Dimanches</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" className="checkbox-input" checked={config.includeFeries} onChange={e => setConfig(c => ({ ...c, includeFeries: e.target.checked }))} />
                    <span className="checkbox-text">{"Jours fériés"}</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" className="checkbox-input" checked={config.includeNuits} onChange={e => setConfig(c => ({ ...c, includeNuits: e.target.checked }))} />
                    <span className="checkbox-text">Gardes de nuit</span>
                  </label>
                </div>
              </fieldset>

              <fieldset className="form-section">
                <legend className="form-legend">Horaires</legend>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="heure-dim-debut" className="form-label">{"Début dimanche / férié"}</label>
                    <input id="heure-dim-debut" type="time" className="form-input" value={config.heureDebutDimanche} onChange={e => setConfig(c => ({ ...c, heureDebutDimanche: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="heure-dim-fin" className="form-label">{"Fin dimanche / férié"}</label>
                    <input id="heure-dim-fin" type="time" className="form-input" value={config.heureFinDimanche} onChange={e => setConfig(c => ({ ...c, heureFinDimanche: e.target.value }))} />
                  </div>
                </div>
                {config.includeNuits && (
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="heure-nuit-debut" className="form-label">{"Début nuit"}</label>
                      <input id="heure-nuit-debut" type="time" className="form-input" value={config.heureDebutNuit} onChange={e => setConfig(c => ({ ...c, heureDebutNuit: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="heure-nuit-fin" className="form-label">Fin nuit</label>
                      <input id="heure-nuit-fin" type="time" className="form-input" value={config.heureFinNuit} onChange={e => setConfig(c => ({ ...c, heureFinNuit: e.target.value }))} />
                    </div>
                  </div>
                )}
              </fieldset>

              <button type="button" className="btn-primary btn-save" onClick={loadGardes}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                </svg>
                {"Enregistrer et régénérer"}
              </button>
            </div>
          </section>
        )}
      </div>

      <style jsx>{`
        .gardes-page {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-6);
          max-width: 1100px;
        }

        /* ─── Header ─── */
        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: var(--spacing-3);
        }
        .header-left { display: flex; flex-direction: column; gap: var(--spacing-1); }
        .header-left :global(.back-link) {
          display: inline-flex; align-items: center; gap: var(--spacing-1);
          font-size: var(--font-size-xs); color: var(--color-primary-600);
          text-decoration: none; margin-bottom: var(--spacing-2);
        }
        .header-left :global(.back-link:hover) { color: var(--color-primary-700); }
        .page-title { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); color: var(--color-neutral-900); margin: 0; }
        .page-subtitle { font-size: var(--font-size-sm); color: var(--color-neutral-500); margin: 0; }
        .header-actions { display: flex; gap: var(--spacing-2); }

        .btn-secondary {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium); color: var(--color-neutral-700);
          cursor: pointer; transition: all 0.15s ease;
        }
        .btn-secondary:hover { border-color: var(--color-primary-300); color: var(--color-primary-700); }

        .btn-primary {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4); background: var(--color-primary-600);
          border: 1px solid var(--color-primary-600); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-semibold); color: white;
          cursor: pointer; transition: all 0.15s ease;
        }
        .btn-primary:hover { background: var(--color-primary-700); border-color: var(--color-primary-700); }

        /* ─── Tabs ─── */
        .view-tabs { display: flex; gap: var(--spacing-2); }
        .tab {
          display: flex; align-items: center; gap: var(--spacing-2);
          padding: var(--spacing-2) var(--spacing-4); background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          font-family: var(--font-family-primary); font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium); color: var(--color-neutral-600);
          cursor: pointer; transition: all 0.15s ease;
        }
        .tab:hover { border-color: var(--color-neutral-300); }
        .tab--active { background: var(--color-primary-600); border-color: var(--color-primary-600); color: white; }
        .tab--active:hover { background: var(--color-primary-700); }

        /* ─── Content ─── */
        .content-section {
          background: white; border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg); padding: var(--spacing-5);
        }
        .section-title {
          font-size: var(--font-size-md); font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800); margin: 0 0 var(--spacing-4) 0;
        }

        /* ─── Month nav ─── */
        .month-navigation { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-5); }
        .month-nav-btn {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; background: white;
          border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md);
          cursor: pointer; color: var(--color-neutral-600); transition: all 0.15s ease;
        }
        .month-nav-btn:hover { background: var(--color-neutral-50); border-color: var(--color-neutral-300); }
        .month-title { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-neutral-900); margin: 0; }

        /* ─── Gardes list ─── */
        .gardes-list { display: flex; flex-direction: column; gap: var(--spacing-3); }
        .garde-day { border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); overflow: hidden; }
        .day-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--spacing-3) var(--spacing-4); background: var(--color-neutral-50);
          border-bottom: 1px solid var(--color-neutral-200);
        }
        .day-date { font-weight: var(--font-weight-bold); font-size: var(--font-size-sm); color: var(--color-neutral-800); }
        .day-count { font-size: var(--font-size-xs); color: var(--color-neutral-500); }
        .gardes-day-list { padding: var(--spacing-3) var(--spacing-4); display: flex; flex-direction: column; gap: var(--spacing-2); }
        .garde-item {
          display: flex; align-items: center; gap: var(--spacing-3);
          padding: var(--spacing-3) var(--spacing-4); border-radius: var(--radius-md);
          border-left: 4px solid transparent;
        }
        .garde-item--nuit { background: var(--color-neutral-50); border-left-color: var(--color-neutral-600); }
        .garde-item--dimanche { background: var(--color-warning-50); border-left-color: var(--color-warning-500); }
        .garde-item--ferie { background: var(--color-primary-50); border-left-color: var(--color-primary-500); }
        .garde-type-badge {
          display: inline-block; padding: 2px 10px; border-radius: var(--radius-full);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-bold);
          min-width: 80px; text-align: center; background: var(--color-neutral-100); color: var(--color-neutral-700);
        }
        .garde-item--nuit .garde-type-badge { background: var(--color-neutral-200); color: var(--color-neutral-800); }
        .garde-item--dimanche .garde-type-badge { background: var(--color-warning-100); color: var(--color-warning-700); }
        .garde-item--ferie .garde-type-badge { background: var(--color-primary-100); color: var(--color-primary-700); }
        .garde-hours { font-size: var(--font-size-sm); color: var(--color-neutral-500); min-width: 100px; }
        .garde-pharmacien {
          flex: 1; display: flex; align-items: center; gap: var(--spacing-2);
          font-weight: var(--font-weight-semibold); font-size: var(--font-size-sm); color: var(--color-neutral-800);
        }
        .garde-conflict { color: var(--color-warning-500); font-size: var(--font-size-md); }

        /* ─── Stats table ─── */
        .stats-table-wrapper { overflow-x: auto; margin-bottom: var(--spacing-6); }
        .stats-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
        .stats-table th {
          text-align: center; padding: var(--spacing-3);
          font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.03em;
          border-bottom: 2px solid var(--color-neutral-200);
        }
        .th-left { text-align: left !important; min-width: 150px; }
        .stats-table td { padding: var(--spacing-3); border-bottom: 1px solid var(--color-neutral-100); vertical-align: middle; }
        .stats-table tbody tr:hover { background: var(--color-neutral-50); }
        .cell-center { text-align: center; }
        .cell-pharmacien { min-width: 150px; }
        .pharma-name { font-weight: var(--font-weight-semibold); color: var(--color-neutral-800); }
        .total-badge {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 28px; height: 28px; padding: 0 8px;
          background: var(--color-primary-100); color: var(--color-primary-700);
          border-radius: var(--radius-full); font-weight: var(--font-weight-bold); font-size: var(--font-size-sm);
        }
        .cell-date { font-size: var(--font-size-xs); color: var(--color-neutral-500); }

        /* ─── Equity bars ─── */
        .equity-section { margin-top: var(--spacing-4); padding-top: var(--spacing-4); border-top: 1px solid var(--color-neutral-200); }
        .equity-title { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-700); margin: 0 0 var(--spacing-3) 0; }
        .equity-bars { display: flex; flex-direction: column; gap: var(--spacing-2); }
        .equity-row { display: flex; align-items: center; gap: var(--spacing-3); }
        .equity-name { font-size: var(--font-size-sm); color: var(--color-neutral-700); min-width: 140px; }
        .equity-bar-track { flex: 1; height: 8px; background: var(--color-neutral-100); border-radius: var(--radius-full); overflow: hidden; }
        .equity-bar-fill {
          height: 100%; background: linear-gradient(to right, var(--color-primary-400), var(--color-primary-600));
          border-radius: var(--radius-full); transition: width 0.4s ease; min-width: 4px;
        }
        .equity-count { font-size: var(--font-size-sm); font-weight: var(--font-weight-bold); color: var(--color-neutral-800); min-width: 28px; text-align: right; }

        /* ─── Config form ─── */
        .config-form { display: flex; flex-direction: column; gap: var(--spacing-5); }
        .form-section { border: 1px solid var(--color-neutral-200); border-radius: var(--radius-md); padding: var(--spacing-4); margin: 0; }
        .form-legend { font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); color: var(--color-neutral-700); padding: 0 var(--spacing-2); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-4); margin-top: var(--spacing-3); }
        .form-group { display: flex; flex-direction: column; gap: var(--spacing-1); }
        .form-label { font-size: var(--font-size-xs); font-weight: var(--font-weight-medium); color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.03em; }
        .form-input {
          padding: var(--spacing-2) var(--spacing-3); border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md); font-family: var(--font-family-primary);
          font-size: var(--font-size-sm); color: var(--color-neutral-700); transition: border-color 0.15s ease;
        }
        .form-input:focus { outline: none; border-color: var(--color-primary-500); box-shadow: 0 0 0 2px var(--color-primary-100); }
        .checkbox-group { display: flex; flex-direction: column; gap: var(--spacing-2); margin-top: var(--spacing-2); }
        .checkbox-label {
          display: flex; align-items: center; gap: var(--spacing-3);
          padding: var(--spacing-2); cursor: pointer; border-radius: var(--radius-md);
          transition: background 0.15s ease;
        }
        .checkbox-label:hover { background: var(--color-neutral-50); }
        .checkbox-input { width: 18px; height: 18px; cursor: pointer; accent-color: var(--color-primary-600); }
        .checkbox-text { font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); color: var(--color-neutral-700); }
        .btn-save { align-self: flex-start; }

        /* ─── Empty ─── */
        .empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--spacing-3); padding: var(--spacing-8); text-align: center; }
        .empty-text { font-size: var(--font-size-sm); color: var(--color-neutral-500); margin: 0; }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .page-header { flex-direction: column; }
          .header-actions { width: 100%; }
          .view-tabs { flex-wrap: wrap; }
          .month-navigation { flex-wrap: wrap; gap: var(--spacing-2); }
          .form-row { grid-template-columns: 1fr; }
          .garde-item { flex-wrap: wrap; }
        }
      `}</style>
    </>
  );
}
