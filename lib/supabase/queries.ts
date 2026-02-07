/**
 * Supabase Queries — Couche d'accès aux données multi-tenant
 * Toutes les requêtes passent par les API Routes Next.js (qui utilisent service_role)
 * pour contourner le RLS en mode développement.
 *
 * Schéma DB (nouveau projet) :
 *   organizations: id, name, slug, logo_url, primary_color, settings, subscription_plan, created_at, updated_at
 *   employees:     id, organization_id, name, first_name, last_name, initials, role, contract_hours, availability, preferences, status, created_at, updated_at
 *   shifts:        id, organization_id, employee_id, date, start_time, end_time, hours, type, validated, notes, conflicts, created_at, updated_at
 *   leave_requests: id, organization_id, employee_id, start_date, end_date, type, status, business_days, ...
 */

import type { Employee, Shift, EmployeeCategory, EmployeeRole } from '@/lib/types';
import { calculateEffectiveHours } from '@/lib/utils/hourUtils';

// ─── Types DB (nouveau schéma) ───

interface DbEmployee {
  id: string;
  organization_id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  initials: string | null;
  role: string;
  contract_hours: number;
  availability: Record<string, unknown>;
  preferences: Record<string, unknown>;
  status: string;
  created_at: string;
  updated_at: string;
}

interface DbShift {
  id: string;
  organization_id: string;
  employee_id: string;
  date: string;
  start_time: string;
  end_time: string;
  hours: number;
  type: string;
  validated: boolean;
  notes: string | null;
  conflicts: unknown[];
  created_at: string;
  updated_at: string;
}

// ─── Mappers DB ↔ App ───

/**
 * Mapping des rôles DB → catégorie/role TypeScript
 * Pour Pharmacien, on utilise le nom de famille pour distinguer titulaire/adjoint
 */
const TITULAIRE_NAMES = ['MAURER', 'WEBER'];

function mapDbRole(dbRole: string, lastName: string | null): { category: EmployeeCategory; role: EmployeeRole } {
  switch (dbRole) {
    case 'Pharmacien':
      if (lastName && TITULAIRE_NAMES.includes(lastName.toUpperCase())) {
        return { category: 'pharmacien_titulaire', role: 'titulaire' };
      }
      return { category: 'pharmacien_adjoint', role: 'adjoint' };
    case 'Preparateur':
      return { category: 'preparateur', role: 'preparateur' };
    case 'Conditionneur':
      return { category: 'rayonniste', role: 'rayonniste' };
    case 'Apprenti':
      return { category: 'apprenti', role: 'apprenti' };
    case 'Etudiant':
      return { category: 'etudiant', role: 'etudiant' };
    default:
      return { category: 'preparateur', role: 'preparateur' };
  }
}

/** Couleurs par catégorie */
const CATEGORY_COLORS: Record<EmployeeCategory, string> = {
  pharmacien_titulaire: '#2563eb',
  pharmacien_adjoint: '#3b82f6',
  preparateur: '#10b981',
  rayonniste: '#f59e0b',
  apprenti: '#8b5cf6',
  etudiant: '#ec4899',
};

/** Convertit une ligne DB employees → Employee TypeScript */
function dbEmployeeToEmployee(row: DbEmployee): Employee {
  // Extraire prénom/nom depuis first_name/last_name ou depuis name
  let firstName = row.first_name || '';
  let lastName = row.last_name || '';
  if (!firstName && !lastName && row.name) {
    const parts = row.name.split(' ');
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ');
  }

  const mapped = mapDbRole(row.role, lastName);

  return {
    id: row.id,
    organization_id: row.organization_id,
    first_name: firstName,
    last_name: lastName,
    email: `${firstName.toLowerCase().replace(/\s/g, '')}@pharmacie-maurer.fr`,
    phone: null,
    category: mapped.category,
    role: mapped.role,
    contract_hours: row.contract_hours || 35,
    contract_type: mapped.category === 'apprenti' ? 'alternance' : mapped.category === 'etudiant' ? 'CDD' : 'CDI',
    contract_start_date: '2023-01-01',
    contract_end_date: null,
    display_color: CATEGORY_COLORS[mapped.category],
    employee_number: null,
    is_active: row.status === 'active',
    availabilities: [],
    skills: [],
    preferences: {
      preferred_days_off: [],
      preferred_shift: 'flexible',
      max_preferred_daily_hours: null,
      notes: null,
    },
    user_id: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Convertit une ligne DB shifts → Shift TypeScript */
function dbShiftToShift(row: DbShift): Shift {
  const startTime = row.start_time.slice(0, 5); // "08:30:00" → "08:30"
  const endTime = row.end_time.slice(0, 5);

  return {
    id: row.id,
    organization_id: row.organization_id,
    employee_id: row.employee_id,
    date: row.date,
    start_time: startTime,
    end_time: endTime,
    break_duration: 0, // pas de colonne break dans le nouveau schéma
    effective_hours: row.hours,
    type: row.type === 'work' ? 'regular' : row.type as Shift['type'],
    status: row.validated ? 'published' : 'draft',
    notes: row.notes || null,
    created_by: '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─── QUERIES (via API Routes pour contourner le RLS) ───

/**
 * Récupère tous les employés actifs d'une organisation
 */
export async function getEmployees(organizationId: string): Promise<Employee[]> {
  try {
    const res = await fetch(`/api/employees?organizationId=${encodeURIComponent(organizationId)}`);
    if (!res.ok) {
      const err = await res.json();
      console.error('Erreur chargement employés:', err);
      return [];
    }
    const data: DbEmployee[] = await res.json();
    return data.map(dbEmployeeToEmployee);
  } catch (error) {
    console.error('Erreur chargement employés:', error);
    return [];
  }
}

/**
 * Récupère les shifts d'une semaine (lun-dim)
 */
export async function getShiftsForWeek(
  organizationId: string,
  weekStart: string,
  weekEnd: string
): Promise<Shift[]> {
  try {
    const params = new URLSearchParams({
      organizationId,
      weekStart,
      weekEnd,
    });
    const res = await fetch(`/api/shifts?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json();
      console.error('Erreur chargement shifts:', err);
      return [];
    }
    const data: DbShift[] = await res.json();
    return data.map(dbShiftToShift);
  } catch (error) {
    console.error('Erreur chargement shifts:', error);
    return [];
  }
}

/**
 * Crée un nouveau shift
 */
export async function createShift(
  organizationId: string,
  shift: {
    employee_id: string;
    date: string;
    start_time: string;
    end_time: string;
    break_duration: number;
  }
): Promise<Shift | null> {
  try {
    const effectiveHours = calculateEffectiveHours(shift.start_time, shift.end_time, shift.break_duration);

    const res = await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        employee_id: shift.employee_id,
        date: shift.date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        hours: effectiveHours,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Erreur création shift:', err);
      return null;
    }

    const data: DbShift = await res.json();
    return dbShiftToShift(data);
  } catch (error) {
    console.error('Erreur création shift:', error);
    return null;
  }
}

/**
 * Met à jour un shift existant
 */
export async function updateShift(
  shiftId: string,
  updates: {
    start_time?: string;
    end_time?: string;
    break_duration?: number;
    date?: string;
  }
): Promise<Shift | null> {
  try {
    // Calculer les heures si les horaires changent
    const body: Record<string, unknown> = {};
    if (updates.start_time) body.start_time = updates.start_time;
    if (updates.end_time) body.end_time = updates.end_time;
    if (updates.date) body.date = updates.date;

    // Si on a les deux horaires, recalculer
    if (updates.start_time && updates.end_time) {
      body.hours = calculateEffectiveHours(updates.start_time, updates.end_time, updates.break_duration || 0);
    }

    const res = await fetch(`/api/shifts?id=${encodeURIComponent(shiftId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Erreur mise à jour shift:', err);
      return null;
    }

    const data: DbShift = await res.json();
    return dbShiftToShift(data);
  } catch (error) {
    console.error('Erreur mise à jour shift:', error);
    return null;
  }
}

/**
 * Supprime un shift
 */
export async function deleteShift(shiftId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/shifts?id=${encodeURIComponent(shiftId)}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Erreur suppression shift:', err);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erreur suppression shift:', error);
    return false;
  }
}

// ─── BATCH SHIFT CREATION ───

/**
 * Crée plusieurs shifts en une seule requête (batch insert)
 */
export async function createShiftsBatch(
  organizationId: string,
  shifts: Array<{
    employee_id: string;
    date: string;
    start_time: string;
    end_time: string;
    hours: number;
  }>,
): Promise<Shift[]> {
  try {
    const payload = shifts.map((s) => ({
      organizationId,
      employee_id: s.employee_id,
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
      hours: s.hours,
    }));

    const res = await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Erreur batch création shifts:', err);
      return [];
    }

    const data: DbShift[] = await res.json();
    return data.map(dbShiftToShift);
  } catch (error) {
    console.error('Erreur batch création shifts:', error);
    return [];
  }
}

// ─── LEAVE REQUESTS (CONGÉS) — via API Route ───

export interface LeaveRequest {
  id: string;
  organization_id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  type: string;
  status: string;
  business_days: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated Utiliser getLeaveRequests() à la place
 */
export async function getLeaves(
  organizationId: string,
  startDate: string,
  endDate: string,
): Promise<Array<{ employee_id: string; start_date: string; end_date: string; type: string; status: string }>> {
  const data = await getLeaveRequests(organizationId, startDate, endDate);
  return data.map((r) => ({
    employee_id: r.employee_id,
    start_date: r.start_date,
    end_date: r.end_date,
    type: r.type,
    status: r.status,
  }));
}

/**
 * Récupère les demandes de congés (via API Route)
 */
export async function getLeaveRequests(
  organizationId: string,
  startDate?: string,
  endDate?: string,
): Promise<LeaveRequest[]> {
  try {
    const params = new URLSearchParams({ organizationId });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    const res = await fetch(`/api/leave-requests?${params.toString()}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error('Erreur chargement congés:', error);
    return [];
  }
}

/**
 * Crée une demande de congé
 */
export async function createLeaveRequest(
  organizationId: string,
  leave: {
    employee_id: string;
    start_date: string;
    end_date: string;
    type: string;
    business_days?: number;
    notes?: string;
  },
): Promise<LeaveRequest | null> {
  try {
    const res = await fetch('/api/leave-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, ...leave }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Erreur création congé:', error);
    return null;
  }
}

/**
 * Met à jour une demande de congé
 */
export async function updateLeaveRequest(
  id: string,
  updates: Partial<{
    start_date: string;
    end_date: string;
    type: string;
    status: string;
    business_days: number;
    notes: string;
  }>,
): Promise<LeaveRequest | null> {
  try {
    const res = await fetch(`/api/leave-requests?id=${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Erreur mise à jour congé:', error);
    return null;
  }
}

/**
 * Supprime une demande de congé
 */
export async function deleteLeaveRequest(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/leave-requests?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (error) {
    console.error('Erreur suppression congé:', error);
    return false;
  }
}
