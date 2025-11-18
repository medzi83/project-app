"use client";

import { useState } from "react";
import { updateAgentName, updateAgentFullName, updateAgentRoleTitle, updateAgentCategories } from "./actions";

type Agent = {
  id: string;
  name: string | null;
  fullName: string | null;
  roleTitle: string | null;
  email: string | null;
  categories: string[];
};

type Props = {
  agent: Agent;
};

export default function AgentEditModal({ agent }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded border px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600"
        title="Agent bearbeiten"
      >
        ✏️
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Agent bearbeiten</h2>
              <button onClick={() => setOpen(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name (Kurzname)</label>
                <form action={async (formData) => { await updateAgentName(formData); setOpen(false); }} className="flex gap-2">
                  <input type="hidden" name="userId" value={agent.id} />
                  <input
                    name="name"
                    defaultValue={agent.name ?? ""}
                    className="flex-1 rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                    placeholder="z.B. Anna"
                  />
                  <button type="submit" className="rounded bg-black dark:bg-blue-600 text-white px-4 py-2 hover:bg-gray-800 dark:hover:bg-blue-700">Speichern</button>
                </form>
              </div>

              {/* Voller Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Voller Name</label>
                <form action={async (formData) => { await updateAgentFullName(formData); setOpen(false); }} className="flex gap-2">
                  <input type="hidden" name="userId" value={agent.id} />
                  <input
                    name="fullName"
                    defaultValue={agent.fullName ?? ""}
                    className="flex-1 rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                    placeholder="z.B. Anna Agent"
                  />
                  <button type="submit" className="rounded bg-black dark:bg-blue-600 text-white px-4 py-2 hover:bg-gray-800 dark:hover:bg-blue-700">Speichern</button>
                </form>
              </div>

              {/* Rollenbezeichnung */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Rollenbezeichnung</label>
                <form action={async (formData) => { await updateAgentRoleTitle(formData); setOpen(false); }} className="flex gap-2">
                  <input type="hidden" name="userId" value={agent.id} />
                  <input
                    name="roleTitle"
                    defaultValue={agent.roleTitle ?? ""}
                    className="flex-1 rounded border p-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                    placeholder="z.B. Projektmanagerin"
                  />
                  <button type="submit" className="rounded bg-black dark:bg-blue-600 text-white px-4 py-2 hover:bg-gray-800 dark:hover:bg-blue-700">Speichern</button>
                </form>
              </div>

              {/* Kategorien */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Kategorien</label>
                <form action={async (formData) => { await updateAgentCategories(formData); setOpen(false); }} className="space-y-3">
                  <input type="hidden" name="userId" value={agent.id} />
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-gray-900 dark:text-gray-100 cursor-pointer">
                      <input type="checkbox" name="categories" value="WEBSEITE" defaultChecked={agent.categories.includes("WEBSEITE")} className="rounded border-gray-300 dark:border-gray-600" />
                      <span>Webseite</span>
                    </label>
                    <label className="flex items-center gap-2 text-gray-900 dark:text-gray-100 cursor-pointer">
                      <input type="checkbox" name="categories" value="FILM" defaultChecked={agent.categories.includes("FILM")} className="rounded border-gray-300 dark:border-gray-600" />
                      <span>Film</span>
                    </label>
                    <label className="flex items-center gap-2 text-gray-900 dark:text-gray-100 cursor-pointer">
                      <input type="checkbox" name="categories" value="PRINT_DESIGN" defaultChecked={agent.categories.includes("PRINT_DESIGN")} className="rounded border-gray-300 dark:border-gray-600" />
                      <span>Print & Design</span>
                    </label>
                    <label className="flex items-center gap-2 text-gray-900 dark:text-gray-100 cursor-pointer">
                      <input type="checkbox" name="categories" value="SOCIALMEDIA" defaultChecked={agent.categories.includes("SOCIALMEDIA")} className="rounded border-gray-300 dark:border-gray-600" />
                      <span>Social Media</span>
                    </label>
                  </div>
                  <button type="submit" className="rounded bg-black dark:bg-blue-600 text-white px-4 py-2 hover:bg-gray-800 dark:hover:bg-blue-700">Kategorien speichern</button>
                </form>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t dark:border-gray-600 flex justify-end">
              <button onClick={() => setOpen(false)} className="rounded border border-gray-300 dark:border-gray-600 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100">Schließen</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
