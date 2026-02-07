/**
 * Utilitaires de validation réutilisables pour PharmaPlanning
 */

/** Résultat de validation */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

/**
 * Crée un résultat de validation vide (valide)
 */
export function createValidResult(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

/**
 * Fusionne plusieurs résultats de validation
 */
export function mergeValidationResults(...results: ValidationResult[]): ValidationResult {
  const merged: ValidationResult = { valid: true, errors: [], warnings: [] };

  for (const result of results) {
    if (!result.valid) merged.valid = false;
    merged.errors.push(...result.errors);
    merged.warnings.push(...result.warnings);
  }

  return merged;
}

/**
 * Validation : champ requis
 */
export function validateRequired(value: unknown, fieldName: string): ValidationResult {
  const result = createValidResult();
  if (value === null || value === undefined || value === '') {
    result.valid = false;
    result.errors.push({
      code: 'REQUIRED',
      message: `${fieldName} est obligatoire`,
      field: fieldName,
    });
  }
  return result;
}

/**
 * Validation : email
 */
export function validateEmail(email: string): ValidationResult {
  const result = createValidResult();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    result.valid = false;
    result.errors.push({
      code: 'INVALID_EMAIL',
      message: 'Adresse email invalide',
      field: 'email',
    });
  }
  return result;
}

/**
 * Validation : format horaire HH:MM
 */
export function validateTimeFormat(time: string): ValidationResult {
  const result = createValidResult();
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(time)) {
    result.valid = false;
    result.errors.push({
      code: 'INVALID_TIME',
      message: `Format horaire invalide : "${time}". Utilisez HH:MM`,
      field: 'time',
    });
  }
  return result;
}

/**
 * Validation : plage numérique
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): ValidationResult {
  const result = createValidResult();
  if (value < min || value > max) {
    result.valid = false;
    result.errors.push({
      code: 'OUT_OF_RANGE',
      message: `${fieldName} doit être entre ${min} et ${max} (valeur : ${value})`,
      field: fieldName,
    });
  }
  return result;
}

/**
 * Validation : format date ISO (YYYY-MM-DD)
 */
export function validateDateFormat(dateStr: string): ValidationResult {
  const result = createValidResult();
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    result.valid = false;
    result.errors.push({
      code: 'INVALID_DATE',
      message: `Format de date invalide : "${dateStr}". Utilisez YYYY-MM-DD`,
      field: 'date',
    });
  }
  return result;
}
