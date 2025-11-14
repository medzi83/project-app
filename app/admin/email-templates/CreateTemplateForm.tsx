'use client';

import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { createEmailTemplate } from "./actions";
import RichHtmlEditor from "./RichHtmlEditor";
import { EMAIL_TEMPLATE_CATEGORIES, type EmailTemplateCategoryKey } from "./constants";

export default function CreateTemplateForm() {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<EmailTemplateCategoryKey>("GENERAL");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!previewOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewOpen]);

  const openPreview = () => setPreviewOpen(true);
  const closePreview = () => setPreviewOpen(false);

  const previewBody = body.trim() ? body : '<p style="color:#6b7280;">Noch kein Inhalt vorhanden.</p>';

  return (
    <>
      <form action={createEmailTemplate} className="space-y-4">
        <Field label="Technischer Titel *">
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="z. B. onboarding_willkommen"
          />
        </Field>
        <Field label="Kategorie *">
          <select
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value as EmailTemplateCategoryKey)}
            required
            className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {Object.entries(EMAIL_TEMPLATE_CATEGORIES).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Betreff *">
          <input
            name="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            className="w-full rounded border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="Willkommen bei Projektverwaltung"
          />
        </Field>
        <Field label="Vorlageninhalt *">
          <RichHtmlEditor
            name="body"
            value={body}
            onChange={setBody}
            placeholder="<p>Hallo {{name}},</p>"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openPreview}
            className="rounded border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Vorschau anzeigen
          </button>
          <SubmitButton />
        </div>
      </form>

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closePreview}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white dark:bg-gray-900 p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Vorlagenvorschau</h3>
                <p className="text-sm text-muted-foreground">
                  Platzhalter werden in der finalen E-Mail automatisch ersetzt.
                </p>
              </div>
              <button
                type="button"
                onClick={closePreview}
                className="rounded border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                Schliessen
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Titel</p>
                <p className="text-sm text-foreground">{title || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kategorie</p>
                <p className="text-sm text-foreground">{EMAIL_TEMPLATE_CATEGORIES[category].label}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Betreff</p>
                <p className="text-sm text-foreground">{subject || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">HTML-Inhalt</p>
                <div className="mt-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 text-sm">
                  <div dangerouslySetInnerHTML={{ __html: previewBody }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-70"
    >
      {pending ? "Speichern..." : "Vorlage speichern"}
    </button>
  );
}
