'use client';

import { useState } from 'react';
import type { GeneratedSchedule, WizardConfig } from '@/lib/assistant/types';

interface ResultsPreviewProps {
  schedule: GeneratedSchedule;
  config: WizardConfig;
  onRegenerate: () => void;
}

export default function ResultsPreview({ schedule, config: _config, onRegenerate }: ResultsPreviewProps) {
  const [conflictFilter, setConflictFilter] = useState<string>('all');

  const { success, stats, conflicts } = schedule;

  const errorCount = conflicts.filter((c) => c.type === 'error').length;
  const warningCount = conflicts.filter((c) => c.type === 'warning').length;

  const filtered = conflictFilter === 'all'
    ? conflicts
    : conflicts.filter((c) => c.type === conflictFilter);

  const handleSave = () => {
    // TODO: Implémenter sauvegarde dans Supabase (prochaine session)
    alert('Sauvegarde du planning dans Supabase (prochaine session)');
  };

  return (
    <div className="results">
      {/* ─── Banner résultat ─── */}
      <div className={`result-banner ${success ? 'result-banner--success' : 'result-banner--warning'}`}>
        <span className="banner-icon">{success ? '\u2713' : '\u26A0'}</span>
        <div className="banner-text">
          <h2 className="banner-title">
            {success ? 'Planning généré avec succès !' : 'Planning généré avec avertissements'}
          </h2>
          <p className="banner-desc">
            {success
              ? 'Le planning respecte toutes les contraintes configurées'
              : `${errorCount} erreur${errorCount > 1 ? 's' : ''} et ${warningCount} avertissement${warningCount > 1 ? 's' : ''} détectés`}
          </p>
        </div>
      </div>

      {/* ─── Statistiques ─── */}
      <div className="section">
        <h3 className="section-title">Statistiques du planning</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{stats.totalShifts}</span>
            <span className="stat-label">Shifts créés</span>
            <span className="stat-detail">{stats.totalHours}h au total</span>
          </div>
          <div className="stat-card">
            <span className={`stat-value ${stats.coverageRate >= 90 ? 'stat-value--good' : stats.coverageRate >= 70 ? 'stat-value--ok' : 'stat-value--bad'}`}>
              {stats.coverageRate}%
            </span>
            <span className="stat-label">Couverture</span>
            <span className="stat-detail">
              {stats.coverageRate >= 90 ? 'Excellent' : stats.coverageRate >= 70 ? 'Bon' : 'À améliorer'}
            </span>
          </div>
          <div className="stat-card">
            <span className={`stat-value ${stats.legalCompliance >= 95 ? 'stat-value--good' : 'stat-value--bad'}`}>
              {stats.legalCompliance}%
            </span>
            <span className="stat-label">Conformité légale</span>
            <span className="stat-detail">
              {stats.legalCompliance >= 95 ? 'Conforme' : 'Non-conformités'}
            </span>
          </div>
          <div className="stat-card">
            <span className={`stat-value ${stats.balanceScore < 3 ? 'stat-value--good' : stats.balanceScore < 5 ? 'stat-value--ok' : 'stat-value--bad'}`}>
              {'\u00B1'}{stats.balanceScore}h
            </span>
            <span className="stat-label">Équilibrage</span>
            <span className="stat-detail">
              {stats.balanceScore < 3 ? 'Excellent' : stats.balanceScore < 5 ? 'Bon' : 'Moyen'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Conflits ─── */}
      {conflicts.length > 0 && (
        <div className="section">
          <div className="conflicts-header">
            <h3 className="section-title">Conflits détectés ({conflicts.length})</h3>
            <div className="conflict-filters">
              <button
                className={`filter-btn ${conflictFilter === 'all' ? 'filter-btn--active' : ''}`}
                onClick={() => setConflictFilter('all')}
                type="button"
              >
                Tous ({conflicts.length})
              </button>
              {errorCount > 0 && (
                <button
                  className={`filter-btn filter-btn--error ${conflictFilter === 'error' ? 'filter-btn--active' : ''}`}
                  onClick={() => setConflictFilter('error')}
                  type="button"
                >
                  Erreurs ({errorCount})
                </button>
              )}
              {warningCount > 0 && (
                <button
                  className={`filter-btn filter-btn--warning ${conflictFilter === 'warning' ? 'filter-btn--active' : ''}`}
                  onClick={() => setConflictFilter('warning')}
                  type="button"
                >
                  Avertissements ({warningCount})
                </button>
              )}
            </div>
          </div>

          <div className="conflicts-list">
            {filtered.map((conflict, index) => (
              <div key={index} className={`conflict-item conflict-item--${conflict.type}`}>
                <span className="conflict-badge">
                  {conflict.type === 'error' ? 'Erreur' : conflict.type === 'warning' ? 'Avert.' : 'Info'}
                </span>
                <div className="conflict-body">
                  <span className="conflict-msg">{conflict.message}</span>
                  <div className="conflict-meta">
                    {conflict.employeeName && (
                      <span className="conflict-chip">{conflict.employeeName}</span>
                    )}
                    {conflict.date && (
                      <span className="conflict-chip">
                        {new Date(conflict.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short',
                        })}
                      </span>
                    )}
                  </div>
                  {conflict.solution && (
                    <span className="conflict-solution">{conflict.solution}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Actions ─── */}
      <div className="actions">
        <button className="btn-regen" onClick={onRegenerate} type="button">
          {'\u21BB'} Regénérer
        </button>
        <button
          className="btn-save"
          onClick={handleSave}
          disabled={!success}
          type="button"
        >
          Enregistrer et appliquer
        </button>
      </div>

      <style jsx>{`
        .results { max-width: 1100px; margin: 0 auto; }

        /* ─── Banner ─── */
        .result-banner {
          display: flex;
          align-items: center;
          gap: var(--spacing-4);
          padding: var(--spacing-5) var(--spacing-6);
          border-radius: var(--radius-lg);
          margin-bottom: var(--spacing-6);
        }

        .result-banner--success {
          background: linear-gradient(135deg, var(--color-primary-600) 0%, var(--color-primary-700) 100%);
        }

        .result-banner--warning {
          background: linear-gradient(135deg, var(--color-warning-500) 0%, var(--color-warning-600) 100%);
        }

        .banner-icon {
          font-size: 48px;
          color: white;
          flex-shrink: 0;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .banner-title {
          margin: 0 0 var(--spacing-1) 0;
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: white;
        }

        .banner-desc {
          margin: 0;
          font-size: var(--font-size-sm);
          color: rgba(255,255,255,0.9);
        }

        /* ─── Section ─── */
        .section {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-6);
          margin-bottom: var(--spacing-5);
        }

        .section-title {
          margin: 0 0 var(--spacing-4) 0;
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
        }

        /* ─── Stats ─── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--spacing-3);
        }

        .stat-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-1);
          padding: var(--spacing-4);
          background: var(--color-neutral-50);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
        }

        .stat-value {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-primary-600);
          line-height: 1;
        }

        .stat-value--good { color: var(--color-primary-600); }
        .stat-value--ok { color: var(--color-warning-500); }
        .stat-value--bad { color: var(--color-danger-500); }

        .stat-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
        }

        .stat-detail {
          font-size: 11px;
          color: var(--color-neutral-400);
        }

        /* ─── Conflits ─── */
        .conflicts-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-4);
        }

        .conflicts-header .section-title { margin-bottom: 0; }

        .conflict-filters { display: flex; gap: var(--spacing-2); }

        .filter-btn {
          padding: 6px 14px;
          background: white;
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-family: var(--font-family-primary);
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-xs);
          color: var(--color-neutral-600);
          transition: all 0.15s ease;
        }

        .filter-btn:hover { border-color: var(--color-neutral-300); }

        .filter-btn--active {
          background: var(--color-primary-600);
          border-color: var(--color-primary-600);
          color: white;
        }

        .filter-btn--error.filter-btn--active {
          background: var(--color-danger-500);
          border-color: var(--color-danger-500);
        }

        .filter-btn--warning.filter-btn--active {
          background: var(--color-warning-500);
          border-color: var(--color-warning-500);
        }

        .conflicts-list {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
        }

        .conflict-item {
          display: flex;
          gap: var(--spacing-3);
          padding: var(--spacing-3) var(--spacing-4);
          border-radius: var(--radius-md);
          border-left: 4px solid;
          align-items: flex-start;
        }

        .conflict-item--error {
          background: var(--color-danger-50);
          border-color: var(--color-danger-500);
        }

        .conflict-item--warning {
          background: var(--color-warning-50);
          border-color: var(--color-warning-400);
        }

        .conflict-item--info {
          background: var(--color-primary-50);
          border-color: var(--color-primary-400);
        }

        .conflict-badge {
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          font-size: 11px;
          font-weight: var(--font-weight-bold);
          white-space: nowrap;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .conflict-item--error .conflict-badge { background: var(--color-danger-500); color: white; }
        .conflict-item--warning .conflict-badge { background: var(--color-warning-500); color: white; }
        .conflict-item--info .conflict-badge { background: var(--color-primary-500); color: white; }

        .conflict-body { flex: 1; display: flex; flex-direction: column; gap: var(--spacing-1); }

        .conflict-msg {
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-sm);
          color: var(--color-neutral-800);
        }

        .conflict-meta { display: flex; gap: var(--spacing-2); flex-wrap: wrap; }

        .conflict-chip {
          padding: 2px 8px;
          background: rgba(0,0,0,0.06);
          border-radius: var(--radius-sm);
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
        }

        .conflict-solution {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
          font-style: italic;
        }

        /* ─── Actions ─── */
        .actions {
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-3);
        }

        .btn-regen, .btn-save {
          padding: 14px 28px;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-regen {
          background: var(--color-neutral-100);
          border: 2px solid var(--color-neutral-200);
          color: var(--color-neutral-600);
        }

        .btn-regen:hover { background: var(--color-neutral-200); }

        .btn-save {
          background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%);
          color: white;
        }

        .btn-save:hover:not(:disabled) {
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          transform: translateY(-1px);
        }

        .btn-save:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 1024px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: 1fr; }
          .conflicts-header { flex-direction: column; align-items: flex-start; gap: var(--spacing-3); }
          .actions { flex-direction: column; }
          .btn-regen, .btn-save { width: 100%; text-align: center; }
        }
      `}</style>
    </div>
  );
}
