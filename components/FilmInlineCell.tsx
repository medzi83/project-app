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
  type: "text" | "date" | "datetime" | "select" | "textarea";
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
  const [error, setError] = useState<string | null>(null);
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
          className="inline-flex items-center justify-center w-5 h-5 rounded hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
          title="Zum Film"
        >
          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
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

  const enterEdit = () => {
    setEditing(true);
    setError(null);
  };
  const cancel = () => {
    setEditing(false);
    setError(null);
  };

  function submitForm(fd: FormData) {
    startTransition(async () => {
      setError(null);
      const result = await updateFilmInlineField(fd);
      if (result.success) {
        setEditing(false);
        router.refresh();
      } else {
        setError(result.error || "Ein Fehler ist aufgetreten");
      }
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
      "inline-flex w-full items-start justify-start gap-2 rounded px-2 py-1 text-left cursor-pointer bg-transparent min-h-[2rem]";
    const interactiveClass =
      "transition-all duration-150 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:focus-visible:outline-blue-400";
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
  const vDate = type === "date" && vStr ? vStr.slice(0, 10) : vStr;
  const vDateTime = type === "datetime" && vStr ? (() => {
    // Naive parsing - just extract the date/time components WITHOUT any timezone conversion
    // Input: "2025-10-24T14:30:00.000Z" or ISO string
    // Output: "2025-10-24T14:30"
    // Don't use new Date() at all - it converts timezones!
    if (typeof vStr === 'string' && vStr.includes('T')) {
      return vStr.slice(0, 16); // Extract "2025-10-24T14:30" directly from string
    }
    return vStr;
  })() : vStr;
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
          className="p-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
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
          className="p-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
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

      {type === "datetime" && (
        <input
          name="value"
          type="datetime-local"
          defaultValue={vDateTime}
          ref={(el: HTMLInputElement | null) => {
            inputRef.current = el;
          }}
          className="p-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
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
          className="p-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
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
          className="w-56 p-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
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
            <label htmlFor={extraInputId} className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
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
            className="p-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
          />
        </div>
      )}

      {extraField && (
        <div className="mt-2 flex gap-2 text-xs">
          <button
            type="submit"
            className="rounded bg-black dark:bg-blue-600 px-2 py-1 text-white hover:bg-gray-800 dark:hover:bg-blue-700"
          >
            Speichern
          </button>
          <button
            type="button"
            onClick={cancel}
            className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Abbrechen
          </button>
        </div>
      )}
      {isPending && <span className="ml-2 text-xs opacity-60">...speichere</span>}
      {error && (
        <div className="mt-2 rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}
    </form>
  );
}
