/**
 * WeekSummaryWidget — Widget compact du récapitulatif semaine pour le dashboard
 *
 * Affiche :
 *  - Numéro de semaine
 *  - Total heures / employés / shifts
 *  - Lien vers la page détaillée
 *
 * styled-jsx uniquement.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import { getShiftsForWeek, getEmployees } from '@/lib/supabase/queries';
import { generateWeekSummary } from '@/lib/recap/generator';
import type { WeekSummary } from '@/lib/recap/types';
import { getMonday, getWeekDates, toISODateString } from '@/lib/utils/dateUtils';
import { formatHours } from '@/lib/utils/hourUtils';
import Link from 'next/link';

export default function WeekSummaryWidget() {
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const monday = getMonday(new Date());
      const weekDates = getWeekDates(monday);
      const weekStart = toISODateString(weekDates[0]);
      const weekEnd = toISODateString(weekDates[6]);

      const [shifts, employees] = await Promise.all([
        getShiftsForWeek(organizationId, weekStart, weekEnd),
        getEmployees(organizationId),
      ]);

      const result = generateWeekSummary(weekStart, shifts, employees);
      setSummary(result);
    } catch (error) {
      console.error('Erreur chargement récapitulatif:', error);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!orgLoading && organizationId) loadSummary();
  }, [orgLoading, organizationId, loadSummary]);

  if (orgLoading || isLoading) {
    return (
      <>
        <div className="widget widget--loading">
          <span className="loading-spinner" />
          <span className="loading-text">{"Chargement récapitulatif..."}</span>
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

  if (!summary) return null;

  return (
    <>
      <div className="widget">
        <div className="widget-header">
          <h3 className="widget-title">{"Récapitulatif semaine"}</h3>
          <Link href="/titulaire/recap-hebdo" className="widget-link">
            {"Voir détails"}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        <div className="week-badge">
          Semaine {summary.weekNumber}
        </div>

        <div className="stats-compact">
          <div className="stat-item">
            <span className="stat-value">{formatHours(summary.totalHours)}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{summary.employeeCount}</span>
            <span className="stat-label">Employés</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{summary.totalShifts}</span>
            <span className="stat-label">Shifts</span>
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
          margin-bottom: var(--spacing-3);
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
        }

        .week-badge {
          text-align: center;
          padding: var(--spacing-2) var(--spacing-3);
          background: var(--color-neutral-50);
          border-radius: var(--radius-md);
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
          margin-bottom: var(--spacing-3);
        }

        .stats-compact {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-2);
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: var(--spacing-2);
          background: var(--color-neutral-50);
          border-radius: var(--radius-md);
        }

        .stat-value {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-bold);
          color: var(--color-primary-600);
          line-height: 1.2;
        }

        .stat-label {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
          margin-top: 2px;
        }
      `}</style>
    </>
  );
}
