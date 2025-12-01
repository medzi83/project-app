'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  Check,
  Loader2,
  ChevronRight,
  Cloud,
  Settings,
  Home,
  AlertTriangle,
  X,
  FileBox,
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

type FileItem = {
  name: string;
  type: 'file' | 'dir';
  size?: number;
  mtime?: string;
};

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
  const { projectId, client } = data;

  // Lokaler State für die aktuelle Zuordnung
  const [currentFolderPath, setCurrentFolderPath] = useState<string | null>(data.luckyCloudFolderPath);

  // Update wenn sich Props ändern
  useEffect(() => {
    setCurrentFolderPath(data.luckyCloudFolderPath);
  }, [data.luckyCloudFolderPath]);

  // Ermittle die Agency aus dem Kunden
  const clientAgency: Agency | null = client.agency?.name
    ? getAgencyKey(client.agency.name)
    : null;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState<FileItem[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Verzeichnis laden (relativ zum Kunden-Ordner)
  const loadDirectory = useCallback(async (path: string) => {
    if (!clientAgency || !client.luckyCloudLibraryId) return;

    setIsLoadingDirectory(true);
    try {
      // Kombiniere Kunden-Ordner-Pfad mit dem relativen Pfad
      const fullPath = client.luckyCloudFolderPath
        ? (path === '/' ? client.luckyCloudFolderPath : `${client.luckyCloudFolderPath}${path}`)
        : path;

      const response = await fetch(
        `/api/admin/luckycloud/files?agency=${clientAgency}&libraryId=${client.luckyCloudLibraryId}&path=${encodeURIComponent(fullPath)}`
      );
      const responseData = await response.json();

      if (response.ok && responseData.success) {
        // Nur Ordner anzeigen
        setItems(responseData.items.filter((item: FileItem) => item.type === 'dir'));
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Error loading directory:', error);
      setItems([]);
    } finally {
      setIsLoadingDirectory(false);
    }
  }, [clientAgency, client.luckyCloudLibraryId, client.luckyCloudFolderPath]);

  // Modal öffnen
  const openModal = () => {
    setIsModalOpen(true);
    setCurrentPath('/');
    setItems([]);
    setMessage(null);
    loadDirectory('/');
  };

  // Modal schließen
  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentPath('/');
    setItems([]);
  };

  // In Ordner navigieren
  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`;
    setCurrentPath(newPath);
    loadDirectory(newPath);
  };

  // Eine Ebene hoch
  const navigateUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length === 0 ? '/' : `/${parts.join('/')}`;
    setCurrentPath(newPath);
    loadDirectory(newPath);
  };

  // Helper: Zuordnung aktualisieren
  const updateAssignment = async (folderPath: string | null) => {
    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/luckycloud/project-folder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          folderPath,
        }),
      });
      const responseData = await response.json();

      if (responseData.success) {
        setCurrentFolderPath(folderPath);
        onAssignmentChange?.(folderPath);
        return true;
      } else {
        throw new Error(responseData.error || 'Fehler beim Speichern');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Aktuellen Ordner zuordnen
  const assignCurrentFolder = async () => {
    const success = await updateAssignment(currentPath === '/' ? null : currentPath);
    if (success) {
      setMessage({
        type: 'success',
        text: currentPath === '/'
          ? 'Material-Ordner-Zuordnung entfernt.'
          : `Material-Ordner "${currentPath}" zugeordnet.`,
      });
      closeModal();
    }
  };

  // Zuordnung entfernen
  const removeAssignment = async () => {
    const success = await updateAssignment(null);
    if (success) {
      setMessage({
        type: 'success',
        text: 'Material-Ordner-Zuordnung entfernt.',
      });
    }
  };

  // Vollständiger Pfad für Anzeige
  const getFullPath = () => {
    if (!client.luckyCloudFolderPath || !currentFolderPath) return currentFolderPath;
    return `${client.luckyCloudFolderPath}${currentFolderPath}`;
  };

  // Kein LuckyCloud beim Kunden eingerichtet
  if (!client.luckyCloudLibraryId) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileBox className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold">Material-Ordner</h3>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Für diesen Kunden ist noch keine LuckyCloud-Zuordnung eingerichtet.
            Bitte zuerst im Kundendetailblatt eine Bibliothek und einen Ordner zuordnen.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Keine Agentur oder Agentur nicht konfiguriert
  if (!clientAgency) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileBox className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold">Material-Ordner</h3>
        </div>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Die Agentur des Kunden ist nicht für LuckyCloud konfiguriert.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileBox className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold">Material-Ordner</h3>
      </div>

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

      {/* Aktuelle Zuordnung */}
      {currentFolderPath ? (
        <div className="rounded-md border bg-background p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium flex items-center gap-2">
              <Folder className="h-4 w-4 text-amber-500" />
              Material-Ordner
            </div>
            <Badge variant="default" className="text-xs">Zugeordnet</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="truncate" title={getFullPath() || undefined}>
              {currentFolderPath}
            </span>
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
        <div className="rounded-md border border-dashed bg-background p-3">
          <div className="flex items-center gap-3">
            <Folder className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Kein Material-Ordner zugeordnet</p>
              <p className="text-xs text-muted-foreground">
                Wähle einen Unterordner für das Projektmaterial
              </p>
            </div>
            {canEdit && (
              <Button onClick={openModal} size="sm">
                <Folder className="h-4 w-4 mr-2" />
                Zuordnen
              </Button>
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

      {/* Modal für Ordnerauswahl */}
      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-lg max-h-[70vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-amber-500" />
              Material-Ordner auswählen
            </DialogTitle>
            <DialogDescription>
              Wähle einen Unterordner im Kunden-Ordner als Material-Ordner für dieses Projekt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <button
                className="hover:text-foreground"
                onClick={() => {
                  setCurrentPath('/');
                  loadDirectory('/');
                }}
              >
                {client.luckyCloudFolderPath || 'Kunden-Ordner'}
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

            {/* Ordner-Liste */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Ordner:</h4>
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
                <ScrollArea className="h-[200px] border rounded-lg">
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

              {/* Aktion: Aktuellen Ordner zuordnen */}
              <div className="pt-4 border-t space-y-2">
                <Button
                  onClick={assignCurrentFolder}
                  disabled={isSaving}
                  className="w-full"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  {currentPath === '/'
                    ? 'Kein Unterordner (Zuordnung entfernen)'
                    : 'Diesen Ordner zuordnen'}
                </Button>
                {currentPath !== '/' && (
                  <p className="text-xs text-muted-foreground text-center truncate" title={currentPath}>
                    {currentPath}
                  </p>
                )}
              </div>

              {/* Fehler im Modal */}
              {message && message.type === 'error' && (
                <Alert variant="destructive">
                  <AlertDescription>{message.text}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
