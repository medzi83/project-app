/**
 * LuckyCloud Material-Ordner Erstellung
 *
 * Diese Bibliothek erstellt automatisch Material-Ordner in LuckyCloud
 * basierend auf der Webdokumentation eines Projekts.
 */

import { prisma } from '@/lib/prisma';
import { createDirectory, isAgencyConfigured, type LuckyCloudAgency } from '@/lib/luckycloud';

type Agency = 'eventomaxx' | 'vendoweb';

/**
 * Mapping von Agentur-Namen zu LuckyCloud-Agency-Keys
 */
function getAgencyKey(agencyName: string): Agency | null {
  const lowerName = agencyName.toLowerCase().trim();
  if (lowerName.startsWith('eventomaxx')) return 'eventomaxx';
  if (lowerName.startsWith('vendoweb')) return 'vendoweb';
  return null;
}

/**
 * Erstellt einen sicheren Ordnernamen aus einem Menüpunkt-Namen
 * Entfernt Sonderzeichen und ersetzt Leerzeichen
 */
function sanitizeFolderName(name: string): string {
  return name
    .trim()
    // Umlaute ersetzen
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    // Sonderzeichen entfernen (außer Bindestrich und Unterstrich)
    .replace(/[^a-zA-Z0-9\-_\s]/g, '')
    // Leerzeichen durch Bindestrich ersetzen
    .replace(/\s+/g, '-')
    // Mehrfache Bindestriche reduzieren
    .replace(/-+/g, '-')
    // Führende/Trailing Bindestriche entfernen
    .replace(/^-|-$/g, '');
}

export type CreateMaterialFoldersResult = {
  success: boolean;
  foldersCreated: string[];
  errors: string[];
};

/**
 * Erstellt Material-Ordner für ein Projekt basierend auf der Webdokumentation.
 * Wird nach der Kundenbestätigung aufgerufen.
 *
 * Erstellt Unterordner für:
 * - Jeden Menüpunkt mit needsImages = true
 * - "Logo" wenn materialLogoNeeded = true
 * - "Sonstiges" wenn materialNotesNeedsImages = true
 *
 * @param projectId Die ID des Projekts
 * @returns Ergebnis mit erstellten Ordnern und ggf. Fehlern
 */
export async function createMaterialFoldersForProject(
  projectId: string
): Promise<CreateMaterialFoldersResult> {
  const foldersCreated: string[] = [];
  const errors: string[] = [];

  try {
    // Projekt mit allen notwendigen Daten laden
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: {
          include: {
            agency: true,
          },
        },
        website: {
          include: {
            webDocumentation: {
              include: {
                menuItems: {
                  where: { needsImages: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return { success: false, foldersCreated: [], errors: ['Projekt nicht gefunden'] };
    }

    if (!project.client) {
      return { success: false, foldersCreated: [], errors: ['Kunde nicht gefunden'] };
    }

    // LuckyCloud-Konfiguration prüfen
    if (!project.client.luckyCloudLibraryId) {
      return {
        success: false,
        foldersCreated: [],
        errors: ['Keine LuckyCloud-Bibliothek für den Kunden konfiguriert'],
      };
    }

    if (!project.client.agency) {
      return {
        success: false,
        foldersCreated: [],
        errors: ['Keine Agentur für den Kunden konfiguriert'],
      };
    }

    const agencyKey = getAgencyKey(project.client.agency.name);
    if (!agencyKey) {
      return {
        success: false,
        foldersCreated: [],
        errors: [`Agentur "${project.client.agency.name}" ist nicht für LuckyCloud konfiguriert`],
      };
    }

    if (!isAgencyConfigured(agencyKey)) {
      return {
        success: false,
        foldersCreated: [],
        errors: [`LuckyCloud ist für "${agencyKey}" nicht konfiguriert`],
      };
    }

    // Projekt-Material-Ordner prüfen
    const projectFolderPath = project.website?.luckyCloudFolderPath;
    if (!projectFolderPath) {
      return {
        success: false,
        foldersCreated: [],
        errors: ['Kein Material-Ordner für das Projekt konfiguriert'],
      };
    }

    // Vollständigen Basis-Pfad erstellen
    const clientFolderPath = project.client.luckyCloudFolderPath || '';
    const basePath = clientFolderPath
      ? `${clientFolderPath}${projectFolderPath}`
      : projectFolderPath;

    const libraryId = project.client.luckyCloudLibraryId;
    const webDoku = project.website?.webDocumentation;

    if (!webDoku) {
      return {
        success: false,
        foldersCreated: [],
        errors: ['Keine Webdokumentation vorhanden'],
      };
    }

    // Ordner für Menüpunkte mit Bildern erstellen
    for (const menuItem of webDoku.menuItems) {
      const folderName = sanitizeFolderName(menuItem.name);
      if (!folderName) {
        errors.push(`Menüpunkt "${menuItem.name}" konnte nicht in einen gültigen Ordnernamen umgewandelt werden`);
        continue;
      }

      const folderPath = `${basePath}/${folderName}`;

      try {
        await createDirectory(agencyKey, libraryId, folderPath);
        foldersCreated.push(folderPath);
      } catch (error) {
        // Fehler "Ordner existiert bereits" ignorieren
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('already exist') && !errorMessage.includes('403')) {
          errors.push(`Fehler beim Erstellen von "${folderName}": ${errorMessage}`);
        } else {
          // Ordner existiert bereits - als erstellt markieren
          foldersCreated.push(folderPath);
        }
      }
    }

    // Logo-Ordner erstellen wenn benötigt
    if (webDoku.materialLogoNeeded) {
      const logoFolderPath = `${basePath}/Logo`;
      try {
        await createDirectory(agencyKey, libraryId, logoFolderPath);
        foldersCreated.push(logoFolderPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('already exist') && !errorMessage.includes('403')) {
          errors.push(`Fehler beim Erstellen des Logo-Ordners: ${errorMessage}`);
        } else {
          foldersCreated.push(logoFolderPath);
        }
      }
    }

    // Sonstiges-Ordner erstellen wenn materialNotesNeedsImages = true
    if (webDoku.materialNotesNeedsImages) {
      const sonstigesFolderPath = `${basePath}/Sonstiges`;
      try {
        await createDirectory(agencyKey, libraryId, sonstigesFolderPath);
        foldersCreated.push(sonstigesFolderPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('already exist') && !errorMessage.includes('403')) {
          errors.push(`Fehler beim Erstellen des Sonstiges-Ordners: ${errorMessage}`);
        } else {
          foldersCreated.push(sonstigesFolderPath);
        }
      }
    }

    return {
      success: errors.length === 0,
      foldersCreated,
      errors,
    };
  } catch (error) {
    console.error('Error creating material folders:', error);
    return {
      success: false,
      foldersCreated,
      errors: [error instanceof Error ? error.message : 'Unbekannter Fehler'],
    };
  }
}
