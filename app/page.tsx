import { getAuthSession } from "@/lib/authz";

import Link from "next/link";

export default async function Home() {
  const session = await getAuthSession();
  if (!session) {
    return <div className="p-6">Nicht angemeldet. <Link className="underline" href="/login">Login</Link></div>;
  }
  const role = session.user.role;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Projektverwaltung</h1>
      <p>Angemeldet als <b>{session.user?.email}</b> ({role})</p>
      <Link className="underline" href="/projects">Projekte ansehen</Link><p></p>
      {session?.user?.role === "ADMIN" && (
  <Link href="/admin" className="underline">Admin</Link>
)}

    </main>
  );
}
