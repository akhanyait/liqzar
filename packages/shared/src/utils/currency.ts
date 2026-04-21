import { ZA_VAT_RATE, ZA_VAT_DIVISOR } from "../constants/business-rules";

/** Format a ZAR amount: R1 234.56 */
export const formatZAR = (amount: number): string =>
  `R${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;

/** Extract the VAT component from a VAT-inclusive price */
export const vatComponent = (inclusivePrice: number): number =>
  +(inclusivePrice - inclusivePrice / ZA_VAT_DIVISOR).toFixed(2);

/** Get the ex-VAT (net) price */
export const exVAT = (inclusivePrice: number): number =>
  +(inclusivePrice / ZA_VAT_DIVISOR).toFixed(2);

export { ZA_VAT_RATE, ZA_VAT_DIVISOR };
