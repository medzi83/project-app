"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInlineField } from "@/app/projects/inline-actions";

type Option = { value: string; label: string };

type Props = {
  target: "project" | "website";
  id: string;             // projectId
  name: string;           // Feldname (whitelisted)
  type: "text" | "number" | "date" | "select" | "tri";
  display: string;        // Anzeige im Read-Mode
  value?: string | number | boolean | null; // Startwert fÃ¼r Edit
  options?: Option[];     // fÃ¼r select/tri
  canEdit: boolean;
};

export default function InlineCell({ target, id, name, type, display, value, options, canEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select?.();
    }
  }, [editing]);

  if (!canEdit) return <span>{display || "â€”"}</span>;

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
    return (
      <span onDoubleClick={enterEdit} title="Doppelklick zum Bearbeiten" className="cursor-text">
        {display || "â€”"}
      </span>
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
          {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
            { value: "unknown", label: "â€” unbekannt â€”" },
            { value: "yes", label: "Ja" },
            { value: "no", label: "Nein" },
          ]).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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

      {isPending && <span className="ml-2 text-xs opacity-60">...speichere</span>}
    </form>
  );
}

function vToString(v: Props["value"], type: Props["type"]) {
  if (v === null || v === undefined) return type === "number" ? "" : "";
  if (type === "date") {
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0,10);
  }
  if (type === "tri") return v === true ? "yes" : v === false ? "no" : "unknown";
  return String(v);
}




