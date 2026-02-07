import type { WizardConfig, RoleConfig } from './types';

export function validateStep1(config: WizardConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.startDate) {
    errors.push('La date de début est requise');
  }

  if (!config.endDate) {
    errors.push('La date de fin est requise');
  }

  if (config.startDate && config.endDate) {
    const start = new Date(config.startDate + 'T00:00:00');
    const end = new Date(config.endDate + 'T00:00:00');

    if (end < start) {
      errors.push('La date de fin doit être après la date de début');
    }

    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      errors.push('La période ne peut pas dépasser 90 jours');
    }
  }

  if (!config.activeDays.some(d => d)) {
    errors.push('Au moins un jour doit être sélectionné');
  }

  return { valid: errors.length === 0, errors };
}

export function validateStep2(config: WizardConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.shifts.length === 0) {
    errors.push('Au moins un créneau doit être défini');
  }

  config.shifts.forEach((shift, index) => {
    if (!shift.name.trim()) {
      errors.push(`Créneau ${index + 1} : Le nom est requis`);
    }

    if (!shift.startTime || !shift.endTime) {
      errors.push(`Créneau ${index + 1} : Les heures sont requises`);
    }

    if (shift.startTime && shift.endTime) {
      const [startH, startM] = shift.startTime.split(':').map(Number);
      const [endH, endM] = shift.endTime.split(':').map(Number);
      const start = startH + startM / 60;
      const end = endH + endM / 60;

      if (end <= start) {
        errors.push(`Créneau ${index + 1} : L'heure de fin doit être après l'heure de début`);
      }
    }

    // Au moins 1 pharmacien obligatoire
    if (shift.roles.Pharmacien.min < 1) {
      errors.push(`Créneau ${index + 1} : Au moins 1 pharmacien est obligatoire`);
    }

    // Cohérence min/max
    (Object.entries(shift.roles) as [string, RoleConfig][]).forEach(([role, cfg]) => {
      if (cfg.min > cfg.max) {
        errors.push(`Créneau ${index + 1} - ${role} : Le minimum ne peut pas être supérieur au maximum`);
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

export function validateStep3(config: WizardConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const constraints = Object.values(config.employeeConstraints);

  if (constraints.length === 0) {
    errors.push('Aucune contrainte employé n\'a été configurée');
  }

  constraints.forEach((c) => {
    if (c.minHoursPerWeek > c.maxHoursPerWeek) {
      errors.push(`Employé : les heures minimum (${c.minHoursPerWeek}h) dépassent le maximum (${c.maxHoursPerWeek}h)`);
    }

    if (c.maxHoursPerWeek > 48) {
      errors.push(`Employé : le maximum (${c.maxHoursPerWeek}h) dépasse le plafond légal de 48h`);
    }

    if (c.restDays.length >= 7) {
      errors.push('Un employé a tous les jours en repos — il ne pourra pas être planifié');
    }
  });

  return { valid: errors.length === 0, errors };
}

export function calculateShiftHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const hours = (endH + endM / 60) - (startH + startM / 60);
  return Math.round(hours * 10) / 10;
}
