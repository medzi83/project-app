"use client";
import { CSSProperties, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFilmInlineField } from "@/app/film-projects/inline-actions";

type Option = { value: string; label: string };

type Props = {
  id: string; // projectId
  name: string; // Feldname (whitelisted)
  type: "text" | "date" | "select" | "textarea";
  display: string; // Anzeige im Read-Mode
  value?: string | null; // Startwert fuer Edit
  options?: Option[]; // fuer select
  canEdit: boolean;
  displayClassName?: string;
  displayStyle?: CSSProperties;
};

export default function FilmInlineCell({
  id,
  name,
  type,
  display,
  value,
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
      await updateFilmInlineField(fd);
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

    const baseButtonClass =
      "inline-flex w-full items-start justify-start gap-2 rounded px-1 py-0.5 text-left cursor-text bg-transparent";
    const interactiveClass =
      "transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black";
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
  const vStr = value ?? "";
  const vDate = type === "date" && vStr ? new Date(vStr).toISOString().slice(0, 10) : vStr;

  return (
    <form ref={formRef} action={submitForm} className="inline">
      <input type="hidden" name="target" value="film" />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="key" value={name} />

      {type === "select" && (
        <select
          name="value"
          defaultValue={vStr}
          ref={(el: HTMLSelectElement | null) => {
            inputRef.current = el;
          }}
          className="p-1 border rounded"
          onBlur={() => formRef.current?.requestSubmit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
            if (e.key === "Enter") {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        >
          {options?.map((o, index) => (
            <option key={o.value ? `${o.value}-${index}` : `none-${index}`} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {type === "date" && (
        <input
          name="value"
          type="date"
          defaultValue={vDate}
          ref={(el: HTMLInputElement | null) => {
            inputRef.current = el;
          }}
          className="p-1 border rounded"
          onBlur={() => formRef.current?.requestSubmit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
            if (e.key === "Enter") {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
      )}

      {type === "text" && (
        <input
          name="value"
          type="text"
          defaultValue={vStr}
          ref={(el: HTMLInputElement | null) => {
            inputRef.current = el;
          }}
          className="p-1 border rounded"
          onBlur={() => formRef.current?.requestSubmit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
            if (e.key === "Enter") {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
      )}

      {type === "textarea" && (
        <textarea
          name="value"
          defaultValue={vStr}
          ref={(el: HTMLTextAreaElement | null) => {
            inputRef.current = el;
          }}
          className="w-56 p-1 border rounded"
          rows={4}
          onBlur={() => formRef.current?.requestSubmit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
      )}
      {isPending && <span className="ml-2 text-xs opacity-60">...speichere</span>}
    </form>
  );
}
