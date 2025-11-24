"use client";

import { useState } from "react";
import Link from "next/link";
import { STATUS_LABELS } from "@/lib/project-status";
import { deriveFilmStatus, FILM_STATUS_LABELS } from "@/lib/film-status";
import type { ProjectStatus } from "@prisma/client";

type WorkStoppedProject = {
  id: string;
  title: string | null;
  type: string;
  status: string;
  client: {
    name: string;
    customerNo: string | null;
  } | null;
  film?: {
    status: string | null;
    onlineDate: Date | null;
    finalToClient: Date | null;
    firstCutToClient: Date | null;
    shootDate: Date | null;
    scriptApproved: Date | null;
    scriptToClient: Date | null;
    scouting: Date | null;
    previewVersions: Array<{ sentDate: Date }>;
  } | null;
  website?: {
    pStatus: string | null;
  } | null;
};

export default function WorkStoppedProjectsAccordion({
  projects,
}: {
  projects: WorkStoppedProject[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-orange-200 dark:border-gray-700 bg-gradient-to-br from-orange-50 to-red-50/40 dark:from-gray-800 dark:to-gray-800 p-5 sm:p-6 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-2xl">⚠️</div>
        <div className="flex-1">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full text-left flex items-center justify-between gap-3 group"
            aria-expanded={isOpen}
          >
            <div>
              <h2 className="text-lg font-bold bg-gradient-to-r from-orange-700 to-red-600 dark:from-orange-400 dark:to-red-400 bg-clip-text text-transparent">
                Projekte mit Arbeitsstopp ({projects.length})
              </h2>
              <p className="text-sm text-orange-900 dark:text-gray-300 font-medium mt-1">
                Diese Projekte befinden sich im Status &quot;Arbeitsstopp&quot;. Bitte keine weiteren Arbeiten durchführen.
              </p>
            </div>
            <div className="flex-shrink-0">
              <svg
                className={`w-6 h-6 text-orange-600 dark:text-orange-400 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </button>

          {isOpen && (
            <div className="space-y-2 mt-4">
              {projects.map((project) => {
                const typeLabel =
                  project.type === "WEBSITE"
                    ? "Webseite"
                    : project.type === "FILM"
                    ? "Film"
                    : project.type === "SOCIAL"
                    ? "Social Media"
                    : project.type;

                // Für Filmprojekte den abgeleiteten Status verwenden
                let statusLabel: string;
                if (project.type === "FILM" && project.film) {
                  const filmStatus = deriveFilmStatus({
                    status: project.film.status,
                    onlineDate: project.film.onlineDate,
                    finalToClient: project.film.finalToClient,
                    firstCutToClient: project.film.firstCutToClient,
                    shootDate: project.film.shootDate,
                    scriptApproved: project.film.scriptApproved,
                    scriptToClient: project.film.scriptToClient,
                    scouting: project.film.scouting,
                    previewVersions: project.film.previewVersions,
                  });
                  statusLabel = FILM_STATUS_LABELS[filmStatus];
                } else {
                  // Für Website- und Social-Projekte die normalen Status-Labels verwenden
                  statusLabel = STATUS_LABELS[project.status as ProjectStatus] ?? project.status;
                }

                const customerLabel =
                  [project.client?.customerNo, project.client?.name]
                    .filter(Boolean)
                    .join(" - ") || "Kunde unbekannt";
                const projectUrl =
                  project.type === "FILM"
                    ? `/film-projects/${project.id}`
                    : `/projects/${project.id}`;

                return (
                  <Link
                    key={project.id}
                    href={projectUrl}
                    className="block rounded-lg border border-orange-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 p-3 hover:border-orange-400 dark:hover:border-orange-500 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate dark:text-gray-200">
                          {customerLabel}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                          {project.title ?? "Projekt ohne Titel"} · {typeLabel}{" "}
                          · Status: {statusLabel}
                        </div>
                      </div>
                      <span className="text-xs text-orange-700 dark:text-orange-400 whitespace-nowrap">
                        Details →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
