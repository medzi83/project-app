'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  FolderOpen,
  FileIcon,
  Image as ImageIcon,
  FileText,
  ChevronRight,
  RefreshCw,
  Home,
  Download,
  Eye,
  Trash2,
  MessageSquare,
  Send,
  X,
  ThumbsUp,
  ThumbsDown,
  Search,
  FolderSearch,
  FolderPlus
} from 'lucide-react';

export type Library = {
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

type ExplorerState = {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  libraries: Library[];
  currentLibrary: Library | null;
  currentPath: string;
  items: FileItem[];
  error?: string;
};

type PreviewState = {
  isOpen: boolean;
  loading: boolean;
  fileName: string;
  fileType: 'image' | 'pdf' | 'other';
  url: string | null;
  error?: string;
};

type DeleteState = {
  isOpen: boolean;
  item: FileItem | null;
  loading: boolean;
};

type Comment = {
  id: number;
  comment: string;
  user_name: string;
  created_at: string;
};

type CommentState = {
  isOpen: boolean;
  item: FileItem | null;
  comments: Comment[];
  loading: boolean;
  submitting: boolean;
  newComment: string;
  error?: string;
};

type SearchResult = {
  path: string;
  name: string;
};

type SearchState = {
  isSearching: boolean;
  query: string;
  results: SearchResult[];
  searched: boolean;
};

type NewFolderState = {
  isOpen: boolean;
  folderName: string;
  creating: boolean;
  createProjectFolders: boolean;
  error?: string;
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

// Hilfsfunktion für Datum-Formatierung (Unix-Timestamp in Sekunden)
function formatDate(mtime: string | number): string {
  try {
    // LuckyCloud liefert Unix-Timestamp in Sekunden
    const timestamp = typeof mtime === 'string' ? parseInt(mtime) : mtime;
    // Prüfen ob der Timestamp in Sekunden ist (< Jahr 2100 in ms wäre zu klein)
    const date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);

    // Prüfen ob das Datum gültig ist
    if (isNaN(date.getTime()) || date.getFullYear() < 2000) {
      return '';
    }

    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

// Hilfsfunktion für Datei-Format
function getFileExtension(fileName: string): string {
  const ext = fileName.split('.').pop()?.toUpperCase() || '';
  return ext;
}

// Bild-Thumbnail mit Hover-Vorschau - zeigt Mini-Bild statt Icon
function ImageThumbnail({
  agency,
  libraryId,
  filePath,
  fileName,
  fileSize,
  onFullPreview
}: {
  agency: string;
  libraryId: string;
  filePath: string;
  fileName: string;
  fileSize?: number;
  onFullPreview: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasStartedLoading, setHasStartedLoading] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Thumbnail über Share-Link laden (direkt von LuckyCloud, kein Vercel-Proxy)
  const loadImage = async () => {
    if (imageUrl || loading || hasStartedLoading) return;

    setHasStartedLoading(true);
    setLoading(true);

    try {
      // Share-Link für Thumbnail von API holen
      const response = await fetch(
        `/api/admin/luckycloud/share-link?agency=${agency}&libraryId=${libraryId}&path=${encodeURIComponent(filePath)}&type=thumbnail&size=96`
      );
      const data = await response.json();

      if (response.ok && data.success && data.url) {
        setImageUrl(data.url);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };


  // Bildgröße formatieren
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div
          ref={(el) => {
            if (el && !hasStartedLoading) {
              // Lazy load: Bild laden wenn Element sichtbar wird
              const observer = new IntersectionObserver(
                (entries) => {
                  if (entries[0].isIntersecting) {
                    loadImage();
                    observer.disconnect();
                  }
                },
                { threshold: 0.1 }
              );
              observer.observe(el);
            }
          }}
          className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all overflow-hidden"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          onClick={(e) => {
            e.stopPropagation();
            onFullPreview();
          }}
        >
          {/* Zeige Thumbnail oder Fallback-Icon */}
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={fileName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                }
              }}
            />
          ) : loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : error ? (
            <ImageIcon className="h-5 w-5 text-red-400" />
          ) : (
            <ImageIcon className="h-5 w-5 text-green-500" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-2"
        side="right"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div className="space-y-2">
          <p className="text-xs font-medium truncate">{fileName}</p>

          {loading && (
            <div className="h-48 flex items-center justify-center bg-muted rounded">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="h-48 flex items-center justify-center bg-muted rounded">
              <p className="text-xs text-muted-foreground">Fehler beim Laden</p>
            </div>
          )}

          {!loading && !error && imageUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={fileName}
                referrerPolicy="no-referrer"
                className="w-full h-48 object-contain rounded bg-muted cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onFullPreview();
                }}
              />
              {/* Bild-Informationen */}
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                {dimensions && (
                  <span>{dimensions.width} × {dimensions.height} px</span>
                )}
                {fileSize && (
                  <span>{formatFileSize(fileSize)}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Klicken für Vollansicht
              </p>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Bewertungs-Konstanten
const RATING_SUITABLE = 'GEEIGNET';
const RATING_NOT_SUITABLE_PREFIX = 'NICHT GEEIGNET';

// Begründungen für "Nicht geeignet"
const NOT_SUITABLE_REASONS = [
  { id: 'resolution', label: 'Auflösung zu gering' },
  { id: 'blurry', label: 'Bild unscharf' },
  { id: 'motif', label: 'Motiv ungeeignet' },
  { id: 'format', label: 'Format falsch' },
  { id: 'filetype', label: 'Falsches Dateiformat' },
] as const;

// Komponente für Datei-Zeile mit Kommentar-Anzeige
function FileListItem({
  item,
  agency,
  libraryId,
  filePath,
  onNavigate,
  onPreview,
  onDownload,
  onDelete,
  onComment,
  formatSize,
  getFileIcon,
  getFileType,
  isImage
}: {
  item: FileItem;
  agency: string;
  libraryId: string;
  filePath: string;
  onNavigate: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onComment: () => void;
  formatSize: (bytes: number) => string;
  getFileIcon: (item: FileItem) => React.ReactNode;
  getFileType: (fileName: string) => 'image' | 'pdf' | 'other';
  isImage: (fileName: string) => boolean;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [isRating, setIsRating] = useState(false);

  // Kommentare laden für Bilder und PDFs
  const canHaveComments = item.type === 'file' && (isImage(item.name) || getFileType(item.name) === 'pdf');

  // Prüfen ob es eine Bewertung gibt
  const getRating = (): { type: 'suitable' | 'not-suitable'; reason?: string } | null => {
    const ratingComment = comments.find(c =>
      c.comment === RATING_SUITABLE || c.comment.startsWith(RATING_NOT_SUITABLE_PREFIX)
    );
    if (!ratingComment) return null;
    if (ratingComment.comment === RATING_SUITABLE) {
      return { type: 'suitable' };
    }
    // Extrahiere die Begründung aus "NICHT GEEIGNET: Begründung"
    const reason = ratingComment.comment.replace(`${RATING_NOT_SUITABLE_PREFIX}: `, '');
    return { type: 'not-suitable', reason: reason !== RATING_NOT_SUITABLE_PREFIX ? reason : undefined };
  };

  const currentRating = getRating();

  // Lazy-load Kommentare wenn Element sichtbar wird
  const loadComments = async () => {
    if (commentsLoaded || !canHaveComments) return;

    try {
      const response = await fetch(
        `/api/admin/luckycloud/comments?agency=${agency}&libraryId=${libraryId}&path=${encodeURIComponent(filePath)}`
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setComments(data.comments || []);
      }
    } catch {
      // Ignorieren
    } finally {
      setCommentsLoaded(true);
    }
  };

  // Bewertung setzen
  const setRating = async (rating: 'suitable' | 'not-suitable', reason?: string) => {
    if (isRating) return;
    setIsRating(true);

    try {
      // Erst alte Bewertungs-Kommentare löschen
      const oldRatingComments = comments.filter(c =>
        c.comment === RATING_SUITABLE || c.comment.startsWith(RATING_NOT_SUITABLE_PREFIX)
      );

      for (const oldComment of oldRatingComments) {
        await fetch(
          `/api/admin/luckycloud/comments?agency=${agency}&libraryId=${libraryId}&commentId=${oldComment.id}`,
          { method: 'DELETE' }
        );
      }

      // Neuen Bewertungs-Kommentar hinzufügen
      const commentText = rating === 'suitable'
        ? RATING_SUITABLE
        : `${RATING_NOT_SUITABLE_PREFIX}: ${reason}`;
      const response = await fetch(
        `/api/admin/luckycloud/comments?agency=${agency}&libraryId=${libraryId}&path=${encodeURIComponent(filePath)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: commentText }),
        }
      );
      const data = await response.json();

      if (response.ok && data.success) {
        // Lokalen State aktualisieren
        setComments(prev => [
          ...prev.filter(c => c.comment !== RATING_SUITABLE && !c.comment.startsWith(RATING_NOT_SUITABLE_PREFIX)),
          data.comment
        ]);
      }
    } catch (error) {
      console.error('Fehler beim Setzen der Bewertung:', error);
    } finally {
      setIsRating(false);
    }
  };

  return (
    <div
      ref={(el) => {
        if (el && !commentsLoaded && canHaveComments) {
          const observer = new IntersectionObserver(
            (entries) => {
              if (entries[0].isIntersecting) {
                loadComments();
                observer.disconnect();
              }
            },
            { threshold: 0.1 }
          );
          observer.observe(el);
        }
      }}
      className={`flex items-center justify-between p-2 rounded hover:bg-muted/50 ${
        item.type === 'dir' ? 'cursor-pointer' : ''
      } transition-colors group`}
      onClick={() => item.type === 'dir' && onNavigate()}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Bild-Icon mit Hover-Vorschau für Bilder, sonst normales Icon */}
        {item.type === 'file' && isImage(item.name) ? (
          <ImageThumbnail
            agency={agency}
            libraryId={libraryId}
            filePath={filePath}
            fileName={item.name}
            fileSize={item.size}
            onFullPreview={onPreview}
          />
        ) : (
          <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center shrink-0">
            {getFileIcon(item)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <span className="text-sm truncate block">{item.name}</span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.type === 'file' && (
              <span>{getFileExtension(item.name)}</span>
            )}
            {item.size !== undefined && (
              <span>{formatSize(item.size)}</span>
            )}
            {item.mtime && formatDate(item.mtime) && (
              <span>{formatDate(item.mtime)}</span>
            )}
          </div>
          {/* Bewertung und Kommentare direkt in der Liste anzeigen */}
          {comments.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {comments.map((comment) => {
                // Bewertungs-Kommentare farblich hervorheben
                const isSuitable = comment.comment === RATING_SUITABLE;
                const isNotSuitable = comment.comment.startsWith(RATING_NOT_SUITABLE_PREFIX);
                const isRatingComment = isSuitable || isNotSuitable;

                if (isRatingComment) {
                  // Extrahiere Begründung bei "nicht geeignet"
                  const reason = isNotSuitable
                    ? comment.comment.replace(`${RATING_NOT_SUITABLE_PREFIX}: `, '')
                    : null;

                  return (
                    <div
                      key={comment.id}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                        isSuitable
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {isSuitable ? (
                        <ThumbsUp className="h-3 w-3" />
                      ) : (
                        <ThumbsDown className="h-3 w-3" />
                      )}
                      <span className="font-medium">
                        {isSuitable ? RATING_SUITABLE : RATING_NOT_SUITABLE_PREFIX}
                        {reason && `: ${reason}`}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={comment.id} className="flex items-start gap-1 text-xs">
                    <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground truncate">
                      <span className="font-medium">{comment.user_name}:</span> {comment.comment}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {/* Bewertungs-Buttons für Bilder - immer sichtbar */}
        {item.type === 'file' && isImage(item.name) && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${
                currentRating?.type === 'suitable'
                  ? 'text-green-600 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50'
                  : 'text-muted-foreground/50 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setRating('suitable');
              }}
              disabled={isRating}
              title="Geeignet"
            >
              {isRating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ThumbsUp className="h-4 w-4" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${
                    currentRating?.type === 'not-suitable'
                      ? 'text-red-600 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50'
                      : 'text-muted-foreground/50 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                  }`}
                  disabled={isRating}
                  title="Nicht geeignet"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isRating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsDown className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {NOT_SUITABLE_REASONS.map((reason) => (
                  <DropdownMenuItem
                    key={reason.id}
                    onClick={() => setRating('not-suitable', reason.label)}
                    className="text-red-600 focus:text-red-600 cursor-pointer"
                  >
                    {reason.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-px h-6 bg-border mx-1" />
          </>
        )}
        {/* Weitere Buttons nur beim Hover sichtbar */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Vorschau-Button für PDFs */}
        {item.type === 'file' && getFileType(item.name) === 'pdf' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            title="Vorschau"
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
        {item.type === 'file' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            title="Herunterladen"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        {/* Kommentar-Button nur für Bilder und PDFs */}
        {canHaveComments && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onComment();
            }}
            title="Kommentare"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Löschen"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        </div>
      </div>
    </div>
  );
}

type LuckyCloudFileExplorerProps = {
  agency: 'eventomaxx' | 'vendoweb';
  /** ID der Bibliothek die automatisch geöffnet werden soll */
  defaultLibraryId?: string;
  /** Bibliotheken automatisch beim Start laden */
  autoLoad?: boolean;
  /** Nur diese Bibliothek-IDs anzeigen (Whitelist) */
  libraryIds?: string[];
  /** Nur diese Bibliothek-Namen anzeigen (Whitelist, case-insensitive) */
  libraryNames?: string[];
  /** Callback wenn sich Library oder Pfad ändert */
  onSelectionChange?: (selection: {
    libraries: Library[];
    libraryId: string | null;
    libraryName: string | null;
    path: string;
  }) => void;
};

export function LuckyCloudFileExplorer({
  agency,
  defaultLibraryId,
  autoLoad = true,
  libraryIds,
  libraryNames,
  onSelectionChange,
}: LuckyCloudFileExplorerProps) {
  const [state, setState] = useState<ExplorerState>({
    status: 'idle',
    libraries: [],
    currentLibrary: null,
    currentPath: '/',
    items: [],
  });
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const [preview, setPreview] = useState<PreviewState>({
    isOpen: false,
    loading: false,
    fileName: '',
    fileType: 'other',
    url: null,
  });

  const [deleteDialog, setDeleteDialog] = useState<DeleteState>({
    isOpen: false,
    item: null,
    loading: false,
  });

  const [commentDialog, setCommentDialog] = useState<CommentState>({
    isOpen: false,
    item: null,
    comments: [],
    loading: false,
    submitting: false,
    newComment: '',
  });

  const [search, setSearch] = useState<SearchState>({
    isSearching: false,
    query: '',
    results: [],
    searched: false,
  });

  const [newFolder, setNewFolder] = useState<NewFolderState>({
    isOpen: false,
    folderName: '',
    creating: false,
    createProjectFolders: false,
  });

  const loadLibraries = async (openLibraryId?: string) => {
    setState(prev => ({ ...prev, status: 'loading' }));

    try {
      const response = await fetch(`/api/admin/luckycloud/libraries?agency=${agency}`);
      const data = await response.json();

      if (response.ok && data.success) {
        let libraries = data.libraries as Library[];

        // Bibliotheken filtern falls Whitelist angegeben
        if (libraryIds && libraryIds.length > 0) {
          libraries = libraries.filter(lib => libraryIds.includes(lib.id));
        } else if (libraryNames && libraryNames.length > 0) {
          const lowerNames = libraryNames.map(n => n.toLowerCase());
          // Teilübereinstimmung: Bibliotheksname enthält einen der Filternamen
          libraries = libraries.filter(lib => {
            const libNameLower = lib.name.toLowerCase();
            return lowerNames.some(filterName => libNameLower.includes(filterName));
          });
        }

        // Falls eine Standard-Bibliothek angegeben wurde, diese direkt öffnen
        if (openLibraryId) {
          const targetLibrary = libraries.find(lib => lib.id === openLibraryId);
          if (targetLibrary) {
            setState(prev => ({
              ...prev,
              status: 'loaded',
              libraries,
              currentLibrary: null,
              currentPath: '/',
              items: [],
            }));
            // Bibliothek direkt öffnen
            loadDirectory(targetLibrary, '/');
            return;
          }
        }

        // Falls nur eine Bibliothek vorhanden, diese direkt öffnen
        if (libraries.length === 1) {
          setState(prev => ({
            ...prev,
            status: 'loaded',
            libraries,
            currentLibrary: null,
            currentPath: '/',
            items: [],
          }));
          loadDirectory(libraries[0], '/');
          return;
        }

        setState(prev => ({
          ...prev,
          status: 'loaded',
          libraries,
          currentLibrary: null,
          currentPath: '/',
          items: [],
        }));
      } else {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: data.error || 'Fehler beim Laden der Bibliotheken',
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      }));
    }
  };

  // Automatisch laden beim Start
  useEffect(() => {
    if (autoLoad && !initialLoadDone) {
      setInitialLoadDone(true);
      loadLibraries(defaultLibraryId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, defaultLibraryId]);

  // Selection-Change-Callback aufrufen
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange({
        libraries: state.libraries,
        libraryId: state.currentLibrary?.id || null,
        libraryName: state.currentLibrary?.name || null,
        path: state.currentPath,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.libraries, state.currentLibrary, state.currentPath]);

  const loadDirectory = async (library: Library, path: string = '/') => {
    setState(prev => ({ ...prev, status: 'loading', currentLibrary: library, currentPath: path }));

    try {
      const response = await fetch(
        `/api/admin/luckycloud/files?agency=${agency}&libraryId=${library.id}&path=${encodeURIComponent(path)}`
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setState(prev => ({
          ...prev,
          status: 'loaded',
          items: data.items,
        }));
      } else {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: data.error || 'Fehler beim Laden des Verzeichnisses',
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      }));
    }
  };

  const navigateToFolder = (folderName: string) => {
    if (!state.currentLibrary) return;
    const newPath = state.currentPath === '/'
      ? `/${folderName}`
      : `${state.currentPath}/${folderName}`;
    loadDirectory(state.currentLibrary, newPath);
  };

  const navigateUp = () => {
    if (!state.currentLibrary || state.currentPath === '/') return;
    const parts = state.currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length === 0 ? '/' : `/${parts.join('/')}`;
    loadDirectory(state.currentLibrary, newPath);
  };

  const goToLibraries = () => {
    setState(prev => ({
      ...prev,
      currentLibrary: null,
      currentPath: '/',
      items: [],
    }));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getFileType = (fileName: string): 'image' | 'pdf' | 'other' => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '')) {
      return 'image';
    }
    if (ext === 'pdf') {
      return 'pdf';
    }
    return 'other';
  };

  const isImage = (fileName: string): boolean => {
    return getFileType(fileName) === 'image';
  };

  const getFileIcon = (item: FileItem) => {
    if (item.type === 'dir') return <FolderOpen className="h-5 w-5 text-blue-500" />;

    const ext = item.name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return <ImageIcon className="h-5 w-5 text-green-500" />;
    }
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) {
      return <FileText className="h-5 w-5 text-orange-500" />;
    }
    return <FileIcon className="h-5 w-5 text-gray-500" />;
  };

  const canPreview = (fileName: string): boolean => {
    const fileType = getFileType(fileName);
    return fileType === 'image' || fileType === 'pdf';
  };

  const getFilePath = (fileName: string): string => {
    return state.currentPath === '/'
      ? `/${fileName}`
      : `${state.currentPath}/${fileName}`;
  };

  const openFile = (item: FileItem) => {
    if (!state.currentLibrary || item.type === 'dir') return;

    const filePath = getFilePath(item.name);
    const fileType = getFileType(item.name);

    // Für alle Dateitypen: Share-Link holen (direkt von LuckyCloud, kein Vercel-Proxy)
    setPreview({
      isOpen: true,
      loading: true,
      fileName: item.name,
      fileType,
      url: null,
    });

    // Share-Link für Vollbild holen
    fetch(`/api/admin/luckycloud/share-link?agency=${agency}&libraryId=${state.currentLibrary.id}&path=${encodeURIComponent(filePath)}&type=full`)
      .then(response => response.json())
      .then(data => {
        if (data.success && data.url) {
          setPreview(prev => ({
            ...prev,
            loading: false,
            url: data.url,
          }));
        } else {
          setPreview(prev => ({
            ...prev,
            loading: false,
            error: data.error || 'Fehler beim Laden der Datei',
          }));
        }
      })
      .catch(error => {
        setPreview(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unbekannter Fehler',
        }));
      });
  };

  const downloadFile = async (item: FileItem) => {
    if (!state.currentLibrary || item.type === 'dir') return;

    const filePath = getFilePath(item.name);

    try {
      const response = await fetch(
        `/api/admin/luckycloud/download?agency=${agency}&libraryId=${state.currentLibrary.id}&path=${encodeURIComponent(filePath)}`
      );
      const data = await response.json();

      if (response.ok && data.success) {
        window.open(data.downloadLink, '_blank');
      } else {
        alert(data.error || 'Fehler beim Erstellen des Download-Links');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unbekannter Fehler');
    }
  };

  const confirmDelete = (item: FileItem) => {
    setDeleteDialog({
      isOpen: true,
      item,
      loading: false,
    });
  };

  const executeDelete = async () => {
    if (!state.currentLibrary || !deleteDialog.item) return;

    setDeleteDialog(prev => ({ ...prev, loading: true }));

    const filePath = getFilePath(deleteDialog.item.name);

    try {
      const response = await fetch(
        `/api/admin/luckycloud/delete?agency=${agency}&libraryId=${state.currentLibrary.id}&path=${encodeURIComponent(filePath)}&type=${deleteDialog.item.type}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setDeleteDialog({ isOpen: false, item: null, loading: false });
        loadDirectory(state.currentLibrary, state.currentPath);
      } else {
        alert(data.error || 'Fehler beim Löschen');
        setDeleteDialog(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unbekannter Fehler');
      setDeleteDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const closePreview = () => {
    setPreview({
      isOpen: false,
      loading: false,
      fileName: '',
      fileType: 'other',
      url: null,
    });
  };

  // Kommentar-Funktionen
  const openCommentDialog = async (item: FileItem) => {
    if (!state.currentLibrary) return;

    const filePath = getFilePath(item.name);

    setCommentDialog({
      isOpen: true,
      item,
      comments: [],
      loading: true,
      submitting: false,
      newComment: '',
    });

    try {
      const response = await fetch(
        `/api/admin/luckycloud/comments?agency=${agency}&libraryId=${state.currentLibrary.id}&path=${encodeURIComponent(filePath)}`
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setCommentDialog(prev => ({
          ...prev,
          loading: false,
          comments: data.comments || [],
        }));
      } else {
        setCommentDialog(prev => ({
          ...prev,
          loading: false,
          error: data.error || 'Fehler beim Laden der Kommentare',
        }));
      }
    } catch (error) {
      setCommentDialog(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      }));
    }
  };

  const submitComment = async () => {
    if (!state.currentLibrary || !commentDialog.item || !commentDialog.newComment.trim()) return;

    const filePath = getFilePath(commentDialog.item.name);

    setCommentDialog(prev => ({ ...prev, submitting: true }));

    try {
      const response = await fetch(
        `/api/admin/luckycloud/comments?agency=${agency}&libraryId=${state.currentLibrary.id}&path=${encodeURIComponent(filePath)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: commentDialog.newComment.trim() }),
        }
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setCommentDialog(prev => ({
          ...prev,
          submitting: false,
          newComment: '',
          comments: [...prev.comments, data.comment],
        }));
      } else {
        alert(data.error || 'Fehler beim Speichern des Kommentars');
        setCommentDialog(prev => ({ ...prev, submitting: false }));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unbekannter Fehler');
      setCommentDialog(prev => ({ ...prev, submitting: false }));
    }
  };

  const deleteComment = async (commentId: number) => {
    if (!state.currentLibrary) return;

    try {
      const response = await fetch(
        `/api/admin/luckycloud/comments?agency=${agency}&libraryId=${state.currentLibrary.id}&commentId=${commentId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setCommentDialog(prev => ({
          ...prev,
          comments: prev.comments.filter(c => c.id !== commentId),
        }));
      } else {
        alert(data.error || 'Fehler beim Löschen des Kommentars');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unbekannter Fehler');
    }
  };

  const closeCommentDialog = () => {
    setCommentDialog({
      isOpen: false,
      item: null,
      comments: [],
      loading: false,
      submitting: false,
      newComment: '',
    });
  };

  // Ordnersuche - sucht nach Ordnern die mit dem Suchbegriff beginnen
  // Unterstützt Wildcard (*) am Ende, z.B. "EM11002*" findet "EM11002-Projekt"
  const searchFolders = async (query: string) => {
    if (!state.currentLibrary || !query.trim()) {
      setSearch(prev => ({ ...prev, results: [], searched: false }));
      return;
    }

    setSearch(prev => ({ ...prev, isSearching: true, searched: false }));

    const results: SearchResult[] = [];
    // Wildcard entfernen falls vorhanden und für Prefix-Suche verwenden
    const searchPrefix = query.replace(/\*+$/, '').toLowerCase();

    // Nur im Root-Verzeichnis suchen - schnelle direkte Suche
    const searchDirectory = async (path: string, depth: number = 0): Promise<void> => {
      // Maximal 2 Ebenen tief suchen (Root + 1 Unterebene)
      if (depth > 1) return;

      try {
        const response = await fetch(
          `/api/admin/luckycloud/files?agency=${agency}&libraryId=${state.currentLibrary!.id}&path=${encodeURIComponent(path)}`
        );
        const data = await response.json();

        if (response.ok && data.success && data.items) {
          const folders = data.items.filter((item: FileItem) => item.type === 'dir');

          for (const folder of folders) {
            const folderPath = path === '/' ? `/${folder.name}` : `${path}/${folder.name}`;
            const folderNameLower = folder.name.toLowerCase();

            // Prüfen ob der Ordnername mit dem Suchbegriff beginnt
            if (folderNameLower.startsWith(searchPrefix)) {
              results.push({
                path: folderPath,
                name: folder.name,
              });
            }

            // Eine Ebene tiefer suchen
            if (depth < 1) {
              await searchDirectory(folderPath, depth + 1);
            }
          }
        }
      } catch (error) {
        console.error('Fehler bei Ordnersuche:', error);
      }
    };

    await searchDirectory('/');

    setSearch(prev => ({
      ...prev,
      isSearching: false,
      results,
      searched: true,
    }));
  };

  // Zu einem Suchergebnis navigieren
  const navigateToSearchResult = (result: SearchResult) => {
    if (!state.currentLibrary) return;

    // Suche zurücksetzen und zum Ordner navigieren
    setSearch({
      isSearching: false,
      query: '',
      results: [],
      searched: false,
    });

    loadDirectory(state.currentLibrary, result.path);
  };

  // Suche zurücksetzen
  const clearSearch = () => {
    setSearch({
      isSearching: false,
      query: '',
      results: [],
      searched: false,
    });
  };

  // Neuen Ordner erstellen
  const createNewFolder = async () => {
    if (!state.currentLibrary || !newFolder.folderName.trim()) return;

    setNewFolder(prev => ({ ...prev, creating: true, error: undefined }));

    try {
      // Hauptordner erstellen
      const response = await fetch(
        `/api/admin/luckycloud/files?agency=${agency}&libraryId=${state.currentLibrary.id}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: state.currentPath,
            folderName: newFolder.folderName.trim(),
          }),
        }
      );
      const data = await response.json();

      if (response.ok && data.success) {
        // Falls Projektordner-Option aktiviert, Unterordner erstellen
        if (newFolder.createProjectFolders) {
          const mainFolderPath = data.path;

          // Alle Unterordner parallel erstellen
          const subfolderPromises = PROJECT_SUBFOLDERS.map(subfolderName =>
            fetch(
              `/api/admin/luckycloud/files?agency=${agency}&libraryId=${state.currentLibrary!.id}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  path: mainFolderPath,
                  folderName: subfolderName,
                }),
              }
            )
          );

          // Warten bis alle Unterordner erstellt sind
          await Promise.all(subfolderPromises);
        }

        // Dialog schließen und Verzeichnis neu laden
        setNewFolder({ isOpen: false, folderName: '', creating: false, createProjectFolders: false });
        loadDirectory(state.currentLibrary, state.currentPath);
      } else {
        setNewFolder(prev => ({
          ...prev,
          creating: false,
          error: data.error || 'Fehler beim Erstellen des Ordners',
        }));
      }
    } catch (error) {
      setNewFolder(prev => ({
        ...prev,
        creating: false,
        error: error instanceof Error ? error.message : 'Unbekannter Fehler',
      }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadLibraries()}
          disabled={state.status === 'loading'}
        >
          {state.status === 'loading' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">{state.libraries.length > 0 ? 'Aktualisieren' : 'Bibliotheken laden'}</span>
        </Button>

        {state.currentLibrary && (
          <>
            <Button variant="ghost" size="sm" onClick={goToLibraries}>
              <Home className="h-4 w-4" />
            </Button>
            {state.currentPath !== '/' && (
              <Button variant="ghost" size="sm" onClick={navigateUp}>
                ..
              </Button>
            )}

            {/* Ordnersuche */}
            <div className="flex-1" />
            <div className="relative flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="z.B. EM11002*"
                  value={search.query}
                  onChange={(e) => setSearch(prev => ({ ...prev, query: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      searchFolders(search.query);
                    }
                    if (e.key === 'Escape') {
                      clearSearch();
                    }
                  }}
                  className="pl-8 h-8 w-48"
                />
                {search.query && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-8 w-8"
                    onClick={clearSearch}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => searchFolders(search.query)}
                disabled={search.isSearching || !search.query.trim()}
              >
                {search.isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderSearch className="h-4 w-4" />
                )}
              </Button>
              {/* Neuer Ordner Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewFolder({ isOpen: true, folderName: '', creating: false, createProjectFolders: false })}
                title="Neuen Ordner erstellen"
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Breadcrumb */}
      {state.currentLibrary && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span
            className="cursor-pointer hover:text-foreground"
            onClick={goToLibraries}
          >
            Bibliotheken
          </span>
          <ChevronRight className="h-3 w-3" />
          <span
            className="cursor-pointer hover:text-foreground"
            onClick={() => loadDirectory(state.currentLibrary!, '/')}
          >
            {state.currentLibrary.name}
          </span>
          {state.currentPath !== '/' && state.currentPath.split('/').filter(Boolean).map((part, i, arr) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <span className={i === arr.length - 1 ? 'font-medium text-foreground' : 'cursor-pointer hover:text-foreground'}>
                {part}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Suchergebnisse */}
      {search.searched && state.currentLibrary && (
        <div className="border rounded-lg p-3 bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <FolderSearch className="h-4 w-4" />
              Suchergebnisse für &quot;{search.query}&quot;
            </h4>
            <Button variant="ghost" size="sm" onClick={clearSearch}>
              <X className="h-4 w-4 mr-1" />
              Schließen
            </Button>
          </div>
          {search.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Ordner gefunden.</p>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-1">
                {search.results.map((result, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigateToSearchResult(result)}
                  >
                    <FolderOpen className="h-4 w-4 text-blue-500" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{result.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.path}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {search.results.length} Ordner gefunden
          </p>
        </div>
      )}

      {/* Content */}
      {state.status === 'error' && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state.status === 'loaded' && !state.currentLibrary && (
        <div className="grid gap-2">
          <h4 className="font-medium text-sm">Verfügbare Bibliotheken:</h4>
          {state.libraries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Bibliotheken gefunden.</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {state.libraries.map((lib) => (
                  <div
                    key={lib.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => loadDirectory(lib)}
                  >
                    <div className="flex items-center gap-3">
                      <FolderOpen className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="font-medium">{lib.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(lib.size)} | {lib.permission}
                        </p>
                      </div>
                    </div>
                    {lib.encrypted && (
                      <Badge variant="secondary" className="text-xs">Verschlüsselt</Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {state.status === 'loaded' && state.currentLibrary && (
        <ScrollArea className="h-[400px]">
          {state.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Verzeichnis ist leer.</p>
          ) : (
            <div className="space-y-1">
              {state.items.map((item, i) => (
                <FileListItem
                  key={i}
                  item={item}
                  agency={agency}
                  libraryId={state.currentLibrary!.id}
                  filePath={getFilePath(item.name)}
                  onNavigate={() => navigateToFolder(item.name)}
                  onPreview={() => openFile(item)}
                  onDownload={() => downloadFile(item)}
                  onDelete={() => confirmDelete(item)}
                  onComment={() => openCommentDialog(item)}
                  formatSize={formatSize}
                  getFileIcon={getFileIcon}
                  getFileType={getFileType}
                  isImage={isImage}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      )}

      {state.status === 'idle' && !autoLoad && (
        <p className="text-sm text-muted-foreground">
          Klicken Sie auf &quot;Bibliotheken laden&quot; um die Luckycloud-Bibliotheken anzuzeigen.
        </p>
      )}

      {/* Preview Dialog */}
      <Dialog open={preview.isOpen} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate pr-4">{preview.fileName}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            {preview.loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {preview.error && (
              <Alert variant="destructive">
                <AlertDescription>{preview.error}</AlertDescription>
              </Alert>
            )}

            {!preview.loading && !preview.error && preview.url && (
              <div className="space-y-4">
                {preview.fileType === 'image' && (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.url}
                      alt={preview.fileName}
                      referrerPolicy="no-referrer"
                      className="max-w-full max-h-[60vh] object-contain rounded-lg"
                    />
                  </div>
                )}

                {preview.fileType === 'pdf' && (
                  <iframe
                    src={preview.url}
                    className="w-full h-[60vh] rounded-lg border"
                    title={preview.fileName}
                  />
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closePreview}>
                    Schließen
                  </Button>
                  <Button onClick={() => window.open(preview.url!, '_blank')}>
                    <Download className="h-4 w-4 mr-2" />
                    Herunterladen
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => !open && setDeleteDialog({ isOpen: false, item: null, loading: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialog.item?.type === 'dir' ? 'Ordner' : 'Datei'} löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie &quot;{deleteDialog.item?.name}&quot; wirklich löschen?
              {deleteDialog.item?.type === 'dir' && (
                <span className="block mt-2 text-red-500 font-medium">
                  Achtung: Alle Dateien und Unterordner werden ebenfalls gelöscht!
                </span>
              )}
              <span className="block mt-2">Diese Aktion kann nicht rückgängig gemacht werden.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteDialog.loading}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              disabled={deleteDialog.loading}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteDialog.loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Comment Dialog */}
      <Dialog open={commentDialog.isOpen} onOpenChange={(open) => !open && closeCommentDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Kommentare
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground truncate">
              {commentDialog.item?.name}
            </p>

            {/* Kommentarliste */}
            <ScrollArea className="h-[200px] border rounded-md p-3">
              {commentDialog.loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : commentDialog.error ? (
                <p className="text-sm text-red-500">{commentDialog.error}</p>
              ) : commentDialog.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Noch keine Kommentare vorhanden.
                </p>
              ) : (
                <div className="space-y-3">
                  {commentDialog.comments.map((comment) => (
                    <div key={comment.id} className="bg-muted/50 rounded-md p-2 text-sm group">
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex-1">{comment.comment}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600"
                          onClick={() => deleteComment(comment.id)}
                          title="Löschen"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {comment.user_name} • {new Date(comment.created_at).toLocaleString('de-DE')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Neuer Kommentar */}
            <div className="space-y-2">
              <Textarea
                placeholder="Kommentar schreiben..."
                value={commentDialog.newComment}
                onChange={(e) => setCommentDialog(prev => ({ ...prev, newComment: e.target.value }))}
                className="resize-none"
                rows={2}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={submitComment}
                  disabled={commentDialog.submitting || !commentDialog.newComment.trim()}
                >
                  {commentDialog.submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Senden
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Neuer Ordner Dialog */}
      <Dialog open={newFolder.isOpen} onOpenChange={(open) => !open && setNewFolder({ isOpen: false, folderName: '', creating: false, createProjectFolders: false })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5" />
              Neuen Ordner erstellen
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Aktueller Pfad: <code className="bg-muted px-1 rounded">{state.currentPath}</code>
            </div>

            <div className="space-y-2">
              <Input
                placeholder="Ordnername eingeben (z.B. EM11002)..."
                value={newFolder.folderName}
                onChange={(e) => setNewFolder(prev => ({ ...prev, folderName: e.target.value, error: undefined }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolder.folderName.trim()) {
                    createNewFolder();
                  }
                }}
                disabled={newFolder.creating}
                autoFocus
              />
              {newFolder.error && (
                <p className="text-sm text-red-500">{newFolder.error}</p>
              )}
            </div>

            {/* Projektordner-Option */}
            <div className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/30">
              <Checkbox
                id="createProjectFolders"
                checked={newFolder.createProjectFolders}
                onCheckedChange={(checked) =>
                  setNewFolder(prev => ({ ...prev, createProjectFolders: checked === true }))
                }
                disabled={newFolder.creating}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="createProjectFolders"
                  className="text-sm font-medium cursor-pointer"
                >
                  Projektordner erstellen
                </Label>
                <p className="text-xs text-muted-foreground">
                  Erstellt automatisch Unterordner: {PROJECT_SUBFOLDERS.join(', ')}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setNewFolder({ isOpen: false, folderName: '', creating: false, createProjectFolders: false })}
                disabled={newFolder.creating}
              >
                Abbrechen
              </Button>
              <Button
                onClick={createNewFolder}
                disabled={newFolder.creating || !newFolder.folderName.trim()}
              >
                {newFolder.creating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FolderPlus className="h-4 w-4 mr-2" />
                )}
                {newFolder.createProjectFolders ? 'Projektordner erstellen' : 'Erstellen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
