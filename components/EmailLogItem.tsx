"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmailLogDialog } from "./EmailLogDialog";
import { deleteEmailLog } from "@/app/clients/[id]/actions";

type EmailLogItemProps = {
  log: {
    id: string;
    subject: string;
    body: string;
    toEmail: string;
    ccEmails: string | null;
    sentAt: Date | string;
    success: boolean;
    error: string | null;
    projectId: string | null;
    projectTitle?: string;
    trigger: {
      name: string;
    } | null;
  };
  isAdmin: boolean;
};

const formatDate = (value: Date | string) => {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "-";
  }
};

export function EmailLogItem({ log, isAdmin }: EmailLogItemProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Möchten Sie diesen E-Mail-Log wirklich löschen?")) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteEmailLog(log.id);
    } catch (error) {
      alert("Fehler beim Löschen: " + (error instanceof Error ? error.message : "Unbekannter Fehler"));
      setIsDeleting(false);
    }
  };

  if (isDeleting) {
    return (
      <div className="rounded border p-3 bg-gray-50 opacity-50">
        <p className="text-sm text-gray-500">Wird gelöscht...</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded border p-3 hover:bg-gray-50 transition">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => setDialogOpen(true)}
                className="font-medium text-sm text-blue-600 hover:underline text-left"
              >
                {log.subject}
              </button>
              {!log.success && (
                <Badge variant="destructive" className="text-xs">
                  Fehlgeschlagen
                </Badge>
              )}
              {log.success && (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-200 text-xs">
                  Versendet
                </Badge>
              )}
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <div>
                <span className="text-gray-500">An:</span> {log.toEmail}
                {log.ccEmails && (
                  <span className="ml-2">
                    <span className="text-gray-500">CC:</span> {log.ccEmails}
                  </span>
                )}
              </div>
              {log.projectId && log.projectTitle && (
                <div>
                  <span className="text-gray-500">Projekt:</span>{" "}
                  <Link
                    href={`/projects/${log.projectId}`}
                    className="text-blue-600 hover:underline"
                  >
                    {log.projectTitle}
                  </Link>
                </div>
              )}
              {log.trigger && (
                <div>
                  <span className="text-gray-500">Trigger:</span> {log.trigger.name}
                </div>
              )}
              <div>
                <span className="text-gray-500">Gesendet:</span> {formatDate(log.sentAt)}
              </div>
              {log.error && (
                <div className="mt-1 rounded bg-red-50 px-2 py-1 text-red-700">
                  <span className="text-gray-500">Fehler:</span> {log.error}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDialogOpen(true)}
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100"
            >
              Ansehen
            </button>
            {isAdmin && (
              <button
                onClick={handleDelete}
                className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
              >
                Löschen
              </button>
            )}
          </div>
        </div>
      </div>

      <EmailLogDialog
        subject={log.subject}
        body={log.body}
        toEmail={log.toEmail}
        ccEmails={log.ccEmails}
        sentAt={log.sentAt}
        trigger={log.trigger?.name}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
