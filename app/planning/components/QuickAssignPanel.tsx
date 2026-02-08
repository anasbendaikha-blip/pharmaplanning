'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Employee, Shift, Disponibilite } from '@/lib/types';
import type { QuickAssignState, ValidationResult, SuggestedSlot } from '@/lib/types/quick-assign';
import {
  timeToMinutes,
  calculateDuration,
  formatDuration,
  formatDurationLong,
  generateSlotSuggestions,
  adjustTime,
  roundToQuarter,
  slotsOverlap,
} from '@/lib/time-utils';
import { validateSlot, suggestPause } from '@/lib/slot-validation';
import {
  CATEGORY_CONFIG,
  getInitials,
  getSlotColor,
  getSlotPosition,
  formatTime,
  formatTimeRange,
  TIMELINE_START,
  TIMELINE_SPAN,
  COLORS,
} from '@/lib/planning-config';

interface QuickAssignPanelProps {
  employee: Employee;
  date: string;
  dispo: Disponibilite;
  existingShifts: Shift[];
  onConfirm: (shift: {
    employee_id: string;
    date: string;
    start_time: string;
    end_time: string;
    break_duration: number;
  }) => void;
  onClose: () => void;
}

export default function QuickAssignPanel({
  employee,
  date,
  dispo,
  existingShifts,
  onConfirm,
  onClose,
}: QuickAssignPanelProps) {
  // ═══ State ═══
  const [state, setState] = useState<QuickAssignState>(() => ({
    start_time: dispo.start_time,
    end_time: dispo.end_time,
    break_duration: 0,
    shift_type: 'regular',
    input_mode: 'suggestion',
    selected_suggestion: null,
    validation: { is_valid: true, errors: [], warnings: [] },
    show_pause_suggestion: false,
  }));

  // ═══ Derived data ═══
  const initials = getInitials(employee.first_name, employee.last_name);
  const catConfig = CATEGORY_CONFIG[employee.category];
  const slotColor = getSlotColor(employee.category);

  // Date display
  const dateLabel = useMemo(() => {
    const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    const [y, m, d] = date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${DAY_NAMES[dt.getDay()]} ${d} ${MONTH_NAMES[m - 1]} ${y}`;
  }, [date]);

  // Dispo duration
  const dispoDuration = useMemo(() =>
    calculateDuration(dispo.start_time, dispo.end_time), [dispo]);

  // Suggestions
  const suggestions = useMemo<SuggestedSlot[]>(() => {
    const raw = generateSlotSuggestions(dispo.start_time, dispo.end_time);
    return raw.map(s => {
      // Check if the suggestion overlaps existing shifts
      const workShifts = existingShifts.filter(sh =>
        sh.type === 'regular' || sh.type === 'morning' || sh.type === 'afternoon' || sh.type === 'split'
      );
      const hasOverlap = workShifts.some(sh =>
        slotsOverlap(s.start_time, s.end_time, sh.start_time, sh.end_time)
      );
      return {
        ...s,
        is_valid: !hasOverlap,
        invalid_reason: hasOverlap ? 'Chevauchement avec un shift existant' : undefined,
      };
    });
  }, [dispo, existingShifts]);

  // Validation (live)
  const validation = useMemo<ValidationResult>(() => {
    return validateSlot(
      state.start_time,
      state.end_time,
      dispo.start_time,
      dispo.end_time,
      existingShifts,
      state.break_duration,
    );
  }, [state.start_time, state.end_time, state.break_duration, dispo, existingShifts]);

  // Pause suggestion
  const pauseSuggestion = useMemo(() => {
    return suggestPause(state.start_time, state.end_time);
  }, [state.start_time, state.end_time]);

  // Duration of current slot
  const slotDuration = useMemo(() =>
    calculateDuration(state.start_time, state.end_time), [state.start_time, state.end_time]);

  const effectiveDuration = slotDuration - state.break_duration;

  // ═══ Handlers ═══

  const handleSelectSuggestion = useCallback((suggestion: SuggestedSlot) => {
    if (!suggestion.is_valid) return;
    setState(prev => ({
      ...prev,
      start_time: suggestion.start_time,
      end_time: suggestion.end_time,
      selected_suggestion: suggestion.id,
      input_mode: 'suggestion',
      break_duration: 0,
      show_pause_suggestion: false,
    }));
  }, []);

  const handleAdjustStart = useCallback((delta: number) => {
    setState(prev => {
      const newStart = roundToQuarter(adjustTime(prev.start_time, delta));
      return { ...prev, start_time: newStart, selected_suggestion: null, input_mode: 'manual' };
    });
  }, []);

  const handleAdjustEnd = useCallback((delta: number) => {
    setState(prev => {
      const newEnd = roundToQuarter(adjustTime(prev.end_time, delta));
      return { ...prev, end_time: newEnd, selected_suggestion: null, input_mode: 'manual' };
    });
  }, []);

  const handleAdjustBoth = useCallback((delta: number) => {
    setState(prev => {
      const newStart = roundToQuarter(adjustTime(prev.start_time, delta));
      const newEnd = roundToQuarter(adjustTime(prev.end_time, delta));
      return { ...prev, start_time: newStart, end_time: newEnd, selected_suggestion: null, input_mode: 'manual' };
    });
  }, []);

  const handleSplit = useCallback(() => {
    // Split in half — set end to midpoint
    setState(prev => {
      const startMin = timeToMinutes(prev.start_time);
      const endMin = timeToMinutes(prev.end_time);
      const mid = Math.round((startMin + endMin) / 2 / 15) * 15;
      const midTime = roundToQuarter(adjustTime('00:00', mid));
      return { ...prev, end_time: midTime, selected_suggestion: null, input_mode: 'manual' };
    });
  }, []);

  const handleAcceptPause = useCallback(() => {
    if (pauseSuggestion.shouldSuggest) {
      setState(prev => ({
        ...prev,
        break_duration: pauseSuggestion.breakDuration,
        show_pause_suggestion: false,
      }));
    }
  }, [pauseSuggestion]);

  const handleRejectPause = useCallback(() => {
    setState(prev => ({ ...prev, show_pause_suggestion: false }));
  }, []);

  const handleTogglePauseSuggestion = useCallback(() => {
    setState(prev => ({ ...prev, show_pause_suggestion: !prev.show_pause_suggestion }));
  }, []);

  const handleBreakChange = useCallback((value: number) => {
    setState(prev => ({ ...prev, break_duration: Math.max(0, Math.min(120, value)) }));
  }, []);

  const handleConfirm = useCallback(() => {
    if (!validation.is_valid) return;
    onConfirm({
      employee_id: employee.id,
      date,
      start_time: state.start_time,
      end_time: state.end_time,
      break_duration: state.break_duration,
    });
  }, [validation.is_valid, onConfirm, employee.id, date, state]);

  // ═══ Keyboard shortcuts ═══
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey && validation.is_valid) {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleConfirm, validation.is_valid]);

  // Show pause suggestion when slot ≥ 6h and no break
  useEffect(() => {
    if (slotDuration >= 360 && state.break_duration === 0 && pauseSuggestion.shouldSuggest) {
      setState(prev => ({ ...prev, show_pause_suggestion: true }));
    }
  }, [slotDuration, state.break_duration, pauseSuggestion.shouldSuggest]);

  // ═══ Preview bar position ═══
  const previewPos = useMemo(() => {
    return getSlotPosition(state.start_time, state.end_time);
  }, [state.start_time, state.end_time]);

  // Existing shifts bar positions
  const existingShiftPositions = useMemo(() => {
    return existingShifts
      .filter(s => s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split')
      .map(s => ({
        id: s.id,
        pos: getSlotPosition(s.start_time, s.end_time),
        label: formatTimeRange(s.start_time, s.end_time),
      }));
  }, [existingShifts]);

  // Dispo bar position
  const dispoPos = useMemo(() => getSlotPosition(dispo.start_time, dispo.end_time), [dispo]);

  return (
    <>
      {/* Backdrop */}
      <div className="qa-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="qa-panel">
        {/* ═══ Header ═══ */}
        <div className="qa-header">
          <div className="qa-header-top">
            <div className="qa-header-avatar" style={{ background: slotColor }}>
              {initials}
            </div>
            <div className="qa-header-info">
              <h3 className="qa-header-name">{employee.first_name} {employee.last_name}</h3>
              <span className="qa-header-role">
                {catConfig.icon} {catConfig.label}
              </span>
            </div>
            <button className="qa-close-btn" onClick={onClose} type="button" title="Fermer (Escape)">
              ✕
            </button>
          </div>
          <div className="qa-header-meta">
            <span className="qa-meta-date">{dateLabel}</span>
            <span className="qa-meta-dispo">
              Disponible {formatTimeRange(dispo.start_time, dispo.end_time)} ({formatDuration(dispoDuration)})
            </span>
          </div>
        </div>

        {/* ═══ Preview Timeline ═══ */}
        <div className="qa-preview">
          <div className="qa-preview-label">Aperçu</div>
          <div className="qa-preview-timeline">
            {/* Dispo background */}
            <div
              className="qa-preview-dispo"
              style={{
                left: `${dispoPos.left}%`,
                width: `${dispoPos.width}%`,
              }}
            />

            {/* Existing shifts (gray) */}
            {existingShiftPositions.map(es => (
              <div
                key={es.id}
                className="qa-preview-existing"
                style={{
                  left: `${es.pos.left}%`,
                  width: `${es.pos.width}%`,
                }}
                title={`Existant: ${es.label}`}
              />
            ))}

            {/* New slot preview (colored) */}
            {slotDuration > 0 && (
              <div
                className="qa-preview-new"
                style={{
                  left: `${previewPos.left}%`,
                  width: `${previewPos.width}%`,
                  backgroundColor: validation.is_valid ? slotColor : '#ef4444',
                }}
              >
                <span className="qa-preview-new-label">
                  {formatTimeRange(state.start_time, state.end_time)}
                </span>
              </div>
            )}

            {/* Time ticks */}
            {[8, 10, 12, 14, 16, 18, 20, 22].map(h => {
              const pct = ((h - TIMELINE_START) / TIMELINE_SPAN) * 100;
              return (
                <div key={h} className="qa-preview-tick" style={{ left: `${pct}%` }}>
                  <span className="qa-preview-tick-label">{h}h</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ Suggestions ═══ */}
        {suggestions.length > 0 && (
          <div className="qa-section">
            <div className="qa-section-title">Suggestions rapides</div>
            <div className="qa-suggestions">
              {suggestions.map(s => (
                <button
                  key={s.id}
                  className={`qa-suggestion ${state.selected_suggestion === s.id ? 'qa-suggestion--active' : ''} ${!s.is_valid ? 'qa-suggestion--disabled' : ''}`}
                  onClick={() => handleSelectSuggestion(s)}
                  type="button"
                  disabled={!s.is_valid}
                  title={s.is_valid ? `${s.label}: ${formatTimeRange(s.start_time, s.end_time)}` : s.invalid_reason}
                >
                  <span className="qa-suggestion-icon">{s.icon}</span>
                  <span className="qa-suggestion-label">{s.label}</span>
                  <span className="qa-suggestion-time">
                    {formatTimeRange(s.start_time, s.end_time)}
                  </span>
                  <span className="qa-suggestion-duration">{formatDuration(s.duration_minutes)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Time Controls ═══ */}
        <div className="qa-section">
          <div className="qa-section-title">Horaires</div>

          <div className="qa-time-controls">
            {/* Start time */}
            <div className="qa-time-group">
              <label className="qa-time-label">Début</label>
              <div className="qa-time-row">
                <button className="qa-time-btn" onClick={() => handleAdjustStart(-30)} type="button" title="-30 min">-30</button>
                <button className="qa-time-btn qa-time-btn--sm" onClick={() => handleAdjustStart(-15)} type="button" title="-15 min">-15</button>
                <span className="qa-time-value">{formatTime(state.start_time)}</span>
                <button className="qa-time-btn qa-time-btn--sm" onClick={() => handleAdjustStart(15)} type="button" title="+15 min">+15</button>
                <button className="qa-time-btn" onClick={() => handleAdjustStart(30)} type="button" title="+30 min">+30</button>
              </div>
            </div>

            {/* End time */}
            <div className="qa-time-group">
              <label className="qa-time-label">Fin</label>
              <div className="qa-time-row">
                <button className="qa-time-btn" onClick={() => handleAdjustEnd(-30)} type="button" title="-30 min">-30</button>
                <button className="qa-time-btn qa-time-btn--sm" onClick={() => handleAdjustEnd(-15)} type="button" title="-15 min">-15</button>
                <span className="qa-time-value">{formatTime(state.end_time)}</span>
                <button className="qa-time-btn qa-time-btn--sm" onClick={() => handleAdjustEnd(15)} type="button" title="+15 min">+15</button>
                <button className="qa-time-btn" onClick={() => handleAdjustEnd(30)} type="button" title="+30 min">+30</button>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="qa-quick-actions">
            <button className="qa-quick-btn" onClick={() => handleAdjustBoth(-30)} type="button" title="Décaler tout -30min">
              ⬅️ -30min
            </button>
            <button className="qa-quick-btn" onClick={() => handleAdjustBoth(30)} type="button" title="Décaler tout +30min">
              ➡️ +30min
            </button>
            <button className="qa-quick-btn" onClick={handleSplit} type="button" title="Couper en deux">
              ✂️ Couper
            </button>
          </div>
        </div>

        {/* ═══ Pause ═══ */}
        <div className="qa-section">
          <div className="qa-section-title">
            Pause
            {pauseSuggestion.shouldSuggest && state.break_duration === 0 && (
              <button className="qa-pause-hint-btn" onClick={handleTogglePauseSuggestion} type="button">
                ☕ Suggestion
              </button>
            )}
          </div>

          {/* Pause suggestion */}
          {state.show_pause_suggestion && pauseSuggestion.shouldSuggest && (
            <div className="qa-pause-suggestion">
              <div className="qa-pause-suggestion-text">
                ☕ Créneau de {formatDuration(slotDuration)} — pause de {pauseSuggestion.breakDuration} min recommandée
                <br />
                <span className="qa-pause-suggestion-time">
                  Suggestion : {formatTimeRange(pauseSuggestion.breakStart, pauseSuggestion.breakEnd)}
                </span>
              </div>
              <div className="qa-pause-suggestion-actions">
                <button className="qa-pause-accept" onClick={handleAcceptPause} type="button">
                  ✓ Accepter
                </button>
                <button className="qa-pause-reject" onClick={handleRejectPause} type="button">
                  ✗ Ignorer
                </button>
              </div>
            </div>
          )}

          <div className="qa-break-row">
            <label className="qa-time-label">Durée pause</label>
            <div className="qa-break-controls">
              <button className="qa-time-btn qa-time-btn--sm" onClick={() => handleBreakChange(state.break_duration - 15)} type="button" disabled={state.break_duration <= 0}>-15</button>
              <span className="qa-break-value">{state.break_duration} min</span>
              <button className="qa-time-btn qa-time-btn--sm" onClick={() => handleBreakChange(state.break_duration + 15)} type="button" disabled={state.break_duration >= 120}>+15</button>
            </div>
          </div>
        </div>

        {/* ═══ Validation Messages ═══ */}
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="qa-validation">
            {validation.errors.map(err => (
              <div key={err.code} className="qa-validation-item qa-validation-item--error">
                <span className="qa-validation-icon">{err.icon}</span>
                <span className="qa-validation-msg">{err.message}</span>
              </div>
            ))}
            {validation.warnings.map(warn => (
              <div key={warn.code} className="qa-validation-item qa-validation-item--warning">
                <span className="qa-validation-icon">{warn.icon}</span>
                <span className="qa-validation-msg">{warn.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* ═══ Summary & Confirm ═══ */}
        <div className="qa-footer">
          <div className="qa-summary">
            <div className="qa-summary-row">
              <span className="qa-summary-label">Créneau</span>
              <span className="qa-summary-value">{formatTimeRange(state.start_time, state.end_time)}</span>
            </div>
            <div className="qa-summary-row">
              <span className="qa-summary-label">Durée brute</span>
              <span className="qa-summary-value">{formatDuration(slotDuration)}</span>
            </div>
            {state.break_duration > 0 && (
              <div className="qa-summary-row">
                <span className="qa-summary-label">Pause</span>
                <span className="qa-summary-value">-{state.break_duration} min</span>
              </div>
            )}
            <div className="qa-summary-row qa-summary-row--total">
              <span className="qa-summary-label">Durée effective</span>
              <span className="qa-summary-value">{formatDuration(Math.max(0, effectiveDuration))}</span>
            </div>
          </div>

          <div className="qa-actions">
            <button className="qa-btn-cancel" onClick={onClose} type="button">
              Annuler
            </button>
            <button
              className="qa-btn-confirm"
              onClick={handleConfirm}
              type="button"
              disabled={!validation.is_valid}
              title={validation.is_valid ? 'Créer le shift (Entrée)' : 'Corrigez les erreurs'}
            >
              Créer le shift
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* ═══════════════════════════════════════════════ */
        /* QuickAssignPanel — Slide-in panel from right   */
        /* ═══════════════════════════════════════════════ */

        .qa-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 100;
          animation: qa-fade-in 0.2s ease;
        }

        @keyframes qa-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .qa-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 420px;
          max-width: 100vw;
          background: white;
          z-index: 101;
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
          animation: qa-slide-in 0.25s ease;
          overflow-y: auto;
        }

        @keyframes qa-slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        /* ─── Header ─── */
        .qa-header {
          flex-shrink: 0;
          padding: 20px 20px 12px;
          border-bottom: 1px solid var(--color-neutral-200);
          background: var(--color-neutral-50);
        }

        .qa-header-top {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .qa-header-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 15px;
          letter-spacing: 0.02em;
          flex-shrink: 0;
        }

        .qa-header-info {
          flex: 1;
          min-width: 0;
        }

        .qa-header-name {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: var(--color-neutral-900);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .qa-header-role {
          font-size: 12px;
          color: var(--color-neutral-500);
          font-weight: 500;
        }

        .qa-close-btn {
          width: 32px;
          height: 32px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          background: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          color: var(--color-neutral-500);
          transition: all 0.15s;
          flex-shrink: 0;
        }

        .qa-close-btn:hover {
          background: var(--color-neutral-100);
          color: var(--color-neutral-700);
        }

        .qa-header-meta {
          margin-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .qa-meta-date {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-700);
        }

        .qa-meta-dispo {
          font-size: 12px;
          color: #16a34a;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* ─── Preview ─── */
        .qa-preview {
          padding: 12px 20px;
          border-bottom: 1px solid var(--color-neutral-100);
        }

        .qa-preview-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-neutral-400);
          margin-bottom: 6px;
        }

        .qa-preview-timeline {
          position: relative;
          height: 36px;
          background: var(--color-neutral-100);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .qa-preview-dispo {
          position: absolute;
          top: 0;
          bottom: 0;
          background: ${COLORS.dispoAvailable};
          border-left: 1px solid ${COLORS.dispoBorder};
          border-right: 1px solid ${COLORS.dispoBorder};
        }

        .qa-preview-existing {
          position: absolute;
          top: 4px;
          bottom: 4px;
          background: var(--color-neutral-400);
          border-radius: 3px;
          opacity: 0.5;
          z-index: 1;
        }

        .qa-preview-new {
          position: absolute;
          top: 4px;
          bottom: 4px;
          border-radius: 4px;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
        }

        .qa-preview-new-label {
          font-size: 10px;
          font-weight: 700;
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          white-space: nowrap;
        }

        .qa-preview-tick {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 0;
          border-left: 1px solid var(--color-neutral-200);
        }

        .qa-preview-tick-label {
          position: absolute;
          bottom: 2px;
          left: 2px;
          font-size: 8px;
          font-weight: 600;
          color: var(--color-neutral-400);
          white-space: nowrap;
        }

        /* ─── Sections ─── */
        .qa-section {
          padding: 14px 20px;
          border-bottom: 1px solid var(--color-neutral-100);
        }

        .qa-section-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--color-neutral-500);
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* ─── Suggestions ─── */
        .qa-suggestions {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .qa-suggestion {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: var(--color-neutral-50);
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          cursor: pointer;
          font-family: var(--font-family-primary);
          transition: all 0.15s;
          text-align: left;
        }

        .qa-suggestion:hover:not(.qa-suggestion--disabled) {
          background: var(--color-primary-50);
          border-color: var(--color-primary-300);
        }

        .qa-suggestion--active {
          background: var(--color-primary-50) !important;
          border-color: var(--color-primary-400) !important;
          box-shadow: 0 0 0 1px var(--color-primary-200);
        }

        .qa-suggestion--disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .qa-suggestion-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .qa-suggestion-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-800);
          flex: 1;
        }

        .qa-suggestion-time {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-neutral-500);
        }

        .qa-suggestion-duration {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-primary-600);
          background: var(--color-primary-50);
          padding: 2px 8px;
          border-radius: var(--radius-full);
        }

        /* ─── Time Controls ─── */
        .qa-time-controls {
          display: flex;
          gap: 16px;
        }

        .qa-time-group {
          flex: 1;
        }

        .qa-time-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-neutral-500);
          display: block;
          margin-bottom: 6px;
        }

        .qa-time-row {
          display: flex;
          align-items: center;
          gap: 4px;
          justify-content: center;
        }

        .qa-time-btn {
          width: 36px;
          height: 32px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          background: white;
          cursor: pointer;
          font-family: var(--font-family-primary);
          font-size: 11px;
          font-weight: 600;
          color: var(--color-neutral-600);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .qa-time-btn:hover:not(:disabled) {
          background: var(--color-neutral-100);
          border-color: var(--color-neutral-400);
        }

        .qa-time-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .qa-time-btn--sm {
          width: 30px;
          font-size: 10px;
        }

        .qa-time-value {
          font-size: 16px;
          font-weight: 700;
          color: var(--color-neutral-900);
          min-width: 52px;
          text-align: center;
          font-variant-numeric: tabular-nums;
        }

        /* ─── Quick Actions ─── */
        .qa-quick-actions {
          display: flex;
          gap: 6px;
          margin-top: 10px;
        }

        .qa-quick-btn {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid var(--color-neutral-200);
          border-radius: var(--radius-md);
          background: var(--color-neutral-50);
          cursor: pointer;
          font-family: var(--font-family-primary);
          font-size: 11px;
          font-weight: 600;
          color: var(--color-neutral-600);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.15s;
        }

        .qa-quick-btn:hover {
          background: var(--color-neutral-100);
          border-color: var(--color-neutral-300);
        }

        /* ─── Pause ─── */
        .qa-pause-hint-btn {
          font-size: 11px;
          font-weight: 500;
          color: #b45309;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: var(--radius-full);
          padding: 2px 10px;
          cursor: pointer;
          font-family: var(--font-family-primary);
          transition: all 0.15s;
        }

        .qa-pause-hint-btn:hover {
          background: rgba(245, 158, 11, 0.2);
        }

        .qa-pause-suggestion {
          padding: 10px 12px;
          background: rgba(245, 158, 11, 0.06);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: var(--radius-md);
          margin-bottom: 10px;
        }

        .qa-pause-suggestion-text {
          font-size: 12px;
          color: #92400e;
          line-height: 1.5;
        }

        .qa-pause-suggestion-time {
          font-weight: 600;
          color: #78350f;
        }

        .qa-pause-suggestion-actions {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .qa-pause-accept,
        .qa-pause-reject {
          padding: 4px 14px;
          border-radius: var(--radius-md);
          font-family: var(--font-family-primary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          border: none;
        }

        .qa-pause-accept {
          background: #16a34a;
          color: white;
        }

        .qa-pause-accept:hover {
          background: #15803d;
        }

        .qa-pause-reject {
          background: var(--color-neutral-200);
          color: var(--color-neutral-600);
        }

        .qa-pause-reject:hover {
          background: var(--color-neutral-300);
        }

        .qa-break-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .qa-break-controls {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .qa-break-value {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-neutral-800);
          min-width: 50px;
          text-align: center;
          font-variant-numeric: tabular-nums;
        }

        /* ─── Validation ─── */
        .qa-validation {
          padding: 10px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .qa-validation-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 6px 10px;
          border-radius: var(--radius-sm);
          font-size: 12px;
          line-height: 1.4;
        }

        .qa-validation-item--error {
          background: var(--color-danger-50);
          color: var(--color-danger-700);
        }

        .qa-validation-item--warning {
          background: var(--color-warning-50);
          color: var(--color-warning-700);
        }

        .qa-validation-icon {
          flex-shrink: 0;
          font-size: 12px;
        }

        .qa-validation-msg {
          font-weight: 500;
        }

        /* ─── Footer ─── */
        .qa-footer {
          margin-top: auto;
          flex-shrink: 0;
          border-top: 2px solid var(--color-neutral-200);
          background: var(--color-neutral-50);
        }

        .qa-summary {
          padding: 14px 20px 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .qa-summary-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: var(--color-neutral-600);
        }

        .qa-summary-label { font-weight: 500; }

        .qa-summary-value {
          font-weight: 600;
          color: var(--color-neutral-800);
          font-variant-numeric: tabular-nums;
        }

        .qa-summary-row--total {
          border-top: 1px solid var(--color-neutral-200);
          padding-top: 6px;
          margin-top: 4px;
          font-size: 13px;
        }

        .qa-summary-row--total .qa-summary-label {
          font-weight: 700;
          color: var(--color-neutral-800);
        }

        .qa-summary-row--total .qa-summary-value {
          font-weight: 700;
          color: var(--color-primary-600);
        }

        .qa-actions {
          display: flex;
          gap: 10px;
          padding: 10px 20px 20px;
        }

        .qa-btn-cancel {
          flex: 1;
          padding: 10px 16px;
          border: 1px solid var(--color-neutral-300);
          border-radius: var(--radius-md);
          background: white;
          cursor: pointer;
          font-family: var(--font-family-primary);
          font-size: 13px;
          font-weight: 600;
          color: var(--color-neutral-600);
          transition: all 0.15s;
        }

        .qa-btn-cancel:hover {
          background: var(--color-neutral-100);
        }

        .qa-btn-confirm {
          flex: 2;
          padding: 10px 16px;
          border: none;
          border-radius: var(--radius-md);
          background: var(--color-primary-600);
          cursor: pointer;
          font-family: var(--font-family-primary);
          font-size: 13px;
          font-weight: 700;
          color: white;
          transition: all 0.15s;
          box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);
        }

        .qa-btn-confirm:hover:not(:disabled) {
          background: var(--color-primary-700);
          box-shadow: 0 3px 10px rgba(99, 102, 241, 0.4);
        }

        .qa-btn-confirm:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* ─── Responsive ─── */
        @media (max-width: 480px) {
          .qa-panel {
            width: 100vw;
          }

          .qa-time-controls {
            flex-direction: column;
            gap: 10px;
          }
        }

        /* ─── Print ─── */
        @media print {
          .qa-backdrop,
          .qa-panel {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
