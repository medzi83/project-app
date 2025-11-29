"use client";

import { useState, useTransition } from "react";
import { reviewMenuItemText, reviewGeneralText, resetMenuItemReview, resetGeneralTextReview } from "./actions";

type Props = {
  type: "menuItem" | "general";
  itemId: string; // menuItemId oder webDocumentationId
  projectId: string;
  currentReview: {
    suitable: boolean | null;
    reviewNote: string | null;
    reviewedAt: Date | string | null;
    reviewedByName: string | null;
  } | null;
};

export default function ReviewButtons({ type, itemId, projectId, currentReview }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const result = type === "menuItem"
        ? await reviewMenuItemText(itemId, true, null, projectId)
        : await reviewGeneralText(itemId, true, null, projectId);

      if (!result.success) {
        setError(result.error);
      }
    });
  };

  const handleReject = () => {
    if (!rejectNote.trim()) {
      setError("Bitte geben Sie einen Hinweis ein");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = type === "menuItem"
        ? await reviewMenuItemText(itemId, false, rejectNote, projectId)
        : await reviewGeneralText(itemId, false, rejectNote, projectId);

      if (result.success) {
        setShowRejectForm(false);
        setRejectNote("");
      } else {
        setError(result.error);
      }
    });
  };

  const handleReset = () => {
    setError(null);
    startTransition(async () => {
      const result = type === "menuItem"
        ? await resetMenuItemReview(itemId, projectId)
        : await resetGeneralTextReview(itemId, projectId);

      if (!result.success) {
        setError(result.error);
      }
    });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    try {
      // Naive Formatierung - direkt aus ISO-String extrahieren ohne Zeitzonen-Konvertierung
      const dateStr = typeof date === "string" ? date : new Date(date).toISOString();
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (!match) return "";
      const [, year, month, day, hours, minutes] = match;
      return `${day}.${month}.${year}, ${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  // Bereits bewertet - zeige Status
  if (currentReview?.suitable !== null && currentReview?.suitable !== undefined) {
    return (
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <div className={`p-3 rounded-lg ${
          currentReview.suitable
            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700"
            : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700"
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              {currentReview.suitable ? (
                <>
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-green-800 dark:text-green-300">
                    Als geeignet markiert
                  </span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-red-800 dark:text-red-300">
                    Als ungeeignet markiert
                  </span>
                </>
              )}
            </div>
            <button
              onClick={handleReset}
              disabled={isPending}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline disabled:opacity-50"
            >
              Zurücksetzen
            </button>
          </div>

          {currentReview.reviewedAt && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formatDate(currentReview.reviewedAt)}
              {currentReview.reviewedByName && ` von ${currentReview.reviewedByName}`}
            </p>
          )}

          {!currentReview.suitable && currentReview.reviewNote && (
            <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-700">
              <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Hinweis:</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{currentReview.reviewNote}</p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  // Noch nicht bewertet - zeige Buttons
  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
      {!showRejectForm ? (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">Bewertung:</span>
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 border border-green-300 dark:border-green-700 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            Geeignet
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 border border-red-300 dark:border-red-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Ungeeignet
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Warum ist der Text ungeeignet?
            </label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="z.B. Der Text ist zu kurz / Enthält keine relevanten Informationen / ..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReject}
              disabled={isPending || !rejectNote.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              Als ungeeignet markieren
            </button>
            <button
              onClick={() => {
                setShowRejectForm(false);
                setRejectNote("");
                setError(null);
              }}
              disabled={isPending}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
