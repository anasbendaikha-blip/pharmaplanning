'use client';

export default function CalendrierCongesPage() {
  return (
    <>
      <div className="page-placeholder">
        <h1>Calendrier des Congés</h1>
        <p className="page-description">
          Vue annuelle des congés et absences de tous les employés
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
