"use client";

import { useTransition } from "react";
import { resetOnlineCheck } from "./online-check/actions";

type Props = {
  projectId: string;
};

export default function ResetQMCheckButton({ projectId }: Props) {
  const [isPending, startTransition] = useTransition();

  const handleReset = () => {
    if (!confirm("QM Check wirklich zurücksetzen? Alle Einträge werden gelöscht und beim nächsten Öffnen wird eine neue Checkliste mit dem aktuellen Template erstellt.")) {
      return;
    }
    startTransition(async () => {
      await resetOnlineCheck(projectId);
    });
  };

  return (
    <button
      onClick={handleReset}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-xs font-medium disabled:opacity-50"
      title="QM Check zurücksetzen"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {isPending ? "..." : "Zurücksetzen"}
    </button>
  );
}
