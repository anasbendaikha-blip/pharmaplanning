'use client';

import { getWeekLabel } from '@/lib/utils/dateUtils';
import Button from '@/components/ui/Button';

interface WeekNavigationProps {
  monday: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  isCurrentWeek: boolean;
}

export default function WeekNavigation({
  monday,
  onPrevious,
  onNext,
  onToday,
  isCurrentWeek,
}: WeekNavigationProps) {
  const weekLabel = getWeekLabel(monday);

  return (
    <>
      <div className="week-nav">
        <div className="week-nav-buttons">
          <Button variant="secondary" size="sm" onClick={onPrevious}>
            &larr; Précédente
          </Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={onToday}>
              Aujourd&apos;hui
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onNext}>
            Suivante &rarr;
          </Button>
        </div>
        <h2 className="week-label">{weekLabel}</h2>
      </div>

      <style jsx>{`
        .week-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-3) 0;
        }

        .week-nav-buttons {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
        }

        .week-label {
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-800);
          margin: 0;
        }
      `}</style>
    </>
  );
}
