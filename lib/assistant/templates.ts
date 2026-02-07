import type { Shift } from './types';

export interface ShiftTemplate {
  name: string;
  description: string;
  shifts: Shift[];
}

export const SHIFT_TEMPLATES: ShiftTemplate[] = [
  {
    name: 'Horaires standards',
    description: '2 créneaux classiques (matin/après-midi)',
    shifts: [
      {
        id: 'template-1-morning',
        name: 'Matin',
        startTime: '08:30',
        endTime: '14:00',
        roles: {
          Pharmacien: { min: 1, max: 2 },
          Preparateur: { min: 2, max: 4 },
          Apprenti: { min: 0, max: 1 },
          Etudiant: { min: 0, max: 1 },
          Conditionneur: { min: 1, max: 2 },
        },
      },
      {
        id: 'template-1-afternoon',
        name: 'Après-midi',
        startTime: '14:00',
        endTime: '20:30',
        roles: {
          Pharmacien: { min: 1, max: 2 },
          Preparateur: { min: 2, max: 3 },
          Apprenti: { min: 0, max: 1 },
          Etudiant: { min: 0, max: 1 },
          Conditionneur: { min: 0, max: 1 },
        },
      },
    ],
  },
  {
    name: 'Semaine chargée',
    description: 'Effectifs renforcés pour période affluente',
    shifts: [
      {
        id: 'template-2-morning',
        name: 'Matin complet',
        startTime: '08:30',
        endTime: '14:00',
        roles: {
          Pharmacien: { min: 2, max: 3 },
          Preparateur: { min: 3, max: 5 },
          Apprenti: { min: 1, max: 2 },
          Etudiant: { min: 0, max: 1 },
          Conditionneur: { min: 2, max: 3 },
        },
      },
      {
        id: 'template-2-afternoon',
        name: 'Après-midi complet',
        startTime: '14:00',
        endTime: '20:30',
        roles: {
          Pharmacien: { min: 2, max: 3 },
          Preparateur: { min: 3, max: 4 },
          Apprenti: { min: 0, max: 1 },
          Etudiant: { min: 0, max: 1 },
          Conditionneur: { min: 1, max: 2 },
        },
      },
    ],
  },
  {
    name: 'Week-end léger',
    description: 'Effectif réduit pour samedi',
    shifts: [
      {
        id: 'template-3-day',
        name: 'Journée continue',
        startTime: '08:30',
        endTime: '19:00',
        roles: {
          Pharmacien: { min: 1, max: 1 },
          Preparateur: { min: 1, max: 2 },
          Apprenti: { min: 0, max: 0 },
          Etudiant: { min: 0, max: 0 },
          Conditionneur: { min: 0, max: 1 },
        },
      },
    ],
  },
];
