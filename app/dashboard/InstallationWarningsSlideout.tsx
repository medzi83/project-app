"use client";

import { useState } from "react";
import Link from "next/link";

type Project = {
  id: string;
  title: string;
  status: string;
  client: {
    id: string;
    name: string | null;
    customerNo: string | null;
  } | null;
};

type Installation = {
  id: string;
  folderName: string;
  standardDomain: string;
  installUrl: string;
  client: {
    id: string;
    name: string | null;
    customerNo: string | null;
  } | null;
};

type Props = {
  projectsNeedingInstallation: Project[];
  unassignedInstallations: Installation[];
};

export function InstallationWarningsSlideout({
  projectsNeedingInstallation,
  unassignedInstallations,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const totalCount = projectsNeedingInstallation.length + unassignedInstallations.length;

  if (totalCount === 0) return null;

  return (
    <>
      {/* Compact Tile */}
      <section className="rounded-2xl border border-orange-300 bg-orange-50 p-5 sm:p-6 shadow-sm">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full text-left hover:bg-orange-100/50 rounded-lg -m-1 p-1 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 text-3xl">⚙️</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-orange-900">
                  Installationen & Zuordnungen
                </h2>
                <span className="text-sm font-medium text-orange-700 bg-orange-200 px-2.5 py-0.5 rounded-full">
                  {totalCount}
                </span>
              </div>
              <p className="text-sm text-orange-700 mt-1">
                {projectsNeedingInstallation.length > 0 && `${projectsNeedingInstallation.length} Projekt${projectsNeedingInstallation.length !== 1 ? 'e' : ''} ohne Installation`}
                {projectsNeedingInstallation.length > 0 && unassignedInstallations.length > 0 && ' • '}
                {unassignedInstallations.length > 0 && `${unassignedInstallations.length} nicht zugeordnet${unassignedInstallations.length !== 1 ? 'e' : ''}`}
              </p>
            </div>
            <svg className="w-5 h-5 text-orange-700 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </section>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 transition-opacity duration-300 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slideout Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-orange-50">
          <div className="flex items-center gap-3">
            <div className="text-2xl">⚙️</div>
            <div>
              <h2 className="text-lg font-semibold text-orange-900">
                Installationen & Zuordnungen
              </h2>
              <p className="text-xs text-orange-700">
                {totalCount} Aufgaben
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {projectsNeedingInstallation.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-orange-900 uppercase tracking-wide mb-3 sticky top-0 bg-white py-2 -mt-2">
                Projekte ohne Installation ({projectsNeedingInstallation.length})
              </p>
              <div className="space-y-2">
                {projectsNeedingInstallation.map((project) => {
                  const customerLabel = [project.client?.customerNo, project.client?.name].filter(Boolean).join(" - ") || "Kunde unbekannt";

                  return (
                    <div key={project.id} className="rounded-lg border border-orange-200 bg-orange-50/30 p-3 hover:border-orange-300 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/projects/${project.id}`}
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline block truncate"
                            onClick={() => setIsOpen(false)}
                          >
                            {project.title}
                          </Link>
                          <p className="text-xs text-gray-600 mt-0.5 truncate">{customerLabel}</p>
                        </div>
                        <Link
                          href={`/clients/${project.client?.id}`}
                          className="text-xs px-3 py-1.5 bg-orange-600 text-white rounded hover:bg-orange-700 whitespace-nowrap flex-shrink-0"
                          onClick={() => setIsOpen(false)}
                        >
                          Erstellen →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {unassignedInstallations.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-orange-900 uppercase tracking-wide mb-3 sticky top-0 bg-white py-2 -mt-2">
                Nicht zugeordnete Installationen ({unassignedInstallations.length})
              </p>
              <div className="space-y-2">
                {unassignedInstallations.map((installation) => {
                  const customerLabel = [installation.client?.customerNo, installation.client?.name].filter(Boolean).join(" - ") || "Kunde unbekannt";

                  return (
                    <div key={installation.id} className="rounded-lg border border-orange-200 bg-orange-50/30 p-3 hover:border-orange-300 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <a
                            href={installation.installUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline block truncate"
                          >
                            {installation.standardDomain}/{installation.folderName}
                          </a>
                          <p className="text-xs text-gray-600 mt-0.5 truncate">{customerLabel}</p>
                        </div>
                        <Link
                          href={`/clients/${installation.client?.id}`}
                          className="text-xs px-3 py-1.5 bg-orange-600 text-white rounded hover:bg-orange-700 whitespace-nowrap flex-shrink-0"
                          onClick={() => setIsOpen(false)}
                        >
                          Zuordnen →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
