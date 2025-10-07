import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";

export default async function AdminStatisticsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Statistik</h1>
      <p className="text-sm text-muted-foreground">
        Hier entstehen kuenftig Auswertungen und Uebersichten.
      </p>
    </div>
  );
}
