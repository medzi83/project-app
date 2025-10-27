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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EmailTemplate = {
  id: string;
  title: string;
  subject: string;
  body: string;
};

type ClientEmailDialogProps = {
  isOpen: boolean;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientSalutation?: string | null;
  clientFirstname?: string | null;
  clientLastname?: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function ClientEmailDialog({
  isOpen,
  clientId,
  clientName,
  clientEmail,
  clientSalutation,
  clientFirstname,
  clientLastname,
  onClose,
  onSuccess,
}: ClientEmailDialogProps) {
  // Build contact name from firstname/lastname
  const contactName = clientFirstname || clientLastname
    ? `${clientSalutation ? clientSalutation + ' ' : ''}${clientFirstname || ''} ${clientLastname || ''}`.trim()
    : '';
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [toEmail, setToEmail] = useState(clientEmail || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load templates when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const res = await fetch("/api/email-templates/general");
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates || []);
        }
      } catch (err) {
        console.error("Error loading templates:", err);
      } finally {
        setLoadingTemplates(false);
      }
    };

    loadTemplates();
  }, [isOpen]);

  // Update email and subject when client data changes
  useEffect(() => {
    setToEmail(clientEmail || "");
  }, [clientEmail]);

  // Update subject and body when template is selected
  useEffect(() => {
    if (!selectedTemplateId) {
      setSubject("");
      setBody("");
      return;
    }

    const template = templates.find((t) => t.id === selectedTemplateId);
    if (!template) return;

    // Fetch rendered template with signature from backend
    const loadRenderedTemplate = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/email-templates/render-client-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: selectedTemplateId,
            clientId,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setSubject(data.subject);
          setBody(data.body);
        } else {
          console.error("Failed to render template");
          // Fallback to local placeholder replacement
          const replacePlaceholders = (text: string) => {
            return text
              .replace(/\{\{client\.name\}\}/g, clientName)
              .replace(/\{\{client\.contact\}\}/g, contactName);
          };
          setSubject(replacePlaceholders(template.subject));
          setBody(replacePlaceholders(template.body));
        }
      } catch (err) {
        console.error("Error loading rendered template:", err);
        // Fallback to local placeholder replacement
        const replacePlaceholders = (text: string) => {
          return text
            .replace(/\{\{client\.name\}\}/g, clientName)
            .replace(/\{\{client\.contact\}\}/g, contactName);
        };
        setSubject(replacePlaceholders(template.subject));
        setBody(replacePlaceholders(template.body));
      } finally {
        setLoading(false);
      }
    };

    loadRenderedTemplate();
  }, [selectedTemplateId, templates, clientName, contactName, clientId]);

  const handleSend = async () => {
    if (!toEmail || !subject || !body) {
      setError("Bitte füllen Sie alle erforderlichen Felder aus");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/email/send-client-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          toEmail,
          subject,
          body,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Senden der E-Mail");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Senden der E-Mail");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset form
    setSelectedTemplateId("");
    setSubject("");
    setBody("");
    setError(null);
    setIsEditingBody(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[40rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>E-Mail an Kunden senden</DialogTitle>
          <DialogDescription>
            Senden Sie eine E-Mail an {clientName}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Client Info */}
          <div className="rounded border bg-gray-50 p-3">
            <div className="text-xs text-gray-500 mb-1">Kunde</div>
            <div className="font-medium">{clientName}</div>
            {contactName && (
              <div className="text-sm text-gray-600 mt-1">
                Ansprechpartner: {contactName}
              </div>
            )}
          </div>

          {/* Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="template">E-Mail-Vorlage</Label>
            {loadingTemplates ? (
              <div className="text-sm text-gray-500">Lade Vorlagen...</div>
            ) : (
              <select
                id="template"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded border p-2"
              >
                <option value="">-- Bitte wählen --</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
            )}
            {templates.length === 0 && !loadingTemplates && (
              <p className="text-xs text-yellow-600">
                Keine allgemeinen E-Mail-Vorlagen vorhanden. Bitte erstellen Sie zuerst Vorlagen in der Kategorie "Allgemein".
              </p>
            )}
          </div>

          {/* Email Address */}
          <div className="space-y-2">
            <Label htmlFor="toEmail">An (E-Mail-Adresse) *</Label>
            <Input
              id="toEmail"
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="kunde@example.com"
              required
            />
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Betreff *</Label>
            <Input
              id="subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="E-Mail-Betreff"
              required
            />
          </div>

          {/* Body Edit/Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Nachricht *</Label>
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
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder="E-Mail-Text (HTML möglich)"
              />
            ) : (
              <div
                className="rounded border bg-gray-50 p-3 text-sm max-h-64 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: body || "<p class='text-gray-400'>Keine Nachricht</p>" }}
              />
            )}
            {isEditingBody && (
              <p className="text-xs text-gray-500">
                HTML-Tags werden unterstützt (z.B. &lt;b&gt;fett&lt;/b&gt;, &lt;br/&gt; für Zeilenumbruch)
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSend}
            disabled={loading || !toEmail || !subject || !body}
          >
            {loading ? "Wird gesendet..." : "E-Mail senden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
