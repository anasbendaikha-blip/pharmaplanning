'use client';

import { useState, useCallback } from 'react';
import { useOrganization } from '@/lib/supabase/client';
import Step1Period from '@/components/assistant/Step1Period';
import Step2Shifts from '@/components/assistant/Step2Shifts';
import Step3Constraints from '@/components/assistant/Step3Constraints';
import type { WizardStep, WizardConfig } from '@/lib/assistant/types';
import { validateStep1, validateStep2, validateStep3 } from '@/lib/assistant/validation';

const STORAGE_KEY = 'assistant-planning-config';

const INITIAL_CONFIG: WizardConfig = {
  startDate: '',
  endDate: '',
  activeDays: [true, true, true, true, true, true, false],
  shifts: [],
  employeeConstraints: {},
  generatedSchedule: null,
};

function loadSavedConfig(): WizardConfig {
  if (typeof window === 'undefined') return INITIAL_CONFIG;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as WizardConfig;
  } catch {
    // Ignore parse errors
  }
  return INITIAL_CONFIG;
}

const STEP_LABELS = ['Période', 'Créneaux', 'Contraintes', 'Génération'];

export default function AssistantPlanningPage() {
  const { organization } = useOrganization();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [errors, setErrors] = useState<string[]>([]);

  // Lazy init : charge localStorage une seule fois au premier rendu
  const [config, setConfig] = useState<WizardConfig>(loadSavedConfig);

  // Sauvegarder config dans localStorage à chaque changement
  const saveConfig = useCallback((newConfig: WizardConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  }, []);

  const goNext = () => {
    let validation = { valid: true, errors: [] as string[] };

    if (currentStep === 1) {
      validation = validateStep1(config);
    } else if (currentStep === 2) {
      validation = validateStep2(config);
    } else if (currentStep === 3) {
      validation = validateStep3(config);
    }

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors([]);
    if (currentStep < 4) {
      setCurrentStep((prev) => (prev + 1) as WizardStep);
    }
  };

  const goPrev = () => {
    setErrors([]);
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const resetWizard = () => {
    if (confirm('Réinitialiser l\'assistant ? Toutes les données seront perdues.')) {
      localStorage.removeItem(STORAGE_KEY);
      setConfig(INITIAL_CONFIG);
      setCurrentStep(1);
      setErrors([]);
    }
  };

  return (
    <div className="assistant-page">
      {/* ─── Header ─── */}
      <header className="assistant-header">
        <div className="header-content">
          <h1 className="header-title">Assistant Planning Intelligent</h1>
          <p className="header-subtitle">
            {organization?.name ?? 'Pharmacie'} &mdash; Génération automatique en 4 étapes
          </p>
        </div>
        <button className="btn-reset" onClick={resetWizard} type="button">
          Réinitialiser
        </button>
      </header>

      {/* ─── Stepper ─── */}
      <nav className="stepper" aria-label="Étapes de l'assistant">
        {([1, 2, 3, 4] as const).map((step) => (
          <div
            key={step}
            className={`step ${currentStep === step ? 'step--active' : ''} ${currentStep > step ? 'step--completed' : ''}`}
          >
            <div className="step-number">
              {currentStep > step ? '\u2713' : step}
            </div>
            <span className="step-label">{STEP_LABELS[step - 1]}</span>
            {step < 4 && <div className="step-connector" />}
          </div>
        ))}
      </nav>

      {/* ─── Erreurs de validation ─── */}
      {errors.length > 0 && (
        <div className="errors-box" role="alert">
          <div className="errors-header">
            <span className="errors-title">Erreurs de validation</span>
          </div>
          <ul className="errors-list">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Contenu ─── */}
      <div className="wizard-content">
        {currentStep === 1 && (
          <Step1Period config={config} setConfig={saveConfig} />
        )}
        {currentStep === 2 && (
          <Step2Shifts config={config} setConfig={saveConfig} />
        )}
        {currentStep === 3 && (
          <Step3Constraints config={config} setConfig={saveConfig} />
        )}
        {currentStep === 4 && (
          <div className="placeholder-step">
            <h2>Génération &amp; Validation</h2>
            <p>À venir dans la prochaine session...</p>
          </div>
        )}
      </div>

      {/* ─── Navigation ─── */}
      <div className="wizard-nav">
        <button
          className="btn-secondary"
          onClick={goPrev}
          disabled={currentStep === 1}
          type="button"
        >
          &larr; Précédent
        </button>

        <span className="nav-info">
          Étape {currentStep} sur 4
        </span>

        <button
          className="btn-primary"
          onClick={goNext}
          disabled={currentStep === 4}
          type="button"
        >
          Suivant &rarr;
        </button>
      </div>

      <style jsx>{`
        .assistant-page {
          max-width: 1100px;
          margin: 0 auto;
        }

        /* ─── Header ─── */
        .assistant-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--spacing-8);
        }

        .header-title {
          margin: 0 0 var(--spacing-1) 0;
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
        }

        .header-subtitle {
          margin: 0;
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
        }

        .btn-reset {
          padding: 10px 20px;
          background: var(--color-neutral-100);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-family: var(--font-family-primary);
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-sm);
          color: var(--color-neutral-600);
          transition: all 0.15s ease;
        }

        .btn-reset:hover {
          background: var(--color-neutral-200);
        }

        /* ─── Stepper ─── */
        .stepper {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          margin-bottom: var(--spacing-8);
        }

        .step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-2);
          position: relative;
        }

        .step-number {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--color-neutral-100);
          border: 3px solid var(--color-neutral-200);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-md);
          color: var(--color-neutral-400);
          transition: all 0.25s ease;
          position: relative;
          z-index: 2;
        }

        .step--active .step-number {
          background: var(--color-primary-600);
          border-color: var(--color-primary-600);
          color: white;
          transform: scale(1.1);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .step--completed .step-number {
          background: var(--color-primary-500);
          border-color: var(--color-primary-500);
          color: white;
        }

        .step-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-400);
          text-align: center;
        }

        .step--active .step-label {
          color: var(--color-primary-700);
        }

        .step--completed .step-label {
          color: var(--color-primary-600);
        }

        .step-connector {
          position: absolute;
          left: 100%;
          top: 22px;
          width: 100px;
          height: 3px;
          background: var(--color-neutral-200);
          z-index: 1;
        }

        .step--completed .step-connector {
          background: var(--color-primary-500);
        }

        /* ─── Erreurs ─── */
        .errors-box {
          background: var(--color-danger-50);
          border-left: 4px solid var(--color-danger-500);
          border-radius: var(--radius-md);
          padding: var(--spacing-4) var(--spacing-5);
          margin-bottom: var(--spacing-5);
        }

        .errors-header {
          margin-bottom: var(--spacing-2);
        }

        .errors-title {
          font-weight: var(--font-weight-bold);
          color: var(--color-danger-700);
          font-size: var(--font-size-sm);
        }

        .errors-list {
          margin: 0;
          padding-left: var(--spacing-5);
          color: var(--color-danger-800);
          font-size: var(--font-size-sm);
        }

        .errors-list li {
          margin-bottom: 2px;
        }

        /* ─── Contenu ─── */
        .wizard-content {
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-8);
          min-height: 460px;
          margin-bottom: var(--spacing-6);
        }

        .placeholder-step {
          text-align: center;
          padding: 80px 20px;
        }

        .placeholder-step h2 {
          margin: 0 0 var(--spacing-3) 0;
          font-size: var(--font-size-xl);
          color: var(--color-neutral-700);
        }

        .placeholder-step p {
          margin: 0;
          font-size: var(--font-size-sm);
          color: var(--color-neutral-500);
        }

        /* ─── Navigation ─── */
        .wizard-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .nav-info {
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
          font-size: var(--font-size-sm);
        }

        .btn-primary,
        .btn-secondary {
          padding: 12px 28px;
          border: none;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-weight: var(--font-weight-semibold);
          font-size: var(--font-size-sm);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-primary {
          background: var(--color-primary-600);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--color-primary-700);
          box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
        }

        .btn-secondary {
          background: var(--color-neutral-100);
          color: var(--color-neutral-600);
        }

        .btn-secondary:hover:not(:disabled) {
          background: var(--color-neutral-200);
        }

        .btn-primary:disabled,
        .btn-secondary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .assistant-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-3);
          }

          .stepper {
            overflow-x: auto;
            padding-bottom: var(--spacing-3);
          }

          .step-connector {
            width: 60px;
          }

          .wizard-content {
            padding: var(--spacing-5);
          }
        }
      `}</style>
    </div>
  );
}
