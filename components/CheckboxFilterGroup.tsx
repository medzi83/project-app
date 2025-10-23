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
      <summary className="flex items-center justify-between px-2 py-1 text-xs border rounded bg-white cursor-pointer select-none shadow-sm [&::-webkit-details-marker]:hidden">
        <span>{label}</span>
        <span className="opacity-70">
          {selected.length ? `${selected.length} ausgewählt` : "Alle"}
        </span>
      </summary>
      <div className="absolute left-0 z-10 mt-1 w-64 rounded border bg-white shadow-lg max-h-72 overflow-auto">
        {/* Action Buttons */}
        <div className="sticky top-0 bg-gray-50 border-b px-2 py-1.5 flex gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
          >
            Alle
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            Löschen
          </button>
        </div>

        {/* Checkboxes */}
        <div className="p-2">
          <div className={`grid ${columns === 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-1 text-xs`}>
            {options.map((option) => (
              <label key={option.value} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  name={name}
                  value={option.value}
                  defaultChecked={selected.includes(option.value)}
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
