import type { FilmProjectStatus } from "@prisma/client";

export type FilmStatus =
  | "BEENDET"
  | "ONLINE"
  | "FINALVERSION"
  | "VORABVERSION"
  | "SCHNITT"
  | "DREH"
  | "SKRIPTFREIGABE"
  | "SKRIPT"
  | "SCOUTING";

export const FILM_STATUS_LABELS: Record<FilmStatus, string> = {
  BEENDET: "Beendet",
  ONLINE: "Online",
  FINALVERSION: "Finalversion",
  VORABVERSION: "Vorabversion",
  SCHNITT: "Schnitt",
  DREH: "Dreh",
  SKRIPTFREIGABE: "Skriptfreigabe",
  SKRIPT: "Skript",
  SCOUTING: "Scouting",
};

const isInPast = (value?: Date | string | null): boolean => {
  if (!value) return false;
  try {
    const date = new Date(value);
    return date.getTime() < Date.now();
  } catch {
    return false;
  }
};

const toDate = (value?: Date | string | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export type FilmStatusInput = {
  status?: FilmProjectStatus | string | null;
  onlineDate?: Date | string | null;
  finalToClient?: Date | string | null;
  shootDate?: Date | string | null;
  scriptApproved?: Date | string | null;
  scriptToClient?: Date | string | null;
  scouting?: Date | string | null;
  previewVersions?: Array<{ sentDate: Date | string }> | null;
};

/**
 * Derives the current status of a film project based on its data.
 * Uses the latest preview version from previewVersions table.
 */
export function deriveFilmStatus(film: FilmStatusInput): FilmStatus {
  // Hierarchie: Beendet > Online > Finalversion > Vorabversion > Schnitt > Dreh > Skriptfreigabe > Skript > Scouting

  // Beendet - P-Status auf beendet
  if (film.status === "BEENDET") return "BEENDET";

  // Online - Datum bei Online
  if (film.onlineDate) return "ONLINE";

  // Finalversion - Finalversion an Kunden
  if (film.finalToClient) return "FINALVERSION";

  // Vorabversion - Check latest preview version
  const hasPreviewVersion = film.previewVersions && film.previewVersions.length > 0;
  if (hasPreviewVersion) return "VORABVERSION";

  // Schnitt - Drehtermin-Datum in Vergangenheit
  if (isInPast(film.shootDate)) return "SCHNITT";

  // Dreh - Datum bei Skriptfreigabe
  if (film.scriptApproved) return "DREH";

  // Skriptfreigabe - Datum bei Script an Kunden
  if (film.scriptToClient) return "SKRIPTFREIGABE";

  // Skript - Datum Scouting in Vergangenheit
  if (isInPast(film.scouting)) return "SKRIPT";

  // Scouting - Kein Scoutingdatum vergeben oder in der Zukunft
  return "SCOUTING";
}

/**
 * Gets the relevant date for a film status
 */
export function getFilmStatusDate(
  status: FilmStatus,
  film: {
    contractStart?: Date | string | null;
    scouting?: Date | string | null;
    scriptToClient?: Date | string | null;
    scriptApproved?: Date | string | null;
    shootDate?: Date | string | null;
    finalToClient?: Date | string | null;
    onlineDate?: Date | string | null;
    lastContact?: Date | string | null;
    previewVersions?: Array<{ sentDate: Date | string }> | null;
  }
): Date | null {
  switch (status) {
    case "SCOUTING":
      return toDate(film.scouting) ?? toDate(film.contractStart);
    case "SKRIPT":
      return toDate(film.scouting);
    case "SKRIPTFREIGABE":
      return toDate(film.scriptToClient);
    case "DREH":
      return toDate(film.scriptApproved);
    case "SCHNITT":
      return toDate(film.shootDate);
    case "VORABVERSION":
      // Get latest preview version date
      if (film.previewVersions && film.previewVersions.length > 0) {
        return toDate(film.previewVersions[0].sentDate);
      }
      return null;
    case "FINALVERSION":
      return toDate(film.finalToClient);
    case "ONLINE":
      return toDate(film.onlineDate);
    case "BEENDET":
      return toDate(film.onlineDate) ?? toDate(film.lastContact);
    default:
      return null;
  }
}
