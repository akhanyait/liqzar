import type { SVGProps } from "react";

/**
 * LIQZAR custom brand iconography.
 *
 * Lucide is our utility icon set; these are the identity marks that give
 * LIQZAR a distinct voice where Lucide's generic glyphs would flatten the
 * brand (empty states, category chips, editorial teasers, tab bar accents).
 *
 * All icons:
 *   - 24×24 viewBox
 *   - currentColor stroke/fill
 *   - 1.5 stroke-width default (matches Lucide visual weight)
 *   - single-path silhouette where possible
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 24) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const BottleIcon = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p} aria-hidden="true">
    <path d="M10 2h4v3l1 1.5v3c.7 1 1 2 1 3v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-9c0-1 .3-2 1-3v-3L10 5V2Z" />
    <path d="M10 13h4" opacity="0.5" />
    <path d="M10 16h4" opacity="0.4" />
  </svg>
);

export const GlassIcon = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p} aria-hidden="true">
    <path d="M6 3h12l-1 8a5 5 0 0 1-5 5 5 5 0 0 1-5-5L6 3Z" />
    <path d="M12 16v5" />
    <path d="M9 21h6" />
    <path d="M8 7h8" opacity="0.4" />
  </svg>
);

export const DecanterIcon = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p} aria-hidden="true">
    <path d="M10 2h4v3.5L16 8v2l2 3a6 6 0 0 1 1 3v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4a6 6 0 0 1 1-3l2-3V8l2-2.5V2Z" />
    <path d="M8 15h8" opacity="0.5" />
  </svg>
);

export const CorkIcon = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p} aria-hidden="true">
    <rect x="8" y="4" width="8" height="16" rx="1.5" />
    <path d="M8 8h8" opacity="0.5" />
    <path d="M8 16h8" opacity="0.5" />
    <path d="M11 11v2" opacity="0.6" />
    <path d="M13 11v2" opacity="0.6" />
  </svg>
);

export const GrapeIcon = ({ size, ...p }: IconProps) => (
  <svg {...base(size)} {...p} aria-hidden="true">
    <path d="M12 3c1 0 2 .5 2.5 1.5" />
    <circle cx="12" cy="8" r="2.2" />
    <circle cx="9" cy="12" r="2.2" />
    <circle cx="15" cy="12" r="2.2" />
    <circle cx="10.5" cy="16" r="2.2" />
    <circle cx="13.5" cy="16" r="2.2" />
    <circle cx="12" cy="20" r="2" />
  </svg>
);
