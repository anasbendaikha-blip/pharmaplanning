/**
 * Service Responsable Poubelle — Rotation automatique
 *
 * Assigne un employe responsable poubelle par jour via rotation modulo.
 * Supporte les overrides manuels (localStorage).
 *
 * Persistence : localStorage (cle 'pharmaplanning-poubelle')
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pharmaplanning-poubelle';

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface PoubelleOverrides {
  [date: string]: string; // date ISO -> employeeId
}

// -------------------------------------------------------
// Persistence localStorage
// -------------------------------------------------------

function loadOverrides(): PoubelleOverrides {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: PoubelleOverrides): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

// -------------------------------------------------------
// Rotation deterministe par date
// -------------------------------------------------------

/**
 * Calcule un index de jour stable a partir d'une date ISO (YYYY-MM-DD).
 * Utilise le nombre de jours depuis epoch pour une rotation deterministe.
 */
function dateToDayIndex(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  // Nombre de jours depuis 2024-01-01 (arbitraire mais stable)
  const ref = new Date('2024-01-01T00:00:00');
  return Math.floor((d.getTime() - ref.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Retourne l'employeeId du responsable poubelle pour une date donnee.
 *
 * 1. Si un override existe pour cette date, il est utilise.
 * 2. Sinon, rotation modulo sur la liste des employes actifs.
 *
 * @param date - Date ISO (YYYY-MM-DD)
 * @param activeEmployeeIds - Liste des IDs employes actifs (tries de maniere stable)
 */
export function getPoubelleResponsable(
  date: string,
  activeEmployeeIds: string[],
): string | null {
  if (activeEmployeeIds.length === 0) return null;

  // Verifier override
  const overrides = loadOverrides();
  if (overrides[date] && activeEmployeeIds.includes(overrides[date])) {
    return overrides[date];
  }

  // Rotation modulo
  const dayIdx = dateToDayIndex(date);
  const idx = ((dayIdx % activeEmployeeIds.length) + activeEmployeeIds.length) % activeEmployeeIds.length;
  return activeEmployeeIds[idx];
}

/**
 * Assignation manuelle pour une date.
 */
export function setPoubelleOverride(date: string, employeeId: string): void {
  const overrides = loadOverrides();
  overrides[date] = employeeId;
  saveOverrides(overrides);
}

/**
 * Retour a la rotation automatique pour une date.
 */
export function clearPoubelleOverride(date: string): void {
  const overrides = loadOverrides();
  delete overrides[date];
  saveOverrides(overrides);
}

// -------------------------------------------------------
// Hook React
// -------------------------------------------------------

interface UsePoubelleReturn {
  /** Map date -> employeeId responsable */
  responsables: Map<string, string>;
  /** Verifie si un employe est responsable pour une date */
  isResponsable: (employeeId: string, date: string) => boolean;
  /** Override manuel */
  setOverride: (date: string, employeeId: string) => void;
  /** Retour rotation auto */
  clearOverride: (date: string) => void;
}

/**
 * Hook pour gerer le responsable poubelle sur un ensemble de dates.
 *
 * @param dates - Tableau de dates ISO
 * @param activeEmployeeIds - IDs employes actifs (ordre stable)
 */
export function usePoubelleResponsable(
  dates: string[],
  activeEmployeeIds: string[],
): UsePoubelleReturn {
  const [version, setVersion] = useState(0);

  // Recalculer quand dates/employees changent
  const responsables = new Map<string, string>();
  for (const date of dates) {
    const resp = getPoubelleResponsable(date, activeEmployeeIds);
    if (resp) responsables.set(date, resp);
  }

  // Force re-render after override
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = version;

  const isResponsable = useCallback(
    (employeeId: string, date: string): boolean => {
      return responsables.get(date) === employeeId;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, ...dates, ...activeEmployeeIds],
  );

  const setOverride = useCallback(
    (date: string, employeeId: string) => {
      setPoubelleOverride(date, employeeId);
      setVersion(v => v + 1);
    },
    [],
  );

  const clearOverrideCb = useCallback(
    (date: string) => {
      clearPoubelleOverride(date);
      setVersion(v => v + 1);
    },
    [],
  );

  // Reload on mount (in case localStorage changed)
  useEffect(() => {
    setVersion(v => v + 1);
  }, []);

  return {
    responsables,
    isResponsable,
    setOverride,
    clearOverride: clearOverrideCb,
  };
}
