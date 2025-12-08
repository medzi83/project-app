"use server";

import { prisma } from "@/lib/prisma";
import { derivePrintDesignStatus, mapPrintDesignStatusToProjectStatus } from "@/lib/print-design-status";
import { normalizeAgentIdForDB } from "@/lib/agent-helpers";
import { processTriggers } from "@/lib/email/trigger-service";
import type {
  Prisma,
  ProductionStatus,
  PrintDesignType,
} from "@prisma/client";
import { getAuthSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ProjectKey = z.enum(["agentId"]);
const PrintDesignKey = z.enum([
  "projectType",
  "pStatus",
  "webtermin",
  "designToClient",
  "designApproval",
  "finalVersionToClient",
  "printRequired",
  "printOrderPlaced",
  "printProvider",
  "note",
]);

const FormSchema = z.object({
  target: z.enum(["project", "printDesign"]),
  id: z.string().min(1), // projectId
  key: z.string().min(1),
  value: z.string().optional(),
  extraValue: z.string().optional(),
});

const dateKeys = new Set([
  "designToClient",
  "designApproval",
  "finalVersionToClient",
  "printOrderPlaced",
]);
const dateTimeKeys = new Set(["webtermin"]);
const boolKeys = new Set(["printRequired"]);
const statusRelevantPrintDesignKeys = new Set([
  "pStatus",
  "webtermin",
  "designToClient",
  "designApproval",
  "finalVersionToClient",
  "printRequired",
  "printOrderPlaced",
]);

function coerce(key: string, v: string | undefined) {
  if (v === undefined) return null;
  const s = v.trim();
  if (s === "") return null;
  // For datetime fields: "2025-10-24T14:30" -> store as "2025-10-24T14:30:00.000Z"
  if (dateTimeKeys.has(key)) return new Date(s + ":00.000Z");
  // For date-only fields: "2025-10-24" -> store as "2025-10-24T00:00:00.000Z"
  if (dateKeys.has(key)) return new Date(s + "T00:00:00.000Z");
  if (boolKeys.has(key)) return s === "yes" ? true : s === "no" ? false : null;
  return s;
}

export async function updatePrintDesignInlineField(
  formData: FormData
): Promise<{
  emailTriggered: boolean;
  queueIds?: string[];
}> {
  const session = await getAuthSession();
  if (
    !session?.user ||
    !["ADMIN", "AGENT"].includes(session.user.role || "")
  ) {
    throw new Error("FORBIDDEN");
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = FormSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Bad request");
  const { target, id, key, value } = parsed.data;

  let emailTriggered = false;
  let emailQueueIds: string[] = [];

  if (target === "project") {
    const projectKey = ProjectKey.parse(key);
    const nextAgentId = value && value !== "" ? value : null;
    if (projectKey === "agentId") {
      const { baseAgentId } = normalizeAgentIdForDB(nextAgentId);
      await prisma.project.update({ where: { id }, data: { agentId: baseAgentId } });
    }
  } else {
    const printDesignKey = PrintDesignKey.parse(key);
    const parsedValue = coerce(printDesignKey, value);

    // Fetch old values for trigger comparison
    const oldProject = await prisma.project.findUnique({
      where: { id },
      include: { printDesign: true },
    });
    const oldValue =
      oldProject?.printDesign?.[
        printDesignKey as keyof typeof oldProject.printDesign
      ];

    const updateData: Prisma.ProjectPrintDesignUncheckedUpdateInput = {};
    const createData: Prisma.ProjectPrintDesignUncheckedCreateInput = {
      projectId: id,
    };

    switch (printDesignKey) {
      case "projectType": {
        const nextValue = (typeof parsedValue === "string"
          ? parsedValue
          : "LOGO") as PrintDesignType;
        updateData.projectType = nextValue;
        createData.projectType = nextValue;
        break;
      }
      case "pStatus": {
        const nextValue = (typeof parsedValue === "string"
          ? parsedValue
          : "NONE") as ProductionStatus;
        updateData.pStatus = nextValue;
        createData.pStatus = nextValue;
        break;
      }
      case "webtermin": {
        const nextValue = parsedValue instanceof Date ? parsedValue : null;
        updateData.webtermin = nextValue;
        createData.webtermin = nextValue;
        break;
      }
      case "designToClient": {
        const nextValue = parsedValue instanceof Date ? parsedValue : null;
        updateData.designToClient = nextValue;
        createData.designToClient = nextValue;
        break;
      }
      case "designApproval": {
        const nextValue = parsedValue instanceof Date ? parsedValue : null;
        updateData.designApproval = nextValue;
        createData.designApproval = nextValue;
        break;
      }
      case "finalVersionToClient": {
        const nextValue = parsedValue instanceof Date ? parsedValue : null;
        updateData.finalVersionToClient = nextValue;
        createData.finalVersionToClient = nextValue;
        break;
      }
      case "printRequired": {
        const nextValue = typeof parsedValue === "boolean" ? parsedValue : false;
        updateData.printRequired = nextValue;
        createData.printRequired = nextValue;
        break;
      }
      case "printOrderPlaced": {
        const nextValue = parsedValue instanceof Date ? parsedValue : null;
        updateData.printOrderPlaced = nextValue;
        createData.printOrderPlaced = nextValue;
        break;
      }
      case "printProvider": {
        const nextValue = typeof parsedValue === "string" ? parsedValue : null;
        updateData.printProvider = nextValue;
        createData.printProvider = nextValue ?? undefined;
        break;
      }
      case "note": {
        const nextValue = typeof parsedValue === "string" ? parsedValue : null;
        updateData.note = nextValue;
        createData.note = nextValue ?? undefined;
        break;
      }
    }

    await prisma.projectPrintDesign.upsert({
      where: { projectId: id },
      update: updateData,
      create: createData,
    });

    // Process email triggers
    try {
      const queueIds = await processTriggers(
        id,
        { [printDesignKey]: parsedValue },
        { [printDesignKey]: oldValue }
      );
      if (queueIds && queueIds.length > 0) {
        emailTriggered = true;
        emailQueueIds = queueIds;
      }
    } catch (error) {
      console.error("Error processing triggers:", error);
      // Don't fail the update if trigger processing fails
    }

    // Update derived status if relevant field changed
    if (statusRelevantPrintDesignKeys.has(printDesignKey)) {
      const project = await prisma.project.findUnique({
        where: { id },
        select: {
          status: true,
          printDesign: {
            select: {
              pStatus: true,
              webtermin: true,
              designToClient: true,
              designApproval: true,
              finalVersionToClient: true,
              printRequired: true,
              printOrderPlaced: true,
            },
          },
        },
      });
      if (project && project.printDesign) {
        const derivedStatus = derivePrintDesignStatus({
          status: project.printDesign.pStatus,
          webtermin: project.printDesign.webtermin,
          designToClient: project.printDesign.designToClient,
          designApproval: project.printDesign.designApproval,
          finalVersionToClient: project.printDesign.finalVersionToClient,
          printRequired: project.printDesign.printRequired,
          printOrderPlaced: project.printDesign.printOrderPlaced,
        });
        const nextStatus = mapPrintDesignStatusToProjectStatus(derivedStatus);
        if (project.status !== nextStatus) {
          await prisma.project.update({
            where: { id },
            data: { status: nextStatus },
          });
        }
      }
    }
  }

  revalidatePath("/print-design");
  return {
    emailTriggered,
    queueIds: emailQueueIds.length > 0 ? emailQueueIds : undefined,
  };
}
