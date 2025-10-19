import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";

export default async function JoomlaInstallationsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const installations = await prisma.joomlaInstallation.findMany({
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      server: {
        select: {
          id: true,
          name: true,
          ip: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Joomla Installationen</h1>
        <p className="text-gray-600 mt-1">
          Übersicht aller durchgeführten Joomla-Installationen
        </p>
      </div>

      {installations.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-gray-600">Noch keine Installationen vorhanden</p>
        </div>
      ) : (
        <div className="space-y-4">
          {installations.map((installation) => (
            <div
              key={installation.id}
              className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {installation.client.name}
                    </h2>
                    <span className="text-sm text-gray-500">
                      ({installation.customerNo})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Server:</span>{" "}
                      <span className="font-medium">
                        {installation.server.name} ({installation.server.ip})
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500">Domain:</span>{" "}
                      <span className="font-medium">
                        {installation.standardDomain}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500">Ordner:</span>{" "}
                      <span className="font-mono text-sm">
                        {installation.folderName}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500">Installationspfad:</span>{" "}
                      <span className="font-mono text-sm">
                        {installation.installPath}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500">Datenbank:</span>{" "}
                      <span className="font-mono text-sm">
                        {installation.databaseName}
                      </span>
                    </div>

                    <div>
                      <span className="text-gray-500">DB-Passwort:</span>{" "}
                      <span className="font-mono text-sm">
                        {installation.databasePassword}
                      </span>
                    </div>

                    {installation.filesExtracted && (
                      <div>
                        <span className="text-gray-500">Dateien:</span>{" "}
                        <span className="font-medium">
                          {installation.filesExtracted.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {installation.bytesProcessed && (
                      <div>
                        <span className="text-gray-500">Größe:</span>{" "}
                        <span className="font-medium">
                          {(
                            Number(installation.bytesProcessed) /
                            1024 /
                            1024
                          ).toFixed(2)}{" "}
                          MB
                        </span>
                      </div>
                    )}

                    <div className="col-span-2">
                      <span className="text-gray-500">Installiert am:</span>{" "}
                      <span className="font-medium">
                        {new Date(installation.createdAt).toLocaleString(
                          "de-DE",
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="ml-4">
                  <a
                    href={installation.installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    Öffnen
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
