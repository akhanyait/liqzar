/**
 * LIQZAR motion system — single source of truth for micro-interactions.
 *
 * Usage:
 *   import { motionSpring, fadeUp, pressable } from "@/lib/motion";
 *   <motion.div variants={fadeUp} initial="initial" animate="animate" />
 *   <motion.button whileTap={pressable.tap} whileHover={pressable.hover} />
 *
 * Curves follow a luxury brand language: slow-in/quick-settle springs for
 * cards, short crisp eases for buttons, low amplitude for long scroll
 * sections so nothing feels theatrical.
 */
import type { Transition, Variants } from "framer-motion";

// ── Timing primitives ──────────────────────────────────────────────────────
export const duration = {
  instant: 0.12,
  quick: 0.2,
  base: 0.32,
  slow: 0.48,
  hero: 0.72,
} as const;

export const ease = {
  standard: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
  emphasized: [0.05, 0.7, 0.1, 1] as [number, number, number, number],
  exit: [0.4, 0, 0.8, 0.4] as [number, number, number, number],
} as const;

// Springs — named for intent, not physics parameters.
export const springs = {
  card: { type: "spring", stiffness: 320, damping: 28, mass: 0.9 },
  button: { type: "spring", stiffness: 520, damping: 30, mass: 0.6 },
  sheet: { type: "spring", stiffness: 260, damping: 32, mass: 1.1 },
} as const satisfies Record<string, Transition>;

// ── Variant presets ────────────────────────────────────────────────────────
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: duration.base, ease: ease.standard },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.quick, ease: ease.exit },
  },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: ease.emphasized },
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: duration.quick, ease: ease.exit },
  },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: springs.card,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: duration.quick, ease: ease.exit },
  },
};

// Stagger helper for a list-of-cards mount.
export const stagger = (gap = 0.05): Variants => ({
  animate: {
    transition: { staggerChildren: gap, delayChildren: 0.04 },
  },
});

// Press/hover affordance — pass to whileTap / whileHover directly.
export const pressable = {
  hover: { y: -2, transition: springs.button },
  tap: { scale: 0.97, transition: springs.button },
} as const;

// Reduced-motion fallback — callers can opt in.
export const instant: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};
