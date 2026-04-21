/**
 * Format a number as South African Rand
 */
export function formatCurrency(amount: number): string {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a number as Rand without decimals (for display)
 */
export function formatRand(amount: number): string {
  return `R${Math.round(amount).toLocaleString("en-ZA")}`;
}
