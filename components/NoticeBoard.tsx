"use client";

import { useMemo, useTransition } from "react";
import { CheckCircle2, Loader2, Megaphone } from "lucide-react";
import { acknowledgeNotice } from "@/app/notices/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type NoticeBoardEntry = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  requireAcknowledgement: boolean;
  acknowledgedAt?: string | null;
  visibility: "GLOBAL" | "TARGETED";
  targetLabel?: string;
  authorName?: string | null;
};

type Props = {
  notices: NoticeBoardEntry[];
  canAcknowledge?: boolean;
};

const formatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function NoticeBoard({ notices, canAcknowledge = false }: Props) {
  const [isPending, startTransition] = useTransition();

  const sortedNotices = useMemo(
    () =>
      [...notices].sort((a, b) => {
        const timeA = Date.parse(a.createdAt);
        const timeB = Date.parse(b.createdAt);
        return Number.isNaN(timeB) ? -1 : Number.isNaN(timeA) ? 1 : timeB - timeA;
      }),
    [notices],
  );

  if (sortedNotices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
        Keine Hinweise vorhanden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sortedNotices.map((notice) => {
        const isRead = Boolean(notice.acknowledgedAt);
        const createdAtLabel = formatter.format(new Date(notice.createdAt));
        return (
          <div
            key={notice.id}
            className="rounded-2xl border bg-card text-card-foreground p-4 shadow-sm transition hover:border-primary/50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Megaphone className="h-5 w-5 text-orange-500 dark:text-orange-400" />
              <h3 className="text-lg font-semibold">{notice.title}</h3>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>erstellt am {createdAtLabel}</span>
                {notice.authorName && <span>von {notice.authorName}</span>}
                {notice.visibility === "GLOBAL" ? (
                  <Badge variant="outline">Global</Badge>
                ) : (
                  <Badge variant="outline">{notice.targetLabel ?? "Individuell"}</Badge>
                )}
                {notice.requireAcknowledgement && (
                  <Badge variant="secondary">Bestätigung erforderlich</Badge>
                )}
              </div>
            </div>

            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {notice.message}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              {notice.requireAcknowledgement && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2
                    className={`${isRead ? "text-green-600 dark:text-green-400" : "text-muted-foreground"} h-4 w-4`}
                  />
                  {isRead
                    ? `Bestätigt am ${formatter.format(new Date(notice.acknowledgedAt!))}`
                    : "Noch nicht bestätigt"}
                </div>
              )}
              {canAcknowledge && notice.requireAcknowledgement && !isRead && (
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await acknowledgeNotice(notice.id);
                    })
                  }
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Wird gespeichert …
                    </>
                  ) : (
                    "Gelesen"
                  )}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
