/** Strip all non-digit characters */
export const normalisePhone = (value: string): string =>
  value.replace(/\D/g, "");

/**
 * Convert a local South-African number (0XX...) or bare digits into E.164 (+27XX...).
 * Returns the input unchanged if it cannot be converted.
 */
export const toE164 = (phone: string): string => {
  const digits = normalisePhone(phone);
  if (digits.startsWith("0") && digits.length === 10)
    return `+27${digits.slice(1)}`;
  if (digits.startsWith("27") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("+")) return digits;
  return digits;
};

/** Format digits as "082 123 4567" for display */
export const formatPhoneDisplay = (value: string): string => {
  const digits = normalisePhone(value).slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6)
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
};

/** Returns true if the phone number looks like a valid SA cell number */
export const isValidSAPhone = (phone: string): boolean => {
  const digits = normalisePhone(phone);
  return (
    (digits.startsWith("0") && digits.length === 10) ||
    (digits.startsWith("27") && digits.length === 11)
  );
};
