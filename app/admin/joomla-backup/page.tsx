import { getAuthSession } from "@/lib/authz";
import { redirect } from "next/navigation";
import JoomlaBackupClient from "./client";
import { prisma } from "@/lib/prisma";
import SftpClient from "ssh2-sftp-client";

export default async function JoomlaBackupPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const VAUTRON_6_IP = "109.235.60.55";
  const BACKUP_PATH = "/var/customers/basis-backup";

  // Check for existing files on Vautron 6
  let kickstartExists = false;
  let backupExists = false;
  let backupFileName = "";
  let kickstartSize = 0;
  let backupSize = 0;

  try {
    // Get Vautron 6 server credentials
    const storageServer = await prisma.server.findFirst({
      where: {
        OR: [
          { sshHost: VAUTRON_6_IP },
          { ip: VAUTRON_6_IP }
        ]
      },
    });

    if (storageServer && storageServer.sshHost && storageServer.sshUsername && storageServer.sshPassword) {
      const sftp = new SftpClient();

      try {
        await sftp.connect({
          host: storageServer.sshHost,
          port: storageServer.sshPort || 22,
          username: storageServer.sshUsername,
          password: storageServer.sshPassword,
        });

        const files = await sftp.list(BACKUP_PATH);

        const kickstartFile = files.find((f: any) => f.name === "kickstart.php");
        if (kickstartFile) {
          kickstartExists = true;
          kickstartSize = kickstartFile.size;
        }

        const backupFile = files.find((f: any) =>
          f.type === '-' && (f.name.endsWith(".jpa") || f.name.endsWith(".zip"))
        );
        if (backupFile) {
          backupExists = true;
          backupFileName = backupFile.name;
          backupSize = backupFile.size;
        }

        await sftp.end();
      } catch (error) {
        await sftp.end();
        // Failed to check files on storage server
      }
    }
  } catch (error) {
    // Storage server not found or connection failed
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
