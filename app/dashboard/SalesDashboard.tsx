"use client";

import { useState } from "react";
import Link from "next/link";

type Agency = {
  id: string;
  name: string;
  logoIconPath: string | null;
};

type WebsiteProject = {
  id: string;
  title: string | null;
  clientName: string;
  domain: string | null;
  onlineDate: Date | null;
  agencyId: string | null;
  agencyName: string | null;
};

type FilmProject = {
  id: string;
  title: string | null;
  clientName: string;
  onlineLink: string | null;
  finalLink: string | null;
  onlineDate: Date | null;
  agencyId: string | null;
  agencyName: string | null;
};

type Props = {
  websiteProjects: WebsiteProject[];
  filmProjects: FilmProject[];
  agencies: Agency[];
};

const formatDate = (d: Date | null) => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "-";
  }
};

export function SalesDashboard({ websiteProjects, filmProjects, agencies }: Props) {
  const [websiteAgencyFilter, setWebsiteAgencyFilter] = useState<string>("all");
  const [filmAgencyFilter, setFilmAgencyFilter] = useState<string>("all");

  const filteredWebsites = websiteAgencyFilter === "all"
    ? websiteProjects
    : websiteProjects.filter(p => p.agencyId === websiteAgencyFilter);

  const filteredFilms = filmAgencyFilter === "all"
    ? filmProjects
    : filmProjects.filter(p => p.agencyId === filmAgencyFilter);

  const AgencyFilterButtons = ({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) => (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => onSelect("all")}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          selectedId === "all"
            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
            : "bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-400 hover:shadow-sm"
        }`}
      >
        Alle Agenturen
      </button>
      {agencies.map((agency) => (
        <button
          key={agency.id}
          onClick={() => onSelect(agency.id)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            selectedId === agency.id
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
              : "bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-400 hover:shadow-sm"
          }`}
        >
          {agency.logoIconPath && (
            <img
              src={agency.logoIconPath}
              alt={agency.name}
              className="w-5 h-5 object-contain"
            />
          )}
          <span>{agency.name}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Neueste Webseiten */}
      <section className="rounded-2xl border border-purple-200 bg-white shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
          <h2 className="font-bold text-lg bg-gradient-to-r from-purple-700 to-pink-600 bg-clip-text text-transparent mb-3">
            Neueste Webseiten
          </h2>
          <AgencyFilterButtons
            selectedId={websiteAgencyFilter}
            onSelect={setWebsiteAgencyFilter}
          />
        </div>
        <div className="p-5">
          {filteredWebsites.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Keine fertiggestellten Webseiten vorhanden.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredWebsites.map((project) => {
                // Customer name is always the main heading
                const displayTitle = project.clientName;
                // Show project title separately if it exists and differs from client name
                const showProjectTitle = project.title && project.title !== project.clientName;
                const hasLink = project.domain && project.onlineDate;
                const url = hasLink
                  ? (project.domain!.startsWith("http") ? project.domain! : `https://${project.domain}`)
                  : null;

                return (
                  <div
                    key={project.id}
                    className="group rounded-xl border-2 border-purple-200 bg-gradient-to-br from-white to-purple-50 p-4 shadow-sm hover:shadow-md hover:border-purple-400 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 flex-1">
                        {displayTitle}
                      </h3>
                      {hasLink && (
                        <a
                          href={url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors"
                          title="Webseite öffnen"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      {showProjectTitle && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span className="truncate">{project.title}</span>
                        </div>
                      )}
                      {project.agencyName && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="truncate">{project.agencyName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Onlinestellung am: {formatDate(project.onlineDate)}</span>
                      </div>
                    </div>
                    <Link
                      href={`/projects/${project.id}`}
                      className="mt-3 block text-xs text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Details ansehen →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Neueste Filmprojekte */}
      <section className="rounded-2xl border border-green-200 bg-white shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <h2 className="font-bold text-lg bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent mb-3">
            Neueste Filmprojekte
          </h2>
          <AgencyFilterButtons
            selectedId={filmAgencyFilter}
            onSelect={setFilmAgencyFilter}
          />
        </div>
        <div className="p-5">
          {filteredFilms.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Keine fertiggestellten Filmprojekte vorhanden.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredFilms.map((project) => {
                // Customer name is always the main heading
                const displayTitle = project.clientName;
                // Show project title separately if it exists and differs from client name
                const showProjectTitle = project.title && project.title !== project.clientName;
                const videoLink = project.onlineLink || (project.onlineDate ? project.finalLink : null);
                const hasLink = Boolean(videoLink);
                const url = hasLink
                  ? (videoLink!.startsWith("http") ? videoLink! : `https://${videoLink}`)
                  : null;

                return (
                  <div
                    key={project.id}
                    className="group rounded-xl border-2 border-green-200 bg-gradient-to-br from-white to-green-50 p-4 shadow-sm hover:shadow-md hover:border-green-400 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 flex-1">
                        {displayTitle}
                      </h3>
                      {hasLink && (
                        <a
                          href={url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          title="Film ansehen"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                        </a>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-gray-600">
                      {showProjectTitle && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                          </svg>
                          <span className="truncate">{project.title}</span>
                        </div>
                      )}
                      {project.agencyName && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="truncate">{project.agencyName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Onlinestellung am: {formatDate(project.onlineDate)}</span>
                      </div>
                    </div>
                    <Link
                      href={`/film-projects/${project.id}`}
                      className="mt-3 block text-xs text-green-600 hover:text-green-800 font-medium"
                    >
                      Details ansehen →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
