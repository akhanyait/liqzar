/**
 * Check whether an order placed now can still qualify for same-day delivery.
 * Cutoff is 14:00 SAST (UTC+2).
 */
export const isSameDayOrderAllowed = (): boolean => {
  const now = new Date();
  // SAST = UTC+2
  const sast = new Date(now.toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }));
  return sast.getHours() < 14;
};

/** Return today's date in YYYY-MM-DD (SAST) */
export const todaySAST = (): string => {
  return new Date()
    .toLocaleDateString("en-ZA", {
      timeZone: "Africa/Johannesburg",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .split("/")
    .reverse()
    .join("-");
};

/** Format an ISO date string for display: "15 Apr 2026" */
export const formatDateDisplay = (isoDate: string): string => {
  return new Date(isoDate).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Johannesburg",
  });
};

/** Friendly relative time: "2 minutes ago", "just now" */
export const relativeTime = (isoDate: string): string => {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
};
