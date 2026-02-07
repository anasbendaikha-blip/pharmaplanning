'use client';

import { useState } from 'react';
import type { WizardConfig } from '@/lib/assistant/types';
import { useOrganization } from '@/lib/supabase/client';
import { getEmployees } from '@/lib/supabase/queries';
import { generateSchedule } from '@/lib/assistant/generator';
import GenerationProgress from './GenerationProgress';
import ResultsPreview from './ResultsPreview';

interface Step4GenerateProps {
  config: WizardConfig;
  setConfig: (config: WizardConfig) => void;
}

const DAYS_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function countWorkingDays(start: string, end: string, activeDays: boolean[]): number {
  if (!start || !end) return 0;
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  let count = 0;
  const d = new Date(startDate);
  while (d <= endDate) {
    const dayIndex = (d.getDay() + 6) % 7;
    if (activeDays[dayIndex]) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Step4Generate({ config, setConfig }: Step4GenerateProps) {
  const { organizationId } = useOrganization();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const hasResults = config.generatedSchedule !== null;

  const handleGenerate = async () => {
    if (!organizationId) {
      alert('Organisation non trouvée');
      return;
    }

    setGenerating(true);
    setProgress(0);
    setStatus('Initialisation...');

    try {
      // Étape 1 : Charger employés
      setProgress(10);
      setStatus('Chargement des employés...');
      await sleep(300);

      const employees = await getEmployees(organizationId);

      if (employees.length === 0) {
        alert('Aucun employé trouvé. Ajoutez des employés depuis la page Employés.');
        setGenerating(false);
        return;
      }

      setProgress(20);
      setStatus(`${employees.length} employés chargés`);
      await sleep(400);

      // Étape 2 : Préparation
      setProgress(30);
      setStatus('Préparation de l\'algorithme...');
      await sleep(300);

      // Étape 3 : Génération
      setProgress(40);
      setStatus('Génération du planning en cours...');
      await sleep(200);

      const result = generateSchedule(config, employees);

      setProgress(70);
      setStatus('Planning généré');
      await sleep(400);

      // Étape 4 : Validation
      setProgress(85);
      setStatus('Validation des contraintes légales...');
      await sleep(300);

      // Étape 5 : Stats
      setProgress(95);
      setStatus('Calcul des statistiques...');
      await sleep(200);

      // Terminé
      setProgress(100);
      setStatus('Génération terminée !');
      await sleep(400);

      // Sauvegarder dans config
      setConfig({ ...config, generatedSchedule: result });
      setGenerating(false);
    } catch (error) {
      console.error('Erreur génération:', error);
      alert(`Erreur lors de la génération : ${error instanceof Error ? error.message : String(error)}`);
      setGenerating(false);
    }
  };

  const handleReset = () => {
    if (confirm('Réinitialiser et regénérer le planning ?')) {
      setConfig({ ...config, generatedSchedule: null });
    }
  };

  // ─── En cours de génération ───
  if (generating) {
    return <GenerationProgress progress={progress} status={status} />;
  }

  // ─── Résultats disponibles ───
  if (hasResults && config.generatedSchedule) {
    return (
      <ResultsPreview
        schedule={config.generatedSchedule}
        config={config}
        onRegenerate={handleReset}
      />
    );
  }

  // ─── Écran initial ───
  const workingDays = countWorkingDays(config.startDate, config.endDate, config.activeDays);
  const activeDaysLabels = DAYS_LABELS.filter((_, i) => config.activeDays[i]).join(', ');
  const constraintsCount = Object.keys(config.employeeConstraints).length;

  return (
    <div className="step4">
      {/* ─── Header ─── */}
      <div className="step-header">
        <h2 className="step-title">Génération automatique</h2>
        <p className="step-desc">
          {"L'assistant va créer un planning optimisé en respectant toutes les contraintes configurées"}
        </p>
      </div>

      {/* ─── Récapitulatif ─── */}
      <div className="recap-section">
        <h3 className="recap-title">Récapitulatif de votre configuration</h3>

        <div className="recap-grid">
          <div className="recap-card">
            <div className="recap-icon-wrap recap-icon--period">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <div className="recap-content">
              <span className="recap-label">Période</span>
              <span className="recap-value">{formatDate(config.startDate)} {'\u2192'} {formatDate(config.endDate)}</span>
              <span className="recap-detail">{workingDays} jours ouvrés</span>
            </div>
          </div>

          <div className="recap-card">
            <div className="recap-icon-wrap recap-icon--shifts">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
            <div className="recap-content">
              <span className="recap-label">Créneaux définis</span>
              <span className="recap-value">{config.shifts.length}</span>
              <span className="recap-detail">{config.shifts.map((s) => s.name).join(', ') || 'Aucun'}</span>
            </div>
          </div>

          <div className="recap-card">
            <div className="recap-icon-wrap recap-icon--employees">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div className="recap-content">
              <span className="recap-label">Employés configurés</span>
              <span className="recap-value">{constraintsCount}</span>
              <span className="recap-detail">Contraintes personnalisées</span>
            </div>
          </div>

          <div className="recap-card">
            <div className="recap-icon-wrap recap-icon--days">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
            </div>
            <div className="recap-content">
              <span className="recap-label">{"Jours d'ouverture"}</span>
              <span className="recap-value">{config.activeDays.filter(Boolean).length}/7</span>
              <span className="recap-detail">{activeDaysLabels}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Info algorithme ─── */}
      <div className="algo-info">
        <h4 className="algo-title">{"Comment fonctionne l'algorithme intelligent ?"}</h4>
        <ul className="algo-list">
          <li>
            <span className="algo-check">{'\u2713'}</span>
            <span><strong>Contraintes légales</strong> : 10h max/jour, 48h max/semaine</span>
          </li>
          <li>
            <span className="algo-check">{'\u2713'}</span>
            <span><strong>Indisponibilités</strong> : Congés, jours de repos, dates spécifiques</span>
          </li>
          <li>
            <span className="algo-check">{'\u2713'}</span>
            <span><strong>Équilibrage automatique</strong> : Distribution équitable de la charge</span>
          </li>
          <li>
            <span className="algo-check">{'\u2713'}</span>
            <span><strong>Préférences</strong> : Priorité aux créneaux préférés</span>
          </li>
          <li>
            <span className="algo-check">{'\u2713'}</span>
            <span><strong>Pharmacien obligatoire</strong> : Au moins 1 par créneau</span>
          </li>
          <li>
            <span className="algo-check">{'\u2713'}</span>
            <span><strong>Scoring intelligent</strong> : Meilleur candidat pour chaque affectation</span>
          </li>
        </ul>
      </div>

      {/* ─── Bouton générer ─── */}
      <button className="btn-generate" onClick={handleGenerate} type="button">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
        <span>Générer le planning automatiquement</span>
      </button>

      <style jsx>{`
        .step4 { max-width: 900px; margin: 0 auto; }

        /* ─── Header ─── */
        .step-header { text-align: center; margin-bottom: var(--spacing-8); }

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
          max-width: 600px;
          margin: 0 auto;
        }

        /* ─── Récapitulatif ─── */
        .recap-section {
          background: var(--color-neutral-50);
          border: 2px solid var(--color-neutral-200);
          border-radius: var(--radius-lg);
          padding: var(--spacing-6);
          margin-bottom: var(--spacing-5);
        }

        .recap-title {
          margin: 0 0 var(--spacing-4) 0;
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-800);
          text-align: center;
        }

        .recap-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--spacing-3);
        }

        .recap-card {
          display: flex;
          gap: var(--spacing-3);
          padding: var(--spacing-4);
          background: white;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
        }

        .recap-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .recap-icon--period { background: var(--color-primary-50); color: var(--color-primary-600); }
        .recap-icon--shifts { background: var(--color-warning-50); color: var(--color-warning-600); }
        .recap-icon--employees { background: #ede9fe; color: #7c3aed; }
        .recap-icon--days { background: var(--color-danger-50); color: var(--color-danger-500); }

        .recap-content { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }

        .recap-label {
          font-size: 11px;
          font-weight: var(--font-weight-semibold);
          color: var(--color-neutral-500);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .recap-value {
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          color: var(--color-neutral-900);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .recap-detail {
          font-size: 11px;
          color: var(--color-neutral-400);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ─── Info algorithme ─── */
        .algo-info {
          padding: var(--spacing-5);
          background: var(--color-primary-50);
          border-left: 4px solid var(--color-primary-500);
          border-radius: var(--radius-md);
          margin-bottom: var(--spacing-6);
        }

        .algo-title {
          margin: 0 0 var(--spacing-3) 0;
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          color: var(--color-primary-800);
        }

        .algo-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
        }

        .algo-list li {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-2);
          font-size: var(--font-size-sm);
          color: var(--color-primary-700);
          line-height: 1.5;
        }

        .algo-list li strong {
          color: var(--color-primary-800);
        }

        .algo-check {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--color-primary-500);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: var(--font-weight-bold);
          flex-shrink: 0;
          margin-top: 1px;
        }

        /* ─── Bouton générer ─── */
        .btn-generate {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-3);
          padding: 20px var(--spacing-8);
          background: linear-gradient(135deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%);
          color: white;
          border: none;
          border-radius: var(--radius-lg);
          font-family: var(--font-family-primary);
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-lg);
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
        }

        .btn-generate:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
        }

        .btn-generate:active {
          transform: translateY(0);
        }

        @media (max-width: 768px) {
          .recap-grid { grid-template-columns: 1fr; }
          .btn-generate { font-size: var(--font-size-md); padding: 16px var(--spacing-5); }
        }
      `}</style>
    </div>
  );
}
