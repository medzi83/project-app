"use client";

import { useState } from "react";
import { reassignFilmProjectClient } from "@/app/film-projects/actions";

type Client = {
  id: string;
  name: string;
  customerNo: string | null;
};

type Props = {
  projectId: string;
  currentClient: Client;
  allClients: Client[];
};

export default function ClientReassignmentFilm({ projectId, currentClient, allClients }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredClients = allClients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.customerNo && client.customerNo.includes(searchTerm))
  );

  const handleSubmit = async (clientId: string) => {
    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("clientId", clientId);

    try {
      await reassignFilmProjectClient(formData);
      setIsOpen(false);
    } catch (error) {
      console.error("Fehler beim Neuzuordnen:", error);
      alert("Fehler beim Neuzuordnen des Kunden");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <div>
            <div className="text-sm font-medium text-blue-900 dark:text-blue-200">Zugeordneter Kunde</div>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              {currentClient.name}
              {currentClient.customerNo && ` (Kd-Nr: ${currentClient.customerNo})`}
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-600 rounded hover:bg-blue-50 dark:hover:bg-blue-800/30 transition-colors"
        >
          Ändern
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50" onClick={() => setIsOpen(false)}>
          <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kunde neu zuordnen</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Kunde suchen (Name oder Kd-Nr)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                  autoFocus
                />
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => handleSubmit(client.id)}
                    disabled={isSubmitting || client.id === currentClient.id}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      client.id === currentClient.id
                        ? "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 cursor-not-allowed"
                        : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{client.name}</div>
                        {client.customerNo && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">Kd-Nr: {client.customerNo}</div>
                        )}
                      </div>
                      {client.id === currentClient.id && (
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                          Aktuell
                        </span>
                      )}
                    </div>
                  </button>
                ))}

                {filteredClients.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    Keine Kunden gefunden
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
