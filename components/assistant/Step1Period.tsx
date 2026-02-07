'use client';

import type { WizardConfig } from '@/lib/assistant/types';

interface Step1PeriodProps {
  config: WizardConfig;
  setConfig: (config: WizardConfig) => void;
}

const DAYS_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export default function Step1Period({ config, setConfig }: Step1PeriodProps) {
  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setConfig({ ...config, [field]: value });
  };

  const toggleDay = (index: number) => {
    const newDays = [...config.activeDays];
    newDays[index] = !newDays[index];
    setConfig({ ...config, activeDays: newDays });
  };

  const selectWeekdays = () => {
    setConfig({ ...config, activeDays: [true, true, true, true, true, false, false] });
  };

  const selectAll = () => {
    setConfig({ ...config, activeDays: [true, true, true, true, true, true, true] });
  };

  // Calcul durée totale
  const totalDays = (() => {
    if (!config.startDate || !config.endDate) return null;
    const start = new Date(config.startDate + 'T00:00:00');
    const end = new Date(config.endDate + 'T00:00:00');
    const diff = end.getTime() - start.getTime();
    if (diff < 0) return null;
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  })();

  // Calcul jours ouvrés
  const workingDays = (() => {
    if (!config.startDate || !config.endDate) return 0;
    const start = new Date(config.startDate + 'T00:00:00');
    const end = new Date(config.endDate + 'T00:00:00');
    if (end < start) return 0;
    let count = 0;
    const d = new Date(start);
    while (d <= end) {
      const dayIndex = (d.getDay() + 6) % 7; // Lundi = 0
      if (config.activeDays[dayIndex]) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  })();

  const activeDaysCount = config.activeDays.filter(Boolean).length;

  // Date minimale = aujourd'hui
  const today = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();

  return (
    <div className="step1">
      {/* ─── En-tête ─── */}
      <div className="step-header">
        <h2 className="step-title">Configuration de la période</h2>
        <p className="step-desc">
          Définissez la période pour laquelle vous souhaitez générer le planning
        </p>
      </div>

      {/* ─── Dates ─── */}
      <div className="date-row">
        <div className="form-field">
          <label htmlFor="startDate">
            Date de début <span className="required">*</span>
          </label>
          <input
            id="startDate"
            type="date"
            value={config.startDate}
            onChange={(e) => handleDateChange('startDate', e.target.value)}
            min={today}
          />
          <span className="hint">À partir de quelle date</span>
        </div>

        <div className="form-field">
          <label htmlFor="endDate">
            Date de fin <span className="required">*</span>
          </label>
          <input
            id="endDate"
            type="date"
            value={config.endDate}
            onChange={(e) => handleDateChange('endDate', e.target.value)}
            min={config.startDate || today}
          />
          <span className="hint">{"Jusqu'à quelle date"}</span>
        </div>
      </div>

      {/* ─── Info durée ─── */}
      {totalDays !== null && totalDays > 0 && (
        <div className="info-banner">
          <span className="info-label">Période sélectionnée</span>
          <span className="info-value">
            {totalDays} jour{totalDays > 1 ? 's' : ''} au total
          </span>
        </div>
      )}

      {/* ─── Jours d'ouverture ─── */}
      <div className="days-section">
        <div className="section-row">
          <div>
            <h3 className="section-title">{"Jours d'ouverture"}</h3>
            <p className="section-desc">Sélectionnez les jours où la pharmacie est ouverte</p>
          </div>
          <div className="quick-btns">
            <button className="quick-btn" onClick={selectWeekdays} type="button">Lun-Ven</button>
            <button className="quick-btn" onClick={selectAll} type="button">Tous</button>
          </div>
        </div>

        <div className="days-grid">
          {DAYS_LABELS.map((day, index) => (
            <button
              key={index}
              className={`day-btn ${config.activeDays[index] ? 'day-btn--active' : ''}`}
              onClick={() => toggleDay(index)}
              type="button"
              aria-pressed={config.activeDays[index]}
            >
              <span className="day-name">{day}</span>
              <span className="day-check">{config.activeDays[index] ? '\u2713' : ''}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Résumé ─── */}
      {workingDays > 0 && (
        <div className="summary">
          <h4 className="summary-title">Résumé de la configuration</h4>
          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-value">{workingDays}</span>
              <span className="summary-label">Jours ouvrés</span>
            </div>
            <div className="summary-card">
              <span className="summary-value">{totalDays}</span>
              <span className="summary-label">Jours totaux</span>
            </div>
            <div className="summary-card">
              <span className="summary-value">{activeDaysCount}</span>
              <span className="summary-label">Jours / semaine</span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .step1 {
          max-width: 780px;
          margin: 0 auto;
        }

        .step-header {
          text-align: center;
          margin-bottom: var(--spacing-8);
        }

        .step-title {
          margin: 0 0 var(--spacing-2) 0;
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
        }

        .step-desc {
          margin: 0;
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
        }

        /* ─── Dates ─── */
        .date-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-5);
          margin-bottom: var(--spacing-5);
        }

        .form-field {
          display: flex;
          flex-direction: column;
        }

        .form-field label {
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-sm);
          color: var(--color-neutral-700);
          margin-bottom: var(--spacing-2);
        }

        .required {
          color: var(--color-danger-500);
          margin-left: 2px;
        }

        .form-field input {
          padding: 12px 14px;
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: var(--font-size-sm);
          transition: border-color 0.15s ease;
        }

        .form-field input:focus {
          outline: none;
          border-color: var(--color-primary-500);
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
        }

        .hint {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-400);
          margin-top: var(--spacing-1);
        }

        /* ─── Info banner ─── */
        .info-banner {
          display: flex;
          align-items: center;
          gap: var(--spacing-3);
          padding: var(--spacing-3) var(--spacing-4);
          background: var(--color-primary-50);
          border-left: 4px solid var(--color-primary-500);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-6);
        }

        .info-label {
          font-weight: var(--font-weight-semibold);
          color: var(--color-primary-700);
          font-size: var(--font-size-sm);
        }

        .info-value {
          color: var(--color-primary-600);
          font-size: var(--font-size-sm);
        }

        /* ─── Jours ─── */
        .days-section {
          margin-bottom: var(--spacing-6);
        }

        .section-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: var(--spacing-4);
        }

        .section-title {
          margin: 0 0 var(--spacing-1) 0;
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
        }

        .section-desc {
          margin: 0;
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        .quick-btns {
          display: flex;
          gap: var(--spacing-2);
        }

        .quick-btn {
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

        .quick-btn:hover {
          border-color: var(--color-primary-400);
          color: var(--color-primary-600);
        }

        .days-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: var(--spacing-2);
        }

        .day-btn {
          padding: var(--spacing-4) var(--spacing-2);
          background: var(--color-neutral-50);
          border: 3px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-1);
        }

        .day-btn:hover {
          border-color: var(--color-neutral-300);
          background: white;
        }

        .day-btn--active {
          background: var(--color-primary-600);
          border-color: var(--color-primary-600);
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .day-name {
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
        }

        .day-check {
          font-size: var(--font-size-lg);
          height: 22px;
          display: flex;
          align-items: center;
        }

        /* ─── Résumé ─── */
        .summary {
          background: var(--color-neutral-50);
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-6);
        }

        .summary-title {
          margin: 0 0 var(--spacing-4) 0;
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
          text-align: center;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-4);
        }

        .summary-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-1);
          padding: var(--spacing-4);
          background: white;
          border-radius: var(--radius-md);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        }

        .summary-value {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-primary-600);
          line-height: 1;
        }

        .summary-label {
          font-size: var(--font-size-xs);
          color: var(--color-neutral-500);
        }

        @media (max-width: 768px) {
          .date-row {
            grid-template-columns: 1fr;
          }

          .section-row {
            flex-direction: column;
            gap: var(--spacing-3);
          }

          .days-grid {
            grid-template-columns: repeat(4, 1fr);
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
