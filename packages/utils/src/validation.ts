/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate South African phone number
 */
export function isValidPhone(phone: string): boolean {
  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s-]/g, "");

  // Check for valid SA phone formats
  // +27 or 0 followed by 9 digits
  const phoneRegex = /^(\+27|0)[1-9]\d{8}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Format phone number to standard format
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, "");

  if (cleaned.startsWith("+27")) {
    return `+27 ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  } else if (cleaned.startsWith("0")) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }

  return phone;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate South African ID number
 */
export function isValidSAID(id: string): boolean {
  if (id.length !== 13) return false;

  // Basic format check (YYMMDD + SSSS + C + A + Z)
  const idRegex = /^\d{13}$/;
  if (!idRegex.test(id)) return false;

  // Validate date part (first 6 digits)
  const year = parseInt(id.substring(0, 2), 10);
  const month = parseInt(id.substring(2, 4), 10);
  const day = parseInt(id.substring(4, 6), 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  return true;
}

/**
 * Validate postal code
 */
export function isValidPostalCode(code: string): boolean {
  // South African postal codes are 4 digits
  const postalRegex = /^\d{4}$/;
  return postalRegex.test(code);
}

/**
 * Check if string is empty or whitespace
 */
export function isEmpty(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

/**
 * Validate required field
 */
export function isRequired(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return !isEmpty(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
