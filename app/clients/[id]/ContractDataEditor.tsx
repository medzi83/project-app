"use client";

import { useState } from "react";
import { updateClientContract } from "./actions";
import type { PaymentInterval, PaymentMethod, ContractService } from "@prisma/client";

// Custom type for serialized contract data (Decimal converted to string)
type SerializedContract = {
  id: string;
  clientId: string;
  contractStart: Date | null;
  contractDuration: number | null;
  setupFee: string | null;  // Decimal -> string for serialization
  paymentInterval: PaymentInterval | null;
  paymentMethod: PaymentMethod | null;
  monthlyAmount: string | null;  // Decimal -> string for serialization
  services: ContractService[];
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  phone1: string | null;
  phone2: string | null;
  mobile: string | null;
  note: string | null;
  minTermEnd: Date | null;
  cancellation: string | null;  // Freitext statt Datum
  sepaMandate: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type Props = {
  clientId: string;
  contract: SerializedContract | null;
  isAdmin: boolean;
  canEdit: boolean;
};

const PAYMENT_INTERVAL_LABELS: Record<PaymentInterval, string> = {
  MONTHLY: "Monatlich",
  QUARTERLY: "Vierteljährlich",
  SEMI_ANNUAL: "Halbjährlich",
  ANNUAL: "Jährlich",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  SEPA: "SEPA-Lastschrift",
  INVOICE: "Rechnung",
  OTHER: "Sonstige",
};

const CONTRACT_SERVICE_LABELS: Record<ContractService, string> = {
  WEBSITE_SUCCESS: "Webseite (Success)",
  WEBSITE_HOSTING: "Webseitenhosting",
  TEXTERSTELLUNG: "Texterstellung (Textit)",
  FILM_IMAGE: "Film (Image)",
  FILM_HOSTING: "Filmhosting",
  SEO_PLUS: "SEOplus",
  BARRIEREFREIHEIT: "Barrierefreiheit (B-free)",
  DROHNE_ONAIR: "Drohne (onAir)",
  FOTOERSTELLUNG: "Fotoerstellung",
  ONLINESHOP_SHOPIT: "Onlineshop (Shopit)",
  FULL_CONTENT: "Full Content",
  SECURE_PLUS: "SecurePlus",
  ADWORDS_ADLEIT: "Adwords (Adleit)",
  SOCIAL_MEDIA: "Social-Media",
};

// Berechnet Ende Mindestlaufzeit aus Vertragsbeginn + Laufzeit
const calculateMinTermEnd = (contractStart: Date | null | undefined, durationMonths: number | null | undefined): Date | null => {
  if (!contractStart || !durationMonths) return null;
  const date = new Date(contractStart);
  date.setMonth(date.getMonth() + durationMonths);
  return date;
};

const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
};

const formatCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return num.toFixed(2).replace(".", ",");
};

export function ContractDataEditor({ clientId, contract, isAdmin, canEdit }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.set("clientId", clientId);

    const result = await updateClientContract(formData);

    setIsSaving(false);
    setMessage({
      type: result.success ? "success" : "error",
      text: result.message,
    });

    if (result.success) {
      setIsEditing(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const services = contract?.services ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Vertragsdaten
        </h2>
        {canEdit && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition"
          >
            Bearbeiten
          </button>
        )}
      </div>

      {message && (
        <div
          className={`mb-3 px-3 py-2 rounded text-sm ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vertragsdaten */}
          <fieldset className="border border-border rounded p-3 space-y-3">
            <legend className="text-sm font-medium text-muted-foreground px-2">Vertrag</legend>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Vertragsbeginn</label>
                <input
                  type="date"
                  name="contractStart"
                  defaultValue={formatDate(contract?.contractStart)}
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Laufzeit (Monate)</label>
                <input
                  type="number"
                  name="contractDuration"
                  defaultValue={contract?.contractDuration ?? ""}
                  min="0"
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Setup (EUR)</label>
                <input
                  type="text"
                  name="setupFee"
                  defaultValue={formatCurrency(contract?.setupFee)}
                  placeholder="0,00"
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Monatl. Betrag (EUR)</label>
                <input
                  type="text"
                  name="monthlyAmount"
                  defaultValue={formatCurrency(contract?.monthlyAmount)}
                  placeholder="0,00"
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Zahlweise</label>
                <select
                  name="paymentInterval"
                  defaultValue={contract?.paymentInterval ?? ""}
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">-- Auswählen --</option>
                  {Object.entries(PAYMENT_INTERVAL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Zahlart</label>
                <select
                  name="paymentMethod"
                  defaultValue={contract?.paymentMethod ?? ""}
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">-- Auswählen --</option>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Ende Mindestlaufzeit
                  <span className="ml-1 text-[10px] text-muted-foreground/70">(optional, sonst berechnet)</span>
                </label>
                <input
                  type="date"
                  name="minTermEnd"
                  defaultValue={formatDate(contract?.minTermEnd)}
                  placeholder="Wird berechnet wenn leer"
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Storno/Kündigung</label>
                <input
                  type="text"
                  name="cancellation"
                  defaultValue={contract?.cancellation ?? ""}
                  placeholder="z.B. gekündigt zum 31.12.2025"
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">SEPA-Mandat</label>
              <input
                type="text"
                name="sepaMandate"
                defaultValue={contract?.sepaMandate ?? ""}
                placeholder="SEPA-Mandatsreferenz"
                className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>
          </fieldset>

          {/* Leistungsumfang */}
          <fieldset className="border border-border rounded p-3">
            <legend className="text-sm font-medium text-muted-foreground px-2">Leistungsumfang</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.entries(CONTRACT_SERVICE_LABELS).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    name="services"
                    value={value}
                    defaultChecked={services.includes(value as ContractService)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Adressdaten */}
          <fieldset className="border border-border rounded p-3 space-y-3">
            <legend className="text-sm font-medium text-muted-foreground px-2">Adresse</legend>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-3">
                <label className="block text-xs text-muted-foreground mb-1">Straße</label>
                <input
                  type="text"
                  name="street"
                  defaultValue={contract?.street ?? ""}
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Hausnummer</label>
                <input
                  type="text"
                  name="houseNumber"
                  defaultValue={contract?.houseNumber ?? ""}
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">PLZ</label>
                <input
                  type="text"
                  name="postalCode"
                  defaultValue={contract?.postalCode ?? ""}
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Ort</label>
                <input
                  type="text"
                  name="city"
                  defaultValue={contract?.city ?? ""}
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          </fieldset>

          {/* Kontaktdaten */}
          <fieldset className="border border-border rounded p-3 space-y-3">
            <legend className="text-sm font-medium text-muted-foreground px-2">Kontakt</legend>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Telefon 1</label>
                <input
                  type="tel"
                  name="phone1"
                  defaultValue={contract?.phone1 ?? ""}
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Telefon 2</label>
                <input
                  type="tel"
                  name="phone2"
                  defaultValue={contract?.phone2 ?? ""}
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Mobil</label>
                <input
                  type="tel"
                  name="mobile"
                  defaultValue={contract?.mobile ?? ""}
                  className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          </fieldset>

          {/* Weitere Felder */}
          <fieldset className="border border-border rounded p-3 space-y-3">
            <legend className="text-sm font-medium text-muted-foreground px-2">Weitere Angaben</legend>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Schreiber</label>
              <input
                type="text"
                name="createdBy"
                defaultValue={contract?.createdBy ?? ""}
                placeholder="Name des Bearbeiters"
                className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Notiz</label>
              <textarea
                name="note"
                defaultValue={contract?.note ?? ""}
                rows={3}
                className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm resize-none"
              />
            </div>
          </fieldset>

          {/* Buttons */}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setMessage(null);
              }}
              className="px-4 py-2 text-sm rounded border border-border hover:bg-muted transition"
              disabled={isSaving}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
              disabled={isSaving}
            >
              {isSaving ? "Speichern..." : "Speichern"}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {/* View Mode: Vertragsdaten */}
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2 text-sm">
            <div>
              <span className="text-muted-foreground">Vertragsbeginn:</span>{" "}
              <span className="font-medium">
                {contract?.contractStart
                  ? new Date(contract.contractStart).toLocaleDateString("de-DE")
                  : "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Laufzeit:</span>{" "}
              <span className="font-medium">
                {contract?.contractDuration ? `${contract.contractDuration} Monate` : "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Setup:</span>{" "}
              <span className="font-medium">
                {contract?.setupFee ? `${formatCurrency(contract.setupFee)} EUR` : "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Monatl. Betrag:</span>{" "}
              <span className="font-medium">
                {contract?.monthlyAmount ? `${formatCurrency(contract.monthlyAmount)} EUR` : "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Zahlweise:</span>{" "}
              <span className="font-medium">
                {contract?.paymentInterval
                  ? PAYMENT_INTERVAL_LABELS[contract.paymentInterval]
                  : "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Zahlart:</span>{" "}
              <span className="font-medium">
                {contract?.paymentMethod
                  ? PAYMENT_METHOD_LABELS[contract.paymentMethod]
                  : "-"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">SEPA:</span>{" "}
              <span className="font-medium">{contract?.sepaMandate || "-"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Ende Mindestlaufzeit:</span>{" "}
              {(() => {
                // Manuell eingetragener Wert hat Vorrang
                if (contract?.minTermEnd) {
                  const minTermDate = new Date(contract.minTermEnd);
                  const isPast = minTermDate < new Date();
                  return (
                    <span className={`font-medium ${isPast ? "text-red-600 dark:text-red-400" : ""}`}>
                      {minTermDate.toLocaleDateString("de-DE")}
                    </span>
                  );
                }
                // Automatisch berechnen aus Vertragsbeginn + Laufzeit
                const calculatedEnd = calculateMinTermEnd(contract?.contractStart, contract?.contractDuration);
                if (calculatedEnd) {
                  const isPast = calculatedEnd < new Date();
                  return (
                    <span className={`font-medium ${isPast ? "text-red-600 dark:text-red-400" : ""}`} title="Automatisch berechnet">
                      {calculatedEnd.toLocaleDateString("de-DE")} <span className="text-xs text-muted-foreground">(berechnet)</span>
                    </span>
                  );
                }
                return <span className="font-medium">-</span>;
              })()}
            </div>
            <div>
              <span className="text-muted-foreground">Storno/Kündigung:</span>{" "}
              <span className={`font-medium ${contract?.cancellation ? "text-orange-600 dark:text-orange-400" : ""}`}>
                {contract?.cancellation || "-"}
              </span>
            </div>
          </div>

          {/* Leistungsumfang */}
          {services.length > 0 && (
            <div>
              <div className="text-sm text-muted-foreground mb-2">Leistungsumfang:</div>
              <div className="flex flex-wrap gap-1.5">
                {services.map((service) => (
                  <span
                    key={service}
                    className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  >
                    {CONTRACT_SERVICE_LABELS[service] || service}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Adresse */}
          {(contract?.street || contract?.city) && (
            <div className="text-sm">
              <span className="text-muted-foreground">Adresse:</span>{" "}
              <span className="font-medium">
                {[
                  contract?.street && contract?.houseNumber
                    ? `${contract.street} ${contract.houseNumber}`
                    : contract?.street,
                  contract?.postalCode && contract?.city
                    ? `${contract.postalCode} ${contract.city}`
                    : contract?.city,
                ]
                  .filter(Boolean)
                  .join(", ") || "-"}
              </span>
            </div>
          )}

          {/* Telefon */}
          {(contract?.phone1 || contract?.phone2 || contract?.mobile) && (
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-3 text-sm">
              {contract?.phone1 && (
                <div>
                  <span className="text-muted-foreground">Tel. 1:</span>{" "}
                  <a href={`tel:${contract.phone1}`} className="font-medium hover:underline">
                    {contract.phone1}
                  </a>
                </div>
              )}
              {contract?.phone2 && (
                <div>
                  <span className="text-muted-foreground">Tel. 2:</span>{" "}
                  <a href={`tel:${contract.phone2}`} className="font-medium hover:underline">
                    {contract.phone2}
                  </a>
                </div>
              )}
              {contract?.mobile && (
                <div>
                  <span className="text-muted-foreground">Mobil:</span>{" "}
                  <a href={`tel:${contract.mobile}`} className="font-medium hover:underline">
                    {contract.mobile}
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Schreiber */}
          {contract?.createdBy && (
            <div className="text-sm">
              <span className="text-muted-foreground">Schreiber:</span>{" "}
              <span className="font-medium">{contract.createdBy}</span>
            </div>
          )}

          {/* Notiz */}
          {contract?.note && (
            <div className="text-sm">
              <span className="text-muted-foreground">Notiz:</span>
              <p className="mt-1 text-foreground whitespace-pre-wrap bg-muted/50 rounded p-2">
                {contract.note}
              </p>
            </div>
          )}

          {/* Leer-Zustand */}
          {!contract && (
            <div className="text-sm text-muted-foreground italic py-4 text-center">
              Keine Vertragsdaten hinterlegt
            </div>
          )}
        </div>
      )}
    </div>
  );
}
