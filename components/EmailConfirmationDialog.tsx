"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EmailData = {
  id: string;
  toEmail: string;
  ccEmails: string | null;
  subject: string;
  body: string;
  project: {
    id: string;
    title: string;
  };
  client: {
    id: string;
    name: string;
    customerNo: string | null;
    email: string | null;
    contact: string | null;
    salutation: string | null;
    firstname: string | null;
    lastname: string | null;
    agency?: {
      id: string;
      name: string;
      logoIconPath: string | null;
    } | null;
  } | null;
  trigger: {
    name: string;
  };
};

export function EmailConfirmationDialog({
  queueIds,
  onComplete,
  onBackToClientData,
}: {
  queueIds: string[];
  onComplete: () => void;
  onBackToClientData?: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [emailData, setEmailData] = useState<EmailData | null>(null);
  const [toEmail, setToEmail] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const currentQueueId = queueIds[currentIndex];

  // Fetch email data when queue ID changes
  useEffect(() => {
    if (!currentQueueId) return;

    setLoading(true);
    setError(null);

    fetch(`/api/email/confirm?queueId=${currentQueueId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch email data");
        return res.json();
      })
      .then((data) => {
        setEmailData(data);
        setToEmail(data.toEmail);
        setEmailBody(data.body);
        setIsEditingBody(false);
        setIsOpen(true);
      })
      .catch((err) => {
        setError(err.message);
        console.error("Error fetching email data:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentQueueId]);

  const handleSend = async () => {
    if (!emailData) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueId: emailData.id,
          toEmail,
          ccEmails: emailData.ccEmails,
          body: emailBody,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send email");
      }

      // Move to next email or close dialog
      if (currentIndex < queueIds.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsOpen(false);
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!emailData) return;

    setLoading(true);

    try {
      await fetch(`/api/email/confirm?queueId=${emailData.id}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Error canceling email:", err);
    } finally {
      setLoading(false);
    }

    // Move to next email or close dialog (after loading is reset)
    if (currentIndex < queueIds.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsOpen(false);
      onComplete();
    }
  };

  if (!currentQueueId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleCancel();
      }
    }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[40rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>E-Mail an Kunden versenden</DialogTitle>
          <DialogDescription>
            {queueIds.length > 1 && (
              <span>
                E-Mail {currentIndex + 1} von {queueIds.length}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading && !emailData && (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Lade E-Mail-Daten...
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {emailData && (
          <div className="space-y-4">
            {/* Project Info */}
            <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Projekt</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {emailData.project.title}
                    {emailData.client?.customerNo && ` - ${emailData.client.customerNo}`}
                  </div>
                  {emailData.client && (
                    <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Kunde: {emailData.client.name}
                    </div>
                  )}
                </div>
                {emailData.client?.agency?.logoIconPath && (
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <img
                      src={emailData.client.agency.logoIconPath}
                      alt={emailData.client.agency.name}
                      className="w-12 h-12 object-contain rounded"
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {emailData.client.agency.name}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Trigger Info */}
            <div>
              <Badge variant="outline" className="text-xs">
                Trigger: {emailData.trigger.name}
              </Badge>
            </div>

            {/* Email Address (read-only display) */}
            <div className="space-y-2">
              <Label htmlFor="toEmail">An (E-Mail-Adresse)</Label>
              <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-sm text-gray-900 dark:text-white">
                {toEmail || "-"}
              </div>
            </div>

            {/* CC Emails */}
            {emailData.ccEmails && (
              <div className="space-y-2">
                <Label>CC</Label>
                <div className="text-sm text-gray-600 dark:text-gray-300">{emailData.ccEmails}</div>
              </div>
            )}

            {/* Subject */}
            <div className="space-y-2">
              <Label>Betreff</Label>
              <div className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-sm text-gray-900 dark:text-white">
                {emailData.subject}
              </div>
            </div>

            {/* Body Edit/Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Nachricht</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditingBody(!isEditingBody)}
                  className="text-xs"
                >
                  {isEditingBody ? "Vorschau" : "Text bearbeiten"}
                </Button>
              </div>
              {isEditingBody ? (
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={10}
                  className="font-mono text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                  placeholder="E-Mail-Text (HTML möglich)"
                />
              ) : (
                <div
                  className="rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 text-sm max-h-64 overflow-y-auto text-gray-900 dark:text-white"
                  dangerouslySetInnerHTML={{ __html: emailBody }}
                />
              )}
              {isEditingBody && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  HTML-Tags werden unterstützt (z.B. &lt;b&gt;fett&lt;/b&gt;, &lt;br/&gt; für Zeilenumbruch)
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 flex-1">
            {onBackToClientData && (
              <Button
                type="button"
                variant="ghost"
                onClick={onBackToClientData}
                disabled={loading}
                className="text-xs"
              >
                ← Kundendaten ändern
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleSend}
              disabled={loading || !emailData}
            >
              {loading
                ? "Wird gesendet..."
                : emailData?.client?.agency
                ? `Senden als ${emailData.client.agency.name}`
                : "Jetzt senden"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
