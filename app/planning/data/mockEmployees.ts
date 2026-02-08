/**
 * Donnees mock : 10 employes de la Pharmacie des Coquelicots
 * 5 categories : pharmacien_titulaire, pharmacien_adjoint, preparateur, apprenti, etudiant
 */

import type { Employee, EmployeeCategory } from '@/lib/types';

const ORG_ID = 'org-pharmacie-coquelicots';

function makeEmployee(
  id: string,
  firstName: string,
  lastName: string,
  category: EmployeeCategory,
  contractHours: number,
  color: string
): Employee {
  return {
    id,
    organization_id: ORG_ID,
    first_name: firstName,
    last_name: lastName,
    email: `${firstName.toLowerCase().replace(/\s/g, '')}.${lastName.toLowerCase().replace(/\s/g, '')}@pharmacie-coquelicots.fr`,
    phone: null,
    category,
    role: category === 'pharmacien_titulaire' ? 'titulaire'
      : category === 'pharmacien_adjoint' ? 'adjoint'
      : category === 'preparateur' ? 'preparateur'
      : category === 'rayonniste' ? 'rayonniste'
      : category === 'apprenti' ? 'apprenti'
      : 'etudiant',
    contract_hours: contractHours,
    contract_type: category === 'apprenti' ? 'alternance' : category === 'etudiant' ? 'CDD' : 'CDI',
    contract_start_date: '2023-01-01',
    contract_end_date: null,
    display_color: color,
    employee_number: id.replace('emp-', ''),
    is_active: true,
    availabilities: [],
    skills: [],
    preferences: {
      preferred_days_off: [],
      preferred_shift: 'flexible',
      max_preferred_daily_hours: null,
      notes: null,
    },
    user_id: null,
    account_status: null,
    invitation_sent_at: null,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

export const MOCK_EMPLOYEES: Employee[] = [
  // --- Pharmacien titulaire (1) ---
  makeEmployee('emp-001', 'Mustafa', 'UNLU', 'pharmacien_titulaire', 35, '#2563eb'),

  // --- Pharmacien adjoint (1) ---
  makeEmployee('emp-002', 'Tolga', 'PHARMACIEN', 'pharmacien_adjoint', 35, '#3b82f6'),

  // --- Preparateurs (2) ---
  makeEmployee('emp-003', 'Lea', 'PREPARATRICE', 'preparateur', 35, '#10b981'),
  makeEmployee('emp-004', 'Hanife', 'PREPARATRICE', 'preparateur', 35, '#10b981'),

  // --- Apprentis (2) ---
  makeEmployee('emp-005', 'Myriam', 'APPRENTIE', 'apprenti', 35, '#8b5cf6'),
  makeEmployee('emp-006', 'Selena', 'APPRENTIE', 'apprenti', 35, '#8b5cf6'),

  // --- Etudiants (4) ---
  makeEmployee('emp-007', 'Ensar', 'ETUDIANT', 'etudiant', 20, '#ec4899'),
  makeEmployee('emp-008', 'Nisa', 'ETUDIANTE', 'etudiant', 20, '#ec4899'),
  makeEmployee('emp-009', 'Mervenur', 'ETUDIANTE', 'etudiant', 20, '#ec4899'),
  makeEmployee('emp-010', 'Mohamed', 'ETUDIANT', 'etudiant', 20, '#ec4899'),
];

export const ORGANIZATION_ID = ORG_ID;
