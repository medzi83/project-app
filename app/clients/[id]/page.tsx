import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { FroxlorClient } from "@/lib/froxlor";
import { deriveProjectStatus, labelForProjectStatus } from "@/lib/project-status";

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

type FilmStatus = "BEENDET" | "ONLINE" | "FINALVERSION" | "SCHNITT" | "DREH" | "SKRIPTFREIGABE" | "SKRIPT" | "SCOUTING";

const FILM_STATUS_LABELS: Record<FilmStatus, string> = {
  BEENDET: "Beendet",
  ONLINE: "Online",
  FINALVERSION: "Finalversion",
  SCHNITT: "Schnitt",
  DREH: "Dreh",
  SKRIPTFREIGABE: "Skriptfreigabe",
  SKRIPT: "Skript",
  SCOUTING: "Scouting",
};

const deriveFilmStatus = (film: {
  status?: string | null;
  onlineDate?: Date | string | null;
  finalToClient?: Date | string | null;
  shootDate?: Date | string | null;
  scriptApproved?: Date | string | null;
  scriptToClient?: Date | string | null;
  scouting?: Date | string | null;
}): FilmStatus => {
  // Hierarchie: Beendet > Online > Finalversion > Schnitt > Dreh > Skriptfreigabe > Skript > Scouting
  if (film.status === "BEENDET") return "BEENDET";
  if (film.onlineDate) return "ONLINE";
  if (film.finalToClient) return "FINALVERSION";
  if (isInPast(film.shootDate)) return "SCHNITT";
  if (film.scriptApproved) return "DREH";
  if (film.scriptToClient) return "SKRIPTFREIGABE";
  if (isInPast(film.scouting)) return "SKRIPT";
  return "SCOUTING";
};

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
          film: true,
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

          const froxlorCustomer = await froxlorClient.findCustomerByNumber(client.customerNo);

          if (froxlorCustomer) {
            // Found the customer on this server! Assign it.
            await prisma.client.update({
              where: { id: client.id },
              data: { serverId: server.id },
            });

            console.log(`Auto-assigned server ${server.name} to client ${client.name} (${client.customerNo})`);

            // Reload client with updated server info
          client = await prisma.client.findUnique({
            where: { id },
            include: {
              server: true,
              agency: true,
              projects: {
                include: {
                  website: true,
                  film: true,
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
          console.error(`Error checking server ${server.name} for customer ${client.customerNo}:`, error);
          // Continue with next server
        }
      }
    } catch (error) {
      console.error('Error during automatic server assignment:', error);
      // Continue without server assignment
    }
  }

  // Fetch Froxlor customer data if server is available
  let froxlorCustomer = null;
  let froxlorDomains = [];
  if (
    client.server &&
    client.customerNo &&
    client.server.froxlorUrl &&
    client.server.froxlorApiKey &&
    client.server.froxlorApiSecret
  ) {
    try {
      const froxlorClient = new FroxlorClient({
        url: client.server.froxlorUrl,
        apiKey: client.server.froxlorApiKey,
        apiSecret: client.server.froxlorApiSecret,
      });

      froxlorCustomer = await froxlorClient.findCustomerByNumber(client.customerNo);

      if (froxlorCustomer) {
        froxlorDomains = await froxlorClient.getCustomerDomains(froxlorCustomer.customerid);
      }
    } catch (error) {
      console.error("Error fetching Froxlor data:", error);
    }
  }

  const isAdmin = session.user.role === "ADMIN";

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
        {froxlorDomains.length > 0 && (
          <section className="rounded-lg border bg-white p-4">
            <h2 className="text-base font-medium mb-3">Domains ({froxlorDomains.length})</h2>
            <div className="space-y-2">
              {froxlorDomains.map((domain: any) => {
                const isStandard = froxlorCustomer && parseInt(domain.id) === parseInt(froxlorCustomer.standardsubdomain);
                return (
                  <div key={domain.id} className="rounded border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      {isStandard && <span className="text-yellow-500 text-sm">★</span>}
                      <span className="font-medium text-sm">{domain.domain}</span>
                      {domain.deactivated === "1" && (
                        <Badge variant="destructive" className="text-xs">Deaktiviert</Badge>
                      )}
                    </div>
                    <div className="font-mono text-xs text-gray-600 mb-1">{domain.documentroot}</div>
                    <div className="flex gap-3 text-xs text-gray-500">
                      <span>SSL: {domain.ssl_redirect === "1" ? "✓" : "✗"}</span>
                      <span>LE: {domain.letsencrypt === "1" ? "✓" : "✗"}</span>
                      <span>PHP: {domain.phpsettingid}</span>
                    </div>
                  </div>
                );
              })}
            </div>
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
                let onlineDate: Date | null = null;

                if (project.type === "WEBSITE" && project.website) {
                  const derivedStatus = deriveProjectStatus({
                    pStatus: project.website.pStatus,
                    webDate: project.website.webDate,
                    demoDate: project.website.demoDate,
                    onlineDate: project.website.onlineDate,
                    materialStatus: project.website.materialStatus,
                  });
                  statusLabel = labelForProjectStatus(derivedStatus, { pStatus: project.website.pStatus });

                  // If status is Online and we have an online date, store it
                  if (derivedStatus === "ONLINE" && project.website.onlineDate) {
                    onlineDate = project.website.onlineDate;
                  }
                } else if (project.type === "FILM" && project.film) {
                  const derivedFilmStatus = deriveFilmStatus({
                    status: project.film.status,
                    onlineDate: project.film.onlineDate,
                    finalToClient: project.film.finalToClient,
                    shootDate: project.film.shootDate,
                    scriptApproved: project.film.scriptApproved,
                    scriptToClient: project.film.scriptToClient,
                    scouting: project.film.scouting,
                  });
                  statusLabel = FILM_STATUS_LABELS[derivedFilmStatus];

                  // If status is Online and we have an online date, store it
                  if (derivedFilmStatus === "ONLINE" && project.film.onlineDate) {
                    onlineDate = project.film.onlineDate;
                  }
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
                            {onlineDate && ` (seit ${formatDateOnly(onlineDate)})`}
                          </Badge>
                          {project.website && project.website.domain && (
                            <span className="text-xs text-gray-500">{project.website.domain}</span>
                          )}
                        </div>
                      </div>
                      <Link
                        href={`/projects/${project.id}`}
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
    </div>
  );
}
