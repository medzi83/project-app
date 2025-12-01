'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
  Library as LibraryIcon,
  Check,
  Loader2,
  ChevronRight,
  Cloud,
  Settings,
  Home,
  Building2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type Agency = 'eventomaxx' | 'vendoweb';

type Library = {
  id: string;
  name: string;
  size: number;
  encrypted: boolean;
  permission: string;
};

type FileItem = {
  name: string;
  type: 'file' | 'dir';
  size?: number;
  mtime?: string;
};

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
// Prüft ob der Agenturname mit dem Key beginnt (case-insensitive)
// z.B. "Eventomaxx GmbH" -> "eventomaxx", "Vendoweb GmbH" -> "vendoweb"
function getAgencyKey(agencyName: string): Agency | null {
  const lowerName = agencyName.toLowerCase().trim();
  if (lowerName.startsWith('eventomaxx')) return 'eventomaxx';
  if (lowerName.startsWith('vendoweb')) return 'vendoweb';
  return null;
}

// Library-Filter pro Agency
const LIBRARY_FILTERS: Record<Agency, string[] | undefined> = {
  eventomaxx: ["Material EM-", "Material EM 100-109", "E - evento"],
  vendoweb: undefined, // Alle Bibliotheken anzeigen
};

export type LuckyCloudClientData = {
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

type LuckyCloudClientCardProps = {
  /** Der Kunde, für den die LuckyCloud-Zuordnung angezeigt/geändert werden soll */
  client: LuckyCloudClientData;
  /** Callback wenn sich die Zuordnung ändert */
  onAssignmentChange?: (data: {
    luckyCloudLibraryId: string | null;
    luckyCloudLibraryName: string | null;
    luckyCloudFolderPath: string | null;
  }) => void;
  /** Ob die Komponente bearbeitbar sein soll (Default: true) */
  canEdit?: boolean;
  /** Kompaktere Darstellung ohne Rahmen (für Einbettung in andere Cards) */
  compact?: boolean;
};

export function LuckyCloudClientCard({
  client,
  onAssignmentChange,
  canEdit = true,
  compact = false,
}: LuckyCloudClientCardProps) {
  // Lokaler State für die aktuelle Zuordnung
  const [currentAssignment, setCurrentAssignment] = useState({
    luckyCloudLibraryId: client.luckyCloudLibraryId,
    luckyCloudLibraryName: client.luckyCloudLibraryName,
    luckyCloudFolderPath: client.luckyCloudFolderPath,
  });

  // Update wenn sich Props ändern
  useEffect(() => {
    setCurrentAssignment({
      luckyCloudLibraryId: client.luckyCloudLibraryId,
      luckyCloudLibraryName: client.luckyCloudLibraryName,
      luckyCloudFolderPath: client.luckyCloudFolderPath,
    });
  }, [client.luckyCloudLibraryId, client.luckyCloudLibraryName, client.luckyCloudFolderPath]);

  // Ermittle die Agency aus dem Kunden
  const clientAgency: Agency | null = client.agency?.name
    ? getAgencyKey(client.agency.name)
    : null;

  // Library-Filter für die ermittelte Agency
  const libraryNames = clientAgency ? LIBRARY_FILTERS[clientAgency] : undefined;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [selectedLibrary, setSelectedLibrary] = useState<Library | null>(null);
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState<FileItem[]>([]);
  const [isLoadingLibraries, setIsLoadingLibraries] = useState(false);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bibliotheken laden
  const loadLibraries = useCallback(async () => {
    if (!clientAgency) return;

    setIsLoadingLibraries(true);
    try {
      const response = await fetch(`/api/admin/luckycloud/libraries?agency=${clientAgency}`);
      const data = await response.json();

      if (response.ok && data.success) {
        let libs = data.libraries as Library[];

        // Filtern falls Whitelist angegeben
        if (libraryNames && libraryNames.length > 0) {
          const lowerNames = libraryNames.map(n => n.toLowerCase());
          libs = libs.filter(lib => {
            const libNameLower = lib.name.toLowerCase();
            return lowerNames.some(filterName => libNameLower.includes(filterName));
          });
        }

        setLibraries(libs);
      }
    } catch (error) {
      console.error('Error loading libraries:', error);
    } finally {
      setIsLoadingLibraries(false);
    }
  }, [clientAgency, libraryNames]);

  // Verzeichnis laden
  const loadDirectory = useCallback(async (library: Library, path: string) => {
    if (!clientAgency) return;

    setIsLoadingDirectory(true);
    try {
      const response = await fetch(
        `/api/admin/luckycloud/files?agency=${clientAgency}&libraryId=${library.id}&path=${encodeURIComponent(path)}`
      );
      const data = await response.json();

      if (response.ok && data.success) {
        // Nur Ordner anzeigen
        setItems(data.items.filter((item: FileItem) => item.type === 'dir'));
      }
    } catch (error) {
      console.error('Error loading directory:', error);
    } finally {
      setIsLoadingDirectory(false);
    }
  }, [clientAgency]);

  // Modal öffnen
  const openModal = () => {
    setIsModalOpen(true);
    setSelectedLibrary(null);
    setCurrentPath('/');
    setItems([]);
    setMessage(null);
    loadLibraries();
  };

  // Modal schließen
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedLibrary(null);
    setCurrentPath('/');
    setItems([]);
  };

  // Bibliothek auswählen
  const selectLibrary = (library: Library) => {
    setSelectedLibrary(library);
    setCurrentPath('/');
    loadDirectory(library, '/');
  };

  // In Ordner navigieren
  const navigateToFolder = (folderName: string) => {
    if (!selectedLibrary) return;
    const newPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
    setCurrentPath(newPath);
    loadDirectory(selectedLibrary, newPath);
  };

  // Eine Ebene hoch
  const navigateUp = () => {
    if (!selectedLibrary || currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length === 0 ? '/' : `/${parts.join('/')}`;
    setCurrentPath(newPath);
    loadDirectory(selectedLibrary, newPath);
  };

  // Zurück zur Bibliotheksauswahl
  const backToLibraries = () => {
    setSelectedLibrary(null);
    setCurrentPath('/');
    setItems([]);
  };

  // Helper: Zuordnung aktualisieren
  const updateAssignment = (data: typeof currentAssignment) => {
    setCurrentAssignment(data);
    onAssignmentChange?.(data);
  };

  // Projektordner erstellen
  const createProjectFolder = async () => {
    if (!selectedLibrary || !clientAgency) return;

    const folderName = `${client.customerNo || 'OHNE-NR'} - ${client.name}`;
    const newFolderPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;

    setIsCreatingFolder(true);
    setMessage(null);

    try {
      // Hauptordner erstellen
      const response = await fetch(
        `/api/admin/luckycloud/files?agency=${clientAgency}&libraryId=${selectedLibrary.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: currentPath,
            folderName: folderName,
          }),
        }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Fehler beim Erstellen des Ordners');
      }

      // Kurz warten damit Seafile den Hauptordner synchronisieren kann
      await new Promise(resolve => setTimeout(resolve, 500));

      // Unterordner sequentiell erstellen (parallel führt zu Fehlern bei Seafile)
      for (const subfolderName of PROJECT_SUBFOLDERS) {
        const subResponse = await fetch(
          `/api/admin/luckycloud/files?agency=${clientAgency}&libraryId=${selectedLibrary.id}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: newFolderPath,
              folderName: subfolderName,
            }),
          }
        );
        const subData = await subResponse.json();
        if (!subResponse.ok || !subData.success) {
          console.warn(`Unterordner "${subfolderName}" konnte nicht erstellt werden:`, subData.error);
        }
      }

      // Zuordnung speichern
      const assignResponse = await fetch('/api/admin/luckycloud/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          libraryId: selectedLibrary.id,
          libraryName: selectedLibrary.name,
          folderPath: newFolderPath,
        }),
      });
      const assignData = await assignResponse.json();

      if (assignData.success) {
        updateAssignment({
          luckyCloudLibraryId: selectedLibrary.id,
          luckyCloudLibraryName: selectedLibrary.name,
          luckyCloudFolderPath: newFolderPath,
        });
        setMessage({
          type: 'success',
          text: `Projektordner "${folderName}" wurde erstellt und zugeordnet.`,
        });
        closeModal();
      } else {
        throw new Error(assignData.error || 'Fehler beim Speichern der Zuordnung');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Aktuellen Ordner zuordnen
  const assignCurrentFolder = async () => {
    if (!selectedLibrary) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/luckycloud/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          libraryId: selectedLibrary.id,
          libraryName: selectedLibrary.name,
          folderPath: currentPath === '/' ? null : currentPath,
        }),
      });
      const data = await response.json();

      if (data.success) {
        updateAssignment({
          luckyCloudLibraryId: selectedLibrary.id,
          luckyCloudLibraryName: selectedLibrary.name,
          luckyCloudFolderPath: currentPath === '/' ? null : currentPath,
        });
        setMessage({
          type: 'success',
          text: `Zuordnung für "${client.name}" wurde gespeichert.`,
        });
        closeModal();
      } else {
        throw new Error(data.error || 'Fehler beim Speichern');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Zuordnung entfernen
  const removeAssignment = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/luckycloud/clients', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          libraryId: null,
          libraryName: null,
          folderPath: null,
        }),
      });
      const data = await response.json();

      if (data.success) {
        updateAssignment({
          luckyCloudLibraryId: null,
          luckyCloudLibraryName: null,
          luckyCloudFolderPath: null,
        });
        setMessage({
          type: 'success',
          text: `Zuordnung für "${client.name}" wurde entfernt.`,
        });
      } else {
        throw new Error(data.error || 'Fehler beim Entfernen');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Kein Agentur-Zuordnung oder Agentur nicht konfiguriert
  if (!client.agency) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>Keine Agentur zugeordnet - LuckyCloud nicht verfügbar</span>
        </div>
      );
    }
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Diesem Kunden ist keine Agentur zugeordnet. Bitte ordne zuerst eine Agentur zu, um LuckyCloud nutzen zu können.
        </AlertDescription>
      </Alert>
    );
  }

  if (!clientAgency) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>Agentur "{client.agency.name}" nicht für LuckyCloud konfiguriert</span>
        </div>
      );
    }
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Die Agentur "{client.agency.name}" ist nicht für LuckyCloud konfiguriert.
        </AlertDescription>
      </Alert>
    );
  }

  const content = (
    <>
      {/* Aktuelle Zuordnung */}
      {currentAssignment.luckyCloudLibraryId ? (
        <div className={compact ? "space-y-2" : "rounded-md border bg-background p-3 space-y-3"}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium flex items-center gap-2">
              <Cloud className="h-4 w-4 text-sky-500" />
              LuckyCloud-Zuordnung
            </div>
            <Badge variant="default" className="text-xs">Aktiv</Badge>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <LibraryIcon className="h-4 w-4 text-blue-500" />
              <span>{currentAssignment.luckyCloudLibraryName || currentAssignment.luckyCloudLibraryId}</span>
            </div>
            {currentAssignment.luckyCloudFolderPath && (
              <div className="flex items-center gap-2 text-sm">
                <Folder className="h-4 w-4 text-amber-500" />
                <span className="truncate" title={currentAssignment.luckyCloudFolderPath}>
                  {currentAssignment.luckyCloudFolderPath}
                </span>
              </div>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={openModal}>
                <Settings className="h-4 w-4 mr-2" />
                Ändern
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={removeAssignment}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Entfernen
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className={compact ? "" : "rounded-md border border-dashed bg-background p-4"}>
          <div className={compact ? "flex items-center gap-3" : "flex flex-col items-center gap-3 text-center"}>
            <Cloud className={compact ? "h-5 w-5 text-muted-foreground" : "h-8 w-8 text-muted-foreground"} />
            <div className={compact ? "flex-1" : ""}>
              <p className="text-sm font-medium">Keine LuckyCloud-Zuordnung</p>
              {!compact && (
                <p className="text-xs text-muted-foreground">
                  Ordne diesem Kunden eine Bibliothek und einen Ordner zu
                </p>
              )}
            </div>
            {canEdit && (
              <Button onClick={openModal} size={compact ? "sm" : "default"}>
                <FolderPlus className="h-4 w-4 mr-2" />
                LuckyCloud einrichten
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Erfolg/Fehler-Meldung */}
      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className="mt-2">
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Modal für Bibliotheks-/Ordnerauswahl */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-sky-500" />
              LuckyCloud einrichten
            </DialogTitle>
            <DialogDescription>
              <span>
                Für <strong>{client.name}</strong>
                {client.customerNo && ` (${client.customerNo})`}
                {client.agency && (
                  <span className="ml-2">
                    • <Building2 className="h-3 w-3 inline mr-1" />
                    {client.agency.name}
                  </span>
                )}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Breadcrumb */}
            {selectedLibrary && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <button
                  className="hover:text-foreground"
                  onClick={backToLibraries}
                >
                  Bibliotheken
                </button>
                <ChevronRight className="h-3 w-3" />
                <button
                  className="hover:text-foreground"
                  onClick={() => {
                    setCurrentPath('/');
                    loadDirectory(selectedLibrary, '/');
                  }}
                >
                  {selectedLibrary.name}
                </button>
                {currentPath !== '/' && currentPath.split('/').filter(Boolean).map((part, i, arr) => (
                  <span key={i} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" />
                    <span className={i === arr.length - 1 ? 'font-medium text-foreground' : ''}>
                      {part}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Bibliotheken-Liste */}
            {!selectedLibrary && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Bibliothek auswählen:</h4>
                {isLoadingLibraries ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : libraries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Keine Bibliotheken gefunden.</p>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {libraries.map((lib) => (
                        <div
                          key={lib.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => selectLibrary(lib)}
                        >
                          <div className="flex items-center gap-3">
                            <LibraryIcon className="h-5 w-5 text-blue-500" />
                            <div>
                              <p className="font-medium">{lib.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatSize(lib.size)}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Ordner-Liste */}
            {selectedLibrary && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Ordner auswählen oder erstellen:</h4>
                  {currentPath !== '/' && (
                    <Button variant="ghost" size="sm" onClick={navigateUp}>
                      <Home className="h-4 w-4 mr-1" />
                      Zurück
                    </Button>
                  )}
                </div>

                {isLoadingDirectory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ScrollArea className="h-[250px] border rounded-lg">
                    <div className="p-2 space-y-1">
                      {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          Keine Unterordner vorhanden.
                        </p>
                      ) : (
                        items.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => navigateToFolder(item.name)}
                          >
                            <FolderOpen className="h-5 w-5 text-amber-500" />
                            <span className="text-sm flex-1">{item.name}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                )}

                {/* Aktionen */}
                <div className="flex flex-col gap-3 pt-4 border-t">
                  {/* Neuen Projektordner erstellen */}
                  <div className="space-y-1">
                    <Button
                      onClick={createProjectFolder}
                      disabled={isCreatingFolder || isSaving}
                      className="w-full"
                    >
                      {isCreatingFolder ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                      ) : (
                        <FolderPlus className="h-4 w-4 mr-2 flex-shrink-0" />
                      )}
                      Neuen Projektordner erstellen
                    </Button>
                    <p className="text-xs text-muted-foreground text-center truncate px-2">
                      {client.customerNo || 'OHNE-NR'} - {client.name}
                    </p>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">oder</span>
                    </div>
                  </div>

                  {/* Aktuellen Ordner zuordnen */}
                  <div className="space-y-1">
                    <Button
                      variant="outline"
                      onClick={assignCurrentFolder}
                      disabled={isCreatingFolder || isSaving}
                      className="w-full"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                      ) : (
                        <Check className="h-4 w-4 mr-2 flex-shrink-0" />
                      )}
                      {currentPath === '/'
                        ? 'Nur Bibliothek zuordnen'
                        : 'Aktuellen Ordner zuordnen'}
                    </Button>
                    {currentPath !== '/' && (
                      <p className="text-xs text-muted-foreground text-center truncate px-2" title={currentPath}>
                        {currentPath}
                      </p>
                    )}
                  </div>
                </div>

                {/* Fehler im Modal */}
                {message && message.type === 'error' && (
                  <Alert variant="destructive">
                    <AlertDescription>{message.text}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  if (compact) {
    return <div className="space-y-2">{content}</div>;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Cloud className="h-5 w-5 text-sky-500" />
        <h3 className="font-semibold">LuckyCloud</h3>
      </div>
      {content}
    </div>
  );
}
