// South-African-specific helpers shared across web and mobile.
// MIRROR of src/lib/za-utils.ts — kept in lock-step intentionally. liqZAR
// isn't a monorepo yet, so the two copies live side by side. When changing
// one, change the other. The contents are framework-agnostic (no DOM, no
// React Native APIs) so a future packages/utils refactor will be trivial.
//
// Adapted from ArtisanZA's `@artisanza/utils` package (May 2026).

// ── Currency ──────────────────────────────────────────────────────────────────

/** Format a number as South African Rand, e.g. formatZAR(1500) → "R 1 500". */
export function formatZAR(amount: number, withCents = false): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  })
    .format(amount)
    .replace("ZAR", "R")
    .trim();
}

// ── Phone normalisation ───────────────────────────────────────────────────────

/** Normalise a SA mobile number to E.164 (+27…). Returns input if unparseable. */
export function toZAPhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("27")) return `+${digits}`;
  if (digits.startsWith("0")) return `+27${digits.slice(1)}`;
  if (digits.length === 9) return `+27${digits}`;
  return (raw ?? "").trim();
}

// ── UUID ──────────────────────────────────────────────────────────────────────

/**
 * Safe UUID generator. Some React Native + WebView contexts (older Android
 * System WebView, Hermes engine without crypto polyfill) throw
 * "crypto.randomUUID is not a function". Falls back to getRandomValues, then
 * Math.random, so it never throws.
 */
export function safeRandomUUID(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      /* fall through */
    }
  }
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

// ── South African ID number ───────────────────────────────────────────────────

export type SaIdGender = "male" | "female";
export type SaIdCitizenship = "citizen" | "permanent_resident";

export interface SaIdParsed {
  dateOfBirth: string;
  age: number;
  gender: SaIdGender;
  citizenship: SaIdCitizenship;
}

export type SaIdResult =
  | { valid: true; dateOfBirth: string; age: number; gender: SaIdGender; citizenship: SaIdCitizenship }
  | { valid: false; error: string };

/** Standard Luhn checksum over the full 13-digit string. */
export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Validate and parse a South African ID number.
 * Non-digit separators (spaces, dashes) are tolerated and stripped.
 */
export function validateSaId(raw: string, asOf: Date = new Date()): SaIdResult {
  const id = (raw ?? "").replace(/\D/g, "");

  if (id.length !== 13) {
    return { valid: false, error: "ID number must be 13 digits." };
  }

  const yy = Number(id.slice(0, 2));
  const mm = Number(id.slice(2, 4));
  const dd = Number(id.slice(4, 6));
  const currentYY = asOf.getFullYear() % 100;
  const century = yy <= currentYY ? 2000 : 1900;
  const year = century + yy;

  if (mm < 1 || mm > 12) return { valid: false, error: "Invalid birth month in ID." };
  const daysInMonth = new Date(year, mm, 0).getDate();
  if (dd < 1 || dd > daysInMonth) return { valid: false, error: "Invalid birth day in ID." };

  const cDigit = id[10];
  if (cDigit !== "0" && cDigit !== "1") {
    return { valid: false, error: "Invalid citizenship digit in ID." };
  }

  if (!luhnValid(id)) {
    return { valid: false, error: "ID number failed the checksum — please re-check the digits." };
  }

  const dob = new Date(Date.UTC(year, mm - 1, dd));
  const dateOfBirth = dob.toISOString().slice(0, 10);

  let age = asOf.getFullYear() - year;
  const beforeBirthday =
    asOf.getMonth() + 1 < mm || (asOf.getMonth() + 1 === mm && asOf.getDate() < dd);
  if (beforeBirthday) age -= 1;

  return {
    valid: true,
    dateOfBirth,
    age,
    gender: Number(id.slice(6, 10)) >= 5000 ? "male" : "female",
    citizenship: cDigit === "0" ? "citizen" : "permanent_resident",
  };
}

/** Mask an ID for safe display/storage, keeping only the DOB prefix: 920220******* */
export function maskSaId(raw: string): string {
  const id = (raw ?? "").replace(/\D/g, "");
  if (id.length !== 13) return "•••••••••••••";
  return `${id.slice(0, 6)}${"*".repeat(7)}`;
}
