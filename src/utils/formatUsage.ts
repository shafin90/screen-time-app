/**
 * Converts milliseconds of foreground time to a human-readable string.
 * Examples:
 *   9_600_000  → "2h 40m"
 *   3_600_000  → "1h 0m"
 *   1_500_000  → "25m"
 */
export const formatUsageTime = (ms: number): string => {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

/**
 * Returns total daily usage in hours (for chart display).
 */
export const totalHours = (stats: { totalTimeInForeground: number }[]): number => {
  const totalMs = stats.reduce((acc, s) => acc + s.totalTimeInForeground, 0);
  return Math.round((totalMs / 3_600_000) * 10) / 10;
};
