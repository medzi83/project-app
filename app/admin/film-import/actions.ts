"use server";
import type { FilmProjectStatus, FilmPriority, FilmScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { saveImportResult } from "../import/store";

type ImportResult = {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  resultId?: string;
  createdAgents?: { name: string; email: string }[];
};

// Simple CSV parser that supports ; , or tab delimiters and quotes
function detectDelimiter(headerLine: string): string {
  if (headerLine.includes("\t")) return "\t";
  if ((headerLine.match(/;/g) || []).length >= (headerLine.match(/,/g) || []).length) return ";";
  return ",";
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const delim = detectDelimiter(lines[0]);
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delim && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((l) => parseLine(l));
  return { headers, rows };
}

const norm = (v: string | undefined | null) => (v ?? "").trim();
const normUC = (v: string | undefined | null) =>
  norm(v)
    .toUpperCase()
    .replace(/\u00C4/g, "AE")
    .replace(/\u00D6/g, "OE")
    .replace(/\u00DC/g, "UE")
    .replace(/\u00DF/g, "SS");

const mapScope = (val: string | undefined): FilmScope => {
  const v = normUC(val);
  if (!v || v === "" || v === "K.A." || v === "K.A" || v === "K A") return "K_A";
  if (["FILM"].includes(v)) return "FILM";
  if (["DROHNE"].includes(v)) return "DROHNE";
  if (["NACHDREH"].includes(v)) return "NACHDREH";
  if (["FILM_UND_DROHNE", "FILM UND DROHNE", "F + D", "F+D"].includes(v)) return "FILM_UND_DROHNE";
  if (["FOTO", "PHOTO"].includes(v)) return "FOTO";
  if (["360", "360°", "360 GRAD", "GRAD_360"].includes(v)) return "GRAD_360";
  return "K_A";
};

const mapPriority = (val: string | undefined): FilmPriority => {
  const v = normUC(val);
  if (!v) return "NONE";
  if (["NONE", "-"].includes(v)) return "NONE";
  if (["FILM_SOLO", "FILM SOLO"].includes(v)) return "FILM_SOLO";
  if (["PRIO_1", "PRIO 1", "1"].includes(v)) return "PRIO_1";
  if (["PRIO_2", "PRIO 2", "2"].includes(v)) return "PRIO_2";
  return "NONE";
};

const mapPStatus = (val: string | undefined): FilmProjectStatus => {
  const v = normUC(val);
  if (!v) return "AKTIV";
  if (["AKTIV"].includes(v)) return "AKTIV";
  if (["BEENDET"].includes(v)) return "BEENDET";
  if (["WARTEN"].includes(v)) return "WARTEN";
  if (["VERZICHT"].includes(v)) return "VERZICHT";
  if (["MMW"].includes(v)) return "MMW";
  return "AKTIV";
};

const toDate = (val: string | undefined) => {
  const raw = norm(val);
  if (!raw) return undefined;
  const v = raw.replace(/\u00A0/g, " ").trim(); // normalize NBSP
  // Support dd.mm.yyyy (or d.m.yy), allowing spaces around dots and optional time hh:mm
  const dm = v.match(/^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (dm) {
    const [, dStr, mStr, yStr, hh, min] = dm;
    let y = Number(yStr);
    if (yStr.length === 2) {
      y += y < 70 ? 2000 : 1900;
    }
    const dNum = Number(dStr);
    const mNum = Number(mStr);
    const date = new Date(y, mNum - 1, dNum, hh ? Number(hh) : 0, min ? Number(min) : 0);
    if (!Number.isNaN(date.getTime())) return date;
    return undefined;
  }
  // Accept ISO-like only for fallback (YYYY-MM-DD...)
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return undefined;
};

export async function importFilmProjects(formData: FormData): Promise<ImportResult> {
  const file = formData.get("file") as File | null;
  if (!file) return { imported: 0, skipped: 0, errors: [{ row: 0, reason: "Keine Datei hochgeladen" }] };
  const text = await file.text();
  const { headers, rows } = parseCSV(text);

  const col = (name: string) => headers.findIndex((h) => h.trim().toLowerCase() === name.trim().toLowerCase());
  const idx = {
    partner: col("Kundennummer"),
    nameFirma: col("Name/Firma"),
    scope: col("Umfang"),
    priority: col("Prio / Nur Film"),
    filmer: col("Verantwortl. Filmer"),
    cutter: col("Cutter"),
    contractStart: col("8. Vetragsbeginn"),
    scouting: col("7. Scouting"),
    scriptToClient: col("6. Skript an Kunden"),
    scriptApproved: col("5. Skriptfreigabe"),
    shootDate: col("4. Drehtermin/Fototermin"),
    firstCutToClient: col("3. Vorabversion an Kunden"),
    finalToClient: col("2. Finalversion an Kunden"),
    onlineDate: col("1. Online"),
    lastContact: col("letzter Kontakt"),
    pStatus: col("Status"),
    reminderAt: col("Wiedervorlage am"),
    note: col("Hinweis"),
  };

  const requiredCols: (keyof typeof idx)[] = ["partner", "nameFirma"];
  for (const key of requiredCols) {
    if (idx[key] === -1) {
      return { imported: 0, skipped: 0, errors: [{ row: 0, reason: `Spalte fehlt: ${key}` }] };
    }
  }

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; reason: string }[] = [];
  const createdAgents: { name: string; email: string }[] = [];

  // Cache existing clients and agents to reduce queries
  const existingClients = new Map<string, { id: string }>();
  const existingAgents = new Map<string, { id: string }>();

  // Preload agents by name (only FILM category)
  const agentRecords = await prisma.user.findMany({
    where: {
      role: "AGENT",
      categories: {
        has: "FILM"
      }
    },
    select: { id: true, name: true }
  });
  for (const a of agentRecords) if (a.name) existingAgents.set(a.name.trim().toLowerCase(), { id: a.id });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // considering header at 1

    const partnerNoRaw = norm(row[idx.partner]);
    // Normalize customer number:
    // 1. Remove prefix E, EM or VW: E12345 -> 12345, VW12345 -> 12345, EM12345 -> 12345
    // 2. Remove suffix -1, -2, etc.: 12345-1 -> 12345
    // Multiple projects can have the same base customer number
    let partnerNoBase = partnerNoRaw;
    let projectTitleFromSuffix = "";

    // Remove E, EM or VW prefix
    partnerNoBase = partnerNoBase.replace(/^(E|EM|VW)/i, "");

    // Remove numeric suffix (e.g., -1, -2, -3)
    const suffixMatch = partnerNoBase.match(/^(.*?)-(\d+)$/);
    if (suffixMatch) {
      partnerNoBase = suffixMatch[1];
    }

    // Use raw number with suffix as project title if suffix was present
    if (partnerNoRaw !== partnerNoBase) {
      projectTitleFromSuffix = partnerNoRaw;
    }

    const clientName = norm(row[idx.nameFirma]);

    if (!partnerNoBase) {
      skipped++;
      errors.push({ row: rowNum, reason: "Partner-Nr. fehlt" });
      continue;
    }
    if (!clientName) {
      skipped++;
      errors.push({ row: rowNum, reason: "Name/Firma fehlt" });
      continue;
    }

    const scope = mapScope(row[idx.scope]);
    const priority = mapPriority(row[idx.priority]);
    const pStatus = mapPStatus(row[idx.pStatus]);

    const contractStart = toDate(row[idx.contractStart]);
    const scouting = toDate(row[idx.scouting]);
    const scriptToClient = toDate(row[idx.scriptToClient]);
    const scriptApproved = toDate(row[idx.scriptApproved]);
    const shootDate = toDate(row[idx.shootDate]);
    const firstCutToClient = toDate(row[idx.firstCutToClient]);
    const finalToClient = toDate(row[idx.finalToClient]);
    const onlineDate = toDate(row[idx.onlineDate]);
    const lastContact = toDate(row[idx.lastContact]);
    const reminderAt = toDate(row[idx.reminderAt]);

    const note = norm(row[idx.note]);
    const filmerNameRaw = norm(row[idx.filmer]);
    const cutterNameRaw = norm(row[idx.cutter]);

    // Check if filmer/cutter is "k.A." (keine Angabe)
    const isFilmerKA = !filmerNameRaw || filmerNameRaw.toLowerCase() === "k.a." || filmerNameRaw.toLowerCase() === "k.a" || filmerNameRaw.toLowerCase() === "k a";
    const isCutterKA = !cutterNameRaw || cutterNameRaw.toLowerCase() === "k.a." || cutterNameRaw.toLowerCase() === "k.a" || cutterNameRaw.toLowerCase() === "k a";

    const filmerName = isFilmerKA ? undefined : filmerNameRaw;
    const cutterName = isCutterKA ? undefined : cutterNameRaw;

    try {
      // Ensure client
      let client = existingClients.get(partnerNoBase);
      if (!client) {
        const found = await prisma.client.findUnique({ where: { customerNo: partnerNoBase }, select: { id: true } });
        if (found) {
          client = found;
        } else {
          client = await prisma.client.create({ data: { name: clientName, customerNo: partnerNoBase } });
        }
        existingClients.set(partnerNoBase, { id: client.id });
      }

      // Ensure filmer agent (by name), create unknown agents automatically with FILM category
      let filmerId: string | undefined = undefined;
      if (filmerName) {
        const key = filmerName.toLowerCase();
        let agent = existingAgents.get(key);
        if (!agent) {
          const found = await prisma.user.findFirst({
            where: {
              name: filmerName,
              role: "AGENT",
              categories: {
                has: "FILM"
              }
            },
            select: { id: true }
          });
          if (found) {
            agent = found;
          } else {
            // Create with generated email based on name
            const mkEmailLocal = (s: string) =>
              s
                .normalize("NFKD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9]+/g, ".")
                .replace(/^\.+|\.+$/g, "")
                .replace(/\.{2,}/g, ".")
                .toLowerCase() || "agent";
            const baseLocal = mkEmailLocal(filmerName);
            let local = baseLocal;
            let email = `${local}@eventomaxx.de`;
            let suffix = 1;
            // ensure unique email
            while (await prisma.user.findUnique({ where: { email } })) {
              local = `${baseLocal}${suffix++}`;
              email = `${local}@eventomaxx.de`;
            }
            const created = await prisma.user.create({
              data: {
                name: filmerName,
                email,
                role: "AGENT",
                active: true,
                categories: ["FILM"],
                password: `imported-${Math.random().toString(36).slice(2, 10)}`,
              },
              select: { id: true },
            });
            createdAgents.push({ name: filmerName, email });
            agent = created;
          }
          existingAgents.set(key, { id: agent.id });
        }
        filmerId = agent.id;
      }

      // Ensure cutter agent
      let cutterId: string | undefined = undefined;
      if (cutterName) {
        const key = cutterName.toLowerCase();
        let agent = existingAgents.get(key);
        if (!agent) {
          const found = await prisma.user.findFirst({
            where: {
              name: cutterName,
              role: "AGENT",
              categories: {
                has: "FILM"
              }
            },
            select: { id: true }
          });
          if (found) {
            agent = found;
          } else {
            // Create with generated email based on name
            const mkEmailLocal = (s: string) =>
              s
                .normalize("NFKD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9]+/g, ".")
                .replace(/^\.+|\.+$/g, "")
                .replace(/\.{2,}/g, ".")
                .toLowerCase() || "agent";
            const baseLocal = mkEmailLocal(cutterName);
            let local = baseLocal;
            let email = `${local}@eventomaxx.de`;
            let suffix = 1;
            // ensure unique email
            while (await prisma.user.findUnique({ where: { email } })) {
              local = `${baseLocal}${suffix++}`;
              email = `${local}@eventomaxx.de`;
            }
            const created = await prisma.user.create({
              data: {
                name: cutterName,
                email,
                role: "AGENT",
                active: true,
                categories: ["FILM"],
                password: `imported-${Math.random().toString(36).slice(2, 10)}`,
              },
              select: { id: true },
            });
            createdAgents.push({ name: cutterName, email });
            agent = created;
          }
          existingAgents.set(key, { id: agent.id });
        }
        cutterId = agent.id;
      }

      // Try to find existing film project based on clientId + filmerId + scouting + contractStart
      // This allows updating existing projects instead of creating duplicates
      const existingProject = await prisma.project.findFirst({
        where: {
          clientId: client.id,
          type: "FILM",
          film: {
            filmerId: filmerId ?? null,
            scouting: scouting ?? null,
            contractStart: contractStart ?? null,
          },
        },
        select: { id: true },
      });

      let project: { id: string };
      if (existingProject) {
        // Update existing project
        project = await prisma.project.update({
          where: { id: existingProject.id },
          data: {
            title: projectTitleFromSuffix,
            status: "WEBTERMIN", // Placeholder - will be overridden by film status logic
          },
          select: { id: true },
        });

        // Update film details
        await prisma.projectFilm.update({
          where: { projectId: project.id },
          data: {
            scope,
            priority,
            status: pStatus,
            filmerId: filmerId ?? null,
            cutterId: cutterId ?? null,
            contractStart: contractStart ?? null,
            scouting: scouting ?? null,
            scriptToClient: scriptToClient ?? null,
            scriptApproved: scriptApproved ?? null,
            shootDate: shootDate ?? null,
            firstCutToClient: firstCutToClient ?? null,
            finalToClient: finalToClient ?? null,
            onlineDate: onlineDate ?? null,
            lastContact: lastContact ?? null,
            reminderAt: reminderAt ?? null,
            note: note || null,
          },
        });
      } else {
        // Create new project
        project = await prisma.project.create({
          data: {
            title: projectTitleFromSuffix,
            type: "FILM",
            status: "WEBTERMIN", // Placeholder - will be overridden by film status logic
            clientId: client.id,
          },
          select: { id: true },
        });

        // Create film details (1:1)
        await prisma.projectFilm.create({
          data: {
            projectId: project.id,
            scope,
            priority,
            status: pStatus,
            filmerId: filmerId ?? null,
            cutterId: cutterId ?? null,
            contractStart: contractStart ?? null,
            scouting: scouting ?? null,
            scriptToClient: scriptToClient ?? null,
            scriptApproved: scriptApproved ?? null,
            shootDate: shootDate ?? null,
            firstCutToClient: firstCutToClient ?? null,
            finalToClient: finalToClient ?? null,
            onlineDate: onlineDate ?? null,
            lastContact: lastContact ?? null,
            reminderAt: reminderAt ?? null,
            note: note || null,
          },
        });
      }

      imported++;
    } catch (error: unknown) {
      skipped++;
      const reason = error instanceof Error ? error.message : String(error);
      errors.push({ row: rowNum, reason });
    }
  }

  revalidatePath("/film-projects");
  revalidatePath("/dashboard");
  const id = saveImportResult({ imported, skipped, errors, createdAgents });
  return { imported, skipped, errors, resultId: id, createdAgents };
}
