"use client";

import { useState, useTransition } from "react";
import { setEmailServer, checkFroxlorCustomer, createFroxlorEmailCustomer, updateFroxlorEmailCustomer } from "./email-server-actions";

type Server = {
  id: string;
  name: string;
  ip: string;
  isEmailServer?: boolean;
};

type FroxlorCustomerData = {
  customerid: string;
  loginname: string;
  name: string;
  firstname: string;
  company: string;
  email: string;
  diskspace_gb?: number;
  email_imap?: number | string;
  email_pop3?: number | string;
};

type Props = {
  clientId: string;
  clientName: string;
  clientFirstname: string | null;
  clientLastname: string | null;
  clientCustomerNo: string | null;
  emailServerId: string | null;
  servers: Server[];
  // Vorgeladene Froxlor-Daten vom Server
  preloadedEmailServerData?: {
    server: { id: string; name: string; ip: string } | null;
    customerNo: string | null;
    customer: {
      customerid: number;
      loginname: string;
      name?: string;
      firstname?: string;
      company?: string;
      email?: string;
      diskspace_gb?: number;
      email_imap?: number;
      email_pop3?: number;
    } | null;
    error: string | null;
  };
};

export function EmailServerCard({
  clientId,
  clientName,
  clientFirstname,
  clientLastname,
  clientCustomerNo,
  emailServerId: initialServerId,
  servers,
  preloadedEmailServerData,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedServerId, setSelectedServerId] = useState<string>(initialServerId || "");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    firstname: clientFirstname || "",
    name: clientLastname || "",
    company: clientName || "",
    email: "server@eventomaxx.de",
    diskspace_gb: "2",
    email_imap: true,
    email_pop3: true,
  });

  // Initialisiere mit vorgeladenen Daten
  const [froxlorCustomer, setFroxlorCustomer] = useState<FroxlorCustomerData | null>(() => {
    if (preloadedEmailServerData?.customer) {
      return {
        customerid: String(preloadedEmailServerData.customer.customerid),
        loginname: preloadedEmailServerData.customer.loginname,
        name: preloadedEmailServerData.customer.name || "",
        firstname: preloadedEmailServerData.customer.firstname || "",
        company: preloadedEmailServerData.customer.company || "",
        email: preloadedEmailServerData.customer.email || "",
        diskspace_gb: preloadedEmailServerData.customer.diskspace_gb,
        email_imap: preloadedEmailServerData.customer.email_imap,
        email_pop3: preloadedEmailServerData.customer.email_pop3,
      };
    }
    return null;
  });

  // Zeige vorgeladenen Fehler an, aber nur wenn Server ausgewählt
  const preloadedError = preloadedEmailServerData?.error && initialServerId ? preloadedEmailServerData.error : null;

  // Automatisch Kunde prüfen wenn Server gewechselt wird
  const checkCustomerOnServer = async (serverId: string) => {
    if (!serverId || !clientCustomerNo) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsChecking(true);
    setFroxlorCustomer(null);
    setShowCreateForm(false);

    try {
      const result = await checkFroxlorCustomer(serverId, clientCustomerNo);

      if (result.success && result.customer) {
        setFroxlorCustomer(result.customer);
      } else {
        // Kunde nicht gefunden - kein Fehler anzeigen, nur die Option zum Anlegen
        setError(null);
      }
    } catch {
      setError("Fehler bei der Abfrage");
    } finally {
      setIsChecking(false);
    }
  };

  // Bei Server-Wechsel automatisch prüfen
  const handleServerChange = (serverId: string) => {
    setSelectedServerId(serverId);
    setFroxlorCustomer(null);
    setError(null);
    setShowCreateForm(false);
    setIsEditing(false);

    if (serverId && clientCustomerNo) {
      checkCustomerOnServer(serverId);
    }
  };

  const handleSave = () => {
    setError(null);
    setSuccessMessage(null);

    startTransition(async () => {
      const result = await setEmailServer(
        clientId,
        selectedServerId || null,
        clientCustomerNo || null
      );

      if (result.success) {
        setSuccessMessage("E-Mail-Server erfolgreich gespeichert");
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result.error || "Fehler beim Speichern");
      }
    });
  };

  const handleCreateCustomer = async () => {
    if (!selectedServerId || !clientCustomerNo) {
      setError("Server und Kundennummer erforderlich");
      return;
    }

    if (!createFormData.firstname || !createFormData.name) {
      setError("Bitte füllen Sie Vorname und Nachname aus");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsCreating(true);

    try {
      const result = await createFroxlorEmailCustomer(selectedServerId, {
        customerNo: clientCustomerNo,
        firstname: createFormData.firstname,
        name: createFormData.name,
        company: createFormData.company,
        email: createFormData.email,
        diskspace_gb: parseInt(createFormData.diskspace_gb) || 2,
      });

      if (result.success && result.customer) {
        setFroxlorCustomer(result.customer);
        setSuccessMessage("Kunde erfolgreich auf Server angelegt!");
        setShowCreateForm(false);
      } else {
        setError(result.error || "Fehler beim Anlegen des Kunden");
      }
    } catch {
      setError("Fehler beim Anlegen des Kunden");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateCustomer = async () => {
    if (!selectedServerId || !froxlorCustomer) {
      setError("Kein Kunde zum Aktualisieren vorhanden");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsUpdating(true);

    try {
      const result = await updateFroxlorEmailCustomer(
        selectedServerId,
        parseInt(froxlorCustomer.customerid),
        {
          firstname: createFormData.firstname,
          name: createFormData.name,
          company: createFormData.company,
          email: createFormData.email,
          diskspace_gb: parseInt(createFormData.diskspace_gb) || 2,
          email_imap: createFormData.email_imap ? 1 : 0,
          email_pop3: createFormData.email_pop3 ? 1 : 0,
        }
      );

      if (result.success && result.customer) {
        setFroxlorCustomer(result.customer);
        setSuccessMessage("Kunde erfolgreich aktualisiert!");
        setIsEditing(false);
      } else {
        setError(result.error || "Fehler beim Aktualisieren des Kunden");
      }
    } catch {
      setError("Fehler beim Aktualisieren des Kunden");
    } finally {
      setIsUpdating(false);
    }
  };

  const startEditing = () => {
    if (froxlorCustomer) {
      setCreateFormData({
        firstname: froxlorCustomer.firstname || "",
        name: froxlorCustomer.name || "",
        company: froxlorCustomer.company || "",
        email: froxlorCustomer.email || "server@eventomaxx.de",
        diskspace_gb: String(froxlorCustomer.diskspace_gb || 2),
        email_imap: froxlorCustomer.email_imap === 1 || froxlorCustomer.email_imap === "1",
        email_pop3: froxlorCustomer.email_pop3 === 1 || froxlorCustomer.email_pop3 === "1",
      });
      setIsEditing(true);
    }
  };

  const selectedServer = servers.find(s => s.id === selectedServerId);

  // Prüfen, ob sich etwas geändert hat (zum Speichern nötig)
  const hasChanges = selectedServerId !== (initialServerId || "");

  // Kunde nicht gefunden und kann angelegt werden
  const canCreateCustomer = selectedServerId && clientCustomerNo && !froxlorCustomer && !isChecking;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">E-Mail-Server</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Server für E-Mail-Verwaltung auswählen
            {clientCustomerNo && (
              <span className="ml-1 text-gray-400 dark:text-gray-500">
                (Kunde: {clientCustomerNo})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Keine Kundennummer vorhanden */}
      {!clientCustomerNo && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Bitte zuerst eine Kundennummer für diesen Kunden hinterlegen.
            </p>
          </div>
        </div>
      )}

      {/* Server-Auswahl (nur wenn Kundennummer vorhanden) */}
      {clientCustomerNo && (
        <div>
          <label htmlFor="emailServer" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            E-Mail-Server
          </label>
          <select
            id="emailServer"
            value={selectedServerId}
            onChange={(e) => handleServerChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">-- Kein E-Mail-Server zugewiesen --</option>
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name} ({server.ip})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Lade-Indikator während Prüfung */}
      {isChecking && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Prüfe ob Kunde {clientCustomerNo} auf {selectedServer?.name} existiert...
            </p>
          </div>
        </div>
      )}

      {/* Froxlor-Kunde gefunden */}
      {froxlorCustomer && !isEditing && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm">
                <p className="font-medium text-emerald-800 dark:text-emerald-200">
                  Kunde auf Server gefunden
                </p>
                <div className="mt-1 text-emerald-700 dark:text-emerald-300 space-y-0.5">
                  <p><span className="text-emerald-600 dark:text-emerald-400">Loginname:</span> {froxlorCustomer.loginname}</p>
                  {froxlorCustomer.company && (
                    <p><span className="text-emerald-600 dark:text-emerald-400">Firma:</span> {froxlorCustomer.company}</p>
                  )}
                  {(froxlorCustomer.firstname || froxlorCustomer.name) && (
                    <p><span className="text-emerald-600 dark:text-emerald-400">Name:</span> {froxlorCustomer.firstname} {froxlorCustomer.name}</p>
                  )}
                  {froxlorCustomer.email && (
                    <p><span className="text-emerald-600 dark:text-emerald-400">E-Mail:</span> {froxlorCustomer.email}</p>
                  )}
                  <p><span className="text-emerald-600 dark:text-emerald-400">Speicherplatz:</span> {froxlorCustomer.diskspace_gb || 2} GB</p>
                  <p>
                    <span className="text-emerald-600 dark:text-emerald-400">IMAP:</span>{" "}
                    {(froxlorCustomer.email_imap === 1 || froxlorCustomer.email_imap === "1") ? (
                      <span className="text-emerald-700 dark:text-emerald-300">Aktiviert</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Deaktiviert</span>
                    )}
                  </p>
                  <p>
                    <span className="text-emerald-600 dark:text-emerald-400">POP3:</span>{" "}
                    {(froxlorCustomer.email_pop3 === 1 || froxlorCustomer.email_pop3 === "1") ? (
                      <span className="text-emerald-700 dark:text-emerald-300">Aktiviert</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">Deaktiviert</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={startEditing}
              className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-800/30 rounded-lg transition-colors"
              title="Bearbeiten"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Bearbeiten-Formular für bestehenden Kunden */}
      {froxlorCustomer && isEditing && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Kunden bearbeiten
            </h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="editFirstname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Vorname
              </label>
              <input
                id="editFirstname"
                type="text"
                value={createFormData.firstname}
                onChange={(e) => setCreateFormData({ ...createFormData, firstname: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="editName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nachname
              </label>
              <input
                id="editName"
                type="text"
                value={createFormData.name}
                onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="editCompany" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Firma
              </label>
              <input
                id="editCompany"
                type="text"
                value={createFormData.company}
                onChange={(e) => setCreateFormData({ ...createFormData, company: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="editDiskspace" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Speicherplatz (GB)
              </label>
              <input
                id="editDiskspace"
                type="number"
                min="1"
                max="100"
                value={createFormData.diskspace_gb}
                onChange={(e) => setCreateFormData({ ...createFormData, diskspace_gb: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* IMAP/POP3 Berechtigungen */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">E-Mail-Protokolle</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createFormData.email_imap}
                  onChange={(e) => setCreateFormData({ ...createFormData, email_imap: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-blue-700 dark:text-blue-300">IMAP erlauben</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createFormData.email_pop3}
                  onChange={(e) => setCreateFormData({ ...createFormData, email_pop3: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-blue-700 dark:text-blue-300">POP3 erlauben</span>
              </label>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Mindestens ein Protokoll muss aktiviert sein, um E-Mail-Postfächer anlegen zu können.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleUpdateCustomer}
              disabled={isUpdating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isUpdating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Speichern...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Speichern
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Vorgeladener Fehler (wenn Server konfiguriert aber Kunde nicht gefunden) */}
      {preloadedError && !froxlorCustomer && !error && !canCreateCustomer && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-amber-700 dark:text-amber-300">{preloadedError}</p>
          </div>
        </div>
      )}

      {/* Button zum Kunden anlegen (wenn Server ausgewählt, aber kein Kunde gefunden) */}
      {canCreateCustomer && !showCreateForm && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Kunde <span className="font-medium">{clientCustomerNo}</span> nicht auf Server gefunden. Möchten Sie ihn anlegen?
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              Kunde anlegen
            </button>
          </div>
        </div>
      )}

      {/* Formular zum Kunden anlegen */}
      {showCreateForm && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Neuen Kunden auf Server anlegen
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="createFirstname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Vorname *
              </label>
              <input
                id="createFirstname"
                type="text"
                value={createFormData.firstname}
                onChange={(e) => setCreateFormData({ ...createFormData, firstname: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Max"
              />
            </div>
            <div>
              <label htmlFor="createName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nachname *
              </label>
              <input
                id="createName"
                type="text"
                value={createFormData.name}
                onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Mustermann"
              />
            </div>
            <div>
              <label htmlFor="createCompany" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Firma
              </label>
              <input
                id="createCompany"
                type="text"
                value={createFormData.company}
                onChange={(e) => setCreateFormData({ ...createFormData, company: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Musterfirma GmbH"
              />
            </div>
            <div>
              <label htmlFor="createEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                E-Mail
              </label>
              <input
                id="createEmail"
                type="email"
                value={createFormData.email}
                onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="info@beispiel.de"
              />
            </div>
            <div>
              <label htmlFor="createDiskspace" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Speicherplatz (GB)
              </label>
              <input
                id="createDiskspace"
                type="number"
                min="1"
                max="100"
                value={createFormData.diskspace_gb}
                onChange={(e) => setCreateFormData({ ...createFormData, diskspace_gb: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <span className="font-medium">Loginname:</span> {clientCustomerNo}<br />
              <span className="font-medium">Server:</span> {selectedServer?.name}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleCreateCustomer}
              disabled={isCreating || !createFormData.firstname || !createFormData.name}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Anlegen...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Kunde anlegen
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Fehlermeldung */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Erfolgsmeldung */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Speichern-Button - nur anzeigen wenn Änderungen vorliegen */}
      {hasChanges && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Speichern...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Speichern
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
