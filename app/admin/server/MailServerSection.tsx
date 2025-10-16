"use client";

import { useState } from "react";
import { TestMailButton } from "./TestMailButton";

type Agency = {
  id: string;
  name: string;
};

type MailServer = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  fromEmail: string;
  fromName: string | null;
  useTls: boolean;
  agencyId: string | null;
  notes: string | null;
  agency: Agency | null;
};

type MailServerSectionProps = {
  mailServers: MailServer[];
  agencies: Agency[];
  mailError: string | undefined;
  mailOk: boolean;
  updateMailServer: (formData: FormData) => void;
  deleteMailServer: (formData: FormData) => void;
  createMailServer: (formData: FormData) => void;
};

export function MailServerSection({
  mailServers,
  agencies,
  mailError,
  mailOk,
  updateMailServer,
  deleteMailServer,
  createMailServer,
}: MailServerSectionProps) {
  const [activeTab, setActiveTab] = useState<string | null>(
    mailServers.length > 0 ? mailServers[0].id : null
  );

  const activeMailServer = mailServers.find((m) => m.id === activeTab);

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Mailserver</h2>
          <p className="text-sm text-gray-500">Hinterlege SMTP-Zugänge und ordne sie Agenturen zu.</p>
          {mailOk && <p className="text-sm text-green-600">Mailserver gespeichert.</p>}
        </div>
        <details className="relative" open={Boolean(mailError)}>
          <summary className="cursor-pointer rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-black/90">
            Mailserver hinzufügen
          </summary>
          <div className="absolute right-0 mt-2 w-[380px] space-y-4 rounded-lg border bg-white p-4 shadow-lg z-10">
            {mailError && <p className="text-sm text-red-600">{mailError}</p>}
            <form action={createMailServer} className="space-y-3">
              <Field label="Bezeichnung *">
                <input name="name" required className="w-full rounded border p-2 text-sm" placeholder="Standard SMTP" />
              </Field>
              <Field label="Absender-E-Mail *">
                <input name="fromEmail" type="email" required className="w-full rounded border p-2 text-sm" placeholder="mail@example.de" />
              </Field>
              <Field label="Absendername">
                <input name="fromName" className="w-full rounded border p-2 text-sm" placeholder="Eventomaxx Team" />
              </Field>
              <Field label="SMTP-Host *">
                <input name="host" required className="w-full rounded border p-2 text-sm" placeholder="smtp.example.de" />
              </Field>
              <div className="grid grid-cols-[1fr_140px] gap-3">
                <Field label="Port *">
                  <input name="port" type="number" min={1} max={65535} defaultValue={587} className="w-full rounded border p-2 text-sm" />
                </Field>
                <Field label="Verschlüsselung">
                  <select name="useTls" defaultValue="yes" className="w-full rounded border p-2 text-sm">
                    <option value="yes">TLS / STARTTLS</option>
                    <option value="no">Keine Verschlüsselung</option>
                  </select>
                </Field>
              </div>
              <Field label="Benutzername">
                <input name="username" className="w-full rounded border p-2 text-sm" placeholder="smtp-user" />
              </Field>
              <Field label="Passwort">
                <input name="password" type="password" className="w-full rounded border p-2 text-sm" placeholder="SMTP-Passwort" />
              </Field>
              <Field label="Agentur">
                <select name="agencyId" className="w-full rounded border p-2 text-sm">
                  <option value="">Alle Agenturen</option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agency.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Notizen">
                <textarea name="notes" rows={2} className="w-full rounded border p-2 text-sm" placeholder="z. B. Ansprechpartner oder Besonderheiten" />
              </Field>
              <button type="submit" className="w-full rounded bg-black px-4 py-2 text-sm font-medium text-white">Speichern</button>
            </form>
          </div>
        </details>
      </div>

      {mailServers.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-gray-500">Noch keine Mailserver hinterlegt.</p>
          <p className="text-sm text-gray-400 mt-1">Klicken Sie auf &quot;Mailserver hinzufügen&quot;, um einen neuen Mailserver anzulegen.</p>
        </div>
      ) : (
        <>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <div className="flex gap-1 overflow-x-auto">
              {mailServers.map((mail) => (
                <button
                  key={mail.id}
                  onClick={() => setActiveTab(mail.id)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === mail.id
                      ? "border-black text-black"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {mail.name}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeMailServer && (
            <div key={activeMailServer.id} className="rounded-lg border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">BEZEICHNUNG</label>
                  <input
                    form={`update-form-${activeMailServer.id}`}
                    name="name"
                    defaultValue={activeMailServer.name}
                    className="text-lg font-semibold border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-black focus:outline-none px-0 py-1 w-full max-w-md"
                    placeholder="Mailserver-Name"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <TestMailButton
                    mailServerId={activeMailServer.id}
                    host={activeMailServer.host}
                    port={activeMailServer.port}
                    fromEmail={activeMailServer.fromEmail}
                    fromName={activeMailServer.fromName}
                    username={activeMailServer.username}
                    useTls={activeMailServer.useTls}
                  />
                  <button
                    form={`update-form-${activeMailServer.id}`}
                    type="submit"
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90 transition-colors"
                  >
                    Speichern
                  </button>
                  <form action={deleteMailServer} className="inline">
                    <input type="hidden" name="id" value={activeMailServer.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                      onClick={(e) => {
                        if (!confirm(`Möchten Sie den Mailserver "${activeMailServer.name}" wirklich löschen?`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Löschen
                    </button>
                  </form>
                </div>
              </div>

              <form id={`update-form-${activeMailServer.id}`} action={updateMailServer}>
                <input type="hidden" name="id" value={activeMailServer.id} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Linke Spalte */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Absender-Name
                      </label>
                      <input
                        form={`update-form-${activeMailServer.id}`}
                        name="fromName"
                        defaultValue={activeMailServer.fromName ?? ""}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none"
                        placeholder="z.B. Eventomaxx Team"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Absender-E-Mail *
                      </label>
                      <input
                        form={`update-form-${activeMailServer.id}`}
                        name="fromEmail"
                        type="email"
                        required
                        defaultValue={activeMailServer.fromEmail}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none"
                        placeholder="mail@example.de"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        SMTP-Host *
                      </label>
                      <input
                        form={`update-form-${activeMailServer.id}`}
                        name="host"
                        required
                        defaultValue={activeMailServer.host}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none"
                        placeholder="smtp.example.de"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Port *
                        </label>
                        <input
                          form={`update-form-${activeMailServer.id}`}
                          name="port"
                          type="number"
                          min={1}
                          max={65535}
                          required
                          defaultValue={activeMailServer.port}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Verschlüsselung
                        </label>
                        <select
                          form={`update-form-${activeMailServer.id}`}
                          name="useTls"
                          defaultValue={activeMailServer.useTls ? "yes" : "no"}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none"
                        >
                          <option value="yes">TLS / STARTTLS</option>
                          <option value="no">Keine</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Rechte Spalte */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Benutzername
                      </label>
                      <input
                        form={`update-form-${activeMailServer.id}`}
                        name="username"
                        defaultValue={activeMailServer.username ?? ""}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none"
                        placeholder="SMTP-Benutzername"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Passwort
                      </label>
                      <input
                        form={`update-form-${activeMailServer.id}`}
                        name="password"
                        type="password"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none"
                        placeholder="••••••••"
                      />
                      <p className="mt-1 text-xs text-gray-500">Leer lassen, um bestehendes Passwort beizubehalten</p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Agentur
                      </label>
                      <select
                        form={`update-form-${activeMailServer.id}`}
                        name="agencyId"
                        defaultValue={activeMailServer.agencyId ?? ""}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none"
                      >
                        <option value="">Alle Agenturen</option>
                        {agencies.map((agency) => (
                          <option key={agency.id} value={agency.id}>
                            {agency.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Notizen
                      </label>
                      <textarea
                        form={`update-form-${activeMailServer.id}`}
                        name="notes"
                        rows={3}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-black focus:ring-1 focus:ring-black focus:outline-none resize-none"
                        placeholder="z. B. Ansprechpartner oder Besonderheiten"
                        defaultValue={activeMailServer.notes ?? ""}
                      />
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </section>
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
