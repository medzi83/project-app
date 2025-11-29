/**
 * Naive Date Utilities
 *
 * Diese Funktionen speichern und formatieren Datumsangaben "naiv" - d.h. ohne
 * Zeitzonenkonvertierung. Die eingegebene Zeit wird exakt so gespeichert und
 * angezeigt, wie sie eingegeben wurde.
 *
 * Beispiel: 16:00 eingegeben → 16:00:00.000Z gespeichert → 16:00 angezeigt
 *
 * Siehe docs/NAIVE_DATE_FORMATTING.md für Details.
 */

/**
 * Konvertiert einen String in ein Date-Objekt ohne Zeitzonenkonvertierung.
 * Die eingegebene Zeit wird als UTC interpretiert (nicht als lokale Zeit).
 *
 * @param s - Datetime-String vom Input (z.B. "2024-11-28T16:00" oder "2024-11-28")
 * @returns Date-Objekt mit der exakt eingegebenen Zeit als UTC
 */
export function toNaiveDate(s?: string | null): Date | null {
  if (!s || !s.trim()) return null;
  const trimmed = s.trim();

  // Wenn der String bereits ein Z oder Timezone-Offset hat, direkt parsen
  if (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }

  // Nur Datum ohne Zeit → Mitternacht UTC
  if (!trimmed.includes('T')) {
    return new Date(trimmed + 'T00:00:00.000Z');
  }

  // Datum mit Zeit → Z anhängen damit es als UTC interpretiert wird
  return new Date(trimmed + ':00.000Z');
}

/**
 * Formatiert ein Datum als deutschen Datumsstring (TT.MM.JJJJ)
 * Extrahiert die Komponenten direkt aus dem ISO-String ohne Zeitzonenkonvertierung.
 *
 * @param d - Date-Objekt oder ISO-String
 * @param fallback - Rückgabewert wenn kein Datum vorhanden (default: "-")
 * @returns Formatiertes Datum oder Fallback
 */
export function formatNaiveDate(d?: Date | string | null, fallback = "-"): string {
  if (!d) return fallback;
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return fallback;
    const [, year, month, day] = match;
    return `${day}.${month}.${year}`;
  } catch {
    return fallback;
  }
}

/**
 * Formatiert ein Datum als deutschen Datumsstring mit kurzer Jahreszahl (TT.MM.JJ)
 *
 * @param d - Date-Objekt oder ISO-String
 * @param fallback - Rückgabewert wenn kein Datum vorhanden (default: "")
 * @returns Formatiertes Datum oder Fallback
 */
export function formatNaiveDateShort(d?: Date | string | null, fallback = ""): string {
  if (!d) return fallback;
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return fallback;
    const [, year, month, day] = match;
    return `${day}.${month}.${year.slice(2)}`;
  } catch {
    return fallback;
  }
}

/**
 * Formatiert Datum und Uhrzeit als deutschen String (TT.MM.JJJJ, HH:MM)
 * Extrahiert die Komponenten direkt aus dem ISO-String ohne Zeitzonenkonvertierung.
 *
 * @param d - Date-Objekt oder ISO-String
 * @param fallback - Rückgabewert wenn kein Datum vorhanden (default: "-")
 * @returns Formatiertes Datum mit Uhrzeit oder Fallback
 */
export function formatNaiveDateTime(d?: Date | string | null, fallback = "-"): string {
  if (!d) return fallback;
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return fallback;
    const [, year, month, day, hours, minutes] = match;
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  } catch {
    return fallback;
  }
}

/**
 * Formatiert Datum und Uhrzeit mit kurzer Jahreszahl (TT.MM.JJ um HH:MM Uhr)
 *
 * @param d - Date-Objekt oder ISO-String
 * @param fallback - Rückgabewert wenn kein Datum vorhanden (default: "")
 * @returns Formatiertes Datum mit Uhrzeit oder Fallback
 */
export function formatNaiveDateTimeShort(d?: Date | string | null, fallback = ""): string {
  if (!d) return fallback;
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return fallback;
    const [, year, month, day, hours, minutes] = match;
    return `${day}.${month}.${year.slice(2)} um ${hours}:${minutes} Uhr`;
  } catch {
    return fallback;
  }
}

/**
 * Formatiert nur die Uhrzeit (HH:MM)
 *
 * @param d - Date-Objekt oder ISO-String
 * @param fallback - Rückgabewert wenn kein Datum vorhanden (default: "-")
 * @returns Formatierte Uhrzeit oder Fallback
 */
export function formatNaiveTime(d?: Date | string | null, fallback = "-"): string {
  if (!d) return fallback;
  try {
    const dateStr = typeof d === 'string' ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return fallback;
    const hours = match[4];
    const minutes = match[5];
    return `${hours}:${minutes}`;
  } catch {
    return fallback;
  }
}

/**
 * Gibt die aktuelle deutsche Zeit als "naive" UTC-Zeit zurück.
 *
 * Da alle Benutzer in Deutschland sind, speichern wir die deutsche Zeit
 * direkt als UTC-Timestamp. So wird 01:00 deutscher Zeit als 01:00:00.000Z
 * gespeichert und später mit naiver Formatierung auch als 01:00 angezeigt.
 *
 * @returns Date-Objekt mit der deutschen Zeit als UTC-Timestamp
 */
export function nowAsNaiveGermanTime(): Date {
  const now = new Date();
  // Formatiere als deutsche Zeit (sv-SE Locale gibt ISO-ähnliches Format)
  const germanTimeStr = now.toLocaleString("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).replace(" ", "T");
  // Parse als UTC (Z anhängen)
  return new Date(germanTimeStr + ".000Z");
}
