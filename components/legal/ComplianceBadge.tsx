/**
 * ComplianceBadge — Badge visuel du score de conformité légale
 *
 * Affiche un score circulaire avec code couleur :
 *  - 90-100 : Vert (Excellent)
 *  - 70-89  : Vert foncé (Bon)
 *  - 50-69  : Orange (Attention)
 *  - 30-49  : Orange foncé (Non conforme)
 *  - 0-29   : Rouge (Critique)
 *
 * styled-jsx uniquement, pas de Tailwind.
 */
'use client';

interface ComplianceBadgeProps {
  /** Score de conformité 0-100 */
  score: number;
  /** Label du score (ex: "Excellent") */
  label: string;
  /** CSS variable pour la couleur (ex: "var(--color-success-500)") */
  colorVar: string;
  /** Taille du badge : 'sm' (48px), 'md' (72px), 'lg' (100px) */
  size?: 'sm' | 'md' | 'lg';
  /** Afficher le label texte sous le score */
  showLabel?: boolean;
}

const SIZE_MAP = {
  sm: { outer: 48, stroke: 4, fontSize: '14px', labelSize: '10px' },
  md: { outer: 72, stroke: 5, fontSize: '20px', labelSize: '11px' },
  lg: { outer: 100, stroke: 6, fontSize: '28px', labelSize: '13px' },
} as const;

export default function ComplianceBadge({
  score,
  label,
  colorVar,
  size = 'md',
  showLabel = true,
}: ComplianceBadgeProps) {
  const config = SIZE_MAP[size];
  const radius = (config.outer - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <>
      <div className="badge-wrapper">
        <div className="badge-circle">
          <svg
            width={config.outer}
            height={config.outer}
            viewBox={`0 0 ${config.outer} ${config.outer}`}
          >
            {/* Track (fond gris) */}
            <circle
              cx={config.outer / 2}
              cy={config.outer / 2}
              r={radius}
              fill="none"
              stroke="var(--color-neutral-200)"
              strokeWidth={config.stroke}
            />
            {/* Progress (score) */}
            <circle
              cx={config.outer / 2}
              cy={config.outer / 2}
              r={radius}
              fill="none"
              stroke={colorVar}
              strokeWidth={config.stroke}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className="progress-ring"
            />
          </svg>
          <span
            className="badge-score"
            style={{ fontSize: config.fontSize, color: colorVar }}
          >
            {score}
          </span>
        </div>
        {showLabel && (
          <span
            className="badge-label"
            style={{ fontSize: config.labelSize, color: colorVar }}
          >
            {label}
          </span>
        )}
      </div>

      <style jsx>{`
        .badge-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-1);
        }

        .badge-circle {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .badge-circle svg {
          transform: rotate(-90deg);
        }

        .badge-circle :global(.progress-ring) {
          transition: stroke-dashoffset 0.6s ease;
        }

        .badge-score {
          position: absolute;
          font-weight: var(--font-weight-bold);
          line-height: 1;
        }

        .badge-label {
          font-weight: var(--font-weight-semibold);
          text-align: center;
          line-height: 1.2;
        }
      `}</style>
    </>
  );
}
