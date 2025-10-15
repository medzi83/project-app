'use client';

import { useEffect, useRef, useState, type ReactNode } from "react";

type RichHtmlEditorProps = {
  value: string;
  onChange: (next: string) => void;
  name: string;
  placeholder?: string;
  htmlRows?: number;
};

type EditorMode = "rich" | "html";

export default function RichHtmlEditor({
  value,
  onChange,
  name,
  placeholder = "",
  htmlRows = 12,
}: RichHtmlEditorProps) {
  const [mode, setMode] = useState<EditorMode>("rich");
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === "rich" && editorRef.current && editorRef.current.innerHTML !== value) {
      // If empty, start with a clean paragraph to prevent auto-formatting
      if (!value || value.trim() === "") {
        editorRef.current.innerHTML = "<p><br></p>";
      } else {
        editorRef.current.innerHTML = value;
      }
    }
  }, [mode, value]);

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const handleRichInput = () => {
    const html = editorRef.current?.innerHTML ?? "";
    // Clean up if only contains empty paragraph
    if (html === "<p><br></p>") {
      onChange("");
    } else {
      onChange(html);
    }
  };

  const handleFocus = () => {
    // Ensure no formatting is active when focusing empty editor
    if (typeof window !== "undefined" && editorRef.current) {
      const isEmpty = !editorRef.current.textContent?.trim();
      if (isEmpty) {
        // Remove any active formatting
        document.execCommand("removeFormat", false);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();

    // Get plain text from clipboard
    const text = e.clipboardData.getData("text/plain");

    // Insert as plain text
    if (typeof window !== "undefined") {
      document.execCommand("insertText", false, text);
      onChange(editorRef.current?.innerHTML ?? "");
    }
  };

  const applyCommand = (command: string) => {
    if (mode !== "rich" || !editorRef.current) return;
    focusEditor();
    if (typeof window !== "undefined") {
      document.execCommand(command, false);
      onChange(editorRef.current.innerHTML ?? "");
    }
  };

  const clearFormatting = () => {
    if (mode !== "rich" || !editorRef.current) return;
    focusEditor();
    if (typeof window !== "undefined") {
      document.execCommand("removeFormat", false);
      document.execCommand("unlink", false);
      onChange(editorRef.current.innerHTML ?? "");
    }
  };

  const switchMode = (nextMode: EditorMode) => {
    setMode(nextMode);
    if (nextMode === "rich" && typeof window !== "undefined") {
      requestAnimationFrame(() => focusEditor());
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <ToolbarButton onClick={() => applyCommand("bold")} title="Fett" ariaLabel="Fett">
            <span className="font-semibold">B</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => applyCommand("italic")} title="Kursiv" ariaLabel="Kursiv">
            <span className="italic">I</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => applyCommand("underline")} title="Unterstrichen" ariaLabel="Unterstrichen">
            <span className="underline">U</span>
          </ToolbarButton>
          <ToolbarButton onClick={() => applyCommand("insertUnorderedList")} title="Aufzaehlung" ariaLabel="Aufzaehlung">
            {"\u2022"}
          </ToolbarButton>
          <ToolbarButton onClick={() => applyCommand("insertOrderedList")} title="Nummerierung" ariaLabel="Nummerierung">
            1.
          </ToolbarButton>
          <ToolbarButton onClick={clearFormatting} title="Formatierung entfernen" ariaLabel="Formatierung entfernen">
            Tx
          </ToolbarButton>
        </div>
        <div className="flex items-center gap-1">
          <ModeButton active={mode === "rich"} onClick={() => switchMode("rich")}>
            Editor
          </ModeButton>
          <ModeButton active={mode === "html"} onClick={() => switchMode("html")}>
            HTML
          </ModeButton>
        </div>
      </div>

      {mode === "rich" ? (
        <div className="relative">
          <div
            ref={editorRef}
            className="min-h-[220px] w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            contentEditable
            aria-label="Rich-Text-Editor"
            suppressContentEditableWarning
            onInput={handleRichInput}
            onPaste={handlePaste}
            onFocus={handleFocus}
          />
          {value.trim().length === 0 && (
            <span className="pointer-events-none absolute left-3 top-2 text-sm text-gray-400">
              {placeholder || "Text hier eingeben und bei Bedarf formatieren."}
            </span>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={htmlRows}
          className="h-[220px] w-full rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          placeholder={placeholder || "<p>HTML-Inhalt</p>"}
          aria-label="HTML-Editor"
        />
      )}

      <input type="hidden" name={name} value={value} readOnly />
    </div>
  );
}

function ToolbarButton({
  onClick,
  title,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-100"
    >
      {children}
    </button>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded px-3 py-1 text-xs font-semibold transition",
        active ? "bg-black text-white" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
