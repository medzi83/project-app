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
import { Input } from "@/components/ui/input";
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
    email: string | null;
    contact: string | null;
  } | null;
  trigger: {
    name: string;
  };
};

export function EmailConfirmationDialog({
  queueIds,
  onComplete,
}: {
  queueIds: string[];
  onComplete: () => void;
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

      // Move to next email or close dialog
      if (currentIndex < queueIds.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsOpen(false);
        onComplete();
      }
    } catch (err) {
      console.error("Error canceling email:", err);
      // Continue anyway
      if (currentIndex < queueIds.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsOpen(false);
        onComplete();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!currentQueueId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        handleCancel();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
          <div className="py-8 text-center text-sm text-gray-500">
            Lade E-Mail-Daten...
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {emailData && (
          <div className="space-y-4">
            {/* Project Info */}
            <div className="rounded border bg-gray-50 p-3">
              <div className="text-xs text-gray-500 mb-1">Projekt</div>
              <div className="font-medium">{emailData.project.title}</div>
              {emailData.client && (
                <div className="text-sm text-gray-600 mt-1">
                  Kunde: {emailData.client.name}
                </div>
              )}
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
              <div className="rounded border bg-gray-50 p-2 text-sm">
                {toEmail || "-"}
              </div>
            </div>

            {/* CC Emails */}
            {emailData.ccEmails && (
              <div className="space-y-2">
                <Label>CC</Label>
                <div className="text-sm text-gray-600">{emailData.ccEmails}</div>
              </div>
            )}

            {/* Subject */}
            <div className="space-y-2">
              <Label>Betreff</Label>
              <div className="rounded border bg-gray-50 p-2 text-sm">
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
                  className="font-mono text-sm"
                  placeholder="E-Mail-Text (HTML möglich)"
                />
              ) : (
                <div
                  className="rounded border bg-gray-50 p-3 text-sm max-h-64 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: emailBody }}
                />
              )}
              {isEditingBody && (
                <p className="text-xs text-gray-500">
                  HTML-Tags werden unterstützt (z.B. &lt;b&gt;fett&lt;/b&gt;, &lt;br/&gt; für Zeilenumbruch)
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
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
            {loading ? "Wird gesendet..." : "Jetzt senden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
