import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FroxlorClient } from "@/lib/froxlor";
import type { FroxlorCustomer, FroxlorDomain } from "@/lib/froxlor";
import { deriveProjectStatus, labelForProjectStatus } from "@/lib/project-status";
import type { ProjectStatus, ProjectType } from "@prisma/client";
import { EmailLogItem } from "@/components/EmailLogItem";
import { deriveFilmStatus, getFilmStatusDate, FILM_STATUS_LABELS } from "@/lib/film-status";

type Props = {
  params: Promise<{ id: string }>;
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return "-";
  }
};

const formatDateOnly = (value?: Date | string | null) => {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "medium"
    }).format(new Date(value));
  } catch {
    return "-";
  }
};

const isInPast = (value?: Date | string | null) => {
  if (!value) return false;
  try {
    const date = new Date(value);
    return date.getTime() < Date.now();
  } catch {
    return false;
  }
};

// FilmStatus logic is now centralized in lib/film-status.ts

const toDate = (value?: Date | string | null) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getWebsiteStatusDate = (
  status: ProjectStatus,
  website?: {
    webDate?: Date | string | null;
    demoDate?: Date | string | null;
    onlineDate?: Date | string | null;
    lastMaterialAt?: Date | string | null;
  },
) => {
  if (!website) return null;
  switch (status) {
    case "WEBTERMIN":
      return toDate(website.webDate);
    case "MATERIAL":
    case "UMSETZUNG":
      return toDate(website.lastMaterialAt) ?? toDate(website.webDate);
    case "DEMO":
      return (
        toDate(website.demoDate) ??
        toDate(website.lastMaterialAt) ??
        toDate(website.webDate)
      );
    case "ONLINE":
      return toDate(website.onlineDate);
    default:
      return null;
  }
};

// getFilmStatusDate is now centralized in lib/film-status.ts

export default async function ClientDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const { id } = await params;

  let client = await prisma.client.findUnique({
    where: { id },
    include: {
      server: true,
      agency: true,
      projects: {
        include: {
          website: true,
          film: {
            include: {
              previewVersions: {
                select: {
                  sentDate: true,
                  version: true,
                },
                orderBy: {
                  sentDate: "desc",
                },
                take: 1,
              },
            },
          },
          emailLogs: {
            orderBy: { sentAt: "desc" },
            take: 50,
            include: {
              trigger: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!client) {
    notFound();
  }

  // Automatic server assignment if no server is assigned yet
  if (!client.serverId && client.customerNo) {
    // Store customer info before async operations (for type narrowing)
    const customerNo = client.customerNo;
    const clientId = client.id;
    const clientName = client.name;

    try {
      // Get all servers with valid Froxlor credentials
      const servers = await prisma.server.findMany({
        where: {
          froxlorUrl: { not: null },
          froxlorApiKey: { not: null },
          froxlorApiSecret: { not: null },
        },
      });

      // Search for customer on each server
      for (const server of servers) {
        if (!server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
          continue;
        }

        try {
          const froxlorClient = new FroxlorClient({
            url: server.froxlorUrl,
            apiKey: server.froxlorApiKey,
            apiSecret: server.froxlorApiSecret,
          });

          const froxlorCustomer = await froxlorClient.findCustomerByNumber(customerNo ?? "");

          if (froxlorCustomer) {
            // Found the customer on this server! Assign it.
            await prisma.client.update({
              where: { id: clientId },
              data: { serverId: server.id },
            });

            console.log(`Auto-assigned server ${server.name} to client ${clientName} (${customerNo})`);

            // Reload client with updated server info
          client = await prisma.client.findUnique({
            where: { id },
            include: {
              server: true,
              agency: true,
              projects: {
                include: {
                  website: true,
                  film: {
                    include: {
                      previewVersions: {
                        select: {
                          sentDate: true,
                          version: true,
                        },
                        orderBy: {
                          sentDate: "desc",
                        },
                        take: 1,
                      },
                    },
                  },
                  emailLogs: {
                    orderBy: { sentAt: "desc" },
                    take: 50,
                    include: {
                      trigger: {
                        select: {
                          name: true,
                        },
                      },
                    },
                  },
                },
                  orderBy: { createdAt: "desc" },
                },
              },
            });

            if (!client) {
              notFound();
            }

            break; // Stop searching after finding the first match
          }
        } catch (error) {
          console.error(`Error checking server ${server.name} for customer ${customerNo}:`, error);
          // Continue with next server
        }
      }
    } catch (error) {
      console.error('Error during automatic server assignment:', error);
      // Continue without server assignment
    }
  }

  // Ensure client is still valid (TypeScript type narrowing)
  if (!client) {
    notFound();
  }

  const canFetchFroxlor =
    !!(
      client.server &&
      client.customerNo &&
      client.server.froxlorUrl &&
      client.server.froxlorApiKey &&
      client.server.froxlorApiSecret
    );

  // Fetch Froxlor customer data if server is available
  let froxlorCustomer: FroxlorCustomer | null = null;
  let froxlorDomains: FroxlorDomain[] = [];
  let froxlorError: string | null = null;

  if (canFetchFroxlor && client.server?.froxlorUrl && client.server?.froxlorApiKey && client.server?.froxlorApiSecret) {
    try {
      const froxlorClient = new FroxlorClient({
        url: client.server.froxlorUrl,
        apiKey: client.server.froxlorApiKey,
        apiSecret: client.server.froxlorApiSecret,
      });

      if (client.customerNo) {
        froxlorCustomer = await froxlorClient.findCustomerByNumber(client.customerNo);
      }

      if (froxlorCustomer) {
        froxlorDomains = await froxlorClient.getCustomerDomains(froxlorCustomer.customerid);
      } else {
        froxlorError = `Kunde ${client.customerNo} wurde auf dem Froxlor-Server nicht gefunden.`;
      }
    } catch (error) {
      console.error("Error fetching Froxlor data:", error);
      froxlorError =
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler beim Abrufen der Froxlor-Daten.";
    }
  }

  const isAdmin = session.user.role === "ADMIN";

  // Collect all email logs from all projects
  const allEmailLogs = client.projects.flatMap((project) =>
    project.emailLogs.map((log) => ({
      ...log,
      projectTitle: project.title,
      projectId: project.id,
      projectType: project.type,
    }))
  ).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  // Group email logs by project type
  const emailLogsByType: Record<ProjectType, typeof allEmailLogs> = {
    WEBSITE: allEmailLogs.filter((log) => log.projectType === "WEBSITE"),
    FILM: allEmailLogs.filter((log) => log.projectType === "FILM"),
    SOCIAL: allEmailLogs.filter((log) => log.projectType === "SOCIAL"),
  };

  // TODO: Add general emails (emails without project) when feature is implemented
  const generalEmails: typeof allEmailLogs = [];

  return (
    <div className="space-y-6">
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
        {isAdmin && (
          <Link
            href={`/clients/${client.id}/edit`}
            className="rounded bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
          >
            Bearbeiten
          </Link>
        )}
      </header>

      {/* Basic Information */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-base font-medium mb-3">Basisdaten</h2>
        <div className="grid gap-3 md:grid-cols-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">Kontaktperson</div>
            <div>{client.contact || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">E-Mail</div>
            <div>
              {client.email ? (
                <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">
                  {client.email}
                </a>
              ) : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Telefon</div>
            <div>
              {client.phone ? (
                <a href={`tel:${client.phone.replace(/[^+0-9]/g, "")}`} className="text-blue-600 hover:underline">
                  {client.phone}
                </a>
              ) : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Server</div>
            <div>
              {client.server ? (
                <Badge variant="outline" className="font-mono text-xs">
                  {client.server.hostname || client.server.name}
                </Badge>
              ) : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Angelegt</div>
            <div className="text-xs">{formatDate(client.createdAt)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Arbeitsstopp</div>
            <div>
              {client.workStopped ? (
                <Badge variant="destructive" className="text-xs">Ja</Badge>
              ) : (
                <span className="text-gray-600">Nein</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Beendet</div>
            <div>
              {client.finished ? (
                <Badge className="bg-gray-600 hover:bg-gray-700 text-xs">Ja</Badge>
              ) : (
                <span className="text-gray-600">Nein</span>
              )}
            </div>
          </div>
          {client.notes && (
            <div className="md:col-span-4">
              <div className="text-xs text-gray-500">Notizen</div>
              <div className="text-sm whitespace-pre-wrap">{client.notes}</div>
            </div>
          )}
        </div>
      </section>

      {/* Froxlor Customer Data */}
      {froxlorCustomer && (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-base font-medium mb-3">Froxlor Kundendaten</h2>
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            <div>
              <div className="text-xs text-gray-500">Login</div>
              <div className="font-mono text-xs">{froxlorCustomer.loginname}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Name</div>
              <div>{froxlorCustomer.firstname} {froxlorCustomer.name}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Firma</div>
              <div>{froxlorCustomer.company || "-"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div>
                {froxlorCustomer.deactivated === 1 ? (
                  <Badge variant="destructive" className="text-xs">Deaktiviert</Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200 text-xs">Aktiv</Badge>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Speicher</div>
              <div>
                {froxlorCustomer.diskspace
                  ? `${Math.round(parseInt(froxlorCustomer.diskspace) / 1024 / 1024)} GB`
                  : "-"}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">MySQL DB</div>
              <div>{froxlorCustomer.mysqls || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">FTP</div>
              <div>{froxlorCustomer.ftps || 0}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">E-Mail</div>
              <div className="text-xs">{froxlorCustomer.email}</div>
            </div>
            <div className="md:col-span-4">
              <div className="text-xs text-gray-500">Document Root</div>
              <div className="font-mono text-xs">{froxlorCustomer.documentroot || "-"}</div>
            </div>
          </div>

          {isAdmin && client.server && (
            <div className="mt-3 pt-3 border-t">
              <Link
                href={`/admin/basisinstallation?server=${client.server.id}&customer=${client.customerNo}`}
                className="text-blue-600 hover:underline text-xs"
              >
                → Neue Demo installieren
              </Link>
            </div>
          )}
        </section>
      )}

      {/* Domains and Projects Side by Side */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Domains */}
        {(canFetchFroxlor || froxlorError) && (
          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-base font-medium mb-3">
              Domains
              {froxlorDomains.length > 0 && <span> ({froxlorDomains.length})</span>}
            </h2>

            {froxlorError && (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {froxlorError}
              </div>
            )}

            {!froxlorError && froxlorDomains.length === 0 && (
              <p className="text-sm text-gray-500">Keine Domains fuer diesen Kunden vorhanden.</p>
            )}

            {!froxlorError && froxlorDomains.length > 0 && (
              <div className="space-y-2">
                {froxlorDomains.map((domain) => {
                  const isStandard =
                    froxlorCustomer?.standardsubdomain != null
                      ? Number.parseInt(domain.id, 10) === Number.parseInt(froxlorCustomer.standardsubdomain, 10)
                      : false;
                  return (
                    <div key={domain.id} className="rounded border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        {isStandard && (
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                            Standard
                          </Badge>
                        )}
                        <span className="font-medium text-sm">{domain.domain}</span>
                        {domain.deactivated === "1" && (
                          <Badge variant="destructive" className="text-xs">Deaktiviert</Badge>
                        )}
                      </div>
                      <div className="font-mono text-xs text-gray-600 mb-1">{domain.documentroot}</div>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>SSL: {domain.ssl_redirect === "1" ? "Ja" : "Nein"}</span>
                        <span>LE: {domain.letsencrypt === "1" ? "Ja" : "Nein"}</span>
                        <span>PHP: {domain.phpsettingid}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
        {/* Projects */}
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-base font-medium mb-3">Projekte ({client.projects.length})</h2>
          {client.projects.length === 0 ? (
            <p className="text-sm text-gray-500">Keine Projekte vorhanden.</p>
          ) : (
            <div className="space-y-2">
              {client.projects.map((project) => {
                const typeLabel = project.type === "WEBSITE" ? "Webseite"
                  : project.type === "FILM" ? "Film"
                  : project.type === "SOCIAL" ? "Social Media"
                  : project.type;

                // Use derived status for website and film projects
                let statusLabel: string;
                let statusDate: Date | null = null;

                if (project.type === "WEBSITE" && project.website) {
                  const derivedStatus = deriveProjectStatus({
                    pStatus: project.website.pStatus,
                    webDate: project.website.webDate,
                    demoDate: project.website.demoDate,
                    onlineDate: project.website.onlineDate,
                    materialStatus: project.website.materialStatus,
                  });
                  statusLabel = labelForProjectStatus(derivedStatus, { pStatus: project.website.pStatus });
                  statusDate = getWebsiteStatusDate(derivedStatus, project.website);
                } else if (project.type === "FILM" && project.film) {
                  const derivedFilmStatus = deriveFilmStatus(project.film);
                  statusLabel = FILM_STATUS_LABELS[derivedFilmStatus];
                  statusDate = getFilmStatusDate(derivedFilmStatus, project.film);
                } else {
                  statusLabel = project.status === "WEBTERMIN" ? "Webtermin"
                    : project.status === "MATERIAL" ? "Material"
                    : project.status === "UMSETZUNG" ? "Umsetzung"
                    : project.status === "DEMO" ? "Demo"
                    : project.status === "ONLINE" ? "Online"
                    : project.status;
                }

                return (
                  <div key={project.id} className="rounded border p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{project.title}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {typeLabel}: {statusLabel}
                            {statusDate && ` (seit ${formatDateOnly(statusDate)})`}
                          </Badge>
                          {project.website && project.website.domain && (
                            <span className="text-xs text-gray-500">{project.website.domain}</span>
                          )}
                        </div>
                      </div>
                      <Link
                        href={project.type === "FILM" ? `/film-projects/${project.id}` : `/projects/${project.id}`}
                        className="text-blue-600 hover:underline text-xs whitespace-nowrap ml-3"
                      >
                        Details →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Email Logs */}
      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-base font-medium mb-3">
          Versendete E-Mails ({allEmailLogs.length})
        </h2>
        {allEmailLogs.length === 0 && generalEmails.length === 0 ? (
          <p className="text-sm text-gray-500">Noch keine E-Mails an diesen Kunden versendet.</p>
        ) : (
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">
                Allgemein ({generalEmails.length})
              </TabsTrigger>
              <TabsTrigger value="WEBSITE">
                Webseite ({emailLogsByType.WEBSITE.length})
              </TabsTrigger>
              <TabsTrigger value="FILM">
                Film ({emailLogsByType.FILM.length})
              </TabsTrigger>
              <TabsTrigger value="SOCIAL">
                Social Media ({emailLogsByType.SOCIAL.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4">
              {generalEmails.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Keine allgemeinen E-Mails (ohne Projektbezug) vorhanden.
                </p>
              ) : (
                <div className="space-y-2">
                  {generalEmails.map((log) => (
                    <EmailLogItem key={log.id} log={log} isAdmin={isAdmin} />
                  ))}
                </div>
              )}
            </TabsContent>

            {(["WEBSITE", "FILM", "SOCIAL"] as const).map((type) => (
              <TabsContent key={type} value={type} className="mt-4">
                {emailLogsByType[type].length === 0 ? (
                  <p className="text-sm text-gray-500">Keine E-Mails für diesen Projekttyp.</p>
                ) : (
                  <div className="space-y-2">
                    {emailLogsByType[type].map((log) => (
                      <EmailLogItem key={log.id} log={log} isAdmin={isAdmin} />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </section>
    </div>
  );
}


