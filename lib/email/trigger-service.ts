import { prisma } from "@/lib/prisma";
import { sendProjectEmail } from "./send-service";
import type { Project, ProjectWebsite, ProjectFilm } from "@prisma/client";

type ProjectWithDetails = Project & {
  website?: ProjectWebsite | null;
  film?:
    | (ProjectFilm & {
        filmer?: { id: string; name: string | null; email: string | null } | null;
        cutter?: { id: string; name: string | null; email: string | null } | null;
        previewVersions?: Array<{ sentDate: Date; link: string; version: number }>;
      })
    | null;
  client?:
    | {
        id: string;
        name: string;
        email: string | null;
        customerNo: string | null;
        contact: string | null;
        salutation: string | null;
        firstname: string | null;
        lastname: string | null;
        phone: string | null;
        agency: { id: string } | null;
      }
    | null;
  agent?:
    | {
        id: string;
        name: string | null;
        email: string | null;
        fullName: string | null;
        roleTitle: string | null;
        categories: string[];
      }
    | null;
};

/**
 * Check if a field was just set (changed from null/undefined to a value)
 */
function wasFieldSet(oldValue: unknown, newValue: unknown): boolean {
  return (oldValue == null || oldValue === "") && newValue != null && newValue !== "";
}

/**
 * Process email triggers when a project field is updated
 * @returns Array of queue IDs that need confirmation
 */
export async function processTriggers(
  projectId: string,
  updatedFields: Record<string, unknown>,
  oldValues: Record<string, unknown>
): Promise<string[]> {
  // Fetch the project with all necessary relations
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      website: true,
      film: {
        include: {
          filmer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          cutter: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          previewVersions: {
            select: {
              sentDate: true,
              link: true,
              version: true,
            },
            orderBy: {
              sentDate: "desc",
            },
            take: 1,
          },
        },
      },
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          customerNo: true,
          contact: true,
          salutation: true,
          firstname: true,
          lastname: true,
          phone: true,
          agency: {
            select: {
              id: true,
            },
          },
        },
      },
      agent: {
        select: {
          id: true,
          name: true,
          email: true,
          fullName: true,
          roleTitle: true,
          categories: true,
        },
      },
    },
  });

  if (!project) {
    console.error(`Project ${projectId} not found`);
    return [];
  }

  // Find all active triggers for this project type
  const triggers = await prisma.emailTrigger.findMany({
    where: {
      active: true,
      OR: [
        { projectType: null }, // Triggers for all project types
        { projectType: project.type },
      ],
    },
    include: {
      template: true,
    },
  });

  const confirmationQueueIds: string[] = [];

  for (const trigger of triggers) {
    try {
      console.log(`[Trigger Check] Checking trigger: ${trigger.name} (${trigger.triggerType})`);
      console.log(`[Trigger Check] Updated fields:`, updatedFields);
      console.log(`[Trigger Check] Old values:`, oldValues);
      console.log(`[Trigger Check] Conditions:`, trigger.conditions);

      const shouldTrigger = await checkTriggerCondition(
        trigger,
        project as ProjectWithDetails,
        updatedFields,
        oldValues
      );

      console.log(`[Trigger Check] Should trigger: ${shouldTrigger}`);

      if (shouldTrigger) {
        const queueId = await queueEmail(trigger, project as ProjectWithDetails);
        if (queueId) {
          confirmationQueueIds.push(queueId);
        }
      }
    } catch (error) {
      console.error(`Error processing trigger ${trigger.id}:`, error);
    }
  }

  return confirmationQueueIds;
}

/**
 * Check if a trigger's conditions are met
 */
async function checkTriggerCondition(
  trigger: { triggerType: string; conditions: unknown },
  project: ProjectWithDetails,
  updatedFields: Record<string, unknown>,
  oldValues: Record<string, unknown>
): Promise<boolean> {
  const conditions = trigger.conditions as Record<string, unknown> | null;

  switch (trigger.triggerType) {
    case "DATE_REACHED": {
      // This should be handled by a scheduled job, not on update
      return false;
    }

    case "CONDITION_MET": {
      // Custom condition logic
      const operator = conditions?.operator as string | undefined;
      const field = conditions?.field as string | undefined;

      if (!field || !operator) return false;

      // Check if field was updated
      if (!(field in updatedFields)) return false;

      if (operator === "SET") {
        return wasFieldSet(oldValues[field], updatedFields[field]);
      }

      if (operator === "EQUALS") {
        const expectedValue = conditions?.value as string | undefined;
        if (!expectedValue) return false;

        // Check if the new value equals the expected value
        const newValue = updatedFields[field];
        console.log(`[Trigger EQUALS] Field: ${field}, Expected: ${expectedValue}, Actual: ${newValue}, Match: ${newValue === expectedValue}`);
        return newValue === expectedValue;
      }

      // Add more operators as needed
      return false;
    }

    case "MANUAL": {
      // Manual triggers are not automatically executed
      return false;
    }

    default:
      return false;
  }
}

/**
 * Queue an email for sending (or mark for confirmation if no delay)
 * @returns The queue ID if confirmation is needed, null otherwise
 */
async function queueEmail(
  trigger: {
    id: string;
    name: string;
    templateId: string;
    delayDays: number | null;
    delayType: string | null;
    recipientConfig: unknown;
    template: {
      id: string;
      title: string;
      subject: string;
      body: string;
    };
  },
  project: ProjectWithDetails
) {
  const recipientConfig = trigger.recipientConfig as { to: string; cc?: string[] } | null;
  if (!recipientConfig?.to) {
    console.warn(`Trigger ${trigger.id} has no recipient configuration`);
    return;
  }

  // Calculate send date based on delay
  let scheduledFor = new Date();
  const shouldSendImmediately = trigger.delayDays == null || trigger.delayDays === 0;

  if (trigger.delayDays != null && trigger.delayDays > 0) {
    const days = trigger.delayDays;
    scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + days);
  }

  // Determine recipient email
  let recipientEmail: string | null = null;

  switch (recipientConfig.to) {
    case "CLIENT":
      recipientEmail = project.client?.email || null;
      break;
    case "AGENT":
      recipientEmail = project.agent?.email || null;
      break;
    case "FILMER":
      recipientEmail = project.film?.filmer?.email || null;
      break;
    case "CUTTER":
      recipientEmail = project.film?.cutter?.email || null;
      break;
  }

  // If no email is set, use a placeholder for immediate triggers (user will be prompted to fill it in)
  // For delayed triggers, skip if no email is available
  if (!recipientEmail) {
    if (shouldSendImmediately) {
      console.log(`No email found for ${recipientConfig.to}, but creating queue for user confirmation`);
      recipientEmail = ""; // Empty string - user must fill in confirmation dialog
    } else {
      console.warn(`Could not determine recipient email for delayed trigger ${trigger.id}, recipient type: ${recipientConfig.to}`);
      return;
    }
  }

  // Build CC list
  const ccEmails: string[] = [];
  if (recipientConfig.cc && Array.isArray(recipientConfig.cc)) {
    for (const ccType of recipientConfig.cc) {
      let ccEmail: string | null = null;

      switch (ccType) {
        case "AGENT":
          ccEmail = project.agent?.email || null;
          break;
        case "FILMER":
          ccEmail = project.film?.filmer?.email || null;
          break;
        case "CUTTER":
          ccEmail = project.film?.cutter?.email || null;
          break;
      }

      if (ccEmail) {
        ccEmails.push(ccEmail);
      }
    }
  }

  // Replace placeholders in subject and body
  const subject = replacePlaceholders(trigger.template.subject, project);
  let body = replacePlaceholders(trigger.template.body, project);

  // Load and append signature based on agency
  const agencyId = project.client?.agency?.id ?? null;
  const signature = await prisma.emailSignature.findFirst({
    where: { agencyId },
    orderBy: { createdAt: "asc" },
  });

  if (signature) {
    // Replace placeholders in signature as well
    const signatureWithData = replacePlaceholders(signature.body, project);
    body = body + "\n\n" + signatureWithData;
  }

  // Determine status: immediate emails need confirmation, delayed emails go straight to PENDING
  const queueStatus = shouldSendImmediately ? "PENDING_CONFIRMATION" : "PENDING";

  // Create queued email (with appropriate status)
  const queuedEmail = await prisma.emailQueue.create({
    data: {
      projectId: project.id,
      triggerId: trigger.id,
      toEmail: recipientEmail,
      ccEmails: ccEmails.length > 0 ? ccEmails.join(",") : null,
      subject,
      body,
      scheduledFor,
      status: queueStatus,
    },
  });

  if (shouldSendImmediately) {
    console.log(`✓ Email queued for confirmation: "${trigger.name}" to ${recipientEmail} (ID: ${queuedEmail.id})`);
    return queuedEmail.id; // Return queue ID for client-side confirmation dialog
  } else {
    console.log(`Queued email for trigger "${trigger.name}" to ${recipientEmail}, scheduled for ${scheduledFor.toISOString()}`);
    return null;
  }
}

/**
 * Replace placeholders in template text with actual project data
 */
function replacePlaceholders(text: string, project: ProjectWithDetails): string {
  const formatDate = (value?: Date | null) =>
    value ? value.toLocaleDateString("de-DE") : "";

  const formatDateTime = (value?: Date | null) =>
    value ? value.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "";

  const formatWebterminType = (type?: string | null) => {
    switch (type) {
      case "TELEFONISCH": return "Telefonisch";
      case "BEIM_KUNDEN": return "Beim Kunden";
      case "IN_DER_AGENTUR": return "In der Agentur";
      default: return "";
    }
  };

  // Get latest preview version link if available
  const latestPreviewLink = project.film?.previewVersions?.[0]?.link ?? "";
  const latestPreviewDate = project.film?.previewVersions?.[0]?.sentDate
    ? formatDate(project.film.previewVersions[0].sentDate)
    : "";
  const latestPreviewVersion = project.film?.previewVersions?.[0]?.version?.toString() ?? "";

  const replacements: Record<string, string> = {
    "{{project.title}}": project.title ?? "",
    "{{project.id}}": project.id,
    "{{project.status}}": project.status ?? "",
    "{{project.webDate}}": formatDateTime(project.website?.webDate ?? null),
    "{{project.webterminType}}": formatWebterminType(project.website?.webterminType),
    "{{project.demoDate}}": formatDate(project.website?.demoDate ?? null),
    "{{project.lastMaterialAt}}": formatDate(project.website?.lastMaterialAt ?? null),
    "{{project.agentName}}": project.agent?.name ?? "",

    "{{client.name}}": project.client?.name ?? "",
    "{{client.customerNo}}": project.client?.customerNo ?? "",
    "{{client.salutation}}": project.client?.salutation ?? "",
    "{{client.firstname}}": project.client?.firstname ?? "",
    "{{client.lastname}}": project.client?.lastname ?? "",
    "{{client.contact}}":
      project.client?.firstname && project.client?.lastname
        ? `${project.client.firstname} ${project.client.lastname}`
        : project.client?.contact ?? "",
    "{{client.phone}}": project.client?.phone ?? "",

    "{{agent.name}}": project.agent?.name ?? "",
    "{{agent.fullName}}": project.agent?.fullName ?? "",
    "{{agent.roleTitle}}": project.agent?.roleTitle ?? "",
    "{{agent.email}}": project.agent?.email ?? "",
    "{{agent.categories}}": project.agent?.categories?.join(", ") ?? "",

    "{{website.domain}}": project.website?.domain ?? "",
    "{{website.webDate}}": formatDateTime(project.website?.webDate ?? null),
    "{{website.demoDate}}": formatDate(project.website?.demoDate ?? null),
    "{{website.demoLink}}": project.website?.demoLink ?? "",

    "{{film.scope}}": project.film?.scope ?? "",
    "{{film.status}}": project.film?.status ?? "",
    "{{film.shootDate}}": formatDate(project.film?.shootDate ?? null),
    "{{film.filmerName}}": project.film?.filmer?.name ?? "",
    "{{film.previewLink}}": latestPreviewLink,
    "{{film.previewDate}}": latestPreviewDate,
    "{{film.previewVersion}}": latestPreviewVersion,
    "{{film.finalLink}}": project.film?.finalLink ?? "",
    "{{film.onlineLink}}": project.film?.onlineLink ?? "",
  };

  let result = text;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }

  return result;
}
