/**
 * Format date and time for German locale with Berlin timezone
 */
export const formatDateTime = (value: Date | string | null | undefined): string => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin"
  }).format(date);
};

/**
 * Format date only (no time) for German locale with UTC timezone
 * Uses UTC to avoid timezone shift issues for dates stored without time component
 */
export const formatDate = (value: Date | string | null | undefined): string => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeZone: "UTC"
  }).format(date);
};

/**
 * Format time only (no date) for German locale with Berlin timezone
 */
export const formatTime = (value: Date | string | null | undefined): string => {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("de-DE", {
    timeStyle: "short",
    timeZone: "Europe/Berlin"
  }).format(date);
};
