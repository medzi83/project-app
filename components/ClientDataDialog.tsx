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

type Agency = {
  id: string;
  name: string;
};

type ClientDataDialogProps = {
  isOpen: boolean;
  clientId: string;
  clientName: string;
  currentEmail: string | null;
  currentContact: string | null;
  currentAgencyId: string | null;
  missingEmail: boolean;
  missingContact: boolean;
  missingAgency: boolean;
  onComplete: () => void;
  onCancel: () => void;
};

export function ClientDataDialog({
  isOpen,
  clientId,
  clientName,
  currentEmail,
  currentContact,
  currentAgencyId,
  missingEmail,
  missingContact,
  missingAgency,
  onComplete,
  onCancel,
}: ClientDataDialogProps) {
  const [email, setEmail] = useState(currentEmail || "");
  const [contact, setContact] = useState(currentContact || "");
  const [agencyId, setAgencyId] = useState(currentAgencyId || "");
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAgencies, setLoadingAgencies] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load agencies when dialog opens (always load, not just when missing)
  useEffect(() => {
    if (!isOpen) return;

    const loadAgencies = async () => {
      setLoadingAgencies(true);
      try {
        const res = await fetch("/api/agencies");
        if (res.ok) {
          const data = await res.json();
          setAgencies(data.agencies || []);
        }
      } catch (err) {
        console.error("Error loading agencies:", err);
      } finally {
        setLoadingAgencies(false);
      }
    };

    loadAgencies();
  }, [isOpen]);

  const handleSave = async () => {
    // Validate required fields (always validate all fields now)
    if (!email || email.trim() === "") {
      setError("E-Mail-Adresse ist erforderlich");
      return;
    }

    if (!agencyId) {
      setError("Agentur ist erforderlich");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Always submit all three fields together
      const res = await fetch("/api/clients/update-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          email: email.trim(),
          contact: contact.trim() || null,
          agencyId: agencyId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Speichern");
      }

      // Success - don't call onComplete, just close and let parent handle
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
      setLoading(false); // Only reset loading on error
    }
    // Don't reset loading on success - keeps dialog visible during reload
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kundendaten vervollständigen</DialogTitle>
          <DialogDescription>
            Für den E-Mail-Versand fehlen noch einige Informationen zu diesem Kunden.
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
          </div>

          {/* Email Field - Always show */}
          <div className="space-y-2">
            <Label htmlFor="email">E-Mail-Adresse *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kunde@example.com"
              required
              className={!email ? "border-red-300" : ""}
            />
            {!email && (
              <p className="text-xs text-red-600">
                ⚠ E-Mail-Adresse ist erforderlich
              </p>
            )}
          </div>

          {/* Contact Field - Always show */}
          <div className="space-y-2">
            <Label htmlFor="contact">Kontaktperson</Label>
            <Input
              id="contact"
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="z.B. Max Mustermann"
              className={!contact ? "border-yellow-300" : ""}
            />
            {!contact && (
              <p className="text-xs text-yellow-600">
                💡 Optional, aber empfohlen für personalisierte E-Mails
              </p>
            )}
          </div>

          {/* Agency Field - Always show */}
          <div className="space-y-2">
            <Label htmlFor="agency">Agentur *</Label>
            {loadingAgencies ? (
              <div className="text-sm text-gray-500">Lade Agenturen...</div>
            ) : (
              <select
                id="agency"
                value={agencyId}
                onChange={(e) => setAgencyId(e.target.value)}
                className={`w-full rounded border p-2 ${!agencyId ? "border-red-300" : ""}`}
                required
              >
                <option value="">-- Bitte wählen --</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
            )}
            {!agencyId && (
              <p className="text-xs text-red-600">
                ⚠ Agentur ist erforderlich (bestimmt Signatur und Absender)
              </p>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Die Daten werden dauerhaft beim Kunden gespeichert und können später aktualisiert werden.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !email || !agencyId}
          >
            {loading ? "Wird gespeichert..." : "Speichern & Fortfahren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
