"use client";
import { CSSProperties, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePrintDesignInlineField } from "@/app/print-design/inline-actions";

type Option = { value: string; label: string };

type Props = {
  target: "project" | "printDesign";
  id: string; // projectId
  name: string; // Feldname (whitelisted)
  type: "text" | "date" | "datetime" | "select" | "tri" | "textarea";
  display: string; // Anzeige im Read-Mode
  value?: string | number | boolean | Date | null; // Startwert fuer Edit
  options?: Option[]; // fuer select/tri
  canEdit: boolean;
  displayClassName?: string;
  displayStyle?: CSSProperties;
};

export default function PrintDesignInlineCell({
  target,
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
  const inputRef = useRef<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null
  >(null);
  const initialValueRef = useRef<string>("");

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (
        inputRef.current instanceof HTMLInputElement ||
        inputRef.current instanceof HTMLTextAreaElement
      ) {
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

  const enterEdit = () => {
    // Store initial value when entering edit mode
    const vStr = vToString(value, type);
    initialValueRef.current = vStr;
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  function submitForm(fd: FormData) {
    // Check if value actually changed
    const newValue = fd.get("value") as string;
    const valueChanged = newValue !== initialValueRef.current;

    if (!valueChanged) {
      // No changes, just exit edit mode without submitting
      setEditing(false);
      return;
    }

    startTransition(async () => {
      const result = await updatePrintDesignInlineField(fd);
      setEditing(false);

      // If email was triggered, dispatch event with queueIds
      if (result?.emailTriggered && result?.queueIds) {
        const event = new CustomEvent("emailConfirmationNeeded", {
          detail: { queueIds: result.queueIds },
        });
        window.dispatchEvent(event);
        // Don't refresh immediately, let the email dialog handle it
        return;
      }

      // No email triggered, safe to refresh immediately
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
          ref={(el: HTMLSelectElement | null) => {
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
        >
          {options?.map((o, index) => (
            <option
              key={o.value ? `${o.value}-${index}` : `none-${index}`}
              value={o.value}
            >
              {o.label}
            </option>
          ))}
        </select>
      )}

      {type === "tri" && (
        <select
          name="value"
          defaultValue={vStr}
          ref={(el: HTMLSelectElement | null) => {
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
        >
          {(
            options ?? [
              { value: "unknown", label: "(nicht gesetzt)" },
              { value: "yes", label: "Ja" },
              { value: "no", label: "Nein" },
            ]
          ).map((o, index) => (
            <option
              key={o.value ? `${o.value}-${index}` : `none-${index}`}
              value={o.value}
            >
              {o.label}
            </option>
          ))}
        </select>
      )}

      {type === "date" && (
        <input
          name="value"
          type="date"
          defaultValue={vStr}
          ref={(el: HTMLInputElement | null) => {
            inputRef.current = el;
          }}
          className="p-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
          onChange={() => {
            // Submit immediately when date is selected from calendar
            formRef.current?.requestSubmit();
          }}
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

      {type === "datetime" && (
        <input
          name="value"
          type="datetime-local"
          defaultValue={vStr}
          ref={(el: HTMLInputElement | null) => {
            inputRef.current = el;
          }}
          className="p-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
          onChange={() => {
            // Submit immediately when datetime is selected
            formRef.current?.requestSubmit();
          }}
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
      {isPending && (
        <span className="ml-2 text-xs opacity-60">...speichere</span>
      )}
    </form>
  );
}

function vToString(v: Props["value"], type: Props["type"]) {
  if (v === null || v === undefined) return "";
  if (type === "date") {
    // Naive parsing - just extract date without timezone conversion
    const str = String(v);
    if (typeof str === "string" && str.includes("T")) {
      return str.slice(0, 10); // Extract "2025-10-24" from "2025-10-24T00:00:00.000Z"
    }
    return str;
  }
  if (type === "datetime") {
    // Naive parsing - just extract datetime without timezone conversion
    const str = String(v);
    if (typeof str === "string" && str.includes("T")) {
      return str.slice(0, 16); // Extract "2025-10-24T14:30" from "2025-10-24T14:30:00.000Z"
    }
    return str;
  }
  if (type === "tri")
    return v === true ? "yes" : v === false ? "no" : "unknown";
  return String(v);
}
