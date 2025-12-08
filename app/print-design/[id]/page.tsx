import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  derivePrintDesignStatus,
  getPrintDesignStatusDate,
  PRINT_DESIGN_STATUS_LABELS,
  PRINT_DESIGN_TYPE_LABELS,
  type PrintDesignStatus,
} from "@/lib/print-design-status";
import PrintDesignInlineCell from "@/components/PrintDesignInlineCell";
import type { PrintDesignType, ProductionStatus } from "@prisma/client";
import { DeleteProjectButton } from "../DeleteProjectButton";
import { BackButton } from "@/components/BackButton";

type Props = {
  params: Promise<{ id: string }>;
};

const formatDate = (value?: Date | string | null) => {
  if (!value) return "-";
  try {
    const dateStr = typeof value === "string" ? value : value.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return "-";
    const [, year, month, day] = match;
    return `${day}.${month}.${year}`;
  } catch {
    return "-";
  }
};

const formatDateTime = (value?: Date | string | null) => {
  if (!value) return "-";
  try {
    const dateStr = typeof value === "string" ? value : value.toISOString();
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) return "-";

    const [, year, month, day, hours, minutes] = match;
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  } catch {
    return "-";
  }
};

const P_STATUS_LABELS = {
  NONE: "Keine",
  BEENDET: "Beendet",
  MMW: "MMW",
} as const;

export default async function PrintDesignDetailPage({ params }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (!session.user.role || !["ADMIN", "AGENT", "SALES"].includes(session.user.role)) {
    redirect("/");
  }

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      agent: true,
      printDesign: true,
    },
  });

  // Check if client has website projects
  const websiteProjects = project?.clientId
    ? await prisma.project.findMany({
        where: {
          clientId: project.clientId,
          type: "WEBSITE",
        },
        select: {
          id: true,
          title: true,
          website: {
            select: {
              pStatus: true,
              webDate: true,
              demoDate: true,
              onlineDate: true,
              materialStatus: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Check if client has film projects
  const filmProjects = project?.clientId
    ? await prisma.project.findMany({
        where: {
          clientId: project.clientId,
          type: "FILM",
        },
        select: {
          id: true,
          title: true,
          film: {
            select: {
              status: true,
              onlineDate: true,
              finalToClient: true,
              shootDate: true,
              scriptApproved: true,
              scriptToClient: true,
              scouting: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Load agents for inline editing (only agents with PRINT_DESIGN category)
  const allAgents = await prisma.user.findMany({
    where: { role: "AGENT", active: true },
    select: { id: true, name: true, email: true, categories: true },
    orderBy: { name: "asc" },
  });
  const agents = allAgents.filter((a) => a.categories.includes("PRINT_DESIGN"));

  // Get all clients for reassignment (Admin only)
  const role = session.user.role!;
  const allClients =
    role === "ADMIN"
      ? await prisma.client.findMany({
          select: { id: true, name: true, customerNo: true },
          orderBy: { name: "asc" },
        })
      : [];

  // Helper to derive website status
  const deriveWebsiteStatusForLink = (website: any) => {
    if (!website) return "WEBTERMIN";

    const normalizedPStatus = website.pStatus?.toUpperCase();
    if (normalizedPStatus === "BEENDET") return "ONLINE";
    if (website.onlineDate) return "ONLINE";
    if (website.demoDate) return "DEMO";

    const now = new Date();
    const webDate = website.webDate ? new Date(website.webDate) : null;
    if (!webDate || webDate > now) return "WEBTERMIN";
    if (normalizedPStatus === "VOLLST_A_K") return "UMSETZUNG";
    if (website.materialStatus !== "VOLLSTAENDIG") return "MATERIAL";

    return "UMSETZUNG";
  };

  const WEBSITE_STATUS_LABELS: Record<string, string> = {
    WEBTERMIN: "Webtermin",
    MATERIAL: "Material",
    UMSETZUNG: "Umsetzung",
    DEMO: "Demo",
    ONLINE: "Online",
  };

  const getWebsiteStatusColor = (status: string) => {
    switch (status) {
      case "WEBTERMIN":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "MATERIAL":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "UMSETZUNG":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "DEMO":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "ONLINE":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const deriveFilmStatusForLink = (film: any) => {
    if (!film) return "SCOUTING";
    if (film.status === "BEENDET") return "BEENDET";
    if (film.onlineDate) return "ONLINE";
    if (film.finalToClient) return "FINALVERSION";
    if (film.shootDate && new Date(film.shootDate).getTime() < Date.now()) return "SCHNITT";
    if (film.scriptApproved) return "DREH";
    if (film.scriptToClient) return "SKRIPTFREIGABE";
    if (film.scouting && new Date(film.scouting).getTime() < Date.now()) return "SKRIPT";
    return "SCOUTING";
  };

  const FILM_STATUS_LABELS: Record<string, string> = {
    SCOUTING: "Scouting",
    SKRIPT: "Skript",
    SKRIPTFREIGABE: "Skriptfreigabe",
    DREH: "Dreh",
    SCHNITT: "Schnitt",
    FINALVERSION: "Finalversion",
    ONLINE: "Online",
    BEENDET: "Beendet",
  };

  const getFilmStatusColor = (status: string) => {
    switch (status) {
      case "SCOUTING":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "SKRIPT":
        return "bg-indigo-100 text-indigo-800 border-indigo-300";
      case "SKRIPTFREIGABE":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "DREH":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "SCHNITT":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "FINALVERSION":
        return "bg-teal-100 text-teal-800 border-teal-300";
      case "ONLINE":
        return "bg-green-100 text-green-800 border-green-300";
      case "BEENDET":
        return "bg-gray-100 text-gray-800 border-gray-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (!project || !project.printDesign) {
    notFound();
  }

  const printDesign = project.printDesign;
  const isAdmin = role === "ADMIN";
  const canEdit = role === "ADMIN" || role === "AGENT";

  // Options for select fields
  const agentOptions = [
    { value: "", label: "- kein Agent -" },
    ...agents.map((a) => ({ value: a.id, label: a.name ?? a.email ?? "" })),
  ];

  const printDesignTypeOptions: { value: string; label: string }[] = (
    Object.keys(PRINT_DESIGN_TYPE_LABELS) as PrintDesignType[]
  ).map((value) => ({
    value,
    label: PRINT_DESIGN_TYPE_LABELS[value],
  }));

  const pStatusOptions = (
    Object.keys(P_STATUS_LABELS) as (keyof typeof P_STATUS_LABELS)[]
  ).map((value) => ({
    value,
    label: P_STATUS_LABELS[value],
  }));

  const derivedStatus = derivePrintDesignStatus({
    status: printDesign.pStatus,
    webtermin: printDesign.webtermin,
    designToClient: printDesign.designToClient,
    designApproval: printDesign.designApproval,
    finalVersionToClient: printDesign.finalVersionToClient,
    printRequired: printDesign.printRequired,
    printOrderPlaced: printDesign.printOrderPlaced,
  });

  // Status badge colors
  const getStatusColor = (status: PrintDesignStatus) => {
    switch (status) {
      case "WEBTERMIN":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "UMSETZUNG":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "DESIGN_AN_KUNDEN":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "DESIGNABNAHME":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "FINALVERSION":
        return "bg-teal-100 text-teal-800 border-teal-300";
      case "DRUCK":
        return "bg-indigo-100 text-indigo-800 border-indigo-300";
      case "ABGESCHLOSSEN":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="p-2 md:p-6 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-2 md:px-0">
        <BackButton fallbackUrl="/print-design" />
      </div>

      {/* Project Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl md:text-3xl">
                {PRINT_DESIGN_TYPE_LABELS[printDesign.projectType ?? "SONSTIGES"]}
              </CardTitle>
              <CardDescription className="mt-2 flex flex-wrap items-center gap-2">
                <Link
                  href={`/clients/${project.clientId}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {project.client.customerNo ?? "?"} {project.client.name}
                </Link>
                {printDesign.printRequired && (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300">
                    🖨️ Druck erforderlich
                  </Badge>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2 items-center">
              <Badge variant="outline" className={`${getStatusColor(derivedStatus)} border text-base px-3 py-1`}>
                {PRINT_DESIGN_STATUS_LABELS[derivedStatus]}
              </Badge>
              {isAdmin && (
                <DeleteProjectButton
                  projectId={project.id}
                  projectTitle={project.title ?? (printDesign?.type ? PRINT_DESIGN_TYPE_LABELS[printDesign.type] : null)}
                  clientId={project.clientId}
                />
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Related Projects Quick Links */}
      {(websiteProjects.length > 0 || filmProjects.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Website Projects Quick Links */}
          {websiteProjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Webseitenprojekte</CardTitle>
                <CardDescription className="text-xs">
                  Weitere Projekte für {project.client.name}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {websiteProjects.map((wp) => {
                    const status = deriveWebsiteStatusForLink(wp.website);
                    return (
                      <Link key={wp.id} href={`/projects/${wp.id}`}>
                        <Badge
                          variant="outline"
                          className={`${getWebsiteStatusColor(status)} border cursor-pointer hover:opacity-80 text-xs`}
                        >
                          {WEBSITE_STATUS_LABELS[status]}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Film Projects Quick Links */}
          {filmProjects.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Filmprojekte</CardTitle>
                <CardDescription className="text-xs">Weitere Projekte für {project.client.name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {filmProjects.map((fp) => {
                    const status = deriveFilmStatusForLink(fp.film);
                    return (
                      <Link key={fp.id} href={`/film-projects/${fp.id}`}>
                        <Badge
                          variant="outline"
                          className={`${getFilmStatusColor(status)} border cursor-pointer hover:opacity-80 text-xs`}
                        >
                          {FILM_STATUS_LABELS[status]}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Project Details and Timeline Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Project Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Projektdetails</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Art</dt>
              <dd className="text-sm">
                <PrintDesignInlineCell
                  target="printDesign"
                  id={project.id}
                  name="projectType"
                  type="select"
                  display={PRINT_DESIGN_TYPE_LABELS[printDesign.projectType ?? "SONSTIGES"]}
                  value={printDesign.projectType ?? "SONSTIGES"}
                  options={printDesignTypeOptions}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">Agent</dt>
              <dd className="text-sm">
                <PrintDesignInlineCell
                  target="project"
                  id={project.id}
                  name="agentId"
                  type="select"
                  display={project.agent?.name ?? "-"}
                  value={project.agentId ?? ""}
                  options={agentOptions}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">P-Status</dt>
              <dd className="text-sm">
                <PrintDesignInlineCell
                  target="printDesign"
                  id={project.id}
                  name="pStatus"
                  type="select"
                  display={P_STATUS_LABELS[printDesign.pStatus as keyof typeof P_STATUS_LABELS] ?? "-"}
                  value={printDesign.pStatus}
                  options={pStatusOptions}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">Druck erforderlich</dt>
              <dd className="text-sm">
                <PrintDesignInlineCell
                  target="printDesign"
                  id={project.id}
                  name="printRequired"
                  type="tri"
                  display={printDesign.printRequired ? "Ja" : "Nein"}
                  value={printDesign.printRequired}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">Druckanbieter</dt>
              <dd className="text-sm">
                <PrintDesignInlineCell
                  target="printDesign"
                  id={project.id}
                  name="printProvider"
                  type="text"
                  display={printDesign.printProvider || "-"}
                  value={printDesign.printProvider ?? ""}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            <div className="md:col-span-2">
              <dt className="text-sm font-medium text-muted-foreground">Notizen</dt>
              <dd className="text-sm whitespace-pre-wrap">
                <PrintDesignInlineCell
                  target="printDesign"
                  id={project.id}
                  name="note"
                  type="textarea"
                  display={printDesign.note || "-"}
                  value={printDesign.note ?? ""}
                  canEdit={canEdit}
                />
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

        {/* Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Zeitplan</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Webtermin</dt>
              <dd className="text-sm">
                <PrintDesignInlineCell
                  target="printDesign"
                  id={project.id}
                  name="webtermin"
                  type="datetime"
                  display={formatDateTime(printDesign.webtermin)}
                  value={printDesign.webtermin}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">Design an Kunden</dt>
              <dd className="text-sm">
                <PrintDesignInlineCell
                  target="printDesign"
                  id={project.id}
                  name="designToClient"
                  type="date"
                  display={formatDate(printDesign.designToClient)}
                  value={printDesign.designToClient}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">Designabnahme</dt>
              <dd className="text-sm">
                <PrintDesignInlineCell
                  target="printDesign"
                  id={project.id}
                  name="designApproval"
                  type="date"
                  display={formatDate(printDesign.designApproval)}
                  value={printDesign.designApproval}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Finalversion an Kunden
              </dt>
              <dd className="text-sm">
                <PrintDesignInlineCell
                  target="printDesign"
                  id={project.id}
                  name="finalVersionToClient"
                  type="date"
                  display={formatDate(printDesign.finalVersionToClient)}
                  value={printDesign.finalVersionToClient}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Druckauftrag erteilt am
              </dt>
              <dd className="text-sm">
                <PrintDesignInlineCell
                  target="printDesign"
                  id={project.id}
                  name="printOrderPlaced"
                  type="date"
                  display={formatDate(printDesign.printOrderPlaced)}
                  value={printDesign.printOrderPlaced}
                  canEdit={canEdit}
                />
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">Zuletzt aktualisiert</dt>
              <dd className="text-sm">{formatDate(project.updatedAt)}</dd>
            </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
