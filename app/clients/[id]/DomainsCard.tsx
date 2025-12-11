"use client";

import { useState, useEffect } from "react";
import {
  getCustomerEmailDomains,
  createCustomerDomain,
  deleteCustomerDomain,
} from "./email-server-actions";

type Domain = {
  id: string;
  domain: string;
  isEmailDomain: boolean;
  letsencrypt: boolean;
  sslRedirect: boolean;
};

type Props = {
  serverId: string | null;
  customerId: number | null;
  customerLoginname: string | null;
};

export function DomainsCard({ serverId, customerId, customerLoginname }: Props) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Formular
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDomain, setNewDomain] = useState({
    domain: "",
    isEmailDomain: true,
    letsencrypt: true,
    sslRedirect: true,
  });

  // Lade Domains wenn Kunde vorhanden
  useEffect(() => {
    if (serverId && customerId) {
      loadDomains();
    }
  }, [serverId, customerId, customerLoginname]);

  const loadDomains = async () => {
    if (!serverId || !customerId) return;

    setIsLoading(true);
    setError(null);

    try {
      // customerLoginname übergeben um Standard-Subdomain herauszufiltern
      const result = await getCustomerEmailDomains(serverId, customerId, customerLoginname || undefined);
      if (result.success && result.domains) {
        setDomains(result.domains);
      } else {
        setError(result.error || "Fehler beim Laden der Domains");
      }
    } catch {
      setError("Fehler beim Laden der Domains");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDomain = async () => {
    if (!serverId || !customerId) return;

    const domainName = newDomain.domain.trim().toLowerCase();

    if (!domainName) {
      setError("Bitte geben Sie einen Domain-Namen ein");
      return;
    }

    // Einfache Domain-Validierung
    if (!/^[a-z0-9]+([\-\.][a-z0-9]+)*\.[a-z]{2,}$/.test(domainName)) {
      setError("Bitte geben Sie einen gültigen Domain-Namen ein (z.B. beispiel.de)");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createCustomerDomain(serverId, customerId, {
        domain: domainName,
        isEmailDomain: newDomain.isEmailDomain,
        letsencrypt: newDomain.letsencrypt,
        sslRedirect: newDomain.sslRedirect,
      });

      if (result.success) {
        setSuccessMessage(`Domain ${result.domain?.domain} erfolgreich angelegt`);
        setTimeout(() => setSuccessMessage(null), 3000);
        setShowCreateForm(false);
        setNewDomain({
          domain: "",
          isEmailDomain: true,
          letsencrypt: true,
          sslRedirect: true,
        });
        await loadDomains();
        // Event auslösen, damit andere Komponenten aktualisiert werden
        window.dispatchEvent(new CustomEvent('domains-changed'));
      } else {
        setError(result.error || "Fehler beim Anlegen der Domain");
      }
    } catch {
      setError("Fehler beim Anlegen der Domain");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDomain = async (domain: Domain) => {
    if (!serverId) return;

    if (!confirm(`Möchten Sie die Domain "${domain.domain}" wirklich löschen?\n\nAchtung: Alle E-Mail-Adressen dieser Domain werden ebenfalls gelöscht!`)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await deleteCustomerDomain(serverId, domain.id);

      if (result.success) {
        setSuccessMessage(`Domain ${domain.domain} gelöscht`);
        setTimeout(() => setSuccessMessage(null), 3000);
        await loadDomains();
        // Event auslösen, damit andere Komponenten aktualisiert werden
        window.dispatchEvent(new CustomEvent('domains-changed'));
      } else {
        setError(result.error || "Fehler beim Löschen der Domain");
      }
    } catch {
      setError("Fehler beim Löschen der Domain");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Domains</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {customerId ? `${domains.length} Domain(s)` : "Kein Kunde zugeordnet"}
            </p>
          </div>
        </div>

        {/* Neue Domain anlegen Button */}
        {serverId && customerId && !showCreateForm && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="px-3 py-1.5 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-1.5"
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
      {serverId && !customerId && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm">Kunde nicht auf Server gefunden. Bitte zuerst anlegen.</p>
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

      {/* Neue Domain Formular */}
      {showCreateForm && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-white">
              Neue Domain anlegen
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

          {/* Domain-Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Domain-Name *
            </label>
            <input
              type="text"
              value={newDomain.domain}
              onChange={(e) => setNewDomain(prev => ({ ...prev, domain: e.target.value }))}
              placeholder="beispiel.de"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>

          {/* Optionen */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isEmailDomain"
                checked={newDomain.isEmailDomain}
                onChange={(e) => setNewDomain(prev => ({ ...prev, isEmailDomain: e.target.checked }))}
                className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
              />
              <label htmlFor="isEmailDomain" className="text-sm text-gray-700 dark:text-gray-300">
                Als E-Mail-Domain aktivieren
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="letsencrypt"
                checked={newDomain.letsencrypt}
                onChange={(e) => setNewDomain(prev => ({ ...prev, letsencrypt: e.target.checked }))}
                className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
              />
              <label htmlFor="letsencrypt" className="text-sm text-gray-700 dark:text-gray-300">
                Let&apos;s Encrypt SSL-Zertifikat aktivieren
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sslRedirect"
                checked={newDomain.sslRedirect}
                onChange={(e) => setNewDomain(prev => ({ ...prev, sslRedirect: e.target.checked }))}
                className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
              />
              <label htmlFor="sslRedirect" className="text-sm text-gray-700 dark:text-gray-300">
                HTTPS-Weiterleitung aktivieren
              </label>
            </div>
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
              onClick={handleCreateDomain}
              disabled={isSubmitting}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
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

      {/* Domains Liste */}
      {serverId && customerId && !isLoading && (
        <>
          {domains.length === 0 && !showCreateForm ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <p className="text-sm">Keine Domains vorhanden. Legen Sie eine Domain an, um E-Mail-Adressen erstellen zu können.</p>
              </div>
            </div>
          ) : domains.length > 0 && (
            <div className="space-y-2">
              {domains.map((domain) => (
                <div
                  key={domain.id}
                  className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {domain.domain}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {domain.isEmailDomain && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                          E-Mail
                        </span>
                      )}
                      {domain.letsencrypt && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                          SSL
                        </span>
                      )}

                      {/* Löschen Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteDomain(domain)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-1"
                        title="Löschen"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Aktualisieren Button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={loadDomains}
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
