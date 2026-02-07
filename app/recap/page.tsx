'use client';

export default function RecapPage() {
  return (
    <>
      <div className="page-placeholder">
        <h1>Récapitulatif Hebdomadaire</h1>
        <p className="page-description">
          Tableau récapitulatif des heures par employé et par semaine
        </p>
      </div>

      <style jsx>{`
        .page-placeholder { max-width: 600px; }
        h1 { font-size: var(--font-size-2xl); margin-bottom: var(--spacing-2); }
        .page-description { color: var(--color-neutral-600); }
      `}</style>
    </>
  );
}
