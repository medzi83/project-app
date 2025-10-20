'use client';

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export type VariableGroup = {
  label: string;
  items: Array<{ placeholder: string; description: string }>;
};

type VariableGroupsPanelProps = {
  groups: VariableGroup[];
};

export default function VariableGroupsPanel({ groups }: VariableGroupsPanelProps) {
  const [openGroupIndex, setOpenGroupIndex] = useState<number | null>(null);

  const toggleGroup = (index: number) => {
    setOpenGroupIndex((prev) => (prev === index ? null : index));
  };

  return (
    <aside className="space-y-4 rounded border border-gray-200 bg-gray-50 p-4 text-sm sticky top-4 self-start max-h-[calc(100vh-2rem)] overflow-y-auto">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Verfügbare Variablen</p>
        <p className="mt-1 text-xs text-gray-500">
          Füge diese Platzhalter in den HTML-Inhalt ein. Die App ersetzt sie später mit den passenden Daten.
        </p>
      </div>

      <div className="space-y-2">
        {groups.map((group, index) => {
          const isOpen = index === openGroupIndex;
          return (
            <div key={group.label} className="overflow-hidden rounded border border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => toggleGroup(index)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-100"
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`grid divide-y divide-gray-200 transition-[grid-template-rows] duration-200 ease-out ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <ul className="space-y-2 px-3 py-3">
                    {group.items.map((item) => (
                      <li key={item.placeholder} className="flex flex-col gap-1">
                        <code className="inline-block rounded border border-gray-300 bg-gray-50 px-2 py-1 font-mono text-[11px] text-gray-800">
                          {item.placeholder}
                        </code>
                        <span className="text-xs text-gray-600">{item.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
