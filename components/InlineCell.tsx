"use client";
import { CSSProperties, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInlineField } from "@/app/projects/inline-actions";

type Option = { value: string; label: string };

type Props = {
  target: "project" | "website";
  id: string;             // projectId
  name: string;           // Feldname (whitelisted)
  type: "text" | "number" | "date" | "datetime" | "datetime-with-type" | "select" | "tri" | "textarea";
  display: string;        // Anzeige im Read-Mode
  value?: string | number | boolean | null; // Startwert fuer Edit
  extraValue?: string;    // Für datetime-with-type: webterminType
  options?: Option[];     // fuer select/tri
  canEdit: boolean;
  displayClassName?: string;
  displayStyle?: CSSProperties;
};

export default function InlineCell({
  target,
  id,
  name,
  type,
  display,
  value,
  extraValue,
  options,
  canEdit,
  displayClassName,
  displayStyle,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select?.();
      }
    }
  }, [editing]);

  const fallbackDisplay = display && display.trim() !== "" ? display : "";

  if (!canEdit) {
    return (
      <span className={displayClassName} style={displayStyle}>
        {fallbackDisplay}
      </span>
    );
  }

  const enterEdit = () => setEditing(true);
  const cancel = () => setEditing(false);

  function submitForm(fd: FormData) {
    startTransition(async () => {
      await updateInlineField(fd);
      setEditing(false);
      router.refresh();
    });
  }

  // READ MODE
  if (!editing) {
    const displayNode = (
      <span className={displayClassName} style={displayStyle}>
        {fallbackDisplay}
      </span>
    );

    const baseButtonClass = "inline-flex w-full items-start justify-start gap-2 rounded px-1 py-0.5 text-left cursor-text bg-transparent";
    const interactiveClass = "transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";
    const buttonClassName = `${baseButtonClass} ${interactiveClass}`;

    return (
      <button
        type="button"
        onClick={enterEdit}
        onDoubleClick={enterEdit}
        title="Zum Bearbeiten klicken"
        className={buttonClassName}
      >
        {displayNode}
      </button>
    );
  }

  // EDIT MODE
  const vStr = vToString(value, type);
  return (
    <form ref={formRef} action={submitForm} className="inline">
      <input type="hidden" name="target" value={target} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="key" value={name} />

      {type === "select" && (
        <select
          name="value"
          defaultValue={vStr}
          ref={(el: HTMLSelectElement | null) => { inputRef.current = el; }}
          className="p-1 border rounded"
          onBlur={() => formRef.current?.requestSubmit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
            if (e.key === "Enter")  { e.preventDefault(); formRef.current?.requestSubmit(); }
          }}
        >
          {options?.map((o, index) => (
            <option key={o.value ? `${o.value}-${index}` : `none-${index}`} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {type === "tri" && (
        <select
          name="value"
          defaultValue={vStr}
          ref={(el: HTMLSelectElement | null) => { inputRef.current = el; }}
          className="p-1 border rounded"
          onBlur={() => formRef.current?.requestSubmit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
            if (e.key === "Enter")  { e.preventDefault(); formRef.current?.requestSubmit(); }
          }}
        >
          {(options ?? [
            { value: "unknown", label: "(nicht gesetzt)" },
            { value: "yes", label: "Ja" },
            { value: "no", label: "Nein" },
          ]).map((o, index) => (
            <option key={o.value ? `${o.value}-${index}` : `none-${index}`} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {type === "number" && (
        <input
          name="value" type="number" defaultValue={vStr}
          step={0.5} min={0} inputMode="decimal"
          ref={(el: HTMLInputElement | null) => { inputRef.current = el; }}
          className="w-24 p-1 border rounded"
          onBlur={() => formRef.current?.requestSubmit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
            if (e.key === "Enter")  { e.preventDefault(); formRef.current?.requestSubmit(); }
          }}
        />
      )}

      {type === "date" && (
        <input
          name="value" type="date" defaultValue={vStr}
          ref={(el: HTMLInputElement | null) => { inputRef.current = el; }}
          className="p-1 border rounded"
          onBlur={() => formRef.current?.requestSubmit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
            if (e.key === "Enter")  { e.preventDefault(); formRef.current?.requestSubmit(); }
          }}
        />
      )}

      {type === "datetime" && (
        <input
          name="value" type="datetime-local" defaultValue={vStr}
          ref={(el: HTMLInputElement | null) => { inputRef.current = el; }}
          className="p-1 border rounded"
          onBlur={() => formRef.current?.requestSubmit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
            if (e.key === "Enter")  { e.preventDefault(); formRef.current?.requestSubmit(); }
          }}
        />
      )}

      {type === "datetime-with-type" && (
        <div className="flex flex-col gap-2">
          <input
            name="value" type="datetime-local" defaultValue={vStr}
            ref={(el: HTMLInputElement | null) => { inputRef.current = el; }}
            className="p-1 border rounded"
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); cancel(); }
            }}
          />
          <select
            name="extraValue"
            defaultValue={extraValue ?? ""}
            className="p-1 border rounded text-sm"
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); cancel(); }
            }}
          >
            <option value="">(nicht gesetzt)</option>
            <option value="TELEFONISCH">Telefonisch</option>
            <option value="BEIM_KUNDEN">Beim Kunden</option>
            <option value="IN_DER_AGENTUR">In der Agentur</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancel}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-2 py-1 text-xs bg-black text-white rounded hover:bg-gray-800"
            >
              Speichern
            </button>
          </div>
        </div>
      )}

      {type === "text" && (
        <input
          name="value" type="text" defaultValue={vStr}
          ref={(el: HTMLInputElement | null) => { inputRef.current = el; }}
          className="p-1 border rounded"
          onBlur={() => formRef.current?.requestSubmit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
            if (e.key === "Enter")  { e.preventDefault(); formRef.current?.requestSubmit(); }
          }}
        />
      )}

      {type === "textarea" && (
        <textarea
          name="value"
          defaultValue={vStr}
          ref={(el: HTMLTextAreaElement | null) => { inputRef.current = el; }}
          className="w-56 p-1 border rounded"
          rows={4}
          onBlur={() => formRef.current?.requestSubmit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); cancel(); }
            if ((e.key === "Enter" && (e.ctrlKey || e.metaKey)))  { e.preventDefault(); formRef.current?.requestSubmit(); }
          }}
        />
      )}
      {isPending && <span className="ml-2 text-xs opacity-60">...speichere</span>}
    </form>
  );
}

function vToString(v: Props["value"], type: Props["type"]) {
  if (v === null || v === undefined) return "";
  if (type === "date") {
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }
  if (type === "datetime") {
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    // Format für datetime-local: YYYY-MM-DDTHH:mm
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  if (type === "tri") return v === true ? "yes" : v === false ? "no" : "unknown";
  return String(v);
}







