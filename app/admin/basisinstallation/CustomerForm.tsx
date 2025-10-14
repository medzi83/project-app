"use client";

import { useState, useEffect, useCallback } from "react";
import {
  checkCustomerNumber,
  createOrUpdateFroxlorCustomer,
  getPhpConfigs,
  getCustomerDomains,
  updateStandardDomain,
} from "./actions";
import type { FroxlorCustomer, FroxlorPhpConfig, FroxlorDomain } from "@/lib/froxlor";

type DomainFormValues = {
  documentroot: string;
  ssl_redirect: boolean;
  letsencrypt: boolean;
  phpsettingid: string;
};

type Props = {
  serverId: string;
  clientName: string;
  clientCustomerNo: string;
};

export default function CustomerForm({ serverId, clientName, clientCustomerNo }: Props) {
  const [customerNumber, setCustomerNumber] = useState(clientCustomerNo || "");
  const [checking, setChecking] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState<FroxlorCustomer | null>(null);
  const [phpConfigs, setPhpConfigs] = useState<FroxlorPhpConfig[]>([]);
  const [selectedPhpConfigs, setSelectedPhpConfigs] = useState<number[]>([1]);
  const [allDomains, setAllDomains] = useState<FroxlorDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [domainFormData, setDomainFormData] = useState<Record<string, DomainFormValues>>({});
  const [formData, setFormData] = useState({
    firstname: "",
    name: "",
    company: "",
    email: "server@eventomaxx.de",
    loginname: "",
    password: "",
    diskspace_gb: "5",
    mysqls: "2",
    ftps: "1",
    documentroot: "",
    leregistered: false,
    deactivated: false,
  });
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [domainResult, setDomainResult] = useState<{ success: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittingDomain, setSubmittingDomain] = useState(false);

  const loadCustomerDomains = useCallback(async (customerId: number) => {
    setLoadingDomains(true);
    const response = await getCustomerDomains(serverId, customerId);
    setLoadingDomains(false);

    if (response.success && response.domains) {
      setAllDomains(response.domains);

      // Initialize form data for each domain
      const initialFormData: Record<string, DomainFormValues> = {};
      response.domains.forEach((domain: FroxlorDomain) => {
        initialFormData[domain.id] = {
          documentroot: domain.documentroot || "",
          ssl_redirect: domain.ssl_redirect === "1",
          letsencrypt: domain.letsencrypt === "1",
          phpsettingid: domain.phpsettingid || "1",
        };
      });
      setDomainFormData(initialFormData);
    }
  }, [serverId]);

  // Load PHP configurations on mount
  useEffect(() => {
    if (serverId) {
      getPhpConfigs(serverId).then((response) => {
        if (response.success && response.configs) {
          setPhpConfigs(response.configs);
        }
      });
    }
  }, [serverId]);

  // Update customerNumber when clientCustomerNo prop changes and auto-check
  useEffect(() => {
    // Normalize values to prevent undefined from changing array size
    const normalizedCustomerNo = clientCustomerNo || "";
    const normalizedClientName = clientName || "";
    const normalizedServerId = serverId || "";

    setCustomerNumber(normalizedCustomerNo);
    setExistingCustomer(null);
    setResult(null);
    setSelectedPhpConfigs([1]);
    setFormData({
      firstname: "",
      name: "",
      company: normalizedClientName,
      email: "server@eventomaxx.de",
      loginname: "",
      password: "",
      diskspace_gb: "5",
      mysqls: "2",
      ftps: "1",
      documentroot: "",
      leregistered: false,
      deactivated: false,
    });

    // Auto-check if customerNumber is provided
    if (normalizedCustomerNo.trim() && normalizedServerId) {
      const autoCheck = async () => {
        setChecking(true);
        const response = await checkCustomerNumber(normalizedServerId, normalizedCustomerNo);
        setChecking(false);

        if (response.exists && response.customer) {
          setExistingCustomer(response.customer);
          // Convert diskspace from KB to GB (diskspace is in KB in Froxlor)
          const diskspaceGB = response.customer.diskspace
            ? Math.round(parseInt(response.customer.diskspace) / 1024 / 1024)
            : 5;
          // Parse allowed_phpconfigs from string like "[1,2]" to array
          const phpConfigsStr = response.customer.allowed_phpconfigs || "[1]";
          const phpConfigsMatch = phpConfigsStr.match(/\[([^\]]*)\]/);
          const phpConfigIds = phpConfigsMatch
            ? phpConfigsMatch[1].split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id))
            : [1];
          setSelectedPhpConfigs(phpConfigIds);

          setFormData({
            firstname: response.customer.firstname || "",
            name: response.customer.name || "",
            company: response.customer.company || "",
            email: response.customer.email || "server@eventomaxx.de",
            loginname: response.customer.loginname || "",
            password: "",
            diskspace_gb: diskspaceGB.toString(),
            mysqls: response.customer.mysqls?.toString() || "2",
            ftps: response.customer.ftps?.toString() || "1",
            documentroot: response.customer.documentroot || "",
            leregistered: response.customer.leregistered === 1,
            deactivated: response.customer.deactivated === 1,
          });

          // Load all domains if customer exists
          loadCustomerDomains(response.customer.customerid);
        }
      };
      autoCheck();
    }
  }, [clientCustomerNo, clientName, serverId, loadCustomerDomains]);

  const handleCheckCustomer = async () => {
    if (!customerNumber.trim()) return;

    setChecking(true);
    setResult(null);
    const response = await checkCustomerNumber(serverId, customerNumber);
    setChecking(false);

    if (response.exists && response.customer) {
      setExistingCustomer(response.customer);
      // Convert diskspace from KB to GB (diskspace is in KB in Froxlor)
      const diskspaceGB = response.customer.diskspace
        ? Math.round(parseInt(response.customer.diskspace) / 1024 / 1024)
        : 5;
      // Parse allowed_phpconfigs from string like "[1,2]" to array
      const phpConfigsStr = response.customer.allowed_phpconfigs || "[1]";
      const phpConfigsMatch = phpConfigsStr.match(/\[([^\]]*)\]/);
      const phpConfigIds = phpConfigsMatch
        ? phpConfigsMatch[1].split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id))
        : [1];
      setSelectedPhpConfigs(phpConfigIds);

      setFormData({
        firstname: response.customer.firstname || "",
        name: response.customer.name || "",
        company: response.customer.company || "",
        email: response.customer.email || "server@eventomaxx.de",
        loginname: response.customer.loginname || "",
        password: "",
        diskspace_gb: diskspaceGB.toString(),
        mysqls: response.customer.mysqls?.toString() || "2",
        ftps: response.customer.ftps?.toString() || "1",
        documentroot: response.customer.documentroot || "",
        leregistered: response.customer.leregistered === 1,
        deactivated: response.customer.deactivated === 1,
      });

      // Load all domains
      loadCustomerDomains(response.customer.customerid);
    } else {
      setExistingCustomer(null);
      // Prefill with client name if available
      if (clientName) {
        setFormData({
          ...formData,
          company: clientName,
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    const data = new FormData(e.currentTarget);
    const response = await createOrUpdateFroxlorCustomer(data);

    setSubmitting(false);
    setResult(response);

    if (response.success) {
      // Reset form on success
      setTimeout(() => {
        setCustomerNumber("");
        setExistingCustomer(null);
        setAllDomains([]);
        setFormData({
          firstname: "",
          name: "",
          company: "",
          email: "server@eventomaxx.de",
          loginname: "",
          password: "",
          diskspace_gb: "5",
          mysqls: "2",
          ftps: "1",
          documentroot: "",
          leregistered: false,
          deactivated: false,
        });
        setResult(null);
      }, 3000);
    }
  };

  const handleDomainSubmit = async (domainId: string) => {
    setSubmittingDomain(true);
    setDomainResult(null);

    const formData = new FormData();
    formData.append("serverId", serverId);
    formData.append("domainId", domainId);
    formData.append("domain_documentroot", domainFormData[domainId].documentroot);
    if (domainFormData[domainId].ssl_redirect) formData.append("domain_ssl_redirect", "on");
    if (domainFormData[domainId].letsencrypt) formData.append("domain_letsencrypt", "on");
    formData.append("domain_phpsettingid", domainFormData[domainId].phpsettingid);

    const response = await updateStandardDomain(formData);

    setSubmittingDomain(false);
    setDomainResult(response);

    if (response.success) {
      // Reload domain data
      setTimeout(() => {
        setDomainResult(null);
        if (existingCustomer) {
          loadCustomerDomains(existingCustomer.customerid);
        }
      }, 2000);
    }
  };

  const toggleDomain = (domainId: string) => {
    const newExpanded = new Set(expandedDomains);
    if (newExpanded.has(domainId)) {
      newExpanded.delete(domainId);
    } else {
      newExpanded.add(domainId);
    }
    setExpandedDomains(newExpanded);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-4 font-medium">Schritt 1: Kundennummer prÃ¼fen</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={customerNumber}
            onChange={(e) => setCustomerNumber(e.target.value)}
            placeholder="z.B. 12345 oder EM12345"
            className="flex-1 rounded border p-2"
            disabled={checking}
          />
          <button
            type="button"
            onClick={handleCheckCustomer}
            disabled={checking || !customerNumber.trim()}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {checking ? "PrÃ¼fe..." : "PrÃ¼fen"}
          </button>
        </div>

        {existingCustomer && (
          <div className="mt-3 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
            <div className="font-medium">âœ“ Kunde gefunden (ID: {existingCustomer.customerid})</div>
            <div className="mt-1">
              Kundennummer: {existingCustomer.customernumber} | Login: {existingCustomer.loginname}
            </div>
            <div className="mt-2 text-xs">Die vorhandenen Daten werden unten angezeigt.</div>
          </div>
        )}

        {!checking && customerNumber && !existingCustomer && (
          <div className="mt-3 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
            Kunde nicht gefunden. Neuen Kunden anlegen.
          </div>
        )}
      </div>

      {(existingCustomer || customerNumber) && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="font-medium">
            {existingCustomer ? "Schritt 2: Kundendaten aktualisieren" : "Schritt 2: Neuen Kunden anlegen"}
          </h3>

          <input type="hidden" name="serverId" value={serverId} />
          <input type="hidden" name="customerNumber" value={customerNumber} />
          {existingCustomer && (
            <input type="hidden" name="existingCustomerId" value={existingCustomer.customerid} />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Vorname">
              <input
                name="firstname"
                value={formData.firstname}
                onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                className="w-full rounded border p-2"
                required
              />
            </Field>

            <Field label="Nachname">
              <input
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded border p-2"
                required
              />
            </Field>

            <Field label="Firma">
              <input
                name="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full rounded border p-2"
                required
              />
            </Field>

            <Field label="E-Mail">
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full rounded border p-2"
                required
              />
            </Field>

            <Field label="Login-Name">
              <input
                name="loginname"
                value={formData.loginname}
                onChange={(e) => setFormData({ ...formData, loginname: e.target.value })}
                className="w-full rounded border p-2"
                placeholder="z.B. VW33061"
                disabled={existingCustomer ? true : false}
              />
              <span className="text-xs text-gray-500 mt-1">
                {existingCustomer ? "Login-Name kann nicht geÃ¤ndert werden" : "Empfohlen: VWxxxxx Format"}
              </span>
            </Field>

            {!existingCustomer && (
              <Field label="Passwort">
                <input
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full rounded border p-2"
                  required
                  minLength={8}
                />
              </Field>
            )}

            <Field label="Speicherplatz (GB)">
              <input
                name="diskspace_gb"
                type="number"
                value={formData.diskspace_gb}
                onChange={(e) => setFormData({ ...formData, diskspace_gb: e.target.value })}
                className="w-full rounded border p-2"
                required
                min="1"
              />
            </Field>

            <Field label="MySQL Datenbanken">
              <input
                name="mysqls"
                type="number"
                value={formData.mysqls}
                onChange={(e) => setFormData({ ...formData, mysqls: e.target.value })}
                className="w-full rounded border p-2"
                required
                min="0"
              />
            </Field>

            <Field label="FTP Konten">
              <input
                name="ftps"
                type="number"
                value={formData.ftps}
                onChange={(e) => setFormData({ ...formData, ftps: e.target.value })}
                className="w-full rounded border p-2"
                required
                min="0"
              />
            </Field>

            <Field label="Document Root">
              <input
                name="documentroot"
                value={formData.documentroot}
                onChange={(e) => setFormData({ ...formData, documentroot: e.target.value })}
                className="w-full rounded border p-2"
                placeholder="/var/customers/webs/VWxxxxx/"
              />
              <span className="text-xs text-gray-500 mt-1">
                Leer lassen fÃ¼r automatische Generierung
              </span>
            </Field>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-gray-500">
              PHP Konfigurationen
            </label>
            {phpConfigs.length === 0 ? (
              <div className="text-sm text-gray-500">Lade PHP-Konfigurationen...</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {phpConfigs.map((config) => {
                  const configId = typeof config.id === 'string' ? parseInt(config.id) : config.id;
                  return (
                    <label key={config.id} className="flex items-start gap-2 rounded border p-2 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        name={`phpconfig_${config.id}`}
                        checked={selectedPhpConfigs.includes(configId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPhpConfigs([...selectedPhpConfigs, configId]);
                          } else {
                            setSelectedPhpConfigs(selectedPhpConfigs.filter(id => id !== configId));
                          }
                        }}
                        className="mt-1 rounded border"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{config.description}</div>
                        <div className="text-xs text-gray-500">{config.binary}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Let&apos;s Encrypt">
              <label className="flex items-center gap-2">
                <input
                  name="leregistered"
                  type="checkbox"
                  checked={formData.leregistered}
                  onChange={(e) => setFormData({ ...formData, leregistered: e.target.checked })}
                  className="rounded border"
                />
                <span>Let&apos;s Encrypt aktiviert</span>
              </label>
            </Field>

            <Field label="Status">
              <label className="flex items-center gap-2">
                <input
                  name="deactivated"
                  type="checkbox"
                  checked={formData.deactivated}
                  onChange={(e) => setFormData({ ...formData, deactivated: e.target.checked })}
                  className="rounded border"
                />
                <span>Kunde deaktiviert</span>
              </label>
            </Field>
          </div>

          {!existingCustomer && (
            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
              <strong>Hinweis:</strong>{" "}
              Wenn kein Login-Name angegeben wird, generiert Froxlor automatisch einen (z.B.{" "}
              <code>&quot;web1&quot;</code>, <code>&quot;web2&quot;</code>, etc.). Empfohlen wird das Format{" "}
              <code>&quot;VWxxxxx&quot;</code> (z.B. <code>&quot;VW33061&quot;</code>). Die Kundennummer{" "}
              <strong>{customerNumber}</strong> wird als eindeutige Referenz gespeichert.
            </div>
          )}

          {result && (
            <div
              className={`rounded p-3 text-sm ${
                result.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
              }`}
            >
              {result.message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-black px-6 py-2 text-white disabled:opacity-50"
          >
            {submitting
              ? "Speichere..."
              : existingCustomer
              ? "Kunde aktualisieren"
              : "Kunde anlegen"}
          </button>
        </form>
      )}

      {/* Domains Configuration */}
      {existingCustomer && (
        <div className="mt-8 space-y-4 border-t pt-6">
          <h3 className="font-medium">Domains ({allDomains.length})</h3>

          {loadingDomains ? (
            <div className="text-sm text-gray-500">Lade Domains...</div>
          ) : allDomains.length > 0 ? (
            <div className="space-y-3">
              {allDomains.map((domain) => {
                const isStandard = existingCustomer.standardsubdomain && parseInt(domain.id) === parseInt(existingCustomer.standardsubdomain);
                const isExpanded = expandedDomains.has(domain.id);
                const formData = domainFormData[domain.id];

                if (!formData) return null;

                return (
                  <div key={domain.id} className="rounded-lg border">
                    {/* Domain Header - Clickable */}
                    <button
                      type="button"
                      onClick={() => toggleDomain(domain.id)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {isStandard && <span className="text-yellow-500 text-lg">â˜…</span>}
                          <span className="font-medium">{domain.domain}</span>
                          {domain.deactivated === "1" && (
                            <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Deaktiviert</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 space-x-4">
                          <span>PHP: {phpConfigs.find(c => c.id.toString() === domain.phpsettingid)?.description || domain.phpsettingid}</span>
                          <span>SSL: {domain.ssl_redirect === "1" ? "âœ“" : "âœ—"}</span>
                          <span>LE: {domain.letsencrypt === "1" ? "âœ“" : "âœ—"}</span>
                        </div>
                      </div>
                      <div className="ml-4 text-gray-400">
                        {isExpanded ? "â–¼" : "â–¶"}
                      </div>
                    </button>

                    {/* Domain Details - Expandable */}
                    {isExpanded && (
                      <div className="border-t p-4 bg-gray-50">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Document Root / Pfad">
                            <input
                              value={formData.documentroot}
                              onChange={(e) => setDomainFormData({
                                ...domainFormData,
                                [domain.id]: { ...formData, documentroot: e.target.value }
                              })}
                              className="w-full rounded border p-2 text-sm"
                              placeholder="/var/customers/webs/..."
                            />
                          </Field>

                          <Field label="PHP Version">
                            <select
                              value={formData.phpsettingid}
                              onChange={(e) => setDomainFormData({
                                ...domainFormData,
                                [domain.id]: { ...formData, phpsettingid: e.target.value }
                              })}
                              className="w-full rounded border p-2 text-sm"
                            >
                              {phpConfigs.map((config) => (
                                <option key={config.id} value={config.id}>
                                  {config.description}
                                </option>
                              ))}
                            </select>
                          </Field>

                          <Field label="SSL Einstellungen">
                            <div className="space-y-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={formData.ssl_redirect}
                                  onChange={(e) => setDomainFormData({
                                    ...domainFormData,
                                    [domain.id]: { ...formData, ssl_redirect: e.target.checked }
                                  })}
                                  className="rounded border"
                                />
                                <span className="text-sm">SSL Redirect (HTTP -&gt; HTTPS)</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={formData.letsencrypt}
                                  onChange={(e) => setDomainFormData({
                                    ...domainFormData,
                                    [domain.id]: { ...formData, letsencrypt: e.target.checked }
                                  })}
                                  className="rounded border"
                                />
                                <span className="text-sm">Let&apos;s Encrypt aktiviert</span>
                              </label>
                            </div>
                          </Field>
                        </div>

                        <div className="mt-4">
                          <button
                            type="button"
                            onClick={() => handleDomainSubmit(domain.id)}
                            disabled={submittingDomain}
                            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
                          >
                            {submittingDomain ? "Speichere..." : "Domain aktualisieren"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {domainResult && (
                <div
                  className={`rounded p-3 text-sm ${
                    domainResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                  }`}
                >
                  {domainResult.message}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500">Keine Domains gefunden</div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}
