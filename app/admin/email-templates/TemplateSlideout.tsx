'use client';

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

type TemplateSlideoutProps = {
  title: string;
  subtitle?: string;
  meta?: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export default function TemplateSlideout({
  title,
  subtitle,
  meta,
  children,
  defaultOpen = false,
}: TemplateSlideoutProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
      >
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
          {subtitle && <p className="truncate text-xs text-gray-600">{subtitle}</p>}
          {meta && <p className="text-[11px] uppercase tracking-wide text-gray-400">{meta}</p>}
        </div>
        <ChevronDown
          className={`h-5 w-5 flex-shrink-0 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid border-t border-gray-200 transition-[grid-template-rows] duration-200 ease-out ${
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
