"use client";

import { useState, useEffect } from "react";
import { testFroxlorConnection, getCustomerDetails } from "./actions";
import CustomerForm from "./CustomerForm";
import JoomlaInstallForm from "./JoomlaInstallForm";

type Client = {
  id: string;
  name: string;
  customerNo: string | null;
  projects: {
    id: string;
    title: string;
    status: string;
  }[];
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

type Step = 1 | 2 | 3;

export default function BasisinstallationClient({ clients, servers }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedServer, setSelectedServer] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(false); // Track wenn User neuen Kunden anlegen will
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
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [checkingServers, setCheckingServers] = useState(false);
  const [showAllServers, setShowAllServers] = useState(false);
  const [serverAvailability, setServerAvailability] = useState<{
    [serverId: string]: {
      exists: boolean;
      checking: boolean;
      customerNo?: string;
      error?: string;
    };
  }>({});

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.client-search-container')) {
        setShowClientDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check all servers when a client is selected OR when creating new customer
  useEffect(() => {
    if (selectedClient || isNewCustomer) {
      const clientData = clients.find((c) => c.id === selectedClient);
      setShowAllServers(false); // Reset when client changes

      if (clientData?.customerNo) {
        // Existing customer WITH customerNo - check if customer exists on servers
        setCheckingServers(true);
        setServerAvailability({});

        // Check each server in parallel
        const checkPromises = servers.map(async (server) => {
          setServerAvailability((prev) => ({
            ...prev,
            [server.id]: { checking: true, exists: false },
          }));

          try {
            const result = await getCustomerDetails(server.id, clientData.customerNo!);

            setServerAvailability((prev) => ({
              ...prev,
              [server.id]: {
                checking: false,
                exists: result.success && result.customer !== null,
                customerNo: result.customer?.customerNo,
              },
            }));
          } catch (error) {
            setServerAvailability((prev) => ({
              ...prev,
              [server.id]: {
                checking: false,
                exists: false,
                error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen',
              },
            }));
          }
        });

        Promise.all(checkPromises).then(() => {
          setCheckingServers(false);
        });
      } else {
        // New customer OR customer without customerNo - just check server connections
        setCheckingServers(true);
        const checkPromises = servers.map(async (server) => {
          setServerAvailability((prev) => ({
            ...prev,
            [server.id]: { checking: true, exists: false },
          }));

          const result = await testFroxlorConnection(server.id);

          setServerAvailability((prev) => ({
            ...prev,
            [server.id]: {
              checking: false,
              exists: false,
              error: result.success ? undefined : result.message,
            },
          }));
        });

        Promise.all(checkPromises).then(() => {
          setCheckingServers(false);
        });
      }
    } else {
      setServerAvailability({});
      setCheckingServers(false);
    }
  }, [selectedClient, isNewCustomer, clients, servers]);

  // Test selected server connection
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

  // Load customer details when server is selected
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

  // Filter clients based on search term
  const filteredClients = clients.filter((client) => {
    const searchLower = clientSearchTerm.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchLower) ||
      (client.customerNo && client.customerNo.toLowerCase().includes(searchLower))
    );
  });

  // Check if customer exists on any server
  const serversWithCustomer = servers.filter((server) => {
    const availability = serverAvailability[server.id];
    return availability?.exists === true;
  });

  // Only show servers where customer exists, or all servers if customer doesn't exist anywhere OR user wants to see all
  const serversToShow = (serversWithCustomer.length > 0 && !showAllServers) ? serversWithCustomer : servers;

  // Step completion checks
  const step1Complete = (selectedClient || isNewCustomer) && selectedServer && connectionStatus.result?.success;
  const step2Complete = step1Complete && (customerDetails !== null || ((selectedClient && !client?.customerNo) || isNewCustomer) && currentStep >= 2);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Basisinstallation</h1>
          <p className="mt-2 text-gray-600">
            Erstelle einen Froxlor-Kunden und installiere Joomla in 3 einfachen Schritten
          </p>
        </div>

        {/* Step Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <StepIndicator
              number={1}
              title="Server & Kunde"
              active={currentStep === 1}
              completed={!!step1Complete}
              onClick={() => setCurrentStep(1)}
            />
            <div className={`h-1 flex-1 mx-2 ${step1Complete ? 'bg-blue-600' : 'bg-gray-300'}`} />

            <StepIndicator
              number={2}
              title="Froxlor-Kunde"
              active={currentStep === 2}
              completed={!!step2Complete}
              onClick={() => step1Complete && setCurrentStep(2)}
              disabled={!step1Complete}
            />
            <div className={`h-1 flex-1 mx-2 ${step2Complete ? 'bg-blue-600' : 'bg-gray-300'}`} />

            <StepIndicator
              number={3}
              title="Joomla Installation"
              active={currentStep === 3}
              completed={false}
              onClick={() => step2Complete && setCurrentStep(3)}
              disabled={!step2Complete}
            />
          </div>
        </div>

        {/* Error Messages */}
        {servers.length === 0 && (
          <div className="mb-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-medium text-yellow-800">Keine Server konfiguriert</p>
                <p className="mt-1 text-sm text-yellow-700">
                  Bitte legen Sie zunächst Server in der{" "}
                  <a href="/admin/server" className="font-medium underline">
                    Serververwaltung
                  </a>{" "}
                  an.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="rounded-lg bg-white shadow-sm border">
          {currentStep === 1 && (
            <StepContent title="Schritt 1: Kunde auswählen & Server prüfen">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kunde suchen oder neuen anlegen
                  </label>

                  <div className="relative client-search-container">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Nach Name oder Kundennummer suchen..."
                        className="w-full rounded-lg border border-gray-300 p-3 pr-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                        value={clientSearchTerm}
                        onChange={(e) => {
                          setClientSearchTerm(e.target.value);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                      />
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>

                    {showClientDropdown && clientSearchTerm && (
                      <div className="absolute z-10 mt-2 w-full rounded-lg border border-gray-300 bg-white shadow-lg max-h-64 overflow-y-auto">
                        {filteredClients.length > 0 ? (
                          <>
                            {filteredClients.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 transition border-b border-gray-100 last:border-b-0"
                                onClick={() => {
                                  setSelectedClient(client.id);
                                  setIsNewCustomer(false); // Deaktiviere "Neuer Kunde"-Modus
                                  setClientSearchTerm(
                                    `${client.name}${client.customerNo ? ` (${client.customerNo})` : ""}`
                                  );
                                  setShowClientDropdown(false);
                                }}
                              >
                                <div className="font-medium text-gray-900">{client.name}</div>
                                {client.customerNo && (
                                  <div className="text-sm text-gray-500">Kundennummer: {client.customerNo}</div>
                                )}
                              </button>
                            ))}
                          </>
                        ) : (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            Keine Kunden gefunden
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedClient && client && (
                    <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-blue-900">{client.name}</p>
                          {client.customerNo && (
                            <p className="text-sm text-blue-700">Kundennummer: {client.customerNo}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClient("");
                            setClientSearchTerm("");
                          }}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Auswahl aufheben"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-start gap-2 text-sm text-gray-500">
                    <svg className="h-5 w-5 text-gray-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>
                      Wählen Sie einen bestehenden Kunden oder klicken Sie auf "Neuen Kunden anlegen"
                    </p>
                  </div>

                  {/* Button für neuen Kunden */}
                  {!selectedClient && !isNewCustomer && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewCustomer(true);
                          setClientSearchTerm("");
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-50 border-2 border-green-200 text-green-700 rounded-lg font-medium hover:bg-green-100 hover:border-green-300 transition"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Neuen Kunden in Projektverwaltung anlegen
                      </button>
                    </div>
                  )}

                  {/* Anzeige wenn neuer Kunde-Modus aktiv */}
                  {isNewCustomer && !selectedClient && (
                    <div className="mt-3 rounded-lg bg-green-50 border border-green-200 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <p className="font-medium text-green-900">Neuen Kunden anlegen</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsNewCustomer(false);
                            setSelectedServer("");
                          }}
                          className="text-green-600 hover:text-green-800 p-1"
                          title="Abbrechen"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-sm text-green-700 mt-1">
                        Sie können jetzt einen Server auswählen und in Schritt 2 die Kundendaten eingeben.
                      </p>
                    </div>
                  )}
                </div>

                {/* Server Availability Check */}
                {(selectedClient || isNewCustomer) && (
                  <div className="border-t pt-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-4">
                      {serversWithCustomer.length > 0
                        ? `Kunde gefunden auf ${serversWithCustomer.length} Server${serversWithCustomer.length > 1 ? 'n' : ''}`
                        : client?.customerNo
                        ? `Kunde nicht auf Servern gefunden - Server zur Installation wählen`
                        : 'Server-Verfügbarkeit (neuer Kunde)'}
                    </h3>

                    {checkingServers ? (
                      <div className="flex items-center gap-3 text-gray-600 py-4">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                        <span>Prüfe Server...</span>
                      </div>
                    ) : (
                      <>
                        {serversWithCustomer.length > 0 && !showAllServers && (
                          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3">
                            <div className="flex items-start gap-2">
                              <svg className="h-5 w-5 text-green-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="flex-1">
                                <p className="text-sm text-green-700">
                                  Kunde bereits vorhanden - Sie können diesen Server für die weitere Konfiguration verwenden
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowAllServers(true)}
                                className="text-sm text-green-800 hover:text-green-900 font-medium underline whitespace-nowrap"
                              >
                                Anderen Server wählen
                              </button>
                            </div>
                          </div>
                        )}

                        {serversWithCustomer.length > 0 && showAllServers && (
                          <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                            <div className="flex items-start gap-2">
                              <svg className="h-5 w-5 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="flex-1">
                                <p className="text-sm text-blue-700">
                                  Alle Server werden angezeigt - Der Kunde existiert bereits auf markierten Servern
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowAllServers(false)}
                                className="text-sm text-blue-800 hover:text-blue-900 font-medium underline whitespace-nowrap"
                              >
                                Nur vorhandene
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          {serversToShow.map((server) => {
                          const availability = serverAvailability[server.id];
                          const exists = availability?.exists;
                          const checking = availability?.checking;
                          const error = availability?.error;

                          return (
                            <button
                              key={server.id}
                              type="button"
                              onClick={() => {
                                if (!error) {
                                  setSelectedServer(server.id);
                                }
                              }}
                              disabled={!!error}
                              className={`w-full text-left rounded-lg border-2 p-4 transition ${
                                selectedServer === server.id
                                  ? 'border-blue-600 bg-blue-50'
                                  : error
                                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">{server.name}</p>
                                    {selectedServer === server.id && (
                                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                                        Ausgewählt
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-500 mt-0.5">{server.ip}</p>

                                  {checking && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                                      Prüfe...
                                    </div>
                                  )}

                                  {!checking && exists && (
                                    <div className="flex items-center gap-2 text-sm text-green-700 mt-2">
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Kunde bereits vorhanden
                                    </div>
                                  )}

                                  {!checking && !exists && !error && (
                                    <div className="flex items-center gap-2 text-sm text-blue-700 mt-2">
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                      Kunde nicht vorhanden - kann angelegt werden
                                    </div>
                                  )}

                                  {!checking && error && (
                                    <div className="flex items-center gap-2 text-sm text-red-700 mt-2">
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      {error}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        </div>
                      </>
                    )}

                    {selectedServer && connectionStatus.result?.success && (
                      <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-4">
                        <div className="flex items-start gap-3">
                          <svg className="h-5 w-5 text-green-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="font-medium text-green-900">Server bereit</p>
                            <p className="text-sm text-green-700 mt-1">
                              {servers.find(s => s.id === selectedServer)?.name} ist einsatzbereit
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step1Complete && (
                  <div className="flex justify-end pt-6 border-t">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
                    >
                      Weiter zu Schritt 2
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </StepContent>
          )}

          {currentStep === 2 && step1Complete && (
            <StepContent title="Schritt 2: Froxlor-Kunde konfigurieren">
              <CustomerForm
                key={`${selectedServer}-${selectedClient}`}
                serverId={selectedServer}
                clientName={client?.name ?? ""}
                clientCustomerNo={client?.customerNo ?? ""}
              />
              <div className="mt-6 flex justify-between border-t pt-4">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition flex items-center gap-2"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                  </svg>
                  Zurück
                </button>
                {(customerDetails || selectedClient === "") && (
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
                  >
                    Weiter zu Schritt 3
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                )}
              </div>
            </StepContent>
          )}

          {currentStep === 3 && step2Complete && (
            <StepContent title="Schritt 3: Joomla installieren">
              {loadingCustomer && (
                <div className="flex items-center gap-3 text-gray-600 py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                  <span>Lade Kundendaten...</span>
                </div>
              )}

              {!loadingCustomer && customerDetails && (
                <JoomlaInstallForm
                  serverId={selectedServer}
                  customerNo={customerDetails.customerNo}
                  customerDocumentRoot={customerDetails.documentRoot}
                  standardDomain={customerDetails.standardDomain}
                  clientId={selectedClient}
                  clientProjects={client?.projects || []}
                />
              )}

              {!loadingCustomer && !customerDetails && selectedClient && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <div className="flex items-start gap-3">
                    <svg className="h-5 w-5 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="font-medium text-yellow-800">Kundendaten nicht verfügbar</p>
                      <p className="mt-1 text-sm text-yellow-700">
                        Bitte stelle sicher, dass der Kunde in Froxlor existiert oder lege zuerst einen Kunden in Schritt 2 an.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 border-t pt-4">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition flex items-center gap-2"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                  </svg>
                  Zurück
                </button>
              </div>
            </StepContent>
          )}
        </div>
      </div>
    </div>
  );
}

function StepIndicator({
  number,
  title,
  active,
  completed,
  disabled = false,
  onClick,
}: {
  number: number;
  title: string;
  active: boolean;
  completed: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full font-semibold transition ${
          completed
            ? 'bg-blue-600 text-white'
            : active
            ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-600'
            : 'bg-gray-200 text-gray-500'
        }`}
      >
        {completed ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          number
        )}
      </div>
      <span className={`text-sm font-medium ${active ? 'text-gray-900' : 'text-gray-500'}`}>
        {title}
      </span>
    </button>
  );
}

function StepContent({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">{title}</h2>
      {children}
    </div>
  );
}
