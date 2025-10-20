import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import SftpClient from "ssh2-sftp-client";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';


// Allow large file uploads (200 MB max)
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

const VAUTRON_6_IP = "109.235.60.55";
const BACKUP_PATH = "/var/customers/basis-backup";

export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!type || (type !== "kickstart" && type !== "backup")) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Validate file types
    if (type === "kickstart" && file.name !== "kickstart.php") {
      return NextResponse.json(
        { error: "Kickstart file must be named 'kickstart.php'" },
        { status: 400 }
      );
    }

    if (type === "backup" && !file.name.endsWith(".jpa") && !file.name.endsWith(".zip")) {
      return NextResponse.json(
        { error: "Backup must be a .jpa or .zip file" },
        { status: 400 }
      );
    }

    // Get Vautron 6 server credentials from database
    const storageServer = await prisma.server.findFirst({
      where: {
        OR: [
          { sshHost: VAUTRON_6_IP },
          { ip: VAUTRON_6_IP }
        ]
      },
    });

    if (!storageServer || !storageServer.sshHost || !storageServer.sshUsername || !storageServer.sshPassword) {
      return NextResponse.json(
        { error: "Storage server (Vautron 6) not found or missing SSH credentials" },
        { status: 500 }
      );
    }

    // Connect to Vautron 6 via SFTP
    const sftp = new SftpClient();

    try {
      await sftp.connect({
        host: storageServer.sshHost,
        port: storageServer.sshPort || 22,
        username: storageServer.sshUsername,
        password: storageServer.sshPassword,
        readyTimeout: 60000, // 60 seconds
      });

      // Ensure backup directory exists
      await sftp.mkdir(BACKUP_PATH, true);

      // Delete old backup files if uploading a new backup
      if (type === "backup") {
        try {
          const files = await sftp.list(BACKUP_PATH);
          const oldBackups = files.filter((f: any) =>
            f.type === '-' && (f.name.endsWith(".jpa") || f.name.endsWith(".zip"))
          );
          for (const oldBackup of oldBackups) {
            await sftp.delete(`${BACKUP_PATH}/${oldBackup.name}`);
          }
        } catch (error) {
          // Ignore if no old files exist
        }
      }

      // Upload file directly to Vautron 6
      const fileName = type === "kickstart" ? "kickstart.php" : file.name;
      const remotePath = `${BACKUP_PATH}/${fileName}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      await sftp.put(buffer, remotePath);
      await sftp.end();

      return NextResponse.json({
        success: true,
        message: `${type === "kickstart" ? "kickstart.php" : "Backup"} successfully uploaded to Vautron 6`,
        fileName,
      });
    } catch (error) {
      await sftp.end();
      throw error;
    }
  } catch (error) {
    console.error("Error uploading file to Vautron 6:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload file" },
      { status: 500 }
    );
  }
}
