'use client';

import { useState, useEffect } from 'react';
import {
  Folder,
  FolderPlus,
  Loader2,
  Cloud,
  AlertTriangle,
  FileBox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Agency = 'eventomaxx' | 'vendoweb';

// Standard-Unterordner für Projektordner
const PROJECT_SUBFOLDERS = [
  '!Wichtig',
  'BFSG',
  'Fotos',
  'Inhalte',
  'Logo',
  'QM Check',
  'SEO+',
] as const;

// Mapping von Agentur-Namen zu LuckyCloud-Agency-Keys
function getAgencyKey(agencyName: string): Agency | null {
  const lowerName = agencyName.toLowerCase().trim();
  if (lowerName.startsWith('eventomaxx')) return 'eventomaxx';
  if (lowerName.startsWith('vendoweb')) return 'vendoweb';
  return null;
}

export type LuckyCloudProjectFolderData = {
  projectId: string;
  projectTitle?: string | null;
  luckyCloudFolderPath: string | null;
  client: {
    id: string;
    name: string;
    customerNo: string | null;
    luckyCloudLibraryId: string | null;
    luckyCloudLibraryName: string | null;
    luckyCloudFolderPath: string | null;
    agency: {
      id: string;
      name: string;
    } | null;
  };
};

type LuckyCloudProjectFolderCardProps = {
  /** Die Projektdaten inkl. Client-LuckyCloud-Zuordnung */
  data: LuckyCloudProjectFolderData;
  /** Callback wenn sich die Zuordnung ändert */
  onAssignmentChange?: (folderPath: string | null) => void;
  /** Ob die Komponente bearbeitbar sein soll (Default: true) */
  canEdit?: boolean;
};

export function LuckyCloudProjectFolderCard({
  data,
  onAssignmentChange,
  canEdit = true,
}: LuckyCloudProjectFolderCardProps) {
  const { projectId, projectTitle, client } = data;

  // Lokaler State für die aktuelle Zuordnung
  const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(data.luckyCloudFolderPath);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Update wenn sich Props ändern
  useEffect(() => {
    setCurrentFolderPath(data.luckyCloudFolderPath);
  }, [data.luckyCloudFolderPath]);

  // Ermittle die Agency aus dem Kunden
  const clientAgency: Agency | null = client.agency?.name
    ? getAgencyKey(client.agency.name)
    : null;

  // Generiere Basis-Ordnernamen: [Jahr] - [Projekttitel oder "Webseite"]
  const generateBaseFolderName = () => {
    const year = new Date().getFullYear();
    const title = projectTitle?.trim() || 'Webseite';
    return `${year} - ${title}`;
  };

  // Generiere eindeutigen Ordnernamen (prüft auf existierende Ordner)
  const generateUniqueFolderName = async (existingFolders: string[]): Promise<string> => {
    const baseName = generateBaseFolderName();

    // Prüfe ob der Basisname bereits existiert
    if (!existingFolders.includes(baseName)) {
      return baseName;
    }

    // Finde den nächsten freien Suffix (2), (3), etc.
    let counter = 2;
    while (existingFolders.includes(`${baseName} (${counter})`)) {
      counter++;
    }

    return `${baseName} (${counter})`;
  };

  // Projektordner mit Unterordnern erstellen
  const createProjectFolder = async () => {
    if (!clientAgency || !client.luckyCloudLibraryId || !client.luckyCloudFolderPath) return;

    setIsCreating(true);
    setMessage(null);

    try {
      const basePath = client.luckyCloudFolderPath;

      // Existierende Ordner laden um Duplikate zu vermeiden
      const listResponse = await fetch(
        `/api/admin/luckycloud/files?agency=${clientAgency}&libraryId=${client.luckyCloudLibraryId}&path=${encodeURIComponent(basePath)}`
      );
      const listData = await listResponse.json();

      const existingFolders: string[] = listData.success && listData.items
        ? listData.items
            .filter((item: { type: string }) => item.type === 'dir')
            .map((item: { name: string }) => item.name)
        : [];

      // Eindeutigen Ordnernamen generieren
      const folderName = await generateUniqueFolderName(existingFolders);
      const projectFolderPath = `${basePath}/${folderName}`;

      // 1. Hauptordner erstellen
      const mainResponse = await fetch(
        `/api/admin/luckycloud/files?agency=${clientAgency}&libraryId=${client.luckyCloudLibraryId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: basePath,
            folderName: folderName,
          }),
        }
      );
      const mainData = await mainResponse.json();

      if (!mainResponse.ok || !mainData.success) {
        throw new Error(mainData.error || 'Fehler beim Erstellen des Hauptordners');
      }

      // Kurz warten damit Seafile den Hauptordner synchronisieren kann
      await new Promise(resolve => setTimeout(resolve, 500));

      // 2. Unterordner sequentiell erstellen
      for (const subfolderName of PROJECT_SUBFOLDERS) {
        const subResponse = await fetch(
          `/api/admin/luckycloud/files?agency=${clientAgency}&libraryId=${client.luckyCloudLibraryId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: projectFolderPath,
              folderName: subfolderName,
            }),
          }
        );
        const subData = await subResponse.json();
        if (!subResponse.ok || !subData.success) {
          console.warn(`Unterordner "${subfolderName}" konnte nicht erstellt werden:`, subData.error);
        }
      }

      // 3. Menuestruktur-Ordner in Inhalte erstellen
      await new Promise(resolve => setTimeout(resolve, 300));
      const menuResponse = await fetch(
        `/api/admin/luckycloud/files?agency=${clientAgency}&libraryId=${client.luckyCloudLibraryId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: `${projectFolderPath}/Inhalte`,
            folderName: 'Menuestruktur',
          }),
        }
      );
      const menuData = await menuResponse.json();
      if (!menuResponse.ok || !menuData.success) {
        console.warn('Menuestruktur-Ordner konnte nicht erstellt werden:', menuData.error);
      }

      // 4. Der Material-Ordner-Pfad zeigt auf Inhalte/Menuestruktur (relativ zum Kunden-Ordner)
      const materialFolderPath = `/${folderName}/Inhalte/Menuestruktur`;

      // 5. Zuordnung speichern
      const assignResponse = await fetch('/api/admin/luckycloud/project-folder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          folderPath: materialFolderPath,
        }),
      });
      const assignData = await assignResponse.json();

      if (assignData.success) {
        setCurrentFolderPath(materialFolderPath);
        onAssignmentChange?.(materialFolderPath);
        setMessage({
          type: 'success',
          text: `Material-Ordner "${folderName}" wurde erstellt.`,
        });
      } else {
        throw new Error(assignData.error || 'Fehler beim Speichern der Zuordnung');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Kein LuckyCloud beim Kunden eingerichtet
  if (!client.luckyCloudLibraryId || !client.luckyCloudFolderPath) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileBox className="h-5 w-5" />
            Material-Ordner
          </h2>
        </div>
        <div className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Für diesen Kunden ist noch keine LuckyCloud-Zuordnung eingerichtet.
              Bitte zuerst im Kundendetailblatt eine Bibliothek und einen Ordner zuordnen.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Keine Agentur oder Agentur nicht konfiguriert
  if (!clientAgency) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileBox className="h-5 w-5" />
            Material-Ordner
          </h2>
        </div>
        <div className="p-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Die Agentur des Kunden ist nicht für LuckyCloud konfiguriert.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Vollständiger Pfad für Anzeige
  const getFullDisplayPath = () => {
    if (!client.luckyCloudFolderPath || !currentFolderPath) return null;
    return `${client.luckyCloudFolderPath}${currentFolderPath}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FileBox className="h-5 w-5" />
          Material-Ordner
        </h2>
      </div>
      <div className="p-6 space-y-4">
        {/* Kunden-Cloud-Info */}
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Cloud className="h-3 w-3" />
          <span>Kunden-Ordner: {client.luckyCloudLibraryName}</span>
          {client.luckyCloudFolderPath && (
            <span className="truncate" title={client.luckyCloudFolderPath}>
              {client.luckyCloudFolderPath}
            </span>
          )}
        </div>

        {/* Aktuelle Zuordnung oder Erstellen-Button */}
        {currentFolderPath ? (
          <div className="rounded-md border bg-background p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium flex items-center gap-2">
                <Folder className="h-4 w-4 text-amber-500" />
                Material-Ordner
              </div>
              <Badge variant="default" className="text-xs bg-green-600">Angelegt</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate" title={getFullDisplayPath() || undefined}>
                {getFullDisplayPath()}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed bg-background p-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <Folder className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Kein Material-Ordner vorhanden</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Es wird ein Projektordner mit allen Unterordnern angelegt
                </p>
              </div>
              {canEdit && (
                <Button onClick={createProjectFolder} disabled={isCreating} className="mt-2">
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FolderPlus className="h-4 w-4 mr-2" />
                  )}
                  {isCreating ? 'Wird erstellt...' : 'Material-Ordner anlegen'}
                </Button>
              )}
              {canEdit && (
                <p className="text-xs text-muted-foreground">
                  Ordnername: <span className="font-medium">{generateBaseFolderName()}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Erfolg/Fehler-Meldung */}
        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
