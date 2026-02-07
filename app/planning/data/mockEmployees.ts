/**
 * Données mock : 28 employés de la Pharmacie Isabelle MAURER
 * 5 catégories : pharmacien_titulaire, pharmacien_adjoint, preparateur, rayonniste, apprenti/etudiant
 */

import type { Employee, EmployeeCategory } from '@/lib/types';

const ORG_ID = 'org-pharmacie-maurer';

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
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@pharmacie-maurer.fr`,
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
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };
}

export const MOCK_EMPLOYEES: Employee[] = [
  // --- Pharmaciens titulaires (2) ---
  makeEmployee('emp-001', 'Isabelle', 'MAURER', 'pharmacien_titulaire', 35, '#2563eb'),
  makeEmployee('emp-002', 'François', 'WEBER', 'pharmacien_titulaire', 35, '#2563eb'),

  // --- Pharmaciens adjoints (4) ---
  makeEmployee('emp-003', 'Marie', 'DUPONT', 'pharmacien_adjoint', 35, '#3b82f6'),
  makeEmployee('emp-004', 'Claire', 'BERNARD', 'pharmacien_adjoint', 35, '#3b82f6'),
  makeEmployee('emp-005', 'Sophie', 'LAURENT', 'pharmacien_adjoint', 28, '#3b82f6'),
  makeEmployee('emp-006', 'Antoine', 'MOREAU', 'pharmacien_adjoint', 35, '#3b82f6'),

  // --- Préparateurs en pharmacie (12) ---
  makeEmployee('emp-007', 'Jean', 'MARTIN', 'preparateur', 35, '#10b981'),
  makeEmployee('emp-008', 'Lucie', 'PETIT', 'preparateur', 35, '#10b981'),
  makeEmployee('emp-009', 'Pierre', 'ROBERT', 'preparateur', 35, '#10b981'),
  makeEmployee('emp-010', 'Camille', 'RICHARD', 'preparateur', 28, '#10b981'),
  makeEmployee('emp-011', 'Nicolas', 'DURAND', 'preparateur', 35, '#10b981'),
  makeEmployee('emp-012', 'Émilie', 'LEROY', 'preparateur', 35, '#10b981'),
  makeEmployee('emp-013', 'Thomas', 'SIMON', 'preparateur', 35, '#10b981'),
  makeEmployee('emp-014', 'Julie', 'MICHEL', 'preparateur', 28, '#10b981'),
  makeEmployee('emp-015', 'Mathieu', 'GARCIA', 'preparateur', 35, '#10b981'),
  makeEmployee('emp-016', 'Laura', 'DAVID', 'preparateur', 35, '#10b981'),
  makeEmployee('emp-017', 'Sébastien', 'BERTRAND', 'preparateur', 35, '#10b981'),
  makeEmployee('emp-018', 'Pauline', 'ROUX', 'preparateur', 28, '#10b981'),

  // --- Rayonnistes (6) ---
  makeEmployee('emp-019', 'Alain', 'FOURNIER', 'rayonniste', 35, '#f59e0b'),
  makeEmployee('emp-020', 'Nathalie', 'MOREL', 'rayonniste', 35, '#f59e0b'),
  makeEmployee('emp-021', 'Vincent', 'GIRARD', 'rayonniste', 28, '#f59e0b'),
  makeEmployee('emp-022', 'Céline', 'ANDRE', 'rayonniste', 35, '#f59e0b'),
  makeEmployee('emp-023', 'David', 'LEFEVRE', 'rayonniste', 35, '#f59e0b'),
  makeEmployee('emp-024', 'Stéphanie', 'MERCIER', 'rayonniste', 28, '#f59e0b'),

  // --- Apprentis (2) ---
  makeEmployee('emp-025', 'Léa', 'BONNET', 'apprenti', 35, '#8b5cf6'),
  makeEmployee('emp-026', 'Hugo', 'LAMBERT', 'apprenti', 35, '#8b5cf6'),

  // --- Étudiants (2) ---
  makeEmployee('emp-027', 'Chloé', 'FONTAINE', 'etudiant', 20, '#ec4899'),
  makeEmployee('emp-028', 'Maxime', 'CHEVALIER', 'etudiant', 20, '#ec4899'),
];

export const ORGANIZATION_ID = ORG_ID;
