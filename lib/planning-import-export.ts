/**
 * Service Import/Export — Planning V2 Phase 6
 * Permet d'exporter/importer les horaires fixes en CSV et JSON
 */

import type { Employee } from '@/lib/types';
import type { HoraireFixes } from '@/lib/types/horaires-fixes';

const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/**
 * Export les horaires fixes en CSV
 */
export function exportPlanningToCSV(
  horairesFixes: HoraireFixes[],
  employees: Employee[],
): string {
  const empMap = new Map(employees.map(e => [e.id, e]));

  const headers = [
    'Employé',
    'Prénom',
    'Nom',
    'Catégorie',
    'Jour',
    'Jour (num)',
    'Début',
    'Fin',
    'Pause (min)',
    'Durée nette (h)',
    'Type',
    'Label',
    'Semaines alternées',
    'Actif',
  ];

  const rows: string[][] = [];

  for (const hf of horairesFixes) {
    const emp = empMap.get(hf.employee_id);
    const empName = emp ? `${emp.first_name} ${emp.last_name}` : hf.employee_id;
    const firstName = emp?.first_name || '';
    const lastName = emp?.last_name || '';
    const category = emp?.category || '';

    // Calculate net duration
    const [sh, sm] = hf.start_time.split(':').map(Number);
    const [eh, em] = hf.end_time.split(':').map(Number);
    const totalMinutes = (eh * 60 + em) - (sh * 60 + sm);
    const netHours = (totalMinutes - hf.break_duration) / 60;

    rows.push([
      empName,
      firstName,
      lastName,
      category,
      DAY_NAMES[hf.day_of_week] || String(hf.day_of_week),
      String(hf.day_of_week),
      hf.start_time,
      hf.end_time,
      String(hf.break_duration),
      netHours.toFixed(2),
      hf.shift_type,
      hf.label,
      hf.alternate_weeks || 'toutes',
      hf.is_active ? 'oui' : 'non',
    ]);
  }

  // Sort by employee name, then day
  rows.sort((a, b) => {
    const nameCmp = a[0].localeCompare(b[0]);
    if (nameCmp !== 0) return nameCmp;
    return Number(a[5]) - Number(b[5]);
  });

  // Build CSV string
  const escape = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const lines = [
    headers.map(escape).join(','),
    ...rows.map(row => row.map(escape).join(',')),
  ];

  // BOM for Excel UTF-8
  return '\uFEFF' + lines.join('\n');
}

/**
 * Export les horaires fixes en JSON structuré
 */
export function exportHorairesToJSON(
  horairesFixes: HoraireFixes[],
  employees: Employee[],
): string {
  const empMap = new Map(employees.map(e => [e.id, e]));

  const data = {
    export_date: new Date().toISOString(),
    version: '1.0',
    total_entries: horairesFixes.length,
    employees: [] as Array<{
      employee_id: string;
      first_name: string;
      last_name: string;
      category: string;
      contract_hours: number;
      horaires: Array<{
        day_of_week: number;
        day_name: string;
        start_time: string;
        end_time: string;
        break_duration: number;
        shift_type: string;
        label: string;
        alternate_weeks: string | null;
        is_active: boolean;
      }>;
    }>,
  };

  // Group by employee
  const byEmployee = new Map<string, HoraireFixes[]>();
  for (const hf of horairesFixes) {
    const arr = byEmployee.get(hf.employee_id) || [];
    arr.push(hf);
    byEmployee.set(hf.employee_id, arr);
  }

  for (const [empId, hfs] of byEmployee) {
    const emp = empMap.get(empId);
    data.employees.push({
      employee_id: empId,
      first_name: emp?.first_name || '',
      last_name: emp?.last_name || '',
      category: emp?.category || '',
      contract_hours: emp?.contract_hours || 0,
      horaires: hfs
        .sort((a, b) => a.day_of_week - b.day_of_week)
        .map(hf => ({
          day_of_week: hf.day_of_week,
          day_name: DAY_NAMES[hf.day_of_week] || String(hf.day_of_week),
          start_time: hf.start_time,
          end_time: hf.end_time,
          break_duration: hf.break_duration,
          shift_type: hf.shift_type,
          label: hf.label,
          alternate_weeks: hf.alternate_weeks,
          is_active: hf.is_active,
        })),
    });
  }

  // Sort employees by name
  data.employees.sort((a, b) =>
    `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
  );

  return JSON.stringify(data, null, 2);
}

/**
 * Parse un CSV d'horaires fixes importé
 * Retourne les données parsées ou une erreur
 */
export function importHorairesFromCSV(
  csvContent: string,
  employees: Employee[],
): { success: true; data: Partial<HoraireFixes>[] } | { success: false; error: string } {
  try {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      return { success: false, error: 'Le fichier CSV est vide ou ne contient que les en-têtes.' };
    }

    // Build employee lookup by name
    const empByName = new Map<string, Employee>();
    for (const emp of employees) {
      const key = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      empByName.set(key, emp);
    }

    const results: Partial<HoraireFixes>[] = [];

    // Skip header (line 0)
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (cells.length < 8) continue; // Skip malformed rows

      const empName = cells[0].toLowerCase();
      const emp = empByName.get(empName);
      if (!emp) continue; // Skip unknown employees

      const dayNum = parseInt(cells[5], 10);
      if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) continue;

      const startTime = cells[6];
      const endTime = cells[7];
      const breakDuration = parseInt(cells[8], 10) || 0;
      const shiftType = cells[10] || 'regular';
      const label = cells[11] || '';
      const altWeeks = cells[12] === 'even' ? 'even' : cells[12] === 'odd' ? 'odd' : null;

      results.push({
        employee_id: emp.id,
        day_of_week: dayNum,
        start_time: startTime,
        end_time: endTime,
        break_duration: breakDuration,
        shift_type: shiftType as HoraireFixes['shift_type'],
        label,
        alternate_weeks: altWeeks,
        is_active: true,
      });
    }

    return { success: true, data: results };
  } catch {
    return { success: false, error: 'Erreur lors du parsing du fichier CSV.' };
  }
}

/**
 * Parse une ligne CSV en tenant compte des guillemets
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());

  return result;
}

/**
 * Télécharge un fichier côté client
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 100);
}
