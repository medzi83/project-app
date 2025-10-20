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
          <h1 className="text-2xl font-semibold mt-2">{client.name}</h1>
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
          <button
            onClick={handleMailButtonClick}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 transition-colors"
          >
            Mail an Kunden
          </button>
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
