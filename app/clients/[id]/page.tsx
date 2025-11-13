import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FroxlorClient } from "@/lib/froxlor";
import type { FroxlorCustomer, FroxlorDomain, FroxlorFtpAccount } from "@/lib/froxlor";
import { deriveProjectStatus, labelForProjectStatus, getProjectDisplayName } from "@/lib/project-status";
import type { ProjectStatus, ProjectType } from "@prisma/client";
import { EmailLogItem } from "@/components/EmailLogItem";
import { deriveFilmStatus, getFilmStatusDate, FILM_STATUS_LABELS } from "@/lib/film-status";
import { ClientStatusToggles } from "@/components/ClientStatusToggles";
import { InstallationProjectAssignment } from "./InstallationProjectAssignment";
import { ClientDetailHeader } from "@/components/ClientDetailHeader";
import { FroxlorDataEditor } from "./FroxlorDataEditor";
import { ClientDataEditor } from "./ClientDataEditor";
import { ProjectDomainAssignment } from "./ProjectDomainAssignment";
import { FtpPasswordEditor } from "./FtpPasswordEditor";
import { DomainProjectAssignment } from "./DomainProjectAssignment";
import { DeleteInstallationButton } from "./DeleteInstallationButton";
import { isFavoriteClient } from "@/app/actions/favorites";

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

  const [clientResult, servers, agencies] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        server: true,
        agency: true,
        joomlaInstallations: {
          include: {
            server: {
              select: {
                name: true,
                ip: true,
              },
            },
            project: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
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
        emailLogs: {
          where: {
            projectId: null,
          },
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
    }),
    prisma.server.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.agency.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  let client = clientResult;

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

            // Reload client with updated server info
          client = await prisma.client.findUnique({
            where: { id },
            include: {
              server: true,
              agency: true,
              joomlaInstallations: {
                include: {
                  server: {
                    select: {
                      name: true,
                      ip: true,
                    },
                  },
                  project: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: "desc",
                },
              },
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
              emailLogs: {
                where: {
                  projectId: null,
                },
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
          });

            if (!client) {
              notFound();
            }

            break; // Stop searching after finding the first match
          }
        } catch (error) {
          // Only log non-credential errors
          // Credential errors (invalid API keys) are expected when servers are misconfigured
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes('Invalid request header') &&
              !errorMessage.includes('API credentials') &&
              !errorMessage.includes('API key and secret')) {
            console.error(`Error checking server ${server.name} for customer ${customerNo}:`, error);
          }
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

  // Check if Froxlor configuration exists (for UI display)
  const hasFroxlorConfig = !!(
    client.server &&
    client.customerNo &&
    client.server.froxlorUrl &&
    client.server.froxlorApiKey &&
    client.server.froxlorApiSecret
  );

  // Only fetch from Froxlor API if explicitly enabled
  const canFetchFroxlor = process.env.ENABLE_FROXLOR_FETCH === "true" && hasFroxlorConfig;

  // Fetch Froxlor customer data if server is available
  let froxlorCustomer: FroxlorCustomer | null = null;
  let froxlorDomains: FroxlorDomain[] = [];
  let froxlorFtpAccounts: FroxlorFtpAccount[] = [];
  let froxlorPhpConfigs: Record<string, string> = {}; // Map of phpsettingid -> description
  let froxlorError: string | null = null;

  // Set error message if Froxlor is configured but API fetch is disabled
  if (hasFroxlorConfig && !canFetchFroxlor) {
    froxlorError = "Froxlor-API-Zugriff ist deaktiviert (ENABLE_FROXLOR_FETCH=false). Keine Live-Daten verfügbar.";
  }

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
        froxlorFtpAccounts = await froxlorClient.getCustomerFtpAccounts(froxlorCustomer.customerid);

        // Load PHP configurations
        const phpConfigs = await froxlorClient.getPhpConfigs();
        froxlorPhpConfigs = phpConfigs.reduce((acc, config) => {
          acc[config.id.toString()] = config.description;
          return acc;
        }, {} as Record<string, string>);
      } else {
        froxlorError = `Kunde ${client.customerNo} wurde auf dem Froxlor-Server nicht gefunden.`;
      }
    } catch (error) {
      // Silently catch Froxlor errors to prevent page crashes
      // The error will be displayed in the UI via froxlorError
      froxlorError =
        error instanceof Error
          ? error.message
          : "Unbekannter Fehler beim Abrufen der Froxlor-Daten.";
    }
  }

  // Automatic sync: Transfer Froxlor contact data to client if client contact fields are empty
  if (froxlorCustomer && !client.firstname && !client.lastname) {
    try {
      const hasFirstname = froxlorCustomer.firstname && froxlorCustomer.firstname.trim() !== "";
      const hasLastname = froxlorCustomer.name && froxlorCustomer.name.trim() !== "";

      if (hasFirstname || hasLastname) {
        await prisma.client.update({
          where: { id: client.id },
          data: {
            firstname: hasFirstname ? froxlorCustomer.firstname : null,
            lastname: hasLastname ? froxlorCustomer.name : null,
          },
        });

        // Reload client to reflect the changes
        const updatedClient = await prisma.client.findUnique({
          where: { id: client.id },
          include: {
            server: true,
            agency: true,
            joomlaInstallations: {
              include: {
                server: {
                  select: {
                    name: true,
                    ip: true,
                  },
                },
                project: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
              orderBy: {
                createdAt: "desc",
              },
            },
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
            emailLogs: {
              where: {
                projectId: null,
              },
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
        });

        if (updatedClient) {
          client = updatedClient;
        }
      }
    } catch (error) {
      console.error("Error auto-syncing Froxlor contact data:", error);
      // Don't show error to user - this is a background sync
    }
  }

  const role = session.user.role!;
  const isAdmin = role === "ADMIN";
  const isSales = role === "SALES";
  const canSendEmail = role === "ADMIN" || role === "AGENT";

  // Check if client is favorited by current user
  const isFavorite = await isFavoriteClient(client.id);

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

  // General emails (without project association)
  const generalEmails = client.emailLogs || [];

  return (
    <div className="space-y-6">
      <ClientDetailHeader
        client={{
          id: client.id,
          name: client.name,
          customerNo: client.customerNo,
          email: client.email,
          salutation: client.salutation,
          firstname: client.firstname,
          lastname: client.lastname,
          agencyId: client.agencyId,
          agency: client.agency,
          workStopped: client.workStopped,
          finished: client.finished,
        }}
        isAdmin={isAdmin}
        canSendEmail={canSendEmail}
        isSales={isSales}
        initialIsFavorite={isFavorite}
      />

      {/* Info-Cards oben */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Basic Information */}
        <section className="rounded-lg border border-border bg-card p-4">
          <ClientDataEditor
            client={{
              id: client.id,
              name: client.name,
              salutation: client.salutation,
              firstname: client.firstname,
              lastname: client.lastname,
              email: client.email,
              phone: client.phone,
              notes: client.notes,
              uploadLinks: client.uploadLinks as string[] | null,
              customerNo: client.customerNo,
              serverId: client.serverId,
              agencyId: client.agencyId,
              workStopped: client.workStopped,
              finished: client.finished,
              createdAt: client.createdAt,
              server: client.server,
            }}
            servers={servers}
            agencies={agencies}
            isAdmin={isAdmin}
          />
        </section>

        {/* Froxlor Customer Data */}
        {froxlorCustomer && client.server && (
          <section className="rounded-lg border border-border bg-card p-4">
            <FroxlorDataEditor
              customer={froxlorCustomer}
              serverId={client.server.id}
              isAdmin={isAdmin}
            />
          </section>
        )}
      </div>

      {/* Tabs für strukturierte Inhalte */}
      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="projects">
            Projekte ({client.projects.length})
          </TabsTrigger>
          <TabsTrigger value="server">
            Server-Daten
          </TabsTrigger>
          <TabsTrigger value="communication">
            Kommunikation
          </TabsTrigger>
        </TabsList>

        {/* Tab: Projekte */}
        <TabsContent value="projects" className="space-y-6 mt-6">
          {/* Show warning for UMSETZUNG projects without installation */}
          {isAdmin && client.projects.some((p) =>
            p.type === "WEBSITE" &&
            p.status === "UMSETZUNG" &&
            !client.joomlaInstallations.some((inst) => inst.project?.id === p.id)
          ) && (
            <div className="rounded-lg border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/30 p-3">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                    Projekte im Status &quot;Umsetzung&quot; ohne Installation
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                    Bitte ordnen Sie den Projekten eine Installation zu oder erstellen Sie eine neue.
                  </p>
                  {client.server && (
                    <Link
                      href={`/admin/basisinstallation?server=${client.server.id}&customer=${client.customerNo}`}
                      className="inline-block mt-2 text-xs text-orange-800 dark:text-orange-200 hover:text-orange-900 dark:hover:text-orange-100 font-medium underline"
                    >
                      → Neue Installation erstellen
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Projects Grid */}
          {client.projects.length === 0 ? (
            <section className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Keine Projekte vorhanden.</p>
            </section>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {client.projects.map((project) => {
                // Determine type label and badge style based on project type and CMS
                let typeLabel: string;
                let badgeClass: string = "";

                if (project.type === "WEBSITE" && project.website) {
                  const cms = project.website.cms;
                  switch (cms) {
                    case "JOOMLA":
                      typeLabel = "Webseite (Joomla)";
                      badgeClass = "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800";
                      break;
                    case "WORDPRESS":
                      typeLabel = "Webseite (WordPress)";
                      badgeClass = "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800";
                      break;
                    case "SHOPWARE":
                      typeLabel = "Shop (Shopware)";
                      badgeClass = "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800";
                      break;
                    case "LOGO":
                      typeLabel = "Logo";
                      badgeClass = "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300 border-pink-300 dark:border-pink-800";
                      break;
                    case "PRINT":
                      typeLabel = "Print";
                      badgeClass = "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800";
                      break;
                    case "CUSTOM":
                      typeLabel = "Webseite (Custom)";
                      badgeClass = "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800";
                      break;
                    case "OTHER":
                      typeLabel = project.website.cmsOther || "Anderes";
                      badgeClass = "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700";
                      break;
                    default:
                      typeLabel = "Webseite";
                      badgeClass = "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800";
                  }
                } else if (project.type === "FILM") {
                  typeLabel = "Film";
                  badgeClass = "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800";
                } else if (project.type === "SOCIAL") {
                  typeLabel = "Social Media";
                  badgeClass = "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-800";
                } else {
                  typeLabel = project.type;
                  badgeClass = "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700";
                }

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

                const isOnlineWebsite = project.type === "WEBSITE" && project.status === "ONLINE";

                return (
                  <div key={project.id} className="rounded-lg border border-border bg-card p-4">
                    <Link
                      href={project.type === "FILM" ? `/film-projects/${project.id}` : `/projects/${project.id}`}
                      className="block transition-all hover:opacity-80"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <Badge variant="outline" className={`text-xs font-semibold ${badgeClass}`}>
                          {typeLabel}
                        </Badge>
                        <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      {project.title && (
                        <div className="text-lg font-bold text-foreground mb-1">
                          {project.title}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground mb-1">
                        Status: {statusLabel}
                      </div>
                      {statusDate && (
                        <div className="text-xs text-muted-foreground mb-2">
                          seit {formatDateOnly(statusDate)}
                        </div>
                      )}
                      {project.website && project.website.domain && (
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {project.website.domain}
                        </div>
                      )}
                    </Link>

                    {/* Demo Link for Website Projects */}
                    {project.type === "WEBSITE" && (project.website?.demoLink || client.joomlaInstallations.some(inst => inst.project?.id === project.id)) && (
                      <div className="mt-3 pt-3 border-t">
                        <a
                          href={
                            project.website?.demoLink
                              ? (project.website.demoLink.startsWith("http") ? project.website.demoLink : `https://${project.website.demoLink}`)
                              : (client.joomlaInstallations.find(inst => inst.project?.id === project.id)?.installUrl.startsWith("http")
                                  ? client.joomlaInstallations.find(inst => inst.project?.id === project.id)?.installUrl
                                  : `https://${client.joomlaInstallations.find(inst => inst.project?.id === project.id)?.installUrl}`)
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-2 text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors"
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="font-medium">Zur Demo</span>
                          <svg className="w-3 h-3 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    )}

                    {/* Online Video Link for Film Projects */}
                    {project.type === "FILM" && project.film?.onlineLink && (
                      <div className="mt-3 pt-3 border-t">
                        <a
                          href={project.film.onlineLink.startsWith("http")
                            ? project.film.onlineLink
                            : `https://${project.film.onlineLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                        >
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">Zum Film</span>
                          <svg className="w-3 h-3 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    )}

                    {/* Domain Assignment for ONLINE websites */}
                    {isAdmin && isOnlineWebsite && froxlorDomains.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <ProjectDomainAssignment
                          projectId={project.id}
                          currentDomain={project.website?.domain || null}
                          availableDomains={froxlorDomains}
                          standardSubdomain={froxlorCustomer?.standardsubdomain ?
                            froxlorDomains.find(d => d.id === froxlorCustomer.standardsubdomain)?.domain || null
                            : null
                          }
                          allProjects={client.projects
                            .filter(p => p.type === "WEBSITE" && p.website)
                            .map(p => ({
                              id: p.id,
                              title: p.title,
                              domain: p.website?.domain || null,
                            }))
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        {/* Joomla Installations */}
        {client.joomlaInstallations.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-medium text-foreground mb-3">
                Joomla Installationen ({client.joomlaInstallations.length})
              </h2>
              <div className="space-y-3">
                {client.joomlaInstallations.map((installation) => {
                  const hasProject = !!installation.project;
                  return (
                    <div
                      key={installation.id}
                      className={`rounded border p-3 ${
                        hasProject
                          ? 'border-green-200 dark:border-green-800 bg-green-50/40 dark:bg-green-950/30'
                          : 'border-blue-100 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/30'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="font-medium text-sm text-foreground">
                              {installation.standardDomain}/{installation.folderName}
                            </div>
                            {hasProject ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Zugeordnet
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Nicht zugeordnet
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <div>
                              <span className="text-muted-foreground">Server:</span>{" "}
                              <span className="font-medium">{installation.server.name}</span>
                            </div>
                            <div className="font-mono text-[11px]">
                              {installation.installPath}
                            </div>
                            {installation.project && (
                              <div className="mt-1 flex items-center gap-1">
                                <svg className="h-3.5 w-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-muted-foreground">Projekt:</span>{" "}
                                <Link
                                  href={`/projects/${installation.project.id}`}
                                  className="text-green-700 dark:text-green-400 hover:underline font-medium"
                                >
                                  {installation.project.title}
                                </Link>
                              </div>
                            )}
                          </div>
                        </div>
                      <a
                        href={installation.installUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-3 inline-flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-800 transition text-xs font-medium whitespace-nowrap"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Öffnen
                      </a>
                    </div>

                    <div className="pt-2 border-t border-blue-200/50 dark:border-blue-800/50 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Datenbank:</span>{" "}
                        <span className="font-mono text-foreground">{installation.databaseName}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">DB-Passwort:</span>{" "}
                        <span className="font-mono text-foreground">{installation.databasePassword}</span>
                      </div>
                      {installation.filesExtracted && (
                        <div>
                          <span className="text-muted-foreground">Dateien:</span>{" "}
                          <span className="text-foreground">{installation.filesExtracted.toLocaleString()}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Installiert:</span>{" "}
                        <span className="text-foreground">{formatDateOnly(installation.createdAt)}</span>
                      </div>
                    </div>

                    {isAdmin && (
                      <>
                        <div className="pt-2 border-t border-blue-200/50 dark:border-blue-800/50 mt-2">
                          <div className="text-xs text-muted-foreground mb-1">
                            {installation.project ? "Projektzuordnung:" : "Projekt zuordnen:"}
                          </div>
                          <InstallationProjectAssignment
                            installationId={installation.id}
                            clientProjects={client.projects.filter((p) => p.type === "WEBSITE")}
                            currentProjectId={installation.project?.id}
                          />
                        </div>
                        <div className="pt-2 border-t border-blue-200/50 mt-2 flex justify-end">
                          <DeleteInstallationButton
                            installationId={installation.id}
                            installationName={`${installation.standardDomain}/${installation.folderName}`}
                          />
                        </div>
                      </>
                    )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </TabsContent>

        {/* Tab: Server-Daten */}
        <TabsContent value="server" className="space-y-6 mt-6">
          {/* Domains */}
          {(hasFroxlorConfig || froxlorError) && (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-medium text-foreground mb-3">
                Domains
                {froxlorDomains.length > 0 && <span> ({froxlorDomains.length})</span>}
              </h2>

              {froxlorError && (
                <div className="rounded border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                  {froxlorError}
                </div>
              )}

              {!froxlorError && froxlorDomains.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Domains fuer diesen Kunden vorhanden.</p>
              )}

              {!froxlorError && froxlorDomains.length > 0 && (
                <div className="space-y-2">
                  {froxlorDomains.map((domain) => {
                    const isStandard =
                      froxlorCustomer?.standardsubdomain != null
                        ? Number.parseInt(domain.id, 10) === Number.parseInt(froxlorCustomer.standardsubdomain, 10)
                        : false;
                    // Find project assigned to this domain
                    const assignedProject = client.projects.find(
                      (p) => p.type === "WEBSITE" && p.website?.domain === domain.domain
                    );

                    return (
                      <div key={domain.id} className="rounded border border-border bg-card p-3">
                        <div className="flex items-center gap-2 mb-1">
                          {isStandard && (
                            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                              Standard
                            </Badge>
                          )}
                          <span className="font-medium text-sm text-foreground">{domain.domain}</span>
                          {domain.deactivated === "1" && (
                            <Badge variant="destructive" className="text-xs">Deaktiviert</Badge>
                          )}
                        </div>
                        {!isStandard && (
                          <div className="font-mono text-xs text-muted-foreground mb-1 break-all">{domain.documentroot}</div>
                        )}
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>SSL: {domain.ssl_redirect === "1" ? "Ja" : "Nein"}</span>
                          <span>LE: {domain.letsencrypt === "1" ? "Ja" : "Nein"}</span>
                          <span>PHP: {froxlorPhpConfigs[domain.phpsettingid] || domain.phpsettingid}</span>
                        </div>

                        {/* Show assigned project or allow assignment */}
                        {!isStandard && (
                          <div className="mt-2 pt-2 border-t">
                            {assignedProject ? (
                              <div className="flex items-center gap-2 text-xs">
                                <svg className="h-3.5 w-3.5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="text-muted-foreground">Zugeordnet zu:</span>
                                <Link
                                  href={`/projects/${assignedProject.id}`}
                                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                                >
                                  {getProjectDisplayName(assignedProject)}
                                </Link>
                              </div>
                            ) : (
                              isAdmin && (
                                <DomainProjectAssignment
                                  domain={domain.domain}
                                  onlineProjects={client.projects
                                    .filter(p => p.type === "WEBSITE" && p.status === "ONLINE" && p.website)
                                    .map(p => ({
                                      id: p.id,
                                      title: p.title,
                                      domain: p.website?.domain || null,
                                    }))
                                  }
                                />
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

        {/* FTP Accounts */}
        {froxlorFtpAccounts.length > 0 && (
          <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="text-base font-medium text-foreground mb-3">
                FTP-Zugänge ({froxlorFtpAccounts.length})
              </h2>
              <div className="space-y-2">
                {froxlorFtpAccounts.map((ftp) => (
                  <div key={ftp.id} className="rounded border border-border p-3 bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-sm text-foreground">{ftp.username}</span>
                      {ftp.login_enabled === "0" && (
                        <Badge variant="destructive" className="text-xs">Deaktiviert</Badge>
                      )}
                      {ftp.description && (
                        <span className="text-xs text-muted-foreground">- {ftp.description}</span>
                      )}
                    </div>
                    <div className="grid gap-2 text-xs">
                      <div className="grid grid-cols-[auto,1fr] gap-2">
                        <span className="text-muted-foreground">Benutzername:</span>
                        <span className="font-mono text-foreground">{ftp.username}</span>
                      </div>
                      <FtpPasswordEditor
                        ftpAccount={ftp}
                        serverId={client.server!.id}
                        clientId={client.id}
                        storedPassword={
                          client.ftpPasswords
                            ? (client.ftpPasswords as Record<string, string>)[ftp.id.toString()]
                            : undefined
                        }
                        isAdmin={isAdmin}
                      />
                      <div className="grid grid-cols-[auto,1fr] gap-2">
                        <span className="text-muted-foreground">Home-Verzeichnis:</span>
                        <span className="font-mono text-[11px] text-foreground break-all">{ftp.homedir}</span>
                      </div>
                      {ftp.last_login && (
                        <div className="grid grid-cols-[auto,1fr] gap-2">
                          <span className="text-muted-foreground">Letzter Login:</span>
                          <span className="text-foreground">{formatDate(ftp.last_login)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </TabsContent>

        {/* Tab: Kommunikation */}
        <TabsContent value="communication" className="space-y-6 mt-6">
          {/* Email Logs */}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-base font-medium text-foreground mb-3">
              Versendete E-Mails ({allEmailLogs.length})
            </h2>
            {allEmailLogs.length === 0 && generalEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine E-Mails an diesen Kunden versendet.</p>
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
                    <p className="text-sm text-muted-foreground">
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
                      <p className="text-sm text-muted-foreground">Keine E-Mails für diesen Projekttyp.</p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
