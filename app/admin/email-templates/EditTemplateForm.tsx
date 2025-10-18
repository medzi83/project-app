'use client';

import { useState, type ReactNode } from "react";
import { updateEmailTemplate } from "./actions";
import RichHtmlEditor from "./RichHtmlEditor";

type Props = {
  id: string;
  initialTitle: string;
  initialSubject: string;
  initialBody: string;
};

export default function EditTemplateForm({ id, initialTitle, initialSubject, initialBody }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  return (
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
      </div>
    </form>
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
