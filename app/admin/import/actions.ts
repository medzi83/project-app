"use server";\nimport type { Prisma } from "@prisma/client";\nimport { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { saveImportResult } from "./store";

type ImportResult = {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  resultId?: string;
  createdAgents?: { name: string; email: string }[];
};

// Ephemeral in-memory store for last import results to show on result page
// Note: helper storage moved to ./store (no "use server")

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

const mapPriority = (val: string | undefined) => {
  const v = normUC(val);
  if (!v) return "NONE" as const;
  if (["1", "PRIO 1", "PRIO_1", "P1"].includes(v)) return "PRIO_1" as const;
  if (["2", "PRIO 2", "PRIO_2", "P2"].includes(v)) return "PRIO_2" as const;
  if (["3", "PRIO 3", "PRIO_3", "P3"].includes(v)) return "PRIO_3" as const;
  if (["NONE", "KEINE", "0"].includes(v)) return "NONE" as const;
  return "NONE" as const;
};

const mapProjectStatus = (val: string | undefined): Prisma.$Enums.ProjectStatus => {
  const v = normUC(val);
  switch (v) {
    case "WEBTERMIN":
    case "MATERIAL":
    case "UMSETZUNG":
    case "DEMO":
    case "ONLINE":
      return v as Prisma.$Enums.ProjectStatus;
    default:
      return "WEBTERMIN";
  }
};

const mapCMS = (val: string | undefined) => {
  const v = normUC(val);
  if (["WORDPRESS", "WP"].includes(v)) return { cms: "WORDPRESS" as const, other: undefined };
  if (["JOOMLA"].includes(v)) return { cms: "JOOMLA" as const, other: undefined };
  if (["SHOPWARE", "SW"].includes(v)) return { cms: "SHOPWARE" as const, other: undefined };
  if (["LOGO"].includes(v)) return { cms: "LOGO" as const, other: undefined };
  if (["PRINT"].includes(v)) return { cms: "PRINT" as const, other: undefined };
  if (["CUSTOM"].includes(v)) return { cms: "CUSTOM" as const, other: undefined };
  if (!v) return { cms: "OTHER" as const, other: undefined };
  return { cms: "OTHER" as const, other: norm(val) };
};

const mapPStatus = (val: string | undefined) => {
  const v = normUC(val);
  if (!v) return "NONE" as const;
  if (["BEENDET"].includes(v)) return "BEENDET" as const;
  if (["MMW"].includes(v)) return "MMW" as const;
  if ([
    "VOLLST A K",
    "VOLLST_A_K",
    "VOLLST. A/K",
    "VOLLST. A.K.",
    "VOLLST A.K.",
    "VOLLST. A K",
    "VOLLSTAK",
  ].includes(v)) return "VOLLST_A_K" as const;
  return "NONE" as const;
};

const mapYN4 = (val: string | undefined) => {
  const v = normUC(val);
  if (["NEIN", "N", "NO"].includes(v)) return "NEIN" as const;
  if (["NEIN/NEIN", "NEIN_NEIN", "N/N"].includes(v)) return "NEIN_NEIN" as const;
  if (["JA/NEIN", "JA_NEIN", "J/N", "FRAGEBOGEN"].includes(v)) return "JA_NEIN" as const;
  if (["JA/JA", "JA_JA", "J/J", "ANALYSE", "FERTIG"].includes(v)) return "JA_JA" as const;
  if (!v) return undefined;
  return undefined;
};

const mapMaterial = (val: string | undefined) => {
  const v = normUC(val);
  // Leerwerte erlaubt, sonst Werte wie in der App
  if (!v) return undefined; // bleibt Default ANGEFORDERT
  if (["ANGEFORDERT"].includes(v)) return "ANGEFORDERT" as const;
  if (["TEILWEISE", "TEILW"].includes(v)) return "TEILWEISE" as const;
  if (["VOLLSTAENDIG", "VOLLST", "JA"].includes(v)) return "VOLLSTAENDIG" as const;
  if (["NV", "NEIN"].includes(v)) return "NV" as const;
  return undefined;
};

const toDate = (val: string | undefined) => {
  const raw = norm(val);
  if (!raw) return undefined;
  const v = raw.replace(/\u00A0/g, " ").trim(); // normalize NBSP
  // Support dd.mm.yyyy (or d.m.yy), allowing spaces around dots and optional time hh:mm
  const dm = v.match(/^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (dm) {
    const [_, dStr, mStr, yStr, hh, min] = dm;
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

export async function importProjects(formData: FormData): Promise<ImportResult> {
  const file = formData.get("file") as File | null;
  if (!file) return { imported: 0, skipped: 0, errors: [{ row: 0, reason: "Keine Datei hochgeladen" }] };

  const text = await file.text();
  const { headers, rows } = parseCSV(text);
  const col = (name: string) => headers.findIndex((h) => h.trim().toLowerCase() === name.trim().toLowerCase());

  const idx = {
    prio: col("Prio"),
    status: col("Status"),
    partner: col("Partner-Nr."),
    nameFirma: col("Name/Firma"),
    cms: col("CMS"),
    pstatus: col("3. P-Status"),
    umsetzer: col("Umsetzer"),
    webtermin: col("5. Webtermin"),
    demo: col("2. Demo an Kunden"),
    effortBuild: col("Zeitaufwand Umsetzung"),
    effortDemo: col("Zeitaufwand Demo"),
    online: col("1. Online"),
    material: col("Material vorhanden?"),
    lastMat: col("4. letzter Materialeingang"),
    arbeitstage: col("Arbeitstage"),
    seo: col("SEO  (Fragebogen /Analyse)"),
    textit: col("Textit (raus / fertig)"),
    accessible: col("Barrierefrei ÃƒÂ¢Ã¢â€žÂ¢Ã‚Â¿"),
    note: col("Hinweis"),
  };

  const requiredCols: (keyof typeof idx)[] = ["status", "partner", "nameFirma"];
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

  // Preload agents by name
  const agentRecords = await prisma.user.findMany({ where: { role: "AGENT" }, select: { id: true, name: true } });
  for (const a of agentRecords) if (a.name) existingAgents.set(a.name.trim().toLowerCase(), { id: a.id });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // considering header at 1

    const partnerNoRaw = norm(row[idx.partner]);
    // Split optional -1/-2 suffix: same client (base), title only set when suffix present
    let partnerNoBase = partnerNoRaw;
    let projectTitleFromSuffix = "";
    const suffixMatch = partnerNoRaw.match(/^(.*?)-(1|2)$/);
    if (suffixMatch) {
      partnerNoBase = suffixMatch[1];
      projectTitleFromSuffix = partnerNoRaw; // keep full with -1/-2 as title
    }
    const clientName = norm(row[idx.nameFirma]);
    let status = mapProjectStatus(row[idx.status]);
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

    const prio = mapPriority(row[idx.prio]);
    const { cms, other: cmsOther } = mapCMS(row[idx.cms]);
    const pStatus = mapPStatus(row[idx.pstatus]);
    if (pStatus === 'BEENDET') { status = 'ONLINE' as const; }
    const webDate = toDate(row[idx.webtermin]);
    const demoDate = toDate(row[idx.demo]);
    const onlineDate = toDate(row[idx.online]);
    const lastMaterialAt = toDate(row[idx.lastMat]);
    const parseHoursToMinutes = (raw: string | undefined) => {
      const s = norm(raw).replace(',', '.');
      if (!s) return NaN;
      const v = Number.parseFloat(s);
      if (!Number.isFinite(v)) return NaN;
      return Math.round(v * 60);
    };
    const effortBuildMin = parseHoursToMinutes(row[idx.effortBuild]);
    const effortDemoMin = parseHoursToMinutes(row[idx.effortDemo]);
    const materialStatus = mapMaterial(row[idx.material]);
    const seo = mapYN4(row[idx.seo]);
    const textit = mapYN4(row[idx.textit]);
    const accessible = (() => {
      const v = normUC(row[idx.accessible]);
      if (!v) return undefined;
      if (["JA", "J", "TRUE", "1", "X"].includes(v)) return true;
      if (["NEIN", "N", "FALSE", "0"].includes(v)) return false;
      return undefined;
    })();
    const note = norm(row[idx.note]);
    const umsetzerName = norm(row[idx.umsetzer]);

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

      // Ensure agent (by name), create unknown agents automatically
      let agentId: string | undefined = undefined;
      if (umsetzerName) {
        const key = umsetzerName.toLowerCase();
        let agent = existingAgents.get(key);
        if (!agent) {
          const found = await prisma.user.findFirst({ where: { name: umsetzerName, role: "AGENT" }, select: { id: true } });
          if (found) {
            agent = found;
          } else {
            // Create with generated email based on name to satisfy potential NOT NULL/UNIQUE constraints
            const mkEmailLocal = (s: string) =>
              s
                .normalize("NFKD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9]+/g, ".")
                .replace(/^\.+|\.+$/g, "")
                .replace(/\.{2,}/g, ".")
                .toLowerCase() || "agent";
            const baseLocal = mkEmailLocal(umsetzerName);
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
                name: umsetzerName,
                email,
                role: "AGENT",
                active: true,
                // Password ist erforderlich; hier Dummy, da Login darÃƒÆ’Ã‚Â¼ber nicht vorgesehen ist
                password: `imported-${Math.random().toString(36).slice(2, 10)}`,
              },
              select: { id: true },
            });
            createdAgents.push({ name: umsetzerName, email });
            agent = created;
          }
          existingAgents.set(key, { id: agent.id });
        }
        agentId = agent.id;
      }

      const project = await prisma.project.create({
        data: {
          // Only set title when suffix present in import (e.g., 12345-1 or 12345-2), otherwise keep empty
          title: projectTitleFromSuffix,
          status,
          clientId: client.id,
          agentId: agentId ?? null,
        },
        select: { id: true },
      });

      // Upsert website details (1:1)
      await prisma.projectWebsite.upsert({
        where: { projectId: project.id },
        create: {
          projectId: project.id,
          priority: prio,
          pStatus,
          cms,
          cmsOther: cmsOther,
          webDate: webDate ?? null,
          demoDate: demoDate ?? null,
          onlineDate: onlineDate ?? null,
          lastMaterialAt: lastMaterialAt ?? null,
          effortBuildMin: Number.isFinite(effortBuildMin) ? effortBuildMin : null,
          effortDemoMin: Number.isFinite(effortDemoMin) ? effortDemoMin : null,
          seo: seo ?? undefined,
          textit: textit ?? undefined,
          accessible: accessible ?? null,
          note: note || null,
          materialStatus: materialStatus ?? undefined,
        },
        update: {
          priority: prio,
          pStatus,
          cms,
          cmsOther: cmsOther,
          webDate: webDate ?? null,
          demoDate: demoDate ?? null,
          onlineDate: onlineDate ?? null,
          lastMaterialAt: lastMaterialAt ?? null,
          effortBuildMin: Number.isFinite(effortBuildMin) ? effortBuildMin : null,
          effortDemoMin: Number.isFinite(effortDemoMin) ? effortDemoMin : null,
          seo: seo ?? undefined,
          textit: textit ?? undefined,
          accessible: accessible ?? null,
          note: note || null,
          materialStatus: materialStatus ?? undefined,
        },
      });

      imported++;
    } catch (error: unknown) {
      skipped++;
      const reason = error instanceof Error ? error.message : String(error);
      errors.push({ row: rowNum, reason });
    }
  }

  revalidatePath("/dashboard");
  const id = saveImportResult({ imported, skipped, errors, createdAgents });
  return { imported, skipped, errors, resultId: id, createdAgents };
}
















