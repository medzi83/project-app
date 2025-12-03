import type { ProjectStatus, PrintDesignType } from "@prisma/client";

export type PrintDesignStatus =
  | "WEBTERMIN"
  | "UMSETZUNG"
  | "DESIGN_AN_KUNDEN"
  | "DESIGNABNAHME"
  | "FINALVERSION"
  | "DRUCK"
  | "ABGESCHLOSSEN";

export const PRINT_DESIGN_STATUS_LABELS: Record<PrintDesignStatus, string> = {
  WEBTERMIN: "Webtermin",
  UMSETZUNG: "Umsetzung",
  DESIGN_AN_KUNDEN: "Design an Kunden",
  DESIGNABNAHME: "Designabnahme",
  FINALVERSION: "Finalversion",
  DRUCK: "Druck",
  ABGESCHLOSSEN: "Beendet",
};

export const PRINT_DESIGN_TYPE_LABELS: Record<PrintDesignType, string> = {
  LOGO: "Logo",
  VISITENKARTE: "Visitenkarte",
  FLYER: "Flyer",
  PLAKAT: "Plakat",
  BROSCHÜRE: "Broschüre",
  SONSTIGES: "Sonstiges",
};

/**
 * Maps PrintDesignStatus to ProjectStatus for database storage
 */
export function mapPrintDesignStatusToProjectStatus(status: PrintDesignStatus): ProjectStatus {
  switch (status) {
    case "WEBTERMIN":
      return "WEBTERMIN";
    case "UMSETZUNG":
      return "UMSETZUNG";
    case "DESIGN_AN_KUNDEN":
    case "DESIGNABNAHME":
    case "FINALVERSION":
      return "DEMO"; // Use DEMO as intermediate status
    case "DRUCK":
      return "DEMO"; // Use DEMO for print phase
    case "ABGESCHLOSSEN":
      return "ONLINE"; // Use ONLINE as completed status
    default:
      return "WEBTERMIN";
  }
}

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

export type PrintDesignStatusInput = {
  status?: ProjectStatus | string | null;
  webtermin?: Date | string | null;
  implementation?: Date | string | null;
  designToClient?: Date | string | null;
  designApproval?: Date | string | null;
  finalVersionToClient?: Date | string | null;
  printRequired?: boolean | null;
  printOrderPlaced?: Date | string | null;
};

/**
 * Derives the current status of a print design project based on its data.
 */
export function derivePrintDesignStatus(
  printDesign: PrintDesignStatusInput
): PrintDesignStatus {
  // Hierarchie: Abgeschlossen > Druck > Finalversion > Designabnahme > Design an Kunden > Umsetzung > Webtermin

  // Abgeschlossen - wenn P-Status BEENDET ist
  if (printDesign.status === "BEENDET") return "ABGESCHLOSSEN";

  // Druck - wenn Druckauftrag erteilt wurde
  if (printDesign.printRequired && printDesign.printOrderPlaced) return "DRUCK";

  // Finalversion - wenn Finalversion an Kunden gesendet
  if (printDesign.finalVersionToClient) return "FINALVERSION";

  // Designabnahme - wenn Design abgenommen wurde
  if (printDesign.designApproval) return "DESIGNABNAHME";

  // Design an Kunden - wenn Design an Kunden gesendet
  if (printDesign.designToClient) return "DESIGN_AN_KUNDEN";

  // Umsetzung - wenn Webtermin in Vergangenheit oder Umsetzung begonnen
  if (isInPast(printDesign.webtermin) || printDesign.implementation)
    return "UMSETZUNG";

  // Webtermin - Standardzustand
  return "WEBTERMIN";
}

/**
 * Gets the relevant date for a print design status
 */
export function getPrintDesignStatusDate(
  status: PrintDesignStatus,
  printDesign: {
    webtermin?: Date | string | null;
    implementation?: Date | string | null;
    designToClient?: Date | string | null;
    designApproval?: Date | string | null;
    finalVersionToClient?: Date | string | null;
    printOrderPlaced?: Date | string | null;
  }
): Date | null {
  switch (status) {
    case "WEBTERMIN":
      return toDate(printDesign.webtermin);
    case "UMSETZUNG":
      return toDate(printDesign.implementation) ?? toDate(printDesign.webtermin);
    case "DESIGN_AN_KUNDEN":
      return toDate(printDesign.designToClient);
    case "DESIGNABNAHME":
      return toDate(printDesign.designApproval);
    case "FINALVERSION":
      return toDate(printDesign.finalVersionToClient);
    case "DRUCK":
      return toDate(printDesign.printOrderPlaced);
    case "ABGESCHLOSSEN":
      return (
        toDate(printDesign.printOrderPlaced) ??
        toDate(printDesign.finalVersionToClient)
      );
    default:
      return null;
  }
}

/**
 * Gets the display name for a print design project
 */
export function getPrintDesignDisplayName(project: {
  client: { name: string; customerNo?: string | null };
  printDesign?: { projectType?: PrintDesignType | null } | null;
}): string {
  const type = project.printDesign?.projectType
    ? PRINT_DESIGN_TYPE_LABELS[project.printDesign.projectType]
    : "Print/Design";

  return `${type} - ${project.client.customerNo ?? "?"} ${project.client.name}`;
}
