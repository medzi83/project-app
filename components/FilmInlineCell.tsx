"use client";
import { CSSProperties, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateFilmInlineField } from "@/app/film-projects/inline-actions";

type Option = { value: string; label: string };

type ExtraFieldConfig = {
  name: string;
  label?: string;
  placeholder?: string;
  type?: "text" | "url";
  value?: string | null;
  required?: boolean;
};

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
  secondaryDisplay?: string;
  secondaryHref?: string;
  extraField?: ExtraFieldConfig;
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
  secondaryDisplay,
  secondaryHref,
  extraField,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>(null);
  const extraInputId = useId();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select?.();
      }
    }
  }, [editing]);

  const fallbackDisplay = display && display.trim() !== "" ? display : "";
  const fallbackSecondary = secondaryDisplay && secondaryDisplay.trim() !== "" ? secondaryDisplay : "";
  const fallbackSecondaryHref = secondaryHref && secondaryHref.trim() !== "" ? secondaryHref : fallbackSecondary;

  const renderSecondary = () => {
    if (!fallbackSecondary) return null;
    if (extraField?.type === "url") {
      if (!fallbackSecondaryHref) return null;
      const href = /^https?:\/\//i.test(fallbackSecondaryHref) ? fallbackSecondaryHref : `https://${fallbackSecondaryHref}`;
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 underline decoration-dotted decoration-1 text-xs"
          onClick={(e) => e.stopPropagation()}
          title="Zum Link"
        >
          {fallbackSecondary}
        </a>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-600 underline decoration-dotted decoration-1">
        {fallbackSecondary}
      </span>
    );
  };

  if (!canEdit) {
    return (
      <span className={displayClassName} style={displayStyle}>
        <span>{fallbackDisplay}</span>
        {renderSecondary() && (
          <span className="ml-1 inline-flex items-center align-middle">{renderSecondary()}</span>
        )}
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
        <span>{fallbackDisplay}</span>
        {renderSecondary() && (
          <span className="ml-1 inline-flex items-center align-middle">{renderSecondary()}</span>
        )}
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
  const extraDefaultValue = extraField?.value ?? "";
  const shouldAutoSubmit = !extraField;

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
          onBlur={() => {
            if (shouldAutoSubmit) formRef.current?.requestSubmit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
            if (e.key === "Enter" && shouldAutoSubmit) {
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
          onBlur={() => {
            if (shouldAutoSubmit) formRef.current?.requestSubmit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
            if (e.key === "Enter" && shouldAutoSubmit) {
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
          onBlur={() => {
            if (shouldAutoSubmit) formRef.current?.requestSubmit();
          }}
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

      {extraField && (
        <div className="mt-2 flex flex-col gap-1">
          {extraField.label && (
            <label htmlFor={extraInputId} className="text-xs uppercase tracking-wide text-gray-500">
              {extraField.label}
            </label>
          )}
          <input
            id={extraInputId}
            name={extraField.name}
            type={extraField.type ?? "text"}
            defaultValue={extraDefaultValue}
            placeholder={extraField.placeholder}
            required={extraField.required}
            className="p-1 border rounded"
          />
        </div>
      )}

      {extraField && (
        <div className="mt-2 flex gap-2 text-xs">
          <button
            type="submit"
            className="rounded bg-black px-2 py-1 text-white hover:bg-gray-800"
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={cancel}
            className="rounded border px-2 py-1 hover:bg-gray-50"
          >
            Abbrechen
          </button>
        </div>
      )}
      {isPending && <span className="ml-2 text-xs opacity-60">...speichere</span>}
    </form>
  );
}
