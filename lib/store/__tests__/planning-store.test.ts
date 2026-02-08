/**
 * Tests unitaires — Planning Store (localStorage)
 *
 * Teste le CRUD des slots et horaires fixes,
 * la persistance localStorage, et les calculs de stats.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadSlots,
  saveSlots,
  upsertSlot,
  removeSlot,
  toggleSlot,
  hasSlot,
  getSlotsForWeek,
  getSlotsForEmployeeDate,
  loadHorairesFixes,
  saveHorairesFixes,
  upsertHoraireFixes,
  removeHoraireFixes,
  getHorairesForEmployee,
  generateSlotsFromHorairesFixes,
  applyHorairesFixes,
  slotHours,
  weeklyHoursForEmployee,
  countEmployeesForDate,
  clearStore,
  clearWeekSlots,
  onStoreChange,
  type PlanningSlot,
  type HoraireFixeEntry,
} from '../planning-store';

// ─── Mock localStorage ───

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] || null),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'window', {
  value: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    localStorage: localStorageMock,
  },
  writable: true,
});

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// ─── Tests Slots ───

describe('Planning Store - Slots', () => {
  const slot1: PlanningSlot = {
    employeeId: 'emp-001',
    date: '2026-02-09',
    creneau: 'matin',
    startTime: '08:30',
    endTime: '12:30',
    breakMinutes: 0,
  };

  const slot2: PlanningSlot = {
    employeeId: 'emp-001',
    date: '2026-02-09',
    creneau: 'aprem',
    startTime: '14:00',
    endTime: '19:30',
    breakMinutes: 0,
  };

  it('devrait charger des slots vides par defaut', () => {
    const slots = loadSlots();
    expect(slots).toEqual([]);
  });

  it('devrait sauvegarder et charger des slots', () => {
    saveSlots([slot1, slot2]);
    const loaded = loadSlots();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].employeeId).toBe('emp-001');
    expect(loaded[0].creneau).toBe('matin');
    expect(loaded[1].creneau).toBe('aprem');
  });

  it('devrait upsert un slot (insertion)', () => {
    const result = upsertSlot(slot1);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(slot1);
  });

  it('devrait upsert un slot (mise a jour)', () => {
    upsertSlot(slot1);
    const updated: PlanningSlot = { ...slot1, startTime: '09:00' };
    const result = upsertSlot(updated);
    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe('09:00');
  });

  it('devrait supprimer un slot', () => {
    upsertSlot(slot1);
    upsertSlot(slot2);
    const result = removeSlot('emp-001', '2026-02-09', 'matin');
    expect(result).toHaveLength(1);
    expect(result[0].creneau).toBe('aprem');
  });

  it('devrait toggle un slot (creer puis supprimer)', () => {
    // Premier toggle : creer
    const after1 = toggleSlot('emp-001', '2026-02-09', 'matin');
    expect(after1).toHaveLength(1);
    expect(after1[0].creneau).toBe('matin');

    // Second toggle : supprimer
    const after2 = toggleSlot('emp-001', '2026-02-09', 'matin');
    expect(after2).toHaveLength(0);
  });

  it('devrait toggle avec des valeurs par defaut custom', () => {
    const result = toggleSlot('emp-001', '2026-02-09', 'matin', {
      startTime: '09:00',
      endTime: '13:00',
    });
    expect(result[0].startTime).toBe('09:00');
    expect(result[0].endTime).toBe('13:00');
  });

  it('devrait verifier si un slot existe', () => {
    upsertSlot(slot1);
    expect(hasSlot('emp-001', '2026-02-09', 'matin')).toBe(true);
    expect(hasSlot('emp-001', '2026-02-09', 'aprem')).toBe(false);
    expect(hasSlot('emp-002', '2026-02-09', 'matin')).toBe(false);
  });

  it('devrait filtrer les slots par semaine', () => {
    const weekDates = ['2026-02-09', '2026-02-10', '2026-02-11', '2026-02-12', '2026-02-13', '2026-02-14'];
    upsertSlot(slot1);
    upsertSlot({ ...slot1, date: '2026-02-16' }); // hors semaine

    const weekSlots = getSlotsForWeek(weekDates);
    expect(weekSlots).toHaveLength(1);
    expect(weekSlots[0].date).toBe('2026-02-09');
  });

  it('devrait filtrer les slots par employe et date', () => {
    upsertSlot(slot1);
    upsertSlot(slot2);
    upsertSlot({ ...slot1, employeeId: 'emp-002' });

    const empSlots = getSlotsForEmployeeDate('emp-001', '2026-02-09');
    expect(empSlots).toHaveLength(2);
  });
});

// ─── Tests Horaires Fixes ───

describe('Planning Store - Horaires Fixes', () => {
  const hf1: HoraireFixeEntry = {
    employeeId: 'emp-001',
    dayOfWeek: 0,
    creneau: 'matin',
    startTime: '08:30',
    endTime: '12:30',
    breakMinutes: 0,
    isActive: true,
  };

  const hf2: HoraireFixeEntry = {
    employeeId: 'emp-001',
    dayOfWeek: 0,
    creneau: 'aprem',
    startTime: '14:00',
    endTime: '19:00',
    breakMinutes: 0,
    isActive: true,
  };

  it('devrait charger des horaires vides par defaut', () => {
    expect(loadHorairesFixes()).toEqual([]);
  });

  it('devrait sauvegarder et charger des horaires', () => {
    saveHorairesFixes([hf1, hf2]);
    const loaded = loadHorairesFixes();
    expect(loaded).toHaveLength(2);
  });

  it('devrait upsert un horaire (insertion)', () => {
    const result = upsertHoraireFixes(hf1);
    expect(result).toHaveLength(1);
    expect(result[0].dayOfWeek).toBe(0);
  });

  it('devrait upsert un horaire (mise a jour)', () => {
    upsertHoraireFixes(hf1);
    const updated = { ...hf1, startTime: '09:00' };
    const result = upsertHoraireFixes(updated);
    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe('09:00');
  });

  it('devrait supprimer un horaire', () => {
    upsertHoraireFixes(hf1);
    upsertHoraireFixes(hf2);
    const result = removeHoraireFixes('emp-001', 0, 'matin');
    expect(result).toHaveLength(1);
    expect(result[0].creneau).toBe('aprem');
  });

  it('devrait filtrer par employe (actifs seulement)', () => {
    upsertHoraireFixes(hf1);
    upsertHoraireFixes({ ...hf2, isActive: false });
    upsertHoraireFixes({ ...hf1, employeeId: 'emp-002' });

    const result = getHorairesForEmployee('emp-001');
    expect(result).toHaveLength(1);
    expect(result[0].creneau).toBe('matin');
  });
});

// ─── Tests Generation depuis Horaires Fixes ───

describe('Planning Store - Generation', () => {
  const weekDates = ['2026-02-09', '2026-02-10', '2026-02-11', '2026-02-12', '2026-02-13', '2026-02-14'];

  const mockEmployees = [
    { id: 'emp-001', is_active: true, first_name: 'Test', last_name: 'User' },
    { id: 'emp-002', is_active: true, first_name: 'Test2', last_name: 'User2' },
    { id: 'emp-003', is_active: false, first_name: 'Inactive', last_name: 'User' },
  ] as any[];

  beforeEach(() => {
    // Ajouter des horaires fixes
    saveHorairesFixes([
      {
        employeeId: 'emp-001',
        dayOfWeek: 0,
        creneau: 'matin' as const,
        startTime: '08:30',
        endTime: '12:30',
        breakMinutes: 0,
        isActive: true,
      },
      {
        employeeId: 'emp-001',
        dayOfWeek: 1,
        creneau: 'aprem' as const,
        startTime: '14:00',
        endTime: '19:00',
        breakMinutes: 0,
        isActive: true,
      },
      {
        employeeId: 'emp-003',
        dayOfWeek: 0,
        creneau: 'matin' as const,
        startTime: '08:30',
        endTime: '12:30',
        breakMinutes: 0,
        isActive: true,
      },
    ]);
  });

  it('devrait generer des slots depuis les horaires fixes', () => {
    const preview = generateSlotsFromHorairesFixes(weekDates, mockEmployees);
    // emp-001 a 2 horaires fixes, emp-003 est inactif donc ignore
    expect(preview).toHaveLength(2);
    expect(preview[0].employeeId).toBe('emp-001');
    expect(preview[0].date).toBe('2026-02-09'); // Lundi = index 0
    expect(preview[1].date).toBe('2026-02-10'); // Mardi = index 1
  });

  it('ne devrait PAS generer si un slot existe deja', () => {
    // Ajouter un slot existant
    upsertSlot({
      employeeId: 'emp-001',
      date: '2026-02-09',
      creneau: 'matin',
      startTime: '08:30',
      endTime: '12:30',
      breakMinutes: 0,
    });

    const preview = generateSlotsFromHorairesFixes(weekDates, mockEmployees);
    // Seul le slot du mardi devrait etre genere
    expect(preview).toHaveLength(1);
    expect(preview[0].date).toBe('2026-02-10');
  });

  it('devrait appliquer les horaires fixes', () => {
    const result = applyHorairesFixes(weekDates, mockEmployees);
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);

    const slots = loadSlots();
    expect(slots).toHaveLength(2);
  });

  it('ne devrait pas dupliquer les slots lors d\'un second apply', () => {
    applyHorairesFixes(weekDates, mockEmployees);
    const result2 = applyHorairesFixes(weekDates, mockEmployees);
    expect(result2.created).toBe(0);

    const slots = loadSlots();
    expect(slots).toHaveLength(2);
  });
});

// ─── Tests Stats ───

describe('Planning Store - Stats', () => {
  it('devrait calculer les heures d\'un slot', () => {
    const slot: PlanningSlot = {
      employeeId: 'emp-001',
      date: '2026-02-09',
      creneau: 'matin',
      startTime: '08:30',
      endTime: '12:30',
      breakMinutes: 0,
    };
    expect(slotHours(slot)).toBe(4);
  });

  it('devrait calculer les heures avec pause', () => {
    const slot: PlanningSlot = {
      employeeId: 'emp-001',
      date: '2026-02-09',
      creneau: 'matin',
      startTime: '08:30',
      endTime: '19:00',
      breakMinutes: 60,
    };
    // 10.5h - 1h pause = 9.5h
    expect(slotHours(slot)).toBe(9.5);
  });

  it('devrait calculer les heures hebdomadaires', () => {
    const weekDates = ['2026-02-09', '2026-02-10', '2026-02-11'];
    saveSlots([
      { employeeId: 'emp-001', date: '2026-02-09', creneau: 'matin', startTime: '08:30', endTime: '12:30', breakMinutes: 0 },
      { employeeId: 'emp-001', date: '2026-02-09', creneau: 'aprem', startTime: '14:00', endTime: '19:00', breakMinutes: 0 },
      { employeeId: 'emp-001', date: '2026-02-10', creneau: 'matin', startTime: '08:30', endTime: '12:30', breakMinutes: 0 },
    ]);

    const hours = weeklyHoursForEmployee('emp-001', weekDates);
    // 4h + 5h + 4h = 13h
    expect(hours).toBe(13);
  });

  it('devrait compter les employes par date', () => {
    saveSlots([
      { employeeId: 'emp-001', date: '2026-02-09', creneau: 'matin', startTime: '08:30', endTime: '12:30', breakMinutes: 0 },
      { employeeId: 'emp-001', date: '2026-02-09', creneau: 'aprem', startTime: '14:00', endTime: '19:00', breakMinutes: 0 },
      { employeeId: 'emp-002', date: '2026-02-09', creneau: 'matin', startTime: '08:30', endTime: '12:30', breakMinutes: 0 },
    ]);

    expect(countEmployeesForDate('2026-02-09')).toBe(2);
    expect(countEmployeesForDate('2026-02-10')).toBe(0);
  });
});

// ─── Tests Clear / Reset ───

describe('Planning Store - Clear', () => {
  it('devrait effacer tout le store', () => {
    upsertSlot({
      employeeId: 'emp-001',
      date: '2026-02-09',
      creneau: 'matin',
      startTime: '08:30',
      endTime: '12:30',
      breakMinutes: 0,
    });
    upsertHoraireFixes({
      employeeId: 'emp-001',
      dayOfWeek: 0,
      creneau: 'matin',
      startTime: '08:30',
      endTime: '12:30',
      breakMinutes: 0,
      isActive: true,
    });

    clearStore();

    expect(loadSlots()).toEqual([]);
    expect(loadHorairesFixes()).toEqual([]);
  });

  it('devrait effacer les slots d\'une semaine seulement', () => {
    const weekDates = ['2026-02-09', '2026-02-10'];
    saveSlots([
      { employeeId: 'emp-001', date: '2026-02-09', creneau: 'matin', startTime: '08:30', endTime: '12:30', breakMinutes: 0 },
      { employeeId: 'emp-001', date: '2026-02-16', creneau: 'matin', startTime: '08:30', endTime: '12:30', breakMinutes: 0 },
    ]);

    const remaining = clearWeekSlots(weekDates);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].date).toBe('2026-02-16');
  });
});

// ─── Tests Event Listener ───

describe('Planning Store - Events', () => {
  it('devrait retourner une fonction de cleanup', () => {
    const callback = vi.fn();
    const cleanup = onStoreChange(callback);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });
});
