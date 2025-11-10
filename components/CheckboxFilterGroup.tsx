"use client";

import { useEffect, useRef, useState } from "react";

type CheckboxOption = {
  value: string;
  label: string;
};

type Props = {
  name: string;
  label: string;
  options: CheckboxOption[];
  selected: string[];
  width?: string;
  columns?: 1 | 2;
};

export default function CheckboxFilterGroup({
  name,
  label,
  options,
  selected,
  width = "w-44",
  columns = 2,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!detailsRef.current) return;

    const handleToggle = () => {
      setIsOpen(detailsRef.current?.open ?? false);
    };

    detailsRef.current.addEventListener("toggle", handleToggle);

    return () => {
      detailsRef.current?.removeEventListener("toggle", handleToggle);
    };
  }, []);

  const handleSelectAll = () => {
    const checkboxes = detailsRef.current?.querySelectorAll<HTMLInputElement>(
      `input[name="${name}"]`
    );
    checkboxes?.forEach((cb) => {
      cb.checked = true;
    });
  };

  const handleClearAll = () => {
    const checkboxes = detailsRef.current?.querySelectorAll<HTMLInputElement>(
      `input[name="${name}"]`
    );
    checkboxes?.forEach((cb) => {
      cb.checked = false;
    });
  };

  return (
    <details ref={detailsRef} className={`relative ${width} shrink-0`}>
      <summary className="flex items-center justify-between px-2 py-1 text-xs border rounded bg-background text-foreground cursor-pointer select-none shadow-sm hover:bg-muted transition-colors [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {selected.length ? `${selected.length} ausgewählt` : "Alle"}
        </span>
      </summary>
      <div className="absolute left-0 z-10 mt-1 w-64 rounded border bg-popover text-popover-foreground shadow-lg max-h-72 overflow-auto">
        {/* Action Buttons */}
        <div className="sticky top-0 bg-muted/50 border-b px-2 py-1.5 flex gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors font-medium"
          >
            Alle
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors font-medium"
          >
            Löschen
          </button>
        </div>

        {/* Checkboxes */}
        <div className="p-2">
          <div className={`grid ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-1 text-xs`}>
            {options.map((option) => (
              <label key={option.value} className="inline-flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                <input
                  type="checkbox"
                  name={name}
                  value={option.value}
                  defaultChecked={selected.includes(option.value)}
                  className="cursor-pointer"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </details>
  );
}
