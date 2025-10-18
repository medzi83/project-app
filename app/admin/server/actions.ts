"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await getAuthSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}

const CreateServerSchema = z.object({
  name: z.string().min(1, "Bitte Servernamen angeben").trim(),
  ip: z.string().min(1, "Bitte IP-Adresse angeben").trim(),
  froxlorUrl: z.string().url("UngÃ¼ltige URL").trim().optional().or(z.literal("")),
  mysqlUrl: z.string().url("UngÃ¼ltige URL").trim().optional().or(z.literal("")),
  froxlorApiKey: z.string().trim().optional().or(z.literal("")),
  froxlorApiSecret: z.string().trim().optional().or(z.literal("")),
  sshHost: z.string().trim().optional().or(z.literal("")),
  sshPort: z.coerce.number().optional(),
  sshUsername: z.string().trim().optional().or(z.literal("")),
  sshPassword: z.string().trim().optional().or(z.literal("")),
});

export async function createServer(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateServerSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((issue) => issue.message).join("; ");
    redirect(`/admin/server?error=${encodeURIComponent(msg)}`);
  }

  const { name, ip, froxlorUrl, mysqlUrl, froxlorApiKey, froxlorApiSecret, sshHost, sshPort, sshUsername, sshPassword } = parsed.data;
  await prisma.server.create({
    data: {
      name,
      ip,
      froxlorUrl: froxlorUrl || null,
      mysqlUrl: mysqlUrl || null,
      froxlorApiKey: froxlorApiKey || null,
      froxlorApiSecret: froxlorApiSecret || null,
      sshHost: sshHost || null,
      sshPort: sshPort || null,
      sshUsername: sshUsername || null,
      sshPassword: sshPassword || null,
    },
  });

  revalidatePath("/admin/server");
  redirect("/admin/server?ok=1");
}

const UpdateServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).trim(),
  ip: z.string().min(1).trim(),
  froxlorUrl: z.string().url().trim().optional().or(z.literal("")),
  mysqlUrl: z.string().url().trim().optional().or(z.literal("")),
  froxlorApiKey: z.string().trim().optional().or(z.literal("")),
  froxlorApiSecret: z.string().trim().optional().or(z.literal("")),
  sshHost: z.string().trim().optional().or(z.literal("")),
  sshPort: z.coerce.number().optional(),
  sshUsername: z.string().trim().optional().or(z.literal("")),
  sshPassword: z.string().trim().optional().or(z.literal("")),
});

export async function updateServer(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateServerSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((issue) => issue.message).join("; ");
    redirect(`/admin/server?error=${encodeURIComponent(msg)}`);
  }

  const { id, name, ip, froxlorUrl, mysqlUrl, froxlorApiKey, froxlorApiSecret, sshHost, sshPort, sshUsername, sshPassword } = parsed.data;
  await prisma.server.update({
    where: { id },
    data: {
      name,
      ip,
      froxlorUrl: froxlorUrl || null,
      mysqlUrl: mysqlUrl || null,
      froxlorApiKey: froxlorApiKey || null,
      froxlorApiSecret: froxlorApiSecret || null,
      sshHost: sshHost || null,
      sshPort: sshPort || null,
      sshUsername: sshUsername || null,
      sshPassword: sshPassword || null,
    },
  });

  revalidatePath("/admin/server");
  redirect("/admin/server?ok=1");
}

const DeleteServerSchema = z.object({ id: z.string().min(1) });

export async function deleteServer(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = DeleteServerSchema.safeParse(raw);
  if (!parsed.success) {
    redirect("/admin/server");
  }

  await prisma.server.delete({ where: { id: parsed.data.id } });
  revalidatePath("/admin/server");
  redirect("/admin/server");
}

const MailServerBaseSchema = z.object({
  name: z.string().min(1, "Name fehlt").trim(),
  host: z.string().min(1, "Host fehlt").trim(),
  port: z.coerce.number().min(1, "Port muss > 0 sein").max(65535, "Port ist zu gross"),
  username: z.string().trim().optional().or(z.literal("")),
  password: z.string().trim().optional().or(z.literal("")),
  fromEmail: z.string().email("Bitte gÃ¼ltige Absender-E-Mail eintragen").trim(),
  fromName: z.string().trim().optional().or(z.literal("")),
  useTls: z.enum(["yes", "no"]).default("yes"),
  agencyId: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

const CreateMailServerSchema = MailServerBaseSchema;
const UpdateMailServerSchema = MailServerBaseSchema.extend({
  id: z.string().min(1),
});
const DeleteMailServerSchema = z.object({
  id: z.string().min(1),
});

function mapMailServerData(
  input: z.infer<typeof MailServerBaseSchema>,
  options?: { preservePassword?: boolean },
) {
  const passwordRaw = (input.password ?? "").trim();
  const data = {
    name: input.name.trim(),
    host: input.host.trim(),
    port: input.port,
    username: input.username?.trim() ? input.username.trim() : null,
    fromEmail: input.fromEmail.trim(),
    fromName: input.fromName?.trim() ? input.fromName.trim() : null,
    useTls: input.useTls !== "no",
    notes: input.notes?.trim() ? input.notes.trim() : null,
    agencyId: input.agencyId?.trim() ? input.agencyId.trim() : null,
    password: null as string | null,
  };

  if (passwordRaw) {
    data.password = passwordRaw;
  } else if (!options?.preservePassword) {
    data.password = null;
  }

  return data;
}

export async function createMailServer(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = CreateMailServerSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((issue) => issue.message).join("; ");
    redirect(`/admin/server?mailError=${encodeURIComponent(msg)}`);
  }

  await prisma.mailServer.create({
    data: mapMailServerData(parsed.data!, { preservePassword: false }),
  });

  revalidatePath("/admin/server");
  redirect("/admin/server?mailOk=1");
}

export async function updateMailServer(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateMailServerSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((issue) => issue.message).join("; ");
    redirect(`/admin/server?mailError=${encodeURIComponent(msg)}`);
  }

  const { id, ...rest } = parsed.data!;
  const payload = mapMailServerData(rest, { preservePassword: true });

  // Remove password from payload if preservePassword is true and password is null
  const updateData: any = { ...payload };
  if (!payload.password && payload.password === null) {
    delete updateData.password;
  }

  await prisma.mailServer.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/admin/server");
  redirect("/admin/server?mailOk=1");
}

export async function deleteMailServer(formData: FormData) {
  await requireAdmin();
  const raw = Object.fromEntries(formData.entries());
  const parsed = DeleteMailServerSchema.safeParse(raw);
  if (!parsed.success) {
    redirect("/admin/server");
  }

  await prisma.mailServer.delete({ where: { id: parsed.data.id } });
  revalidatePath("/admin/server");
  redirect("/admin/server?mailOk=1");
}
