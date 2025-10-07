"use client";
import React from "react";

export default function DangerActionButton({
  action,
  children,
  confirmText,
  className,
  id,
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: React.ReactNode;
  confirmText: string;
  className?: string;
  id?: string;
}) {
  return (
    <form action={action}>
      {id && <input type="hidden" name="id" value={id} />}
      <button
        type="submit"
        onClick={(e) => {
          if (!window.confirm(confirmText)) {
            e.preventDefault();
          }
        }}
        className={
          className ??
          "px-3 py-1.5 rounded border border-red-300 text-red-700 bg-red-50 hover:bg-red-100"
        }
      >
        {children}
      </button>
    </form>
  );
}

