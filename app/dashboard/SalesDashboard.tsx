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
  scope: string | null;
  agencyId: string | null;
  agencyName: string | null;
};

type FavoriteClient = {
  id: string;
  name: string;
  customerNo: string | null;
  agencyId: string | null;
  agencyName: string | null;
  agencyLogoIconPath: string | null;
  projectsCount: number;
  websiteProjectsCount: number;
  filmProjectsCount: number;
  activeProjectsCount: number;
};

type Props = {
  websiteProjects: WebsiteProject[];
  filmProjects: FilmProject[];
  agencies: Agency[];
  favoriteClients: FavoriteClient[];
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

const FILM_SCOPE_LABELS: Record<string, string> = {
  FILM: "Film",
  DROHNE: "Drohne",
  NACHDREH: "Nachdreh",
  FILM_UND_DROHNE: "F + D",
  FOTO: "Foto",
  GRAD_360: "360°",
  K_A: "k.A.",
};

const getScopeLabel = (scope: string | null) => {
  if (!scope) return null;
  return FILM_SCOPE_LABELS[scope] || scope;
};

export function SalesDashboard({ websiteProjects, filmProjects, agencies, favoriteClients }: Props) {
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
            : "bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm"
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
              : "bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm"
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
      {/* Favoriten */}
      {favoriteClients.length > 0 && (
        <section className="rounded-2xl border border-yellow-200 dark:border-yellow-800/50 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-yellow-200 dark:border-yellow-800/50 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500 dark:text-yellow-400 fill-current" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <h2 className="font-bold text-lg bg-gradient-to-r from-yellow-700 to-amber-600 dark:from-yellow-400 dark:to-amber-400 bg-clip-text text-transparent">
                Meine Favoriten ({favoriteClients.length})
              </h2>
            </div>
          </div>
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {favoriteClients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="group rounded-xl border-2 border-yellow-200 dark:border-yellow-800/50 bg-gradient-to-br from-white to-yellow-50 dark:from-slate-800 dark:to-yellow-950/20 p-4 shadow-sm hover:shadow-md hover:border-yellow-400 dark:hover:border-yellow-600 transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {client.customerNo && (
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{client.customerNo}</span>
                        )}
                        <svg className="w-4 h-4 text-yellow-500 dark:text-yellow-400 fill-current flex-shrink-0" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mt-1 line-clamp-2">
                        {client.name}
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    {client.agencyName && (
                      <div className="flex items-center gap-1">
                        {client.agencyLogoIconPath && (
                          <img
                            src={client.agencyLogoIconPath}
                            alt={client.agencyName}
                            className="w-3 h-3 object-contain"
                          />
                        )}
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{client.agencyName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>{client.projectsCount} Projekte</span>
                      </div>
                      {client.activeProjectsCount > 0 && (
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 rounded">
                          {client.activeProjectsCount} aktiv
                        </div>
                      )}
                    </div>
                    {(client.websiteProjectsCount > 0 || client.filmProjectsCount > 0) && (
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-500">
                        {client.websiteProjectsCount > 0 && <span>{client.websiteProjectsCount} Web</span>}
                        {client.filmProjectsCount > 0 && <span>{client.filmProjectsCount} Film</span>}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-yellow-600 dark:text-yellow-400 group-hover:text-yellow-800 dark:group-hover:text-yellow-300 font-medium">
                    Details ansehen →
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Neueste Webseiten */}
      <section className="rounded-2xl border border-purple-200 dark:border-purple-800/50 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-purple-200 dark:border-purple-800/50 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <h2 className="font-bold text-lg bg-gradient-to-r from-purple-700 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              Neueste Webseiten
            </h2>
          </div>
          <AgencyFilterButtons
            selectedId={websiteAgencyFilter}
            onSelect={setWebsiteAgencyFilter}
          />
        </div>
        <div className="p-5">
          {filteredWebsites.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
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
                    className="group rounded-xl border-2 border-purple-200 dark:border-purple-800/50 bg-gradient-to-br from-white dark:from-slate-800 to-purple-50 dark:to-purple-950/20 p-4 shadow-sm hover:shadow-md hover:border-purple-400 dark:hover:border-purple-600 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2 flex-1">
                        {displayTitle}
                      </h3>
                      {hasLink && (
                        <a
                          href={url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
                          title="Webseite öffnen"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
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
                      className="mt-3 block text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium"
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
      <section className="rounded-2xl border border-green-200 dark:border-green-800/50 bg-white dark:bg-slate-800 shadow-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-green-200 dark:border-green-800/50 bg-gradient-to-r from-green-50 dark:from-green-950/30 to-emerald-50 dark:to-emerald-950/30">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <h2 className="font-bold text-lg bg-gradient-to-r from-green-700 dark:from-green-400 to-emerald-600 dark:to-emerald-400 bg-clip-text text-transparent">
              Neueste Filmprojekte
            </h2>
          </div>
          <AgencyFilterButtons
            selectedId={filmAgencyFilter}
            onSelect={setFilmAgencyFilter}
          />
        </div>
        <div className="p-5">
          {filteredFilms.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
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
                    className="group rounded-xl border-2 border-green-200 dark:border-green-800/50 bg-gradient-to-br from-white dark:from-slate-800 to-green-50 dark:to-green-950/20 p-4 shadow-sm hover:shadow-md hover:border-green-400 dark:hover:border-green-600 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2 flex-1">
                        {displayTitle}
                      </h3>
                      {hasLink && (
                        <a
                          href={url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                          title="Film ansehen"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                        </a>
                      )}
                    </div>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      {showProjectTitle && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                          </svg>
                          <span className="truncate">{project.title}</span>
                        </div>
                      )}
                      {project.scope && getScopeLabel(project.scope) && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                          </svg>
                          <span className="font-medium text-green-700 dark:text-green-400">Umfang: {getScopeLabel(project.scope)}</span>
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
                      className="mt-3 block text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium"
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
