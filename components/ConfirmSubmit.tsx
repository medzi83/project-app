"use client";
import React from "react";

export default function ConfirmSubmit({
  confirmText,
  className,
  children,
  title,
}: {
  confirmText: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(confirmText)) {
          e.preventDefault();
        }
      }}
      className={className ?? "px-3 py-1.5 rounded border"}
      title={title}
    >
      {children}
    </button>
  );
}

