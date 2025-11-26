import type { ReactNode } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import { createAgency, updateAgency, deleteAgency } from "./actions";
import AgencyLogoUpload from "./AgencyLogoUpload";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const formatDate = (value: Date) =>
  new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(value);

const readParam = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

export default async function AgenciesAdminPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const successMessage = readParam(params.success);
  const errorMessage = readParam(params.error);
  const warningMessage = readParam(params.warning);

  const agencies = await prisma.agency.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      street: true,
      postalCode: true,
      city: true,
      country: true,
      website: true,
      notes: true,
      logoPath: true,
      logoIconPath: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { clients: true },
      },
    },
  });

  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Agenturverwaltung</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Verwalte Agenturen mit Kontakt- und Adressdaten, lade Logos für Dokumente oder E-Mails hoch und halte Organisationsinformationen aktuell.
        </p>
        <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc pl-5 space-y-1">
          <li>Kunden können zukünftig Agenturen zugeordnet werden, wodurch Projekte automatisch gefiltert werden können.</li>
          <li>Je Agentur kann später eine eigene E-Mail-Signatur gepflegt werden.</li>
        </ul>
        {successMessage && <Alert tone="success">{successMessage}</Alert>}
        {warningMessage && <Alert tone="warning">{warningMessage}</Alert>}
        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
      </header>

      <section className="rounded-2xl border border-green-100 dark:border-green-900/50 bg-white dark:bg-gray-900 shadow-lg overflow-hidden">
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-b border-green-100 dark:border-green-900/50">
            <div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-green-700 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">Neue Agentur anlegen</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Name ist Pflicht, alle weiteren Angaben sind optional und können später angepasst werden.</p>
            </div>
            <span className="text-xs text-green-600 dark:text-green-400 font-medium group-open:hidden">Formular öffnen →</span>
            <span className="text-xs text-green-600 dark:text-green-400 font-medium hidden group-open:inline">Formular schließen ↑</span>
          </summary>

          <form action={createAgency} className="space-y-4 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name *">
                <input name="name" required className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 transition-all" placeholder="z. B. Muster Media GmbH" />
              </Field>
              <Field label="Kontaktperson">
                <input name="contactName" className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 transition-all" placeholder="z. B. Max Beispiel" />
              </Field>
              <Field label="Kontakt E-Mail">
                <input name="contactEmail" type="email" className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 transition-all" placeholder="kontakt@example.com" />
              </Field>
              <Field label="Kontakt Telefon">
                <input name="contactPhone" className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 transition-all" placeholder="+49 ..." />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Straße und Hausnummer">
                <input name="street" className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 transition-all" placeholder="Hauptstraße 1" />
              </Field>
              <div className="grid grid-cols-[120px_1fr] gap-4">
                <Field label="PLZ">
                  <input name="postalCode" className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 transition-all" placeholder="12345" />
                </Field>
                <Field label="Ort">
                  <input name="city" className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 transition-all" placeholder="Berlin" />
                </Field>
              </div>
              <Field label="Land">
                <input name="country" className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 transition-all" placeholder="Deutschland" />
              </Field>
              <Field label="Webseite">
                <input name="website" className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 transition-all" placeholder="https://example.de" />
              </Field>
            </div>

            <Field label="Notizen">
              <textarea name="notes" rows={3} className="w-full rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-green-500 dark:focus:border-green-400 focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 transition-all" placeholder="Interne Hinweise" />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Haupt-Logo hochladen">
                <input name="logo" type="file" accept=".png,.jpg,.jpeg,.svg,.webp" className="w-full text-sm text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 dark:file:bg-green-900/30 file:text-green-700 dark:file:text-green-300 hover:file:bg-green-100 dark:hover:file:bg-green-900/50" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PNG, JPG, SVG oder WEBP (max. 5 MB)</p>
              </Field>
              <Field label="Icon/Favicon hochladen">
                <input name="logoIcon" type="file" accept=".png,.jpg,.jpeg,.svg,.webp" className="w-full text-sm text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 dark:file:bg-emerald-900/30 file:text-emerald-700 dark:file:text-emerald-300 hover:file:bg-emerald-100 dark:hover:file:bg-emerald-900/50" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Quadratisch, 64x64px oder größer</p>
              </Field>
            </div>

            <div className="flex justify-end border-t dark:border-gray-700 pt-4">
              <button type="submit" className="rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all active:scale-95">
                Agentur speichern
              </button>
            </div>
          </form>
        </details>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Bestehende Agenturen</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">{agencies.length} Eintraege</span>
        </div>

        {agencies.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Noch keine Agenturen angelegt.</p>
        ) : (
          <div className="space-y-4">
            {agencies.map((agency) => (
              <article key={agency.id} className="overflow-hidden rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
                <div className="flex flex-col gap-4 border-b dark:border-gray-700 p-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{agency.name}</h3>
                      {agency.logoIconPath && (
                        <Image
                          src={agency.logoIconPath}
                          alt={`Icon ${agency.name}`}
                          width={24}
                          height={24}
                          className="h-6 w-6 object-contain rounded"
                          unoptimized
                        />
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Aktualisiert am {formatDate(agency.updatedAt)} - Kunden: {agency._count.clients}
                    </div>
                    {agency.notes && <p className="text-sm text-gray-600 dark:text-gray-400">{agency.notes}</p>}
                    <dl className="grid gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400 md:grid-cols-2 lg:grid-cols-3">
                      {agency.contactName && (
                        <>
                          <dt className="font-medium">Kontakt</dt>
                          <dd>{agency.contactName}</dd>
                        </>
                      )}
                      {agency.contactEmail && (
                        <>
                          <dt className="font-medium">E-Mail</dt>
                          <dd>
                            <a href={`mailto:${agency.contactEmail}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                              {agency.contactEmail}
                            </a>
                          </dd>
                        </>
                      )}
                      {agency.contactPhone && (
                        <>
                          <dt className="font-medium">Telefon</dt>
                          <dd>{agency.contactPhone}</dd>
                        </>
                      )}
                      {(agency.street || agency.city) && (
                        <>
                          <dt className="font-medium">Adresse</dt>
                          <dd>
                            {[agency.street, [agency.postalCode, agency.city].filter(Boolean).join(" "), agency.country]
                              .filter(Boolean)
                              .join(", ")}
                          </dd>
                        </>
                      )}
                      {agency.website && (
                        <>
                          <dt className="font-medium">Website</dt>
                          <dd>
                            <a href={agency.website} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                              {agency.website.replace(/^https?:\/\//, "")}
                            </a>
                          </dd>
                        </>
                      )}
                    </dl>
                  </div>
                  {agency.logoPath && (
                    <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-950/30 p-3 shadow-sm max-w-[300px]">
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase">Logo</span>
                      <Image
                        src={agency.logoPath}
                        alt={`Logo ${agency.name}`}
                        width={200}
                        height={96}
                        className="max-h-24 w-auto object-contain"
                        unoptimized
                      />
                    </div>
                  )}
                </div>

                <details className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span>Agentur bearbeiten</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Formular oeffnen</span>
                  </summary>
                  <div className="space-y-4 border-t dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                    <form action={updateAgency} className="space-y-4">
                      <input type="hidden" name="agencyId" value={agency.id} />
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Name *">
                          <input name="name" defaultValue={agency.name} required className="w-full rounded border dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
                        </Field>
                        <Field label="Kontaktperson">
                          <input name="contactName" defaultValue={agency.contactName ?? ""} className="w-full rounded border dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
                        </Field>
                        <Field label="Kontakt E-Mail">
                          <input name="contactEmail" type="email" defaultValue={agency.contactEmail ?? ""} className="w-full rounded border dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
                        </Field>
                        <Field label="Kontakt Telefon">
                          <input name="contactPhone" defaultValue={agency.contactPhone ?? ""} className="w-full rounded border dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
                        </Field>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Straße">
                          <input name="street" defaultValue={agency.street ?? ""} className="w-full rounded border dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
                        </Field>
                        <div className="grid grid-cols-[120px_1fr] gap-4">
                          <Field label="PLZ">
                            <input name="postalCode" defaultValue={agency.postalCode ?? ""} className="w-full rounded border dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
                          </Field>
                          <Field label="Ort">
                            <input name="city" defaultValue={agency.city ?? ""} className="w-full rounded border dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
                          </Field>
                        </div>
                        <Field label="Land">
                          <input name="country" defaultValue={agency.country ?? ""} className="w-full rounded border dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
                        </Field>
                        <Field label="Webseite">
                          <input name="website" defaultValue={agency.website ?? ""} className="w-full rounded border dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
                        </Field>
                      </div>

                      <Field label="Notizen">
                        <textarea name="notes" defaultValue={agency.notes ?? ""} rows={3} className="w-full rounded border dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100" />
                      </Field>

                      <div className="flex justify-end border-t dark:border-gray-700 pt-4">
                        <button type="submit" className="rounded bg-black dark:bg-white px-4 py-2 text-sm font-medium text-white dark:text-black hover:bg-black/90 dark:hover:bg-gray-200">
                          Änderungen speichern
                        </button>
                      </div>
                    </form>

                    <div className="border-t dark:border-gray-700 pt-6">
                      <h4 className="text-base font-semibold mb-4 text-gray-900 dark:text-gray-100">Logo-Verwaltung</h4>
                      <AgencyLogoUpload
                        agencyId={agency.id}
                        agencyName={agency.name}
                        currentLogoPath={agency.logoPath}
                        currentLogoIconPath={agency.logoIconPath}
                      />
                    </div>

                    <form action={deleteAgency} className="flex justify-end border-t dark:border-gray-700 pt-4">
                      <input type="hidden" name="agencyId" value={agency.id} />
                      <ConfirmSubmit
                        confirmText="Diese Agentur wirklich löschen? Kunden müssen vorher umgezogen oder gelöst werden."
                        className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
                      >
                        Agentur löschen
                      </ConfirmSubmit>
                    </form>
                  </div>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function Alert({ tone, children }: { tone: "success" | "warning" | "error"; children: ReactNode }) {
  const toneStyles =
    tone === "success"
      ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-300"
      : tone === "warning"
      ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300"
      : "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 text-red-800 dark:text-red-300";
  return (
    <div className={`rounded border px-3 py-2 text-sm ${toneStyles}`}>
      {children}
    </div>
  );
}
