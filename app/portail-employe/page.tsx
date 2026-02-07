'use client';

export default function PortailEmployePage() {
  return (
    <>
      <div className="page-placeholder">
        <h1>Portail Employé</h1>
        <p className="page-description">
          Vue personnalisée du planning pour chaque employé
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
