"use client";

import { useTransition, useState } from "react";
import { markDomainAsRegistered } from "./webdoku/actions";

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

type Props = {
  projectId: string;
  domain: string;
  registeredAt?: Date | string | null;
  registeredByName?: string | null;
};

export default function MarkDomainRegisteredButton({
  projectId,
  domain,
  registeredAt: initialRegisteredAt,
  registeredByName: initialRegisteredByName,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [registrationInfo, setRegistrationInfo] = useState({
    registeredAt: initialRegisteredAt,
    registeredByName: initialRegisteredByName,
  });

  const isRegistered = !!registrationInfo.registeredAt;

  const handleMarkRegistered = () => {
    startTransition(async () => {
      const result = await markDomainAsRegistered(projectId);
      if (result.success && result.domainRegisteredAt) {
        setRegistrationInfo({
          registeredAt: result.domainRegisteredAt,
          registeredByName: result.domainRegisteredByName ?? null,
        });
      }
    });
  };

  if (isRegistered) {
    return (
      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-xs">
          Domain {domain} wurde registriert am {fmtDate(registrationInfo.registeredAt)}
          {registrationInfo.registeredByName && ` von ${registrationInfo.registeredByName}`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-sm text-amber-800 dark:text-amber-200">
          Die Domain <strong>{domain}</strong> muss neu registriert werden
        </span>
      </div>
      <button
        onClick={handleMarkRegistered}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-xs font-medium disabled:opacity-50"
      >
        {isPending ? (
          <>
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            ...
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Erledigt
          </>
        )}
      </button>
    </div>
  );
}
