import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import SftpClient from "ssh2-sftp-client";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const preferredRegion = 'fra1';

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VAUTRON_6_IP = "109.235.60.55";
const BACKUP_PATH = "/var/customers/basis-backup";

export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const chunk = formData.get("chunk") as Blob;
    const fileName = formData.get("fileName") as string;
    const chunkIndex = parseInt(formData.get("chunkIndex") as string);
    const totalChunks = parseInt(formData.get("totalChunks") as string);
    const type = formData.get("type") as string;

    if (!chunk || !fileName || chunkIndex === undefined || !totalChunks || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (type !== "kickstart" && type !== "backup") {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
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

    // Connect to Vautron 6 via SFTP with extended timeouts
    const sftp = new SftpClient();
    await sftp.connect({
      host: storageServer.sshHost,
      port: storageServer.sshPort || 22,
      username: storageServer.sshUsername,
      password: storageServer.sshPassword,
      readyTimeout: 30000, // 30 seconds
      retries: 3,
      retry_factor: 2,
      retry_minTimeout: 2000,
    });

    try {
      // Ensure backup directories exist
      await sftp.mkdir(`${BACKUP_PATH}/temp`, true);

      // Upload chunk directly to Vautron 6
      const chunkFileName = `${fileName}.part${chunkIndex}`;
      const remoteTempPath = `${BACKUP_PATH}/temp/${chunkFileName}`;
      const buffer = Buffer.from(await chunk.arrayBuffer());
      await sftp.put(buffer, remoteTempPath);

      // If this is the last chunk, combine all chunks on the server
      if (chunkIndex === totalChunks - 1) {
        const finalFileName = type === "kickstart" ? "kickstart.php" : fileName;
        const finalPath = `${BACKUP_PATH}/${finalFileName}`;

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

        // Close SFTP before opening SSH (avoid connection conflicts)
        await sftp.end();

        // Combine chunks using SSH cat command (can take a while for large files)
        const { Client } = await import("ssh2");
        const sshClient = new Client();

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            sshClient.end();
            reject(new Error("SSH timeout - combining chunks took too long"));
          }, 120000); // 2 minutes timeout for combining large files

          sshClient
            .on("ready", () => {
              // Build cat command: cat file.part0 file.part1 ... > final_file
              const partFiles = Array.from({ length: totalChunks }, (_, i) =>
                `${BACKUP_PATH}/temp/${fileName}.part${i}`
              ).join(' ');

              const combineCommand = `cat ${partFiles} > ${finalPath} && rm -rf ${BACKUP_PATH}/temp`;

              sshClient.exec(combineCommand, (err, stream) => {
                if (err) {
                  clearTimeout(timeout);
                  sshClient.end();
                  reject(err);
                  return;
                }

                let stderr = "";

                stream
                  .on("close", (code: number) => {
                    clearTimeout(timeout);
                    sshClient.end();
                    if (code !== 0) {
                      reject(new Error(`Failed to combine chunks: ${stderr}`));
                    } else {
                      resolve();
                    }
                  })
                  .stderr.on("data", (data: Buffer) => {
                    stderr += data.toString();
                  });
              });
            })
            .on("error", (err) => {
              clearTimeout(timeout);
              reject(err);
            })
            .connect({
              host: storageServer.sshHost!,
              port: storageServer.sshPort || 22,
              username: storageServer.sshUsername!,
              password: storageServer.sshPassword!,
              readyTimeout: 30000,
              keepaliveInterval: 10000,
            });
        });

        return NextResponse.json({
          success: true,
          message: `${type === "kickstart" ? "kickstart.php" : "Backup"} successfully uploaded to Vautron 6`,
          fileName: finalFileName,
          complete: true,
        });
      }

      await sftp.end();

      // Not the last chunk, just acknowledge receipt
      return NextResponse.json({
        success: true,
        message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded to Vautron 6`,
        complete: false,
      });
    } catch (error) {
      await sftp.end();
      throw error;
    }
  } catch (error) {
    console.error("Error uploading chunk to Vautron 6:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload chunk" },
      { status: 500 }
    );
  }
}
