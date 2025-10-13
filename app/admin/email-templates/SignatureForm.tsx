'use client';

import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import RichHtmlEditor from "./RichHtmlEditor";
import { updateEmailSignature } from "./actions";

type SignatureFormProps = {
  options: Array<{
    agencyId: string | null;
    label: string;
    body: string;
  }>;
};

const DEFAULT_PLACEHOLDER = "<p>Mit freundlichen Grüßen<br/>Ihr Team</p>";

const optionKey = (agencyId: string | null) => agencyId ?? "default";

export default function SignatureForm({ options }: SignatureFormProps) {
  const fallbackOption = useMemo(
    () => options[0] ?? { agencyId: null, label: "Standard", body: "" },
    [options],
  );
  const [selectedId, setSelectedId] = useState(() => optionKey(fallbackOption.agencyId));
  const [body, setBody] = useState(fallbackOption.body);

  useEffect(() => {
    const current = options.find((option) => optionKey(option.agencyId) === selectedId);
    if (current) {
      setBody(current.body);
    } else if (options.length > 0) {
      setSelectedId(optionKey(fallbackOption.agencyId));
      setBody(fallbackOption.body);
    } else {
      setSelectedId("default");
      setBody("");
    }
  }, [options, selectedId, fallbackOption]);

  const currentOption = useMemo(
    () => options.find((option) => optionKey(option.agencyId) === selectedId) ?? fallbackOption,
    [options, selectedId, fallbackOption],
  );
  const originalBody = currentOption.body ?? "";
  const hasChanges = body !== originalBody;

  const handleAgencyChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedId(value);
    const nextOption = options.find((option) => optionKey(option.agencyId) === value);
    setBody(nextOption ? nextOption.body : "");
  };

  return (
    <form action={updateEmailSignature} className="space-y-4">
      <input type="hidden" name="agencyId" value={selectedId === "default" ? "" : selectedId} />
      <div>
        <p className="text-sm text-gray-500">
          Wähle eine Agentur aus und pflege die entsprechende Signatur. Wenn keine Agentur ausgewählt wird, gilt die Standard-Signatur für alle.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-[240px_1fr] md:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs uppercase tracking-wide text-gray-500">Agentur</span>
          <select
            value={selectedId}
            onChange={handleAgencyChange}
            className="rounded border px-3 py-2 text-sm"
          >
            {options.length === 0 && (
              <option value="default">Standard (alle Agenturen)</option>
            )}
            {options.map((option) => (
              <option key={optionKey(option.agencyId)} value={optionKey(option.agencyId)}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-gray-500">
          Kein Eintrag bedeutet, dass die Standard-Signatur verwendet wird.
        </p>
      </div>

      <RichHtmlEditor
        name="body"
        value={body}
        onChange={setBody}
        placeholder={DEFAULT_PLACEHOLDER}
        htmlRows={10}
      />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Live Vorschau</p>
        <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-4 text-sm">
          {body.trim() ? (
            <div dangerouslySetInnerHTML={{ __html: body }} />
          ) : (
            <p className="text-sm text-gray-400">Keine Signatur hinterlegt.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SignatureSubmitButton disabled={!hasChanges} />
        <button
          type="button"
          onClick={() => setBody(originalBody)}
          disabled={!hasChanges}
          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Änderungen verwerfen
        </button>
      </div>
    </form>
  );
}

function SignatureSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
    >
      {pending ? "Speichern..." : "Signatur speichern"}
    </button>
  );
}
