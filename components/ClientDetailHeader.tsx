"use client";

import { useState } from "react";
import Link from "next/link";
import { ClientStatusToggles } from "./ClientStatusToggles";
import { ClientDataDialog } from "./ClientDataDialog";
import { ClientEmailDialog } from "./ClientEmailDialog";

type ClientDetailHeaderProps = {
  client: {
    id: string;
    name: string;
    customerNo: string | null;
    email: string | null;
    contact: string | null;
    agencyId: string | null;
    agency: {
      id: string;
      name: string;
    } | null;
    workStopped: boolean;
    finished: boolean;
  };
  isAdmin: boolean;
};

export function ClientDetailHeader({ client, isAdmin }: ClientDetailHeaderProps) {
  const [showClientDataDialog, setShowClientDataDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  const handleMailButtonClick = () => {
    // Check if client has required data
    const needsClientData = !client.email || !client.agencyId;

    if (needsClientData) {
      // Show client data dialog first
      setShowClientDataDialog(true);
    } else {
      // Show email dialog directly
      setShowEmailDialog(true);
    }
  };

  const handleClientDataComplete = () => {
    setShowClientDataDialog(false);
    // Reload the page to get updated client data
    window.location.reload();
  };

  const handleEmailSuccess = () => {
    setShowEmailDialog(false);
    // Reload to show the sent email in the log
    window.location.reload();
  };

  return (
    <>
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/clients" className="text-blue-600 hover:underline">
              ← Zurück zur Kundenliste
            </Link>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <h1 className="text-2xl font-semibold">{client.name}</h1>
            <button
              onClick={handleMailButtonClick}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
                <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
              </svg>
              Mail an Kunden
            </button>
            {isAdmin && (
              <Link
                href={`/admin/basisinstallation?clientId=${client.id}`}
                className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                </svg>
                Neue Demo anlegen
              </Link>
            )}
          </div>
          {client.customerNo && (
            <p className="text-sm text-gray-500">Kundennummer: {client.customerNo}</p>
          )}
          {client.agency && (
            <p className="text-sm text-gray-500">
              Agentur: {client.agency.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <>
              <ClientStatusToggles
                clientId={client.id}
                initialWorkStopped={client.workStopped}
                initialFinished={client.finished}
              />
              <Link
                href={`/clients/${client.id}/edit`}
                className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
              >
                Bearbeiten
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Client Data Dialog */}
      <ClientDataDialog
        isOpen={showClientDataDialog}
        clientId={client.id}
        clientName={client.name}
        currentEmail={client.email}
        currentContact={client.contact}
        currentAgencyId={client.agencyId}
        missingEmail={!client.email}
        missingContact={!client.contact}
        missingAgency={!client.agencyId}
        onComplete={handleClientDataComplete}
        onCancel={() => setShowClientDataDialog(false)}
      />

      {/* Client Email Dialog */}
      <ClientEmailDialog
        isOpen={showEmailDialog}
        clientId={client.id}
        clientName={client.name}
        clientEmail={client.email}
        clientContact={client.contact}
        onClose={() => setShowEmailDialog(false)}
        onSuccess={handleEmailSuccess}
      />
    </>
  );
}
