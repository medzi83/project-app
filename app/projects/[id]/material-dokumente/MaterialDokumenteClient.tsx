"use client";

import { useState, useEffect, useCallback } from "react";
import ImageFileRow from "./ImageFileRow";

type MenuItem = {
  id: string;
  name: string;
  materialNotes: string | null;
  imagesComplete: boolean;
  imagesAgentComment: string | null;
  imagesReviewedAt: string | null;
  imagesReviewedByName: string | null;
};

type ReviewData = {
  complete: boolean;
  comment: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
};

type FileItem = {
  name: string;
  type: "file" | "dir";
  size?: number;
  mtime?: string;
  isUnsuitable?: boolean; // Markierung für Bilder aus dem "ungeeignet" Unterordner
};

type Props = {
  projectId: string;
  agency: "eventomaxx" | "vendoweb";
  libraryId: string;
  clientFolderPath: string | null;
  projectFolderPath: string;
  menuItems: MenuItem[];
  materialLogoNeeded: boolean;
  materialNotesNeedsImages: boolean;
  materialNotes: string | null;
  logoReview: ReviewData;
  generalReview: ReviewData;
};

// Funktion um einen sicheren Ordnernamen zu erstellen (gleiche Logik wie Kundenportal)
function sanitizeFolderName(name: string): string {
  return name
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-zA-Z0-9\-_\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Bild-Dateiendungen
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];

function isImageFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.includes(ext);
}

// Folder-Typ für interne Verwaltung
type FolderData = {
  name: string;
  displayName: string;
  notes?: string | null;
  type: "menuItem" | "logo" | "general";
  id: string; // menuItemId oder projectId
  review: ReviewData;
};

export default function MaterialDokumenteClient({
  projectId,
  agency,
  libraryId,
  clientFolderPath,
  projectFolderPath,
  menuItems,
  materialLogoNeeded,
  materialNotesNeedsImages,
  materialNotes,
  logoReview,
  generalReview,
}: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folderContents, setFolderContents] = useState<
    Record<string, { files: FileItem[]; loading: boolean; error?: string }>
  >({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Review-State für lokale Updates
  const [reviewStates, setReviewStates] = useState<Record<string, ReviewData>>({});
  const [savingReview, setSavingReview] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  // Vollständiger Basispfad zum Projektordner
  const basePath = clientFolderPath
    ? `${clientFolderPath}${projectFolderPath}`
    : projectFolderPath;

  // Alle relevanten Ordner sammeln
  const folders: FolderData[] = [];

  // Logo-Ordner
  if (materialLogoNeeded) {
    folders.push({
      name: "Logo",
      displayName: "Logo",
      type: "logo",
      id: projectId,
      review: logoReview,
    });
  }

  // Menüpunkt-Ordner
  menuItems.forEach((item) => {
    folders.push({
      name: sanitizeFolderName(item.name),
      displayName: item.name,
      notes: item.materialNotes,
      type: "menuItem",
      id: item.id,
      review: {
        complete: item.imagesComplete,
        comment: item.imagesAgentComment,
        reviewedAt: item.imagesReviewedAt,
        reviewedByName: item.imagesReviewedByName,
      },
    });
  });

  // Sonstiges-Ordner
  if (materialNotesNeedsImages) {
    folders.push({
      name: "Sonstiges",
      displayName: "Sonstiges",
      notes: materialNotes,
      type: "general",
      id: projectId,
      review: generalReview,
    });
  }

  // Hilfsfunktion: Review-Daten holen (aus lokalem State oder Props)
  const getReview = (folder: FolderData): ReviewData => {
    const key = `${folder.type}-${folder.id}`;
    return reviewStates[key] || folder.review;
  };

  // Review-Status speichern
  const saveReview = async (
    folder: FolderData,
    complete?: boolean,
    comment?: string | null
  ) => {
    const key = `${folder.type}-${folder.id}`;
    setSavingReview(key);

    try {
      const response = await fetch("/api/admin/material-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: folder.type,
          id: folder.id,
          complete,
          comment,
        }),
      });
      const data = await response.json();

      if (data.success) {
        // Lokalen State aktualisieren
        setReviewStates((prev) => ({
          ...prev,
          [key]: {
            complete: complete ?? getReview(folder).complete,
            comment: comment !== undefined ? comment : getReview(folder).comment,
            reviewedAt: new Date().toISOString(),
            reviewedByName: data.data.imagesReviewedByName || data.data.logoImagesReviewedByName || data.data.generalImagesReviewedByName,
          },
        }));
      }
    } catch (err) {
      console.error("Fehler beim Speichern:", err);
    } finally {
      setSavingReview(null);
    }
  };

  // Dateien für einen Ordner laden (inkl. "ungeeignet" Unterordner)
  const loadFolderFiles = useCallback(
    async (folderName: string) => {
      setFolderContents((prev) => ({
        ...prev,
        [folderName]: { files: prev[folderName]?.files || [], loading: true },
      }));

      try {
        const folderPath = `${basePath}/${folderName}`;
        const allFiles: FileItem[] = [];

        // Hauptordner laden
        const response = await fetch(
          `/api/admin/luckycloud/files?agency=${agency}&libraryId=${libraryId}&path=${encodeURIComponent(folderPath)}`
        );
        const data = await response.json();

        if (response.ok && data.success) {
          // Nur Bilddateien filtern (keine Ordner)
          const imageFiles = (data.items || []).filter(
            (item: FileItem) => item.type === "file" && isImageFile(item.name)
          );
          allFiles.push(...imageFiles);
        }

        // "ungeeignet" Unterordner laden
        const unsuitablePath = `${folderPath}/ungeeignet`;
        try {
          const unsuitableResponse = await fetch(
            `/api/admin/luckycloud/files?agency=${agency}&libraryId=${libraryId}&path=${encodeURIComponent(unsuitablePath)}`
          );
          const unsuitableData = await unsuitableResponse.json();

          if (unsuitableResponse.ok && unsuitableData.success) {
            const unsuitableFiles = (unsuitableData.items || [])
              .filter((item: FileItem) => item.type === "file" && isImageFile(item.name))
              .map((item: FileItem) => ({
                ...item,
                isUnsuitable: true, // Markierung für UI
              }));
            allFiles.push(...unsuitableFiles);
          }
        } catch {
          // "ungeeignet" Ordner existiert nicht - das ist OK
        }

        setFolderContents((prev) => ({
          ...prev,
          [folderName]: { files: allFiles, loading: false },
        }));
      } catch {
        setFolderContents((prev) => ({
          ...prev,
          [folderName]: { files: [], loading: false, error: "Fehler beim Laden" },
        }));
      }
    },
    [agency, libraryId, basePath]
  );

  // Ordner expandieren/kollabieren
  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
        // Beim Öffnen Dateien laden falls noch nicht geladen
        if (!folderContents[folderName] || folderContents[folderName].files.length === 0) {
          loadFolderFiles(folderName);
        }
      }
      return next;
    });
  };

  // Beim Mount nur Ordner-Übersicht laden (Anzahl Bilder), aber nicht expandieren
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Alle Ordner parallel laden (für Statistiken)
        await Promise.all(folders.map((folder) => loadFolderFiles(folder.name)));
        // Alle Ordner eingeklappt lassen - Bilder werden erst bei Klick geladen
        setExpandedFolders(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setIsLoading(false);
      }
    };

    if (folders.length > 0) {
      loadAll();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Statistiken berechnen
  const stats = {
    totalFolders: folders.length,
    foldersWithImages: Object.values(folderContents).filter(
      (f) => f.files.length > 0
    ).length,
    totalImages: Object.values(folderContents).reduce(
      (sum, f) => sum + f.files.length,
      0
    ),
    // Review-Status Statistiken
    complete: folders.filter((f) => {
      const review = getReview(f);
      return review.complete === true;
    }).length,
    incomplete: folders.filter((f) => {
      const review = getReview(f);
      return review.complete === false && review.reviewedAt !== null;
    }).length,
    needsReview: folders.filter((f) => {
      const review = getReview(f);
      return review.reviewedAt === null;
    }).length,
  };

  if (folders.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-gray-400 dark:text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          Keine Bildanforderungen
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Für dieses Projekt werden keine Bilder benötigt.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fortschrittsübersicht */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Übersicht Material-Dokumente
          </h2>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <svg className="w-6 h-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Wird geladen...</span>
            </div>
          ) : (
            <>
              {/* Status-Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* Bereiche mit Bildern */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Mit Bildern</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {stats.foldersWithImages} <span className="text-sm font-normal text-blue-600 dark:text-blue-400">/ {stats.totalFolders}</span>
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">{stats.totalImages} Bilder gesamt</div>
                </div>

                {/* Vollständig */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">Vollständig</span>
                  </div>
                  <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {stats.complete} <span className="text-sm font-normal text-green-600 dark:text-green-400">/ {stats.totalFolders}</span>
                  </div>
                </div>

                {/* Unvollständig */}
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-xs font-medium text-red-700 dark:text-red-300">Unvollständig</span>
                  </div>
                  <div className="text-2xl font-bold text-red-900 dark:text-red-100">
                    {stats.incomplete} <span className="text-sm font-normal text-red-600 dark:text-red-400">/ {stats.totalFolders}</span>
                  </div>
                </div>

                {/* Zu prüfen */}
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Zu prüfen</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                    {stats.needsReview} <span className="text-sm font-normal text-amber-600 dark:text-amber-400">/ {stats.totalFolders}</span>
                  </div>
                </div>
              </div>

              {/* Fortschrittsbalken */}
              {stats.totalFolders > 0 && (
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  {stats.complete > 0 && (
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${(stats.complete / stats.totalFolders) * 100}%` }}
                      title={`${stats.complete} vollständig`}
                    />
                  )}
                  {stats.incomplete > 0 && (
                    <div
                      className="h-full bg-red-500 transition-all duration-300"
                      style={{ width: `${(stats.incomplete / stats.totalFolders) * 100}%` }}
                      title={`${stats.incomplete} unvollständig`}
                    />
                  )}
                  {stats.needsReview > 0 && (
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${(stats.needsReview / stats.totalFolders) * 100}%` }}
                      title={`${stats.needsReview} zu prüfen`}
                    />
                  )}
                </div>
              )}

              {/* Ordner-Pfad Info */}
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="truncate" title={basePath}>
                  {basePath}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Ordner-Liste */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {folders.map((folder) => {
            const content = folderContents[folder.name] || {
              files: [],
              loading: true,
            };
            const isExpanded = expandedFolders.has(folder.name);
            const review = getReview(folder);
            const reviewKey = `${folder.type}-${folder.id}`;
            const isSaving = savingReview === reviewKey;
            const isEditingThisComment = editingComment === reviewKey;

            return (
              <div key={folder.name}>
                {/* Ordner-Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  onClick={() => toggleFolder(folder.name)}
                >
                  {/* Expand/Collapse Icon */}
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>

                  {/* Ordner-Icon mit Status */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    review.complete === true
                      ? "bg-green-100 dark:bg-green-900/30"
                      : review.complete === false && review.reviewedAt
                        ? "bg-red-100 dark:bg-red-900/30"
                        : "bg-amber-100 dark:bg-amber-900/30"
                  }`}>
                    {review.complete === true ? (
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : review.complete === false && review.reviewedAt ? (
                      <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg
                        className="w-4 h-4 text-amber-600 dark:text-amber-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Ordner-Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {folder.displayName}
                      </span>
                      {content.loading ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
                          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        </span>
                      ) : content.files.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                          {content.files.length} {content.files.length === 1 ? "Bild" : "Bilder"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Keine Bilder
                        </span>
                      )}
                      {/* Status-Badge */}
                      {review.complete === true && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Vollständig
                        </span>
                      )}
                      {review.complete === false && review.reviewedAt && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Unvollständig
                        </span>
                      )}
                      {/* Kommentar-Indikator */}
                      {review.comment && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" title={review.comment}>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          Hinweis
                        </span>
                      )}
                    </div>
                    {folder.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {folder.notes}
                      </p>
                    )}
                  </div>

                  {/* Aktions-Buttons */}
                  <div className="flex items-center gap-1">
                    {/* Vollständig-Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        saveReview(folder, true);
                      }}
                      disabled={isSaving || (review.complete === true && review.reviewedAt !== null)}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        review.complete === true && review.reviewedAt !== null
                          ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                          : "text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                      }`}
                      title="Als vollständig markieren"
                    >
                      {isSaving ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Unvollständig-Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        saveReview(folder, false);
                      }}
                      disabled={isSaving || (review.complete === false && review.reviewedAt !== null)}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        review.complete === false && review.reviewedAt !== null
                          ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                          : "text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      }`}
                      title="Als unvollständig markieren"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    {/* Kommentar-Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingComment(isEditingThisComment ? null : reviewKey);
                        setCommentDraft(review.comment || "");
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        review.comment
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                          : "text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      }`}
                      title="Hinweis für Kunden"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </button>

                    {/* Refresh-Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        loadFolderFiles(folder.name);
                      }}
                      disabled={content.loading}
                      className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                      title="Aktualisieren"
                    >
                      <svg
                        className={`w-4 h-4 text-gray-400 ${content.loading ? "animate-spin" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Kommentar-Editor */}
                {isEditingThisComment && (
                  <div
                    className="px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-200 dark:border-amber-800"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label className="block text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                      Hinweis für den Kunden
                    </label>
                    <textarea
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="z.B. 'Bitte Bilder in höherer Auflösung nachreichen'"
                      className="w-full px-3 py-2 text-sm border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                      rows={2}
                    />
                    <div className="flex items-center justify-end gap-2 mt-2">
                      {review.comment && (
                        <button
                          onClick={() => {
                            saveReview(folder, undefined, null);
                            setEditingComment(null);
                          }}
                          disabled={isSaving}
                          className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Hinweis entfernen
                        </button>
                      )}
                      <button
                        onClick={() => setEditingComment(null)}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Abbrechen
                      </button>
                      <button
                        onClick={() => {
                          saveReview(folder, undefined, commentDraft || null);
                          setEditingComment(null);
                        }}
                        disabled={isSaving}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {isSaving ? "Speichern..." : "Speichern"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Bestehender Kommentar-Anzeige (wenn nicht editiert) */}
                {review.comment && !isEditingThisComment && (
                  <div
                    className="px-4 py-2 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-200 dark:border-amber-800 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingComment(reviewKey);
                      setCommentDraft(review.comment || "");
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      <p className="text-sm text-amber-700 dark:text-amber-400 flex-1">{review.comment}</p>
                    </div>
                  </div>
                )}

                {/* Datei-Liste (wenn expandiert) */}
                {isExpanded && (
                  <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                    {content.loading ? (
                      <div className="flex items-center justify-center py-6">
                        <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    ) : content.error ? (
                      <div className="text-center py-4 text-sm text-red-600 dark:text-red-400">
                        {content.error}
                      </div>
                    ) : content.files.length === 0 ? (
                      <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                        Noch keine Bilder in diesem Ordner
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {content.files.map((file) => (
                          <ImageFileRow
                            key={`${file.isUnsuitable ? "unsuitable-" : ""}${file.name}`}
                            agency={agency}
                            libraryId={libraryId}
                            filePath={file.isUnsuitable
                              ? `${basePath}/${folder.name}/ungeeignet/${file.name}`
                              : `${basePath}/${folder.name}/${file.name}`
                            }
                            fileName={file.name}
                            fileSize={file.size}
                            mtime={file.mtime}
                            isUnsuitable={file.isUnsuitable}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
