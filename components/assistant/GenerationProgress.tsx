'use client';

interface GenerationProgressProps {
  progress: number;
  status: string;
}

export default function GenerationProgress({ progress, status }: GenerationProgressProps) {
  return (
    <div className="generation-progress">
      <div className="progress-container">
        {/* Icône animée */}
        <div className="progress-icon">
          <span className="spinner-emoji" aria-hidden="true">{'\u2699'}</span>
        </div>

        <h2 className="progress-title">Génération en cours...</h2>
        <p className="status-text">{status}</p>

        {/* Barre de progression */}
        <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${progress}%` }}>
            {progress >= 15 && <span className="progress-pct">{progress}%</span>}
          </div>
        </div>

        {/* Étapes visuelles */}
        <div className="progress-steps">
          <div className={`pstep ${progress >= 20 ? 'pstep--done' : progress >= 10 ? 'pstep--active' : ''}`}>
            <span className="pstep-num">{progress >= 20 ? '\u2713' : '1'}</span>
            <span className="pstep-label">Chargement</span>
          </div>
          <div className={`pstep ${progress >= 70 ? 'pstep--done' : progress >= 30 ? 'pstep--active' : ''}`}>
            <span className="pstep-num">{progress >= 70 ? '\u2713' : '2'}</span>
            <span className="pstep-label">Génération</span>
          </div>
          <div className={`pstep ${progress >= 95 ? 'pstep--done' : progress >= 85 ? 'pstep--active' : ''}`}>
            <span className="pstep-num">{progress >= 95 ? '\u2713' : '3'}</span>
            <span className="pstep-label">Validation</span>
          </div>
          <div className={`pstep ${progress >= 100 ? 'pstep--done' : progress >= 95 ? 'pstep--active' : ''}`}>
            <span className="pstep-num">{progress >= 100 ? '\u2713' : '4'}</span>
            <span className="pstep-label">Statistiques</span>
          </div>
        </div>

        {/* Tip */}
        <div className="tip-box">
          <p className="tip-title">Le saviez-vous ?</p>
          <p className="tip-text">
            {"L'algorithme teste des milliers de combinaisons pour trouver la meilleure affectation en respectant toutes vos contraintes."}
          </p>
        </div>
      </div>

      <style jsx>{`
        .generation-progress {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 500px;
          padding: var(--spacing-8) var(--spacing-4);
        }

        .progress-container {
          max-width: 640px;
          width: 100%;
          text-align: center;
        }

        /* ─── Icône animée ─── */
        .progress-icon { margin-bottom: var(--spacing-6); }

        .spinner-emoji {
          font-size: 64px;
          display: inline-block;
          animation: spin-gear 2s linear infinite;
        }

        @keyframes spin-gear {
          to { transform: rotate(360deg); }
        }

        /* ─── Titre / Status ─── */
        .progress-title {
          margin: 0 0 var(--spacing-2) 0;
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
        }

        .status-text {
          margin: 0 0 var(--spacing-6) 0;
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
          min-height: 22px;
        }

        /* ─── Barre de progression ─── */
        .progress-bar {
          height: 14px;
          background: var(--color-neutral-200);
          border-radius: var(--radius-full);
          overflow: hidden;
          margin-bottom: var(--spacing-8);
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%);
          border-radius: var(--radius-full);
          transition: width 0.5s ease;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 10px;
        }

        .progress-pct {
          font-size: 10px;
          font-weight: var(--font-weight-bold);
          color: white;
        }

        /* ─── Étapes ─── */
        .progress-steps {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--spacing-3);
          margin-bottom: var(--spacing-6);
        }

        .pstep {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-2);
          padding: var(--spacing-3);
          background: var(--color-neutral-50);
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          transition: all 0.3s ease;
          opacity: 0.5;
        }

        .pstep--active {
          opacity: 1;
          border-color: var(--color-primary-400);
          background: var(--color-primary-50);
          transform: scale(1.05);
        }

        .pstep--done {
          opacity: 1;
          border-color: var(--color-primary-500);
          background: var(--color-primary-500);
        }

        .pstep-num {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--color-neutral-200);
          color: var(--color-neutral-600);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
        }

        .pstep--active .pstep-num {
          background: var(--color-primary-500);
          color: white;
        }

        .pstep--done .pstep-num {
          background: white;
          color: var(--color-primary-600);
        }

        .pstep-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-600);
        }

        .pstep--done .pstep-label { color: white; }

        /* ─── Tip ─── */
        .tip-box {
          padding: var(--spacing-4);
          background: var(--color-warning-50);
          border-left: 4px solid var(--color-warning-400);
          border-radius: var(--radius-md);
          text-align: left;
        }

        .tip-title {
          margin: 0 0 var(--spacing-1) 0;
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
          color: var(--color-warning-700);
        }

        .tip-text {
          margin: 0;
          font-size: var(--font-size-xs);
          color: var(--color-warning-600);
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .progress-steps { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
