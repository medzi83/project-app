import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import BasisinstallationClient from "./client";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BasisinstallationPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const preselectedClientId = typeof params.clientId === "string" ? params.clientId : undefined;

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
          updatedAt: true,
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

  return <BasisinstallationClient clients={clients} servers={servers} preselectedClientId={preselectedClientId} />;
}
