import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import BasisinstallationClient from "./client";

export default async function BasisinstallationPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      customerNo: true,
      projects: {
        where: {
          type: "WEBSITE",
        },
        select: {
          id: true,
          title: true,
          status: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  const servers = await prisma.server.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      ip: true,
      froxlorUrl: true,
      froxlorApiKey: true,
      froxlorApiSecret: true,
    },
  });

  return <BasisinstallationClient clients={clients} servers={servers} />;
}
