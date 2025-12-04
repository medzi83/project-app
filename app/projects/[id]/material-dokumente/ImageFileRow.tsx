"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Comment = {
  id: number;
  comment: string;
  user_name: string;
  created_at: string;
};

type Props = {
  agency: "eventomaxx" | "vendoweb";
  libraryId: string;
  filePath: string;
  fileName: string;
  fileSize?: number;
  mtime?: string;
  isUnsuitable?: boolean; // Bild liegt im "ungeeignet" Unterordner
};

// Bewertungs-Konstanten (gleiche wie im LuckyCloud File Explorer)
const RATING_SUITABLE = "GEEIGNET";
const RATING_NOT_SUITABLE_PREFIX = "NICHT GEEIGNET";
// Kommentar wenn Kunde abgelehntes Bild trotzdem möchte
const CUSTOMER_WANTS_ANYWAY = "KUNDE WÜNSCHT TROTZDEM";

// Begründungen für "Nicht geeignet"
const NOT_SUITABLE_REASONS = [
  { id: "resolution", label: "Auflösung zu gering" },
  { id: "blurry", label: "Bild unscharf" },
  { id: "motif", label: "Motiv ungeeignet" },
  { id: "format", label: "Format falsch" },
  { id: "filetype", label: "Falsches Dateiformat" },
] as const;

// Hilfsfunktion für Datum-Formatierung (Unix-Timestamp in Sekunden)
function formatDate(mtime: string | number): string {
  try {
    const timestamp = typeof mtime === "string" ? parseInt(mtime) : mtime;
    const date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);

    if (isNaN(date.getTime()) || date.getFullYear() < 2000) {
      return "";
    }

    return date.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// Dateigröße formatieren
function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Datei-Erweiterung extrahieren
function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toUpperCase() || "";
}

export default function ImageFileRow({
  agency,
  libraryId,
  filePath,
  fileName,
  fileSize,
  mtime,
  isUnsuitable = false,
}: Props) {
  // Thumbnail für Listenansicht (klein, schnell, 24h Cache)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  // Vollbild-URL für Lightbox (nur bei Bedarf geladen)
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [hasStartedLoading, setHasStartedLoading] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Bewertungs-State
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [showRejectDropdown, setShowRejectDropdown] = useState(false);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number } | null>(null);
  const rejectButtonRef = useRef<HTMLButtonElement>(null);

  // Lightbox State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isLoadingFullImage, setIsLoadingFullImage] = useState(false);

  // Thumbnail laden über Share-Link API (kein Vercel-Proxy, direkt von LuckyCloud)
  const loadImage = async () => {
    if (thumbnailUrl || hasStartedLoading) return;

    setHasStartedLoading(true);

    try {
      // Share-Link für Thumbnail von API holen
      const response = await fetch(
        `/api/admin/luckycloud/share-link?agency=${agency}&libraryId=${libraryId}&path=${encodeURIComponent(filePath)}&type=thumbnail&size=96`
      );
      const data = await response.json();

      if (response.ok && data.success && data.url) {
        setThumbnailUrl(data.url);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
  };

  // Vollbild laden wenn Lightbox geöffnet wird
  const openLightbox = async () => {
    setIsLightboxOpen(true);

    if (!fullImageUrl && !isLoadingFullImage) {
      setIsLoadingFullImage(true);
      try {
        // Share-Link für Vollbild von API holen
        const response = await fetch(
          `/api/admin/luckycloud/share-link?agency=${agency}&libraryId=${libraryId}&path=${encodeURIComponent(filePath)}&type=full`
        );
        const data = await response.json();

        if (response.ok && data.success && data.url) {
          setFullImageUrl(data.url);
        }
      } catch {
        // Ignorieren - zeigt Ladeanimation
      } finally {
        setIsLoadingFullImage(false);
      }
    }
  };

  // Kommentare laden
  const loadComments = async () => {
    if (commentsLoaded) return;

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

  // Bewertung aus Kommentaren extrahieren
  const getRating = (): { type: "suitable" | "not-suitable"; reason?: string } | null => {
    const ratingComment = comments.find(
      (c) => c.comment === RATING_SUITABLE || c.comment.startsWith(RATING_NOT_SUITABLE_PREFIX)
    );
    if (!ratingComment) return null;
    if (ratingComment.comment === RATING_SUITABLE) {
      return { type: "suitable" };
    }
    const reason = ratingComment.comment.replace(`${RATING_NOT_SUITABLE_PREFIX}: `, "");
    return {
      type: "not-suitable",
      reason: reason !== RATING_NOT_SUITABLE_PREFIX ? reason : undefined,
    };
  };

  const currentRating = getRating();

  // Prüfen ob Kunde das Bild trotzdem wünscht
  const customerWantsAnyway = comments.some((c) => c.comment === CUSTOMER_WANTS_ANYWAY);

  // Bewertung setzen
  const setRating = async (rating: "suitable" | "not-suitable", reason?: string) => {
    if (isRating) return;
    setIsRating(true);
    setShowRejectDropdown(false);

    try {
      // Alte Bewertungs-Kommentare löschen
      const oldRatingComments = comments.filter(
        (c) => c.comment === RATING_SUITABLE || c.comment.startsWith(RATING_NOT_SUITABLE_PREFIX)
      );

      for (const oldComment of oldRatingComments) {
        await fetch(
          `/api/admin/luckycloud/comments?agency=${agency}&libraryId=${libraryId}&commentId=${oldComment.id}`,
          { method: "DELETE" }
        );
      }

      // Neuen Bewertungs-Kommentar hinzufügen
      const commentText =
        rating === "suitable" ? RATING_SUITABLE : `${RATING_NOT_SUITABLE_PREFIX}: ${reason}`;
      const response = await fetch(
        `/api/admin/luckycloud/comments?agency=${agency}&libraryId=${libraryId}&path=${encodeURIComponent(filePath)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: commentText }),
        }
      );
      const data = await response.json();

      if (response.ok && data.success) {
        setComments((prev) => [
          ...prev.filter(
            (c) => c.comment !== RATING_SUITABLE && !c.comment.startsWith(RATING_NOT_SUITABLE_PREFIX)
          ),
          data.comment,
        ]);
      }
    } catch (error) {
      console.error("Fehler beim Setzen der Bewertung:", error);
    } finally {
      setIsRating(false);
    }
  };

  const uploadDate = mtime ? formatDate(mtime) : "";

  // Escape-Taste schließt Lightbox
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isLightboxOpen) {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isLightboxOpen]);

  // Klick außerhalb schließt Dropdown
  useEffect(() => {
    const handleClickOutside = () => {
      if (showRejectDropdown) {
        setShowRejectDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showRejectDropdown]);

  return (
    <>
      <div
        ref={(el) => {
          if (el && !hasStartedLoading) {
            const observer = new IntersectionObserver(
              (entries) => {
                if (entries[0].isIntersecting) {
                  loadImage();
                  loadComments();
                  observer.disconnect();
                }
              },
              { threshold: 0.1 }
            );
            observer.observe(el);
          }
        }}
        className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group ${
          isUnsuitable ? "bg-gray-100 dark:bg-gray-800/50 opacity-60" : ""
        }`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Thumbnail */}
        <div
          className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 cursor-pointer"
          onClick={() => thumbnailUrl && openLightbox()}
        >
          {thumbnailUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt={fileName}
                className={`w-full h-full object-cover ${imageLoaded ? '' : 'opacity-0'}`}
                onLoad={(e) => {
                  setImageLoaded(true);
                  const img = e.currentTarget;
                  if (img.naturalWidth && img.naturalHeight) {
                    setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                  }
                }}
                onError={() => setError(true)}
              />
              {/* Ladeanimation während Bild lädt */}
              {!imageLoaded && !error && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </>
          ) : error ? (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
              </svg>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {/* Hover-Overlay für Vergrößern */}
          {thumbnailUrl && isHovering && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          )}
        </div>

        {/* Datei-Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-900 dark:text-white truncate">{fileName}</span>
            {isUnsuitable && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                Verschoben in ungeeignet
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{getFileExtension(fileName)}</span>
            {dimensions && <span>{dimensions.width}×{dimensions.height}</span>}
            {fileSize && <span>{formatFileSize(fileSize)}</span>}
            {uploadDate && <span>{uploadDate}</span>}
          </div>

          {/* Bewertungs-Badge in der Zeile */}
          {currentRating && (
            <div className="mt-1 flex flex-wrap gap-1">
              <span
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                  currentRating.type === "suitable"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {currentRating.type === "suitable" ? (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    GEEIGNET
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                    </svg>
                    NICHT GEEIGNET{currentRating.reason && `: ${currentRating.reason}`}
                  </>
                )}
              </span>
              {/* Badge: Kunde wünscht trotzdem (nur bei abgelehnten Bildern) */}
              {currentRating.type === "not-suitable" && customerWantsAnyway && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Kunde wünscht trotzdem
                </span>
              )}
            </div>
          )}
        </div>

        {/* Bewertungs-Buttons */}
        <div className="flex items-center gap-1">
          {/* Geeignet-Button */}
          <button
            onClick={() => setRating("suitable")}
            disabled={isRating}
            className={`p-2 rounded-lg transition-colors ${
              currentRating?.type === "suitable"
                ? "text-green-600 bg-green-100 dark:bg-green-900/30"
                : "text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
            } disabled:opacity-50`}
            title="Geeignet"
          >
            {isRating ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
            )}
          </button>

          {/* Nicht geeignet-Button mit Dropdown */}
          <div className="relative">
            <button
              ref={rejectButtonRef}
              onClick={(e) => {
                e.stopPropagation();
                // Berechne Position für Portal-Dropdown
                if (rejectButtonRef.current) {
                  const rect = rejectButtonRef.current.getBoundingClientRect();
                  const dropdownHeight = 200;
                  const spaceBelow = window.innerHeight - rect.bottom;

                  // Nach oben oder unten?
                  const top = spaceBelow < dropdownHeight
                    ? rect.top - dropdownHeight // nach oben
                    : rect.bottom + 4; // nach unten

                  setDropdownCoords({
                    top,
                    left: rect.right - 192, // 192px = w-48
                  });
                }
                setShowRejectDropdown(!showRejectDropdown);
              }}
              disabled={isRating}
              className={`p-2 rounded-lg transition-colors ${
                currentRating?.type === "not-suitable"
                  ? "text-red-600 bg-red-100 dark:bg-red-900/30"
                  : "text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              } disabled:opacity-50`}
              title="Nicht geeignet"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
              </svg>
            </button>

            {/* Dropdown als Portal gerendert */}
            {showRejectDropdown && dropdownCoords && createPortal(
              <div
                className="fixed w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-[9999]"
                style={{ top: dropdownCoords.top, left: dropdownCoords.left }}
                onClick={(e) => e.stopPropagation()}
              >
                {NOT_SUITABLE_REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    onClick={() => setRating("not-suitable", reason.label)}
                    className="w-full px-3 py-2 text-left text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    {reason.label}
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>

          {/* Vorschau-Button */}
          {thumbnailUrl && (
            <button
              onClick={() => openLightbox()}
              className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors opacity-0 group-hover:opacity-100"
              title="Vorschau"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Lightbox - lädt Vollbild nur bei Bedarf */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Schließen-Button */}
          <button
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Bewertungs-Badge in Lightbox */}
          {currentRating && (
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              <div
                className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${
                  currentRating.type === "suitable"
                    ? "bg-green-500 text-white"
                    : "bg-red-500 text-white"
                }`}
              >
                {currentRating.type === "suitable" ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Geeignet
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Ungeeignet{currentRating.reason && `: ${currentRating.reason}`}
                  </>
                )}
              </div>
              {/* Badge: Kunde wünscht trotzdem */}
              {currentRating.type === "not-suitable" && customerWantsAnyway && (
                <div className="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 bg-amber-500 text-white">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Kunde wünscht trotzdem
                </div>
              )}
            </div>
          )}

          {/* Bild - Vollbild wird erst geladen wenn Lightbox geöffnet wird */}
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {fullImageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fullImageUrl}
                  alt={fileName}
                  className="max-w-full max-h-[85vh] object-contain rounded-lg"
                />
              </>
            ) : (
              <div className="w-64 h-64 flex items-center justify-center">
                <svg className="w-8 h-8 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}

            {/* Info-Leiste unten */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 rounded-b-lg">
              <div className="flex items-center justify-between text-white">
                <div>
                  <p className="font-medium">{fileName}</p>
                  <p className="text-sm text-white/70">
                    {dimensions && `${dimensions.width}×${dimensions.height} px`}
                    {fileSize && ` • ${formatFileSize(fileSize)}`}
                  </p>
                </div>

                {/* Bewertungs-Buttons in Lightbox */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRating("suitable")}
                    disabled={isRating}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1 ${
                      currentRating?.type === "suitable"
                        ? "bg-green-500 text-white"
                        : "bg-white/20 text-white hover:bg-green-500"
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Geeignet
                  </button>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRejectDropdown(!showRejectDropdown);
                      }}
                      disabled={isRating}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1 ${
                        currentRating?.type === "not-suitable"
                          ? "bg-red-500 text-white"
                          : "bg-white/20 text-white hover:bg-red-500"
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Ungeeignet
                    </button>

                    {showRejectDropdown && (
                      <div
                        className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {NOT_SUITABLE_REASONS.map((reason) => (
                          <button
                            key={reason.id}
                            onClick={() => setRating("not-suitable", reason.label)}
                            className="w-full px-3 py-2 text-left text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            {reason.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hinweis */}
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs">
            Klicken Sie irgendwo oder ESC, um zu schließen
          </p>
        </div>
      )}
    </>
  );
}
