"use client";

import { useState } from "react";
import { updateSalesAgentName, updateSalesAgentEmail } from "./actions";

type SalesAgent = {
  id: string;
  name: string | null;
  email: string | null;
};

export default function SalesAgentEditModal({ agent }: { agent: SalesAgent }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
        title="Bearbeiten"
      >
        ✏️
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Vertriebsagent bearbeiten</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="space-y-4">
              <form action={updateSalesAgentName} className="space-y-3">
                <input type="hidden" name="userId" value={agent.id} />
                <Field label="Name">
                  <input
                    name="name"
                    defaultValue={agent.name ?? ""}
                    className="w-full rounded border p-2"
                    placeholder="Name"
                  />
                </Field>
                <button className="w-full rounded bg-black px-4 py-2 text-white text-sm">Name speichern</button>
              </form>

              <form action={updateSalesAgentEmail} className="space-y-3">
                <input type="hidden" name="userId" value={agent.id} />
                <Field label="E-Mail">
                  <input
                    name="email"
                    type="email"
                    defaultValue={agent.email ?? ""}
                    className="w-full rounded border p-2"
                    placeholder="email@example.com"
                  />
                </Field>
                <button className="w-full rounded bg-black px-4 py-2 text-white text-sm">E-Mail speichern</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
