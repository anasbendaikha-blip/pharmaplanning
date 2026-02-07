'use client';

export default function GardesPage() {
  return (
    <>
      <div className="page-placeholder">
        <h1>Gestion des Gardes</h1>
        <p className="page-description">
          Planning des gardes de nuit, dimanche et jours fériés
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
