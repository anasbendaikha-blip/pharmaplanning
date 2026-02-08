/**
 * Analytics Planning V2
 * Détecte les disponibilités sous-exploitées et génère des alertes
 */

import type { Disponibilite, DispoAlert, DispoStats, Shift, Employee } from '@/lib/types';
import {
  getDisposForEmployeeDate,
  findUnusedDispos,
} from '@/lib/disponibilites-service';
import { timeToDecimal } from '@/lib/planning-config';

/**
 * Analyse complète des disponibilités pour une semaine
 */
export function analyzeWeeklyDispos(
  dispos: Disponibilite[],
  shifts: Shift[],
  employees: Employee[],
  weekDates: string[],
): DispoStats {
  const workDays = weekDates.slice(0, 6); // Lun-Sam
  const activeEmployees = employees.filter(e => e.is_active);
  const alerts: DispoAlert[] = [];

  let totalDispos = 0;
  let usedDispos = 0;
  let unusedDispos = 0;
  const employeesWithDispos = new Set<string>();
  const employeesWithoutDispos = new Set<string>();

  for (const emp of activeEmployees) {
    let empHasAnyDispo = false;

    for (const date of workDays) {
      const empDispos = getDisposForEmployeeDate(dispos, emp.id, date)
        .filter(d => d.type !== 'unavailable');

      if (empDispos.length > 0) {
        empHasAnyDispo = true;
        totalDispos += empDispos.length;

        // Check which dispos are used
        const unused = findUnusedDispos(dispos, shifts, emp.id, date);
        usedDispos += empDispos.length - unused.length;
        unusedDispos += unused.length;

        // Generate alerts for unused dispos
        for (const d of unused) {
          const durationH = timeToDecimal(d.end_time) - timeToDecimal(d.start_time);
          // Only alert if the unused slot is >= 2h
          if (durationH >= 2) {
            alerts.push({
              id: `alert-${emp.id}-${date}-${d.id}`,
              employee_id: emp.id,
              employee_name: `${emp.first_name} ${emp.last_name}`,
              category: emp.category,
              date,
              dispo_start: d.start_time,
              dispo_end: d.end_time,
              alert_type: 'unused_dispo',
              message: `${emp.first_name} ${emp.last_name} est disponible ${d.start_time}–${d.end_time} mais n'a aucun shift`,
            });
          }
        }

        // Check for partial usage
        const empShifts = shifts.filter(s =>
          s.employee_id === emp.id &&
          s.date === date &&
          (s.type === 'regular' || s.type === 'morning' || s.type === 'afternoon' || s.type === 'split')
        );

        for (const d of empDispos) {
          if (empShifts.length > 0) {
            const totalDispoHours = timeToDecimal(d.end_time) - timeToDecimal(d.start_time);
            let coveredHours = 0;

            for (const s of empShifts) {
              const overlapStart = Math.max(timeToDecimal(d.start_time), timeToDecimal(s.start_time));
              const overlapEnd = Math.min(timeToDecimal(d.end_time), timeToDecimal(s.end_time));
              coveredHours += Math.max(0, overlapEnd - overlapStart);
            }

            const usagePercent = totalDispoHours > 0 ? (coveredHours / totalDispoHours) * 100 : 0;

            // If less than 50% of the dispo is used and remaining is >= 2h
            if (usagePercent > 0 && usagePercent < 50 && (totalDispoHours - coveredHours) >= 2) {
              alerts.push({
                id: `alert-partial-${emp.id}-${date}-${d.id}`,
                employee_id: emp.id,
                employee_name: `${emp.first_name} ${emp.last_name}`,
                category: emp.category,
                date,
                dispo_start: d.start_time,
                dispo_end: d.end_time,
                alert_type: 'partial_use',
                message: `${emp.first_name} ${emp.last_name} : dispo ${d.start_time}–${d.end_time} utilisée à ${Math.round(usagePercent)}%`,
              });
            }
          }
        }
      }
    }

    if (empHasAnyDispo) {
      employeesWithDispos.add(emp.id);
    } else {
      employeesWithoutDispos.add(emp.id);
      // Only alert for missing dispos if the employee has shifts
      const empHasShifts = shifts.some(s =>
        s.employee_id === emp.id &&
        workDays.includes(s.date)
      );
      if (empHasShifts) {
        alerts.push({
          id: `alert-nodispo-${emp.id}`,
          employee_id: emp.id,
          employee_name: `${emp.first_name} ${emp.last_name}`,
          category: emp.category,
          date: workDays[0],
          dispo_start: '08:00',
          dispo_end: '19:30',
          alert_type: 'no_dispo',
          message: `${emp.first_name} ${emp.last_name} n'a aucune disponibilité déclarée cette semaine`,
        });
      }
    }
  }

  const usageRate = totalDispos > 0 ? Math.round((usedDispos / totalDispos) * 100) : 0;

  return {
    total_dispos: totalDispos,
    used_dispos: usedDispos,
    unused_dispos: unusedDispos,
    usage_rate: usageRate,
    employees_with_dispos: employeesWithDispos.size,
    employees_without_dispos: employeesWithoutDispos.size,
    alerts,
  };
}

/**
 * Filtre les alertes par type
 */
export function filterAlertsByType(
  alerts: DispoAlert[],
  type: DispoAlert['alert_type'],
): DispoAlert[] {
  return alerts.filter(a => a.alert_type === type);
}

/**
 * Trie les alertes par priorité (unused > partial > no_dispo)
 */
export function sortAlertsByPriority(alerts: DispoAlert[]): DispoAlert[] {
  const priority: Record<string, number> = {
    unused_dispo: 1,
    partial_use: 2,
    no_dispo: 3,
  };
  return [...alerts].sort((a, b) => (priority[a.alert_type] || 99) - (priority[b.alert_type] || 99));
}

/**
 * Obtient le nombre d'alertes par type
 */
export function getAlertCounts(alerts: DispoAlert[]): {
  unused: number;
  partial: number;
  noDispo: number;
  total: number;
} {
  return {
    unused: alerts.filter(a => a.alert_type === 'unused_dispo').length,
    partial: alerts.filter(a => a.alert_type === 'partial_use').length,
    noDispo: alerts.filter(a => a.alert_type === 'no_dispo').length,
    total: alerts.length,
  };
}
