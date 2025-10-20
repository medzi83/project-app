'use client';

import { useState, type ReactNode } from "react";
import { updateEmailTemplate } from "./actions";
import RichHtmlEditor from "./RichHtmlEditor";
import VariableGroupsPanel, { type VariableGroup } from "./VariableGroupsPanel";
import SendTestEmailForm from "./SendTestEmailForm";
import { EMAIL_TEMPLATE_CATEGORIES, type EmailTemplateCategoryKey } from "./constants";

type Agency = {
  id: string;
  name: string;
};

type Props = {
  id: string;
  initialTitle: string;
  initialSubject: string;
  initialBody: string;
  initialCategory: EmailTemplateCategoryKey;
  variableGroups?: VariableGroup[];
  agencies: Agency[];
};

export default function EditTemplateForm({ id, initialTitle, initialSubject, initialBody, initialCategory, variableGroups, agencies }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [category, setCategory] = useState<EmailTemplateCategoryKey>(initialCategory);
  const [showTestEmail, setShowTestEmail] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-3">
        <form action={updateEmailTemplate} className="space-y-3">
          <input type="hidden" name="id" value={id} />

          <Field label="Technischer Titel *">
            <input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Kategorie *">
            <select
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as EmailTemplateCategoryKey)}
              required
              className="w-full rounded border px-3 py-2 text-sm"
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
              onChange={(e) => setSubject(e.target.value)}
              required
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </Field>

          <Field label="HTML-Inhalt *">
            <RichHtmlEditor
              name="body"
              value={body}
              onChange={setBody}
              placeholder="<p>E-Mail-Inhalt...</p>"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded border border-black px-4 py-2 text-sm font-medium text-black hover:bg-gray-50"
            >
              Änderungen speichern
            </button>
            <button
              type="button"
              onClick={() => setShowTestEmail(!showTestEmail)}
              className="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {showTestEmail ? 'Test-E-Mail schließen' : 'Test-E-Mail senden'}
            </button>
          </div>
        </form>

        {showTestEmail && (
          <div className="mt-6 border-t pt-6">
            <SendTestEmailForm templateId={id} agencies={agencies} />
          </div>
        )}
      </div>

      {variableGroups && variableGroups.length > 0 && (
        <VariableGroupsPanel groups={variableGroups} />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}
