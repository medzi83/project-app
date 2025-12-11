"use client";

import { useState, useTransition } from "react";
import { setWebsiteOnline } from "./online-check/actions";

type Props = {
  projectId: string;
};

export default function SetOnlineButton({ projectId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const result = await setWebsiteOnline(projectId);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || "Ein Fehler ist aufgetreten");
      }
    });
  };

  if (success) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
          Die Webseite wurde als online markiert!
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      <button
        onClick={handleClick}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Wird verarbeitet...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Webseite ist online
          </>
        )}
      </button>
    </div>
  );
}
