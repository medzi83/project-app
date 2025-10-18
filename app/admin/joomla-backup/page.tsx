import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import JoomlaBackupClient from "./client";
import { promises as fs } from "fs";
import path from "path";

export default async function JoomlaBackupPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const storageDir = path.join(process.cwd(), "storage", "joomla");

  // Check for existing files
  let kickstartExists = false;
  let backupExists = false;
  let backupFileName = "";
  let kickstartSize = 0;
  let backupSize = 0;

  try {
    await fs.access(storageDir);
    const files = await fs.readdir(storageDir);

    const kickstartFile = files.find((f) => f === "kickstart.php");
    if (kickstartFile) {
      kickstartExists = true;
      const stats = await fs.stat(path.join(storageDir, kickstartFile));
      kickstartSize = stats.size;
    }

    const backupFile = files.find((f) => f.endsWith(".jpa") || f.endsWith(".zip"));
    if (backupFile) {
      backupExists = true;
      backupFileName = backupFile;
      const stats = await fs.stat(path.join(storageDir, backupFile));
      backupSize = stats.size;
    }
  } catch (error) {
    // Directory doesn't exist yet, will be created on first upload
  }

  return (
    <JoomlaBackupClient
      kickstartExists={kickstartExists}
      backupExists={backupExists}
      backupFileName={backupFileName}
      kickstartSize={kickstartSize}
      backupSize={backupSize}
    />
  );
}
