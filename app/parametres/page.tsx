'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { usePharmacieConfig } from '@/lib/pharmacie-config-service';
import type { DayOpeningHours } from '@/lib/types';

// ═══════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════

type TabId = 'pharmacie' | 'horaires' | 'planning' | 'notifications';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'pharmacie', label: 'Pharmacie', icon: '🏥' },
  { id: 'horaires', label: 'Horaires', icon: '🕐' },
  { id: 'planning', label: 'Planning', icon: '📋' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' },
];

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DIGEST_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// ═══════════════════════════════════════════════════════
// Page Component
// ═══════════════════════════════════════════════════════

export default function ParametresPage() {
  const { addToast } = useToast();
  const {
    config,
    updatePharmacie,
    updateHoraires,
    updatePlanning,
    updateNotifications,
    save,
    reset,
    hasChanges,
    isSaving,
    lastSaved,
  } = usePharmacieConfig();

  const [activeTab, setActiveTab] = useState<TabId>('pharmacie');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSave = useCallback(() => {
    save();
    addToast('success', 'Paramètres sauvegardés avec succès');
  }, [save, addToast]);

  const handleReset = useCallback(() => {
    reset();
    setShowResetConfirm(false);
    addToast('warning', 'Paramètres réinitialisés aux valeurs par défaut');
  }, [reset, addToast]);

  // Horaires helpers
  const updateDayHours = useCallback((dayIndex: number, field: string, value: string | boolean) => {
    const current = config.horaires.ouverture;
    const day = current[dayIndex] || { is_open: false, slots: [] };

    let updated: DayOpeningHours;
    if (field === 'is_open') {
      updated = {
        is_open: value as boolean,
        slots: value ? (day.slots.length > 0 ? day.slots : [{ start: '08:30', end: '19:30' }]) : [],
      };
    } else if (field === 'start') {
      updated = {
        ...day,
        slots: day.slots.length > 0
          ? [{ ...day.slots[0], start: value as string }]
          : [{ start: value as string, end: '19:30' }],
      };
    } else {
      updated = {
        ...day,
        slots: day.slots.length > 0
          ? [{ ...day.slots[0], end: value as string }]
          : [{ start: '08:30', end: value as string }],
      };
    }

    updateHoraires({
      ouverture: { ...current, [dayIndex]: updated },
    });
  }, [config.horaires.ouverture, updateHoraires]);

  const formatLastSaved = (iso: string | null) => {
    if (!iso) return 'Jamais';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Jamais';
    }
  };

  // ─── Render functions ───

  function renderPharmacieTab() {
    const p = config.pharmacie;
    return (
      <div className="pm-tab-content">
        {/* Section: Informations pharmacie */}
        <div className="pm-section">
          <h3 className="pm-section-title">Informations pharmacie</h3>
          <div className="pm-grid pm-grid--2col">
            <div className="pm-field">
              <label className="pm-label">Nom officiel</label>
              <input
                type="text"
                className="pm-input"
                placeholder="Pharmacie du Centre"
                value={p.nom}
                onChange={e => updatePharmacie({ nom: e.target.value })}
              />
            </div>
            <div className="pm-field">
              <label className="pm-label">Numéro FINESS</label>
              <input
                type="text"
                className="pm-input"
                placeholder="XX XXX XXX X"
                value={p.finess}
                onChange={e => updatePharmacie({ finess: e.target.value })}
              />
            </div>
            <div className="pm-field pm-field--full">
              <label className="pm-label">Adresse</label>
              <input
                type="text"
                className="pm-input"
                placeholder="12 rue de la Pharmacie"
                value={p.adresse}
                onChange={e => updatePharmacie({ adresse: e.target.value })}
              />
            </div>
            <div className="pm-field">
              <label className="pm-label">Code postal</label>
              <input
                type="text"
                className="pm-input"
                placeholder="75001"
                value={p.codePostal}
                onChange={e => updatePharmacie({ codePostal: e.target.value })}
              />
            </div>
            <div className="pm-field">
              <label className="pm-label">Ville</label>
              <input
                type="text"
                className="pm-input"
                placeholder="Paris"
                value={p.ville}
                onChange={e => updatePharmacie({ ville: e.target.value })}
              />
            </div>
            <div className="pm-field">
              <label className="pm-label">Téléphone</label>
              <input
                type="tel"
                className="pm-input"
                placeholder="01 23 45 67 89"
                value={p.telephone}
                onChange={e => updatePharmacie({ telephone: e.target.value })}
              />
            </div>
            <div className="pm-field">
              <label className="pm-label">Email</label>
              <input
                type="email"
                className="pm-input"
                placeholder="contact@pharmacie.fr"
                value={p.email}
                onChange={e => updatePharmacie({ email: e.target.value })}
              />
            </div>
            <div className="pm-field">
              <label className="pm-label">Numéro RPPS</label>
              <input
                type="text"
                className="pm-input"
                placeholder="XXXXXXXXXXX"
                value={p.rpps}
                onChange={e => updatePharmacie({ rpps: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section: Titulaire */}
        <div className="pm-section">
          <h3 className="pm-section-title">Pharmacien titulaire</h3>
          <div className="pm-grid pm-grid--2col">
            <div className="pm-field">
              <label className="pm-label">Nom complet</label>
              <input
                type="text"
                className="pm-input"
                placeholder="Dr. Jean Dupont"
                value={p.titulaireNom}
                onChange={e => updatePharmacie({ titulaireNom: e.target.value })}
              />
            </div>
            <div className="pm-field">
              <label className="pm-label">RPPS personnel</label>
              <input
                type="text"
                className="pm-input"
                placeholder="XXXXXXXXXXX"
                value={p.titulaireRpps}
                onChange={e => updatePharmacie({ titulaireRpps: e.target.value })}
              />
            </div>
            <div className="pm-field">
              <label className="pm-label">Email</label>
              <input
                type="email"
                className="pm-input"
                placeholder="titulaire@pharmacie.fr"
                value={p.titulaireEmail}
                onChange={e => updatePharmacie({ titulaireEmail: e.target.value })}
              />
            </div>
            <div className="pm-field">
              <label className="pm-label">Téléphone</label>
              <input
                type="tel"
                className="pm-input"
                placeholder="06 12 34 56 78"
                value={p.titulaireTelephone}
                onChange={e => updatePharmacie({ titulaireTelephone: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderHorairesTab() {
    const h = config.horaires;
    return (
      <div className="pm-tab-content">
        {/* Section: Horaires d'ouverture */}
        <div className="pm-section">
          <h3 className="pm-section-title">Horaires d&apos;ouverture</h3>
          <p className="pm-section-desc">Définissez les horaires d&apos;ouverture pour chaque jour de la semaine.</p>
          <div className="pm-days-grid">
            {DAY_NAMES.map((dayName, idx) => {
              const day = h.ouverture[idx] || { is_open: false, slots: [] };
              return (
                <div key={idx} className={`pm-day-row ${!day.is_open ? 'pm-day-row--closed' : ''}`}>
                  <div className="pm-day-name">
                    <label className="pm-toggle-label">
                      <input
                        type="checkbox"
                        className="pm-toggle"
                        checked={day.is_open}
                        onChange={e => updateDayHours(idx, 'is_open', e.target.checked)}
                      />
                      <span className="pm-toggle-slider" />
                      <span className="pm-day-text">{dayName}</span>
                    </label>
                  </div>
                  {day.is_open ? (
                    <div className="pm-day-times">
                      <input
                        type="time"
                        className="pm-time-input"
                        value={day.slots[0]?.start || '08:30'}
                        onChange={e => updateDayHours(idx, 'start', e.target.value)}
                      />
                      <span className="pm-time-sep">→</span>
                      <input
                        type="time"
                        className="pm-time-input"
                        value={day.slots[0]?.end || '19:30'}
                        onChange={e => updateDayHours(idx, 'end', e.target.value)}
                      />
                    </div>
                  ) : (
                    <span className="pm-closed-label">Fermé</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Section: Zone pré-ouverture */}
        <div className="pm-section">
          <h3 className="pm-section-title">Zone pré-ouverture</h3>
          <p className="pm-section-desc">Créneau avant l&apos;ouverture officielle (affiché en vert sur le planning).</p>
          <div className="pm-grid pm-grid--2col">
            <div className="pm-field">
              <label className="pm-label">Début</label>
              <input
                type="time"
                className="pm-input"
                value={h.preOuvertureDebut}
                onChange={e => updateHoraires({ preOuvertureDebut: e.target.value })}
              />
            </div>
            <div className="pm-field">
              <label className="pm-label">Fin (= heure d&apos;ouverture)</label>
              <input
                type="time"
                className="pm-input"
                value={h.preOuvertureFin}
                onChange={e => updateHoraires({ preOuvertureFin: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section: Garde pharmaceutique */}
        <div className="pm-section">
          <h3 className="pm-section-title">Garde pharmaceutique</h3>
          <p className="pm-section-desc">Créneau de garde après fermeture (affiché en violet sur le planning).</p>
          <div className="pm-grid pm-grid--2col">
            <div className="pm-field">
              <label className="pm-label">Début de garde</label>
              <input
                type="time"
                className="pm-input"
                value={h.gardeDebut}
                onChange={e => updateHoraires({ gardeDebut: e.target.value })}
              />
            </div>
            <div className="pm-field">
              <label className="pm-label">Fin de garde</label>
              <input
                type="time"
                className="pm-input"
                value={h.gardeFin}
                onChange={e => updateHoraires({ gardeFin: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Section: Timeline */}
        <div className="pm-section">
          <h3 className="pm-section-title">Plage horaire du planning</h3>
          <p className="pm-section-desc">Heures de début et fin visibles sur la timeline du planning.</p>
          <div className="pm-grid pm-grid--2col">
            <div className="pm-field">
              <label className="pm-label">Début timeline</label>
              <select
                className="pm-input"
                value={h.timelineStart}
                onChange={e => updateHoraires({ timelineStart: Number(e.target.value) })}
              >
                {[6, 7, 8, 9].map(v => (
                  <option key={v} value={v}>{v}h00</option>
                ))}
              </select>
            </div>
            <div className="pm-field">
              <label className="pm-label">Fin timeline</label>
              <select
                className="pm-input"
                value={h.timelineEnd}
                onChange={e => updateHoraires({ timelineEnd: Number(e.target.value) })}
              >
                {[20, 21, 22, 23, 24].map(v => (
                  <option key={v} value={v}>{v === 24 ? '00h00 (minuit)' : `${v}h00`}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderPlanningTab() {
    const pl = config.planning;
    return (
      <div className="pm-tab-content">
        <div className="pm-section">
          <h3 className="pm-section-title">Règles de travail</h3>
          <p className="pm-section-desc">Configurez les limites légales et internes pour la génération du planning.</p>
          <div className="pm-grid pm-grid--2col">
            <div className="pm-field">
              <label className="pm-label">Durée max journalière (heures)</label>
              <input
                type="number"
                className="pm-input"
                min={6}
                max={14}
                step={0.5}
                value={pl.maxDailyHours}
                onChange={e => updatePlanning({ maxDailyHours: Number(e.target.value) })}
              />
              <span className="pm-hint">Code du travail : 10h max (dérogation possible à 12h)</span>
            </div>
            <div className="pm-field">
              <label className="pm-label">Heures max hebdomadaires</label>
              <input
                type="number"
                className="pm-input"
                min={35}
                max={60}
                step={1}
                value={pl.maxWeeklyHours}
                onChange={e => updatePlanning({ maxWeeklyHours: Number(e.target.value) })}
              />
              <span className="pm-hint">Légal : 44h en moyenne sur 12 semaines</span>
            </div>
            <div className="pm-field">
              <label className="pm-label">Repos hebdomadaire minimum (heures)</label>
              <input
                type="number"
                className="pm-input"
                min={24}
                max={48}
                step={1}
                value={pl.minRestHoursWeekly}
                onChange={e => updatePlanning({ minRestHoursWeekly: Number(e.target.value) })}
              />
              <span className="pm-hint">Légal : 35h consécutives minimum</span>
            </div>
            <div className="pm-field">
              <label className="pm-label">Pharmaciens minimum en service</label>
              <input
                type="number"
                className="pm-input"
                min={1}
                max={5}
                step={1}
                value={pl.minPharmacists}
                onChange={e => updatePlanning({ minPharmacists: Number(e.target.value) })}
              />
              <span className="pm-hint">Obligation légale : au moins 1 pharmacien</span>
            </div>
          </div>
        </div>

        <div className="pm-section">
          <h3 className="pm-section-title">Pauses</h3>
          <div className="pm-grid pm-grid--2col">
            <div className="pm-field pm-field--full">
              <label className="pm-toggle-label">
                <input
                  type="checkbox"
                  className="pm-toggle"
                  checked={pl.breakRequired}
                  onChange={e => updatePlanning({ breakRequired: e.target.checked })}
                />
                <span className="pm-toggle-slider" />
                <span>Pause obligatoire au-delà du seuil</span>
              </label>
            </div>
            {pl.breakRequired && (
              <>
                <div className="pm-field">
                  <label className="pm-label">Seuil de déclenchement (heures)</label>
                  <input
                    type="number"
                    className="pm-input"
                    min={4}
                    max={8}
                    step={0.5}
                    value={pl.breakThresholdHours}
                    onChange={e => updatePlanning({ breakThresholdHours: Number(e.target.value) })}
                  />
                  <span className="pm-hint">Légal : pause obligatoire après 6h</span>
                </div>
                <div className="pm-field">
                  <label className="pm-label">Durée de la pause (minutes)</label>
                  <select
                    className="pm-input"
                    value={pl.breakDurationMinutes}
                    onChange={e => updatePlanning({ breakDurationMinutes: Number(e.target.value) })}
                  >
                    <option value={20}>20 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 heure</option>
                    <option value={90}>1h30</option>
                  </select>
                  <span className="pm-hint">Légal : 20 min minimum</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderNotificationsTab() {
    const n = config.notifications;
    return (
      <div className="pm-tab-content">
        <div className="pm-section">
          <h3 className="pm-section-title">Alertes</h3>
          <p className="pm-section-desc">Choisissez les notifications que vous souhaitez recevoir.</p>
          <div className="pm-notif-list">
            <label className="pm-notif-item">
              <input
                type="checkbox"
                className="pm-toggle"
                checked={n.conflictsEnabled}
                onChange={e => updateNotifications({ conflictsEnabled: e.target.checked })}
              />
              <span className="pm-toggle-slider" />
              <div className="pm-notif-info">
                <span className="pm-notif-title">Conflits de planning</span>
                <span className="pm-notif-desc">Alerte quand deux shifts se chevauchent ou qu&apos;un employé dépasse les heures max</span>
              </div>
            </label>

            <label className="pm-notif-item">
              <input
                type="checkbox"
                className="pm-toggle"
                checked={n.leaveRequestsEnabled}
                onChange={e => updateNotifications({ leaveRequestsEnabled: e.target.checked })}
              />
              <span className="pm-toggle-slider" />
              <div className="pm-notif-info">
                <span className="pm-notif-title">Demandes de congés</span>
                <span className="pm-notif-desc">Notification quand un employé soumet une demande de congé</span>
              </div>
            </label>

            <label className="pm-notif-item">
              <input
                type="checkbox"
                className="pm-toggle"
                checked={n.planningChangesEnabled}
                onChange={e => updateNotifications({ planningChangesEnabled: e.target.checked })}
              />
              <span className="pm-toggle-slider" />
              <div className="pm-notif-info">
                <span className="pm-notif-title">Changements de planning</span>
                <span className="pm-notif-desc">Notification quand le planning est modifié ou publié</span>
              </div>
            </label>
          </div>
        </div>

        <div className="pm-section">
          <h3 className="pm-section-title">Récapitulatif hebdomadaire</h3>
          <div className="pm-notif-list">
            <label className="pm-notif-item">
              <input
                type="checkbox"
                className="pm-toggle"
                checked={n.weeklyDigestEnabled}
                onChange={e => updateNotifications({ weeklyDigestEnabled: e.target.checked })}
              />
              <span className="pm-toggle-slider" />
              <div className="pm-notif-info">
                <span className="pm-notif-title">Récap hebdomadaire par email</span>
                <span className="pm-notif-desc">Résumé du planning de la semaine suivante</span>
              </div>
            </label>
          </div>

          {n.weeklyDigestEnabled && (
            <div className="pm-grid pm-grid--2col" style={{ marginTop: 12 }}>
              <div className="pm-field">
                <label className="pm-label">Jour d&apos;envoi</label>
                <select
                  className="pm-input"
                  value={n.weeklyDigestDay}
                  onChange={e => updateNotifications({ weeklyDigestDay: Number(e.target.value) })}
                >
                  {DIGEST_DAYS.map((day, idx) => (
                    <option key={idx} value={idx}>{day}</option>
                  ))}
                </select>
              </div>
              <div className="pm-field">
                <label className="pm-label">Email de notification</label>
                <input
                  type="email"
                  className="pm-input"
                  placeholder="titulaire@pharmacie.fr"
                  value={n.notificationEmail}
                  onChange={e => updateNotifications({ notificationEmail: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Main render ───

  return (
    <>
      <div className="pm-page">
        {/* Header */}
        <div className="pm-header">
          <div className="pm-header-top">
            <div className="pm-header-left">
              <h1 className="pm-title">Paramètres pharmacie</h1>
              <span className="pm-subtitle">
                Dernière sauvegarde : {formatLastSaved(lastSaved)}
              </span>
            </div>
            <div className="pm-header-actions">
              <button
                className="pm-btn pm-btn--outline"
                onClick={() => setShowResetConfirm(true)}
                type="button"
              >
                Réinitialiser
              </button>
              <button
                className="pm-btn pm-btn--primary"
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                type="button"
              >
                {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="pm-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`pm-tab ${activeTab === tab.id ? 'pm-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                <span className="pm-tab-icon">{tab.icon}</span>
                <span className="pm-tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="pm-content">
          {activeTab === 'pharmacie' && renderPharmacieTab()}
          {activeTab === 'horaires' && renderHorairesTab()}
          {activeTab === 'planning' && renderPlanningTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
        </div>

        {/* Unsaved changes */}
        {hasChanges && (
          <div className="pm-unsaved">
            <span className="pm-unsaved-dot" />
            <span>Modifications non sauvegardées</span>
            <button className="pm-unsaved-btn" onClick={handleSave} type="button">
              Sauvegarder
            </button>
          </div>
        )}

        {/* Reset confirm modal */}
        {showResetConfirm && (
          <div className="pm-modal-backdrop" onClick={() => setShowResetConfirm(false)}>
            <div className="pm-modal" onClick={e => e.stopPropagation()}>
              <h3 className="pm-modal-title">Réinitialiser les paramètres ?</h3>
              <p className="pm-modal-text">
                Tous les paramètres seront remis aux valeurs par défaut. Cette action est irréversible.
              </p>
              <div className="pm-modal-actions">
                <button className="pm-btn pm-btn--outline" onClick={() => setShowResetConfirm(false)} type="button">
                  Annuler
                </button>
                <button className="pm-btn pm-btn--danger" onClick={handleReset} type="button">
                  Réinitialiser
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        /* ═══════════════════════════════════════ */
        /* Paramètres Page — pm- prefix           */
        /* ═══════════════════════════════════════ */

        .pm-page {
          display: flex;
          flex-direction: column;
          gap: 0;
          max-width: 900px;
        }

        /* Header */
        .pm-header {
          background: white;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-neutral-200);
          overflow: hidden;
        }

        .pm-header-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px 12px;
        }

        .pm-header-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .pm-title {
          font-size: 20px;
          font-weight: 700;
          margin: 0;
          color: var(--color-neutral-900);
        }

        .pm-subtitle {
          font-size: 12px;
          color: var(--color-neutral-400);
        }

        .pm-header-actions {
          display: flex;
          gap: 8px;
        }

        /* Buttons */
        .pm-btn {
          padding: 8px 16px;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .pm-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pm-btn--primary {
          background: var(--color-primary-600);
          color: white;
        }

        .pm-btn--primary:hover:not(:disabled) {
          background: var(--color-primary-700);
        }

        .pm-btn--outline {
          background: white;
          color: var(--color-neutral-600);
          border: 1px solid var(--color-neutral-300);
        }

        .pm-btn--outline:hover {
          background: var(--color-neutral-50);
          border-color: var(--color-neutral-400);
        }

        .pm-btn--danger {
          background: #ef4444;
          color: white;
        }

        .pm-btn--danger:hover {
          background: #dc2626;
        }

        /* Tabs */
        .pm-tabs {
          display: flex;
          gap: 0;
          border-top: 1px solid var(--color-neutral-100);
          padding: 0 16px;
        }

        .pm-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 16px;
          border: none;
          background: none;
          font-family: var(--font-family-primary);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-500);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .pm-tab:hover {
          color: var(--color-neutral-700);
          background: var(--color-neutral-50);
        }

        .pm-tab--active {
          color: var(--color-primary-700);
          border-bottom-color: var(--color-primary-600);
        }

        .pm-tab-icon {
          font-size: 15px;
        }

        /* Content */
        .pm-content {
          margin-top: 16px;
        }

        .pm-tab-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Sections */
        .pm-section {
          background: white;
          border-radius: var(--radius-lg);
          border: 1px solid var(--color-neutral-200);
          padding: 20px 24px;
        }

        .pm-section-title {
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 4px;
          color: var(--color-neutral-900);
        }

        .pm-section-desc {
          font-size: 12px;
          color: var(--color-neutral-400);
          margin: 0 0 16px;
        }

        /* Grid layout */
        .pm-grid {
          display: grid;
          gap: 14px;
        }

        .pm-grid--2col {
          grid-template-columns: 1fr 1fr;
        }

        .pm-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .pm-field--full {
          grid-column: 1 / -1;
        }

        .pm-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-600);
        }

        .pm-input {
          padding: 8px 12px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 13px;
          color: var(--color-neutral-800);
          background: white;
          transition: border-color 0.15s;
        }

        .pm-input:focus {
          outline: none;
          border-color: var(--color-primary-400);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.1);
        }

        .pm-hint {
          font-size: 11px;
          color: var(--color-neutral-400);
          margin-top: 2px;
        }

        /* Days grid (horaires) */
        .pm-days-grid {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .pm-day-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: var(--radius-md);
          background: var(--color-neutral-50);
          transition: background 0.15s;
        }

        .pm-day-row--closed {
          opacity: 0.6;
        }

        .pm-day-name {
          min-width: 150px;
        }

        .pm-day-text {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-700);
        }

        .pm-day-times {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pm-time-input {
          padding: 5px 8px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-sm);
          font-family: var(--font-family-primary);
          font-size: 13px;
          color: var(--color-neutral-800);
          width: 110px;
        }

        .pm-time-input:focus {
          outline: none;
          border-color: var(--color-primary-400);
        }

        .pm-time-sep {
          color: var(--color-neutral-400);
          font-size: 14px;
        }

        .pm-closed-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-neutral-400);
          font-style: italic;
        }

        /* Toggle switch */
        .pm-toggle-label {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-size: 13px;
          color: var(--color-neutral-700);
        }

        .pm-toggle {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .pm-toggle-slider {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
          background: var(--color-neutral-300);
          border-radius: 10px;
          transition: background 0.2s;
          flex-shrink: 0;
        }

        .pm-toggle-slider::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }

        .pm-toggle:checked + .pm-toggle-slider {
          background: var(--color-primary-500);
        }

        .pm-toggle:checked + .pm-toggle-slider::after {
          transform: translateX(16px);
        }

        /* Notifications */
        .pm-notif-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pm-notif-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--radius-md);
          background: var(--color-neutral-50);
          cursor: pointer;
          transition: background 0.15s;
        }

        .pm-notif-item:hover {
          background: var(--color-neutral-100);
        }

        .pm-notif-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .pm-notif-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-800);
        }

        .pm-notif-desc {
          font-size: 11px;
          color: var(--color-neutral-400);
          line-height: 1.4;
        }

        /* Unsaved changes bar */
        .pm-unsaved {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          background: var(--color-neutral-900);
          color: white;
          border-radius: var(--radius-lg);
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
          font-size: 13px;
          font-weight: 500;
          z-index: 100;
          animation: pmSlideUp 0.3s ease;
        }

        @keyframes pmSlideUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }

        .pm-unsaved-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #f59e0b;
          animation: pmPulse 1.5s ease infinite;
        }

        @keyframes pmPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .pm-unsaved-btn {
          padding: 4px 12px;
          border-radius: var(--radius-sm);
          background: var(--color-primary-500);
          color: white;
          border: none;
          font-family: var(--font-family-primary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }

        .pm-unsaved-btn:hover {
          background: var(--color-primary-400);
        }

        /* Modal */
        .pm-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
        }

        .pm-modal {
          background: white;
          border-radius: var(--radius-lg);
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 8px 40px rgba(0,0,0,0.2);
        }

        .pm-modal-title {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 8px;
          color: var(--color-neutral-900);
        }

        .pm-modal-text {
          font-size: 13px;
          color: var(--color-neutral-500);
          margin: 0 0 20px;
          line-height: 1.5;
        }

        .pm-modal-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .pm-header-top {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .pm-tabs {
            overflow-x: auto;
          }

          .pm-grid--2col {
            grid-template-columns: 1fr;
          }

          .pm-day-row {
            flex-direction: column;
            align-items: stretch;
            gap: 8px;
          }

          .pm-day-times {
            padding-left: 46px;
          }
        }
      `}</style>
    </>
  );
}
