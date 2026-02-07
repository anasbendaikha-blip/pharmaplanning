/**
 * ComplianceWidget — Widget de conformité légale pour le dashboard
 *
 * Affiche un résumé compact :
 *  - Score circulaire (ComplianceBadge)
 *  - Compteurs critical/warning
 *  - Lien vers la page détaillée
 *
 * Charge les shifts de la semaine courante via l'API existante
 * et les employés, puis exécute quickComplianceCheck().
 *
 * styled-jsx uniquement.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import { getShiftsForWeek, getEmployees } from '@/lib/supabase/queries';
import { quickComplianceCheck } from '@/lib/legal/validation';
import { getMonday, getWeekDates, toISODateString } from '@/lib/utils/dateUtils';
import ComplianceBadge from './ComplianceBadge';
import Link from 'next/link';

interface ComplianceData {
  score: number;
  label: string;
  colorVar: string;
  criticalCount: number;
  warningCount: number;
}

export default function ComplianceWidget() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [data, setData] = useState<ComplianceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCompliance = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    setError(null);

    try {
      const monday = getMonday(new Date());
      const weekDates = getWeekDates(monday);
      const weekStart = toISODateString(weekDates[0]);
      const weekEnd = toISODateString(weekDates[6]);

      // Charger shifts et employés en parallèle
      const [shifts, employees] = await Promise.all([
        getShiftsForWeek(organizationId, weekStart, weekEnd),
        getEmployees(organizationId),
      ]);

      const result = quickComplianceCheck(shifts, employees);
      setData(result);
    } catch (err) {
      console.error('Erreur chargement conformité:', err);
      setError('Impossible de charger la conformité');
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!orgLoading && organizationId) {
      loadCompliance();
    }
  }, [orgLoading, organizationId, loadCompliance]);

  if (orgLoading || isLoading) {
    return (
      <>
        <div className="widget widget--loading">
          <span className="loading-spinner" />
          <span className="loading-text">Analyse conformité...</span>
        </div>
        <style jsx>{`
          .widget--loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: var(--spacing-2);
            padding: var(--spacing-5);
            background: white;
            border: 1px solid var(--color-neutral-200);
            border-radius: var(--radius-lg);
            min-height: 140px;
          }
          .loading-spinner {
            width: 24px;
            height: 24px;
            border: 3px solid var(--color-neutral-200);
            border-top-color: var(--color-primary-500);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          .loading-text {
            font-size: var(--font-size-xs);
            color: var(--color-neutral-500);
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <div className="widget widget--error">
          <span className="error-icon">{'\u26A0'}</span>
          <span className="error-text">{error || 'Erreur de chargement'}</span>
        </div>
        <style jsx>{`
          .widget--error {
            display: flex;
            align-items: center;
            gap: var(--spacing-2);
            padding: var(--spacing-4);
            background: var(--color-warning-50);
            border: 1px solid var(--color-warning-200);
            border-radius: var(--radius-lg);
            font-size: var(--font-size-sm);
            color: var(--color-warning-700);
          }
          .error-icon {
            font-size: var(--font-size-lg);
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div className="widget">
        <div className="widget-header">
          <h3 className="widget-title">Conformité légale</h3>
          <Link href="/titulaire/conformite" className="widget-link">
            Voir le rapport
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        <div className="widget-body">
          <ComplianceBadge
            score={data.score}
            label={data.label}
            colorVar={data.colorVar}
            size="md"
          />

          <div className="widget-stats">
            {data.criticalCount > 0 && (
              <div className="stat-row stat-row--critical">
                <span className="stat-dot stat-dot--critical" />
                <span className="stat-count">{data.criticalCount}</span>
                <span className="stat-label">
                  {data.criticalCount === 1 ? 'violation critique' : 'violations critiques'}
                </span>
              </div>
            )}
            {data.warningCount > 0 && (
              <div className="stat-row stat-row--warning">
                <span className="stat-dot stat-dot--warning" />
                <span className="stat-count">{data.warningCount}</span>
                <span className="stat-label">
                  {data.warningCount === 1 ? 'avertissement' : 'avertissements'}
                </span>
              </div>
            )}
            {data.criticalCount === 0 && data.warningCount === 0 && (
              <div className="stat-row stat-row--success">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 8l3 3 5-5" stroke="var(--color-success-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="stat-label stat-label--success">
                  Aucune violation détectée
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .widget {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-5);
        }

        .widget-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--spacing-4);
        }

        .widget-title {
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
          margin: 0;
        }

        .widget-header :global(.widget-link) {
          display: flex;
          align-items: center;
          gap: var(--spacing-1);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--color-primary-600);
          text-decoration: none;
          transition: color var(--transition-fast);
        }

        .widget-header :global(.widget-link:hover) {
          color: var(--color-primary-700);
          text-decoration: none;
        }

        .widget-body {
          display: flex;
          align-items: center;
          gap: var(--spacing-5);
        }

        .widget-stats {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
        }

        .stat-row {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .stat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .stat-dot--critical {
          background-color: var(--color-danger-500);
        }

        .stat-dot--warning {
          background-color: var(--color-warning-500);
        }

        .stat-count {
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
        }

        .stat-label {
          font-size: var(--font-size-sm);
          color: var(--color-neutral-600);
        }

        .stat-label--success {
          color: var(--color-success-600);
          font-weight: var(--font-weight-medium);
        }
      `}</style>
    </>
  );
}
