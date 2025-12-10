"use client";

import { useState, useTransition } from "react";
import { Textarea } from "@/components/ui/textarea";
import { toggleCheckItem, updateItemNote, completeOnlineCheck } from "./actions";
import { Button } from "@/components/ui/button";

type CheckItem = {
  id: string;
  label: string;
  description: string | null;
  sortOrder: number;
  completed: boolean;
  completedAt: Date | null;
  completedByName: string | null;
  note: string | null;
};

type OnlineCheck = {
  projectId: string;
  createdAt: Date;
  completedAt: Date | null;
  completedByName: string | null;
  items: CheckItem[];
};

type Props = {
  onlineCheck: OnlineCheck;
  projectId: string;
};

// Naive date formatting (nur Datum, keine Uhrzeit)
const fmtDate = (d?: Date | string | null) => {
  if (!d) return "-";
  try {
    const dateStr = typeof d === "string" ? d : d.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "-";
    const [, year, month, day] = match;
    return `${day}.${month}.${year}`;
  } catch {
    return "-";
  }
};

export default function ChecklistClient({ onlineCheck, projectId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [localItems, setLocalItems] = useState(onlineCheck.items);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>(
    Object.fromEntries(
      onlineCheck.items.map((item) => [item.id, item.note || ""])
    )
  );
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const [isCompleted, setIsCompleted] = useState(!!onlineCheck.completedAt);
  const [completionInfo, setCompletionInfo] = useState({
    completedAt: onlineCheck.completedAt,
    completedByName: onlineCheck.completedByName,
  });

  const completedCount = localItems.filter((item) => item.completed).length;
  const totalCount = localItems.length;
  const allItemsChecked = completedCount === totalCount && totalCount > 0;

  const handleCheckboxToggle = (itemId: string, currentCompleted: boolean) => {
    // Optimistic update
    setLocalItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, completed: !currentCompleted } : item
      )
    );

    startTransition(async () => {
      await toggleCheckItem(itemId, !currentCompleted);
    });
  };

  const handleNoteBlur = (itemId: string) => {
    const value = noteInputs[itemId] || "";
    const item = localItems.find((i) => i.id === itemId);

    // Nur speichern wenn sich der Wert geändert hat
    if (item && value !== (item.note || "")) {
      // Optimistic update
      setLocalItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, note: value || null } : i
        )
      );

      startTransition(async () => {
        await updateItemNote(itemId, value);
      });
    }
  };

  const toggleNoteExpanded = (itemId: string) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleComplete = () => {
    startTransition(async () => {
      const result = await completeOnlineCheck(projectId);
      setIsCompleted(true);
      setCompletionInfo({
        completedAt: result.completedAt,
        completedByName: result.completedByName,
      });
    });
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Fortschritt
          </span>
          <span className={`text-sm font-bold ${allItemsChecked ? "text-emerald-600 dark:text-emerald-400" : "text-gray-600 dark:text-gray-400"}`}>
            {completedCount} / {totalCount}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${
              allItemsChecked
                ? "bg-emerald-500"
                : "bg-blue-500"
            }`}
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        {isCompleted && (
          <div className="mt-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">
              QM-Check abgeschlossen
              {completionInfo.completedAt && ` am ${fmtDate(completionInfo.completedAt)}`}
              {completionInfo.completedByName && ` von ${completionInfo.completedByName}`}
            </span>
          </div>
        )}
      </div>

      {/* Checklist Items */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
        {localItems.map((item, index) => (
          <div key={item.id} className="px-3 py-2">
            <div className="flex items-center gap-3">
              {/* Checkbox */}
              <button
                onClick={() => handleCheckboxToggle(item.id, item.completed)}
                disabled={isPending}
                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  item.completed
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-gray-300 dark:border-gray-600 hover:border-emerald-400 dark:hover:border-emerald-500"
                }`}
              >
                {item.completed && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Number */}
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500 w-5">
                {index + 1}.
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${
                  item.completed
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-gray-900 dark:text-white"
                }`}>
                  {item.label}
                </span>
                {item.description && (
                  item.description.length > 40 && !expandedDescriptions[item.id] ? (
                    <button
                      onClick={() => setExpandedDescriptions(prev => ({ ...prev, [item.id]: true }))}
                      className="text-xs text-gray-400 dark:text-gray-500 ml-2 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      — {item.description.substring(0, 40)}...
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                      — {item.description}
                    </span>
                  )
                )}
              </div>

              {/* Note indicator & toggle */}
              <button
                onClick={() => toggleNoteExpanded(item.id)}
                className={`flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  item.note ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"
                }`}
                title={item.note ? "Bemerkung bearbeiten" : "Bemerkung hinzufügen"}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </button>
            </div>

            {/* Expanded Note */}
            {(expandedNotes[item.id] || item.note) && (
              <div className="ml-11 mt-1 space-y-1">
                {expandedNotes[item.id] ? (
                  <Textarea
                    value={noteInputs[item.id] || ""}
                    onChange={(e) =>
                      setNoteInputs((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                    onBlur={() => handleNoteBlur(item.id)}
                    placeholder="Bemerkung eingeben..."
                    rows={2}
                    className="text-sm"
                  />
                ) : item.note ? (
                  <button
                    onClick={() => toggleNoteExpanded(item.id)}
                    className="text-xs text-gray-500 dark:text-gray-400 italic text-left hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {item.note}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Complete Button - only when all items checked and not yet completed */}
      {allItemsChecked && !isCompleted && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 mx-auto text-emerald-500 dark:text-emerald-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-emerald-800 dark:text-emerald-200 font-medium mb-1">
            Alle Punkte abgehakt!
          </p>
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-4">
            Das hast du wieder mal ganz toll gemacht. Dann darfst du jetzt auch hier klicken:
          </p>
          <Button
            onClick={handleComplete}
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPending ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Wird abgeschlossen...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                QM-Check abschließen
              </>
            )}
          </Button>
        </div>
      )}

      {/* Empty State */}
      {localItems.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
          <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            Keine Check-Items definiert.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Bitte Template unter Administration konfigurieren.
          </p>
        </div>
      )}
    </div>
  );
}
