"use client";

import { useState, useEffect } from "react";
import {
  getCustomerEmailAddresses,
  getCustomerEmailDomains,
  createEmailAddress,
  updateEmailAccount,
  deleteEmailAddress,
  addEmailForwarder
} from "./email-server-actions";

type EmailAddress = {
  id: number;
  email: string;
  email_full: string;
  destination: string;
  iscatchall: boolean;
  hasMailbox: boolean;
};

type EmailDomain = {
  id: string;
  domain: string;
  isEmailDomain: boolean;
};

type Props = {
  serverId: string | null;
  customerNo: string | null;
  preloadedCustomer: {
    customerid: number;
    loginname: string;
  } | null;
};

export function EmailAddressesCard({ serverId, customerNo, preloadedCustomer }: Props) {
  const [emails, setEmails] = useState<EmailAddress[]>([]);
  const [domains, setDomains] = useState<EmailDomain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Formulare
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Neue E-Mail-Adresse Formular
  const [newEmail, setNewEmail] = useState({
    localPart: "",
    domain: "",
    createMailbox: true,
    password: "",
    isCatchall: false,
  });

  // Passwort ändern Formular
  const [editPassword, setEditPassword] = useState("");

  // Lade E-Mail-Adressen und Domains wenn Kunde vorhanden
  useEffect(() => {
    if (serverId && preloadedCustomer?.customerid) {
      loadData();
    }
  }, [serverId, preloadedCustomer?.customerid]);

  // Auf Domains-Änderungen lauschen (von DomainsCard)
  useEffect(() => {
    const handleDomainsChanged = () => {
      if (serverId && preloadedCustomer?.customerid) {
        loadData();
      }
    };

    window.addEventListener('domains-changed', handleDomainsChanged);
    return () => {
      window.removeEventListener('domains-changed', handleDomainsChanged);
    };
  }, [serverId, preloadedCustomer?.customerid, preloadedCustomer?.loginname]);

  const loadData = async () => {
    if (!serverId || !preloadedCustomer?.customerid) return;

    setIsLoading(true);
    setError(null);

    try {
      // Lade E-Mails und Domains parallel
      // loginname wird übergeben um Standard-Subdomain herauszufiltern
      const [emailsResult, domainsResult] = await Promise.all([
        getCustomerEmailAddresses(serverId, preloadedCustomer.customerid),
        getCustomerEmailDomains(serverId, preloadedCustomer.customerid, preloadedCustomer.loginname),
      ]);

      if (emailsResult.success && emailsResult.emails) {
        setEmails(emailsResult.emails);
      } else {
        setError(emailsResult.error || "Fehler beim Laden der E-Mail-Adressen");
      }

      if (domainsResult.success && domainsResult.domains) {
        // Nur E-Mail-fähige Domains anzeigen
        setDomains(domainsResult.domains.filter(d => d.isEmailDomain));
        // Standard-Domain setzen wenn vorhanden
        if (domainsResult.domains.length > 0 && !newEmail.domain) {
          const emailDomains = domainsResult.domains.filter(d => d.isEmailDomain);
          if (emailDomains.length > 0) {
            setNewEmail(prev => ({ ...prev, domain: emailDomains[0].domain }));
          }
        }
      }
    } catch {
      setError("Fehler beim Laden der Daten");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEmail = async () => {
    if (!serverId || !preloadedCustomer?.customerid) return;

    if (!newEmail.localPart.trim()) {
      setError("Bitte geben Sie einen lokalen Teil (vor @) ein");
      return;
    }

    if (!newEmail.domain) {
      setError("Bitte wählen Sie eine Domain aus");
      return;
    }

    if (newEmail.createMailbox && !newEmail.password.trim()) {
      setError("Bitte geben Sie ein Passwort für das Postfach ein");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createEmailAddress(
        serverId,
        preloadedCustomer.customerid,
        {
          localPart: newEmail.localPart.trim().toLowerCase(),
          domain: newEmail.domain,
          createMailbox: newEmail.createMailbox,
          password: newEmail.password,
          isCatchall: newEmail.isCatchall,
        }
      );

      if (result.success) {
        setSuccessMessage(`E-Mail-Adresse ${result.email?.email_full} erfolgreich angelegt`);
        setTimeout(() => setSuccessMessage(null), 3000);
        setShowCreateForm(false);
        setNewEmail({
          localPart: "",
          domain: domains[0]?.domain || "",
          createMailbox: true,
          password: "",
          isCatchall: false,
        });
        await loadData();
      } else {
        setError(result.error || "Fehler beim Anlegen der E-Mail-Adresse");
      }
    } catch {
      setError("Fehler beim Anlegen der E-Mail-Adresse");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (emailAddress: string) => {
    if (!serverId || !preloadedCustomer?.customerid) return;

    if (!editPassword.trim()) {
      setError("Bitte geben Sie ein neues Passwort ein");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await updateEmailAccount(
        serverId,
        preloadedCustomer.customerid,
        emailAddress,
        { password: editPassword }
      );

      if (result.success) {
        setSuccessMessage("Passwort erfolgreich geändert");
        setTimeout(() => setSuccessMessage(null), 3000);
        setShowEditForm(null);
        setEditPassword("");
      } else {
        setError(result.error || "Fehler beim Ändern des Passworts");
      }
    } catch {
      setError("Fehler beim Ändern des Passworts");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmail = async (email: EmailAddress) => {
    if (!serverId || !preloadedCustomer?.customerid) return;

    if (!confirm(`Möchten Sie die E-Mail-Adresse "${email.email_full}" wirklich löschen?`)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await deleteEmailAddress(
        serverId,
        preloadedCustomer.customerid,
        email.id,
        true // Daten auch löschen
      );

      if (result.success) {
        setSuccessMessage(`E-Mail-Adresse ${email.email_full} gelöscht`);
        setTimeout(() => setSuccessMessage(null), 3000);
        await loadData();
      } else {
        setError(result.error || "Fehler beim Löschen der E-Mail-Adresse");
      }
    } catch {
      setError("Fehler beim Löschen der E-Mail-Adresse");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    setNewEmail(prev => ({ ...prev, password }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">E-Mail-Adressen</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {preloadedCustomer ? `${emails.length} Adresse(n)` : "Kein Kunde zugeordnet"}
            </p>
          </div>
        </div>

        {/* Neue E-Mail anlegen Button */}
        {serverId && preloadedCustomer && domains.length > 0 && !showCreateForm && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neu
          </button>
        )}
      </div>

      {/* Kein Server zugewiesen */}
      {!serverId && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">Bitte zuerst einen E-Mail-Server zuweisen.</p>
          </div>
        </div>
      )}

      {/* Server zugewiesen aber kein Kunde */}
      {serverId && !preloadedCustomer && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm">Kunde nicht auf Server gefunden. Bitte zuerst anlegen.</p>
          </div>
        </div>
      )}

      {/* Keine Domains vorhanden */}
      {serverId && preloadedCustomer && !isLoading && domains.length === 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <p className="text-sm">Keine E-Mail-Domain vorhanden. Bitte zuerst eine Domain anlegen.</p>
          </div>
        </div>
      )}

      {/* Lade-Indikator */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}

      {/* Erfolg */}
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

      {/* Fehler */}
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

      {/* Neue E-Mail-Adresse Formular */}
      {showCreateForm && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Neue E-Mail-Adresse
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

          {/* E-Mail-Adresse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              E-Mail-Adresse *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newEmail.localPart}
                onChange={(e) => setNewEmail(prev => ({ ...prev, localPart: e.target.value }))}
                placeholder="name"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <span className="flex items-center text-gray-500 dark:text-gray-400">@</span>
              <select
                value={newEmail.domain}
                onChange={(e) => setNewEmail(prev => ({ ...prev, domain: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {domains.map(domain => (
                  <option key={domain.id} value={domain.domain}>{domain.domain}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Postfach erstellen */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="createMailbox"
              checked={newEmail.createMailbox}
              onChange={(e) => setNewEmail(prev => ({ ...prev, createMailbox: e.target.checked }))}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="createMailbox" className="text-sm text-gray-700 dark:text-gray-300">
              Postfach erstellen (für IMAP/POP3 Zugriff)
            </label>
          </div>

          {/* Passwort (nur wenn Postfach) */}
          {newEmail.createMailbox && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Passwort *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newEmail.password}
                  onChange={(e) => setNewEmail(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Sicheres Passwort"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono"
                />
                <button
                  type="button"
                  onClick={generatePassword}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Generieren
                </button>
              </div>
            </div>
          )}

          {/* Catchall */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isCatchall"
              checked={newEmail.isCatchall}
              onChange={(e) => setNewEmail(prev => ({ ...prev, isCatchall: e.target.checked }))}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="isCatchall" className="text-sm text-gray-700 dark:text-gray-300">
              Als Catchall markieren (empfängt alle nicht zugeordneten E-Mails)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleCreateEmail}
              disabled={isSubmitting}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
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
                  Anlegen
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* E-Mail-Adressen Liste */}
      {serverId && preloadedCustomer && !isLoading && domains.length > 0 && (
        <>
          {emails.length === 0 && !showCreateForm ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-sm">Keine E-Mail-Adressen vorhanden.</p>
              </div>
            </div>
          ) : emails.length > 0 && (
            <div className="space-y-2">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  {showEditForm === email.id ? (
                    // Bearbeitungsformular
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 dark:text-white">{email.email_full}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowEditForm(null);
                            setEditPassword("");
                          }}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {email.hasMailbox && (
                        <div>
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Neues Passwort
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              placeholder="Neues Passwort eingeben"
                              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdatePassword(email.email_full)}
                              disabled={isSubmitting || !editPassword.trim()}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isSubmitting ? "..." : "Speichern"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Normale Anzeige
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {email.hasMailbox ? (
                          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {email.email_full}
                          </p>
                          {email.destination && !email.hasMailbox && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              → {email.destination}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {email.iscatchall && (
                          <span className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded">
                            Catchall
                          </span>
                        )}
                        {email.hasMailbox ? (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                            Postfach
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                            Weiterleitung
                          </span>
                        )}

                        {/* Bearbeiten Button (nur für Postfächer) */}
                        {email.hasMailbox && (
                          <button
                            type="button"
                            onClick={() => setShowEditForm(email.id)}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Passwort ändern"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}

                        {/* Löschen Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteEmail(email)}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Löschen"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Aktualisieren Button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Aktualisieren
            </button>
          </div>
        </>
      )}
    </div>
  );
}
