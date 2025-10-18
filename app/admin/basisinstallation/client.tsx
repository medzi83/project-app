"use client";

import { useState, useEffect } from "react";
import { testFroxlorConnection, getCustomerDetails } from "./actions";
import CustomerForm from "./CustomerForm";
import JoomlaInstallForm from "./JoomlaInstallForm";

type Client = {
  id: string;
  name: string;
  customerNo: string | null;
};

type Server = {
  id: string;
  name: string;
  ip: string;
  froxlorUrl: string | null;
  froxlorApiKey: string | null;
  froxlorApiSecret: string | null;
};

type Props = {
  clients: Client[];
  servers: Server[];
};

export default function BasisinstallationClient({ clients, servers }: Props) {
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedServer, setSelectedServer] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<{
    testing: boolean;
    result?: { success: boolean; message: string };
  }>({ testing: false });
  const [customerDetails, setCustomerDetails] = useState<{
    customerNo: string;
    documentRoot: string;
    standardDomain: string;
  } | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  useEffect(() => {
    if (selectedServer) {
      setConnectionStatus({ testing: true });
      testFroxlorConnection(selectedServer).then((result) => {
        setConnectionStatus({ testing: false, result });
      });
    } else {
      setConnectionStatus({ testing: false });
    }
  }, [selectedServer]);

  // Load customer details when client with customerNo is selected
  useEffect(() => {
    if (selectedClient && selectedServer) {
      const clientData = clients.find((c) => c.id === selectedClient);
      if (clientData?.customerNo) {
        setLoadingCustomer(true);
        getCustomerDetails(selectedServer, clientData.customerNo).then((result) => {
          if (result.success && result.customer) {
            setCustomerDetails({
              customerNo: result.customer.customerNo,
              documentRoot: result.customer.documentRoot,
              standardDomain: result.standardDomain || "",
            });
          } else {
            setCustomerDetails(null);
          }
          setLoadingCustomer(false);
        });
      } else {
        setCustomerDetails(null);
      }
    } else {
      setCustomerDetails(null);
    }
  }, [selectedClient, selectedServer, clients]);

  const server = servers.find((s) => s.id === selectedServer);
  const client = clients.find((c) => c.id === selectedClient);
  const hasCredentials = server?.froxlorUrl && server?.froxlorApiKey && server?.froxlorApiSecret;
  const canShowCustomerForm = selectedServer && connectionStatus.result?.success;

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Basisinstallation</h1>
        <p className="text-sm text-gray-500">
          Verwalte Froxlor-Projekte, Domains und Joomla-Installationen für Kunden.
        </p>
      </div>

      <section className="space-y-6 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">Projekt-Setup</h2>

        <div className="space-y-4">
          <div>
            <h3 className="mb-3 text-sm font-medium">Kunde wählen</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Aus Liste wählen">
                <select
                  name="clientId"
                  className="w-full rounded border p-2"
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                >
                  <option value="">-- Kunde aus Liste wählen --</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} {client.customerNo ? `(${client.customerNo})` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="flex items-center justify-center text-sm text-gray-400">
                <span>oder</span>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-gray-50 p-4">
              <p className="mb-2 text-sm font-medium text-gray-700">
                Neuen Kunden anlegen (ohne Auswahl aus Liste)
              </p>
              <p className="text-xs text-gray-500">
                Lassen Sie die Dropdown-Auswahl leer, um direkt eine neue Kundennummer anzulegen
              </p>
            </div>
          </div>

          <Field label="Server auswählen">
            <select
              name="serverId"
              className="w-full rounded border p-2"
              value={selectedServer}
              onChange={(e) => setSelectedServer(e.target.value)}
              required
            >
              <option value="">-- Server wählen --</option>
              {servers.map((server) => (
                <option key={server.id} value={server.id}>
                  {server.name} ({server.ip})
                </option>
              ))}
            </select>
          </Field>
        </div>

        {servers.length === 0 && (
          <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
            Bitte legen Sie zunächst Server in der{" "}
            <a href="/admin/server" className="font-medium underline">
              Serververwaltung
            </a>{" "}
            an.
          </div>
        )}

        {clients.length === 0 && (
          <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
            Bitte legen Sie zunächst Kunden an.
          </div>
        )}

        {selectedServer && (
          <div className="rounded-lg border p-4">
            <h3 className="mb-3 font-medium">Froxlor API Status</h3>
            {connectionStatus.testing && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
                Teste Verbindung...
              </div>
            )}
            {!connectionStatus.testing && connectionStatus.result && (
              <div
                className={`rounded p-3 text-sm ${
                  connectionStatus.result.success
                    ? "bg-green-50 text-green-800"
                    : "bg-red-50 text-red-800"
                }`}
              >
                <div className="font-medium">
                  {connectionStatus.result.success ? "✓ Verbindung OK" : "✗ Verbindung fehlgeschlagen"}
                </div>
                <div className="mt-1">{connectionStatus.result.message}</div>
                {!connectionStatus.result.success && !hasCredentials && (
                  <div className="mt-2">
                    <a href="/admin/server" className="font-medium underline">
                      → Zur Serververwaltung
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {canShowCustomerForm && (
          <div className="border-t pt-6">
            <h3 className="mb-4 text-lg font-semibold">Froxlor-Kunde anlegen/aktualisieren</h3>
            <CustomerForm
              key={`${selectedServer}-${selectedClient}`}
              serverId={selectedServer}
              clientName={client?.name ?? ""}
              clientCustomerNo={client?.customerNo ?? ""}
            />
          </div>
        )}

        {loadingCustomer && (
          <div className="border-t pt-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></div>
              Lade Kundendaten...
            </div>
          </div>
        )}

        {!loadingCustomer && customerDetails && (
          <div className="border-t pt-6">
            <JoomlaInstallForm
              serverId={selectedServer}
              customerNo={customerDetails.customerNo}
              customerDocumentRoot={customerDetails.documentRoot}
              standardDomain={customerDetails.standardDomain}
            />
          </div>
        )}

        {!loadingCustomer && selectedClient && selectedServer && !customerDetails && clients.find((c) => c.id === selectedClient)?.customerNo && (
          <div className="border-t pt-6">
            <div className="rounded border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
              Kundendaten konnten nicht geladen werden. Bitte stelle sicher, dass der Kunde in Froxlor existiert.
            </div>
          </div>
        )}
      </section>
    </div>
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

function ActionCard({
  title,
  description,
  disabled = false
}: {
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${disabled ? "opacity-50" : ""}`}>
      <h4 className="font-medium mb-2">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
      {disabled && (
        <span className="mt-3 inline-block text-xs text-gray-400">In Vorbereitung</span>
      )}
    </div>
  );
}
