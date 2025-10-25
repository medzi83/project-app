import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { FroxlorClient } from "@/lib/froxlor";
import SftpClient from "ssh2-sftp-client";
import { Readable } from "stream";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const preferredRegion = 'fra1';


export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { serverId, customerNo, folderName, dbPassword } = body;

    if (!serverId || !customerNo || !folderName || !dbPassword) {
      return NextResponse.json(
        { error: `Missing required fields. Received: serverId=${!!serverId}, customerNo=${!!customerNo}, folderName=${!!folderName}, dbPassword=${!!dbPassword}` },
        { status: 400 }
      );
    }

    // Validate folder name
    if (!/^[a-zA-Z0-9_-]+$/.test(folderName)) {
      return NextResponse.json(
        { error: "Folder name can only contain letters, numbers, _ and -" },
        { status: 400 }
      );
    }

    // Get server
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (!server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
      return NextResponse.json(
        { error: "Server has no Froxlor API credentials" },
        { status: 400 }
      );
    }

    // Get Froxlor customer data
    const froxlorClient = new FroxlorClient({
      url: server.froxlorUrl,
      apiKey: server.froxlorApiKey,
      apiSecret: server.froxlorApiSecret,
    });

    const customer = await froxlorClient.findCustomerByNumber(customerNo);

    if (!customer) {
      return NextResponse.json(
        { error: `Customer ${customerNo} not found on Froxlor server` },
        { status: 404 }
      );
    }

    if (!customer.documentroot) {
      return NextResponse.json(
        { error: "Customer has no document root" },
        { status: 400 }
      );
    }

    // Get standard subdomain and check SSL/LE status
    let standardDomain = "";
    let useHttps = false;
    if (customer.standardsubdomain) {
      const stdDomain = await froxlorClient.getCustomerStandardDomain(
        customer.customerid,
        customer.standardsubdomain
      );
      if (stdDomain) {
        standardDomain = stdDomain.domain;
        // Use HTTPS only if Let's Encrypt is enabled
        useHttps = stdDomain.letsencrypt === "1";
      }
    }

    if (!standardDomain) {
      return NextResponse.json(
        { error: "Could not determine standard domain" },
        { status: 400 }
      );
    }

    // Get files from Vautron 6 storage server
    const VAUTRON_6_IP = "109.235.60.55";
    const BACKUP_PATH = "/var/customers/basis-backup";

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

    // Check what files exist on Vautron 6
    let kickstartExists = false;
    let backupFileName: string | null = null;

    const sftpCheck = new SftpClient();
    try {
      await sftpCheck.connect({
        host: storageServer.sshHost,
        port: storageServer.sshPort || 22,
        username: storageServer.sshUsername,
        password: storageServer.sshPassword,
      });

      const files = await sftpCheck.list(BACKUP_PATH);

      if (files.find((f: any) => f.name === "kickstart.php")) {
        kickstartExists = true;
      }

      const backupFile = files.find((f: any) =>
        f.type === '-' && (f.name.endsWith(".jpa") || f.name.endsWith(".zip"))
      );
      if (backupFile) {
        backupFileName = backupFile.name;
      }

      await sftpCheck.end();
    } catch (error) {
      await sftpCheck.end();
      return NextResponse.json(
        { error: "Failed to check backup files on storage server" },
        { status: 500 }
      );
    }

    if (!kickstartExists || !backupFileName) {
      return NextResponse.json(
        { error: "kickstart.php or backup file missing on storage server. Please upload both files first." },
        { status: 400 }
      );
    }

    const targetPath = `${customer.documentroot}/${folderName}`;
    const protocol = useHttps ? "https" : "http";
    const installUrl = `${protocol}://${standardDomain}/${folderName}/kickstart.php`;

    // Create MySQL database in Froxlor
    const dbResult = await froxlorClient.createDatabase(
      customer.customerid,
      dbPassword,
      `Joomla Database for ${folderName}`
    );

    if (!dbResult.success) {
      return NextResponse.json(
        { error: `Fehler beim Anlegen der Datenbank: ${dbResult.message}` },
        { status: 500 }
      );
    }

    const databaseName = dbResult.databaseName;

    // Check if SSH credentials are available
    if (!server.sshHost || !server.sshUsername || !server.sshPassword) {
      return NextResponse.json({
        success: false,
        error: "SSH credentials missing. Please configure SSH access in server settings.",
        info: {
          customerNo,
          customerDocumentRoot: customer.documentroot,
          standardDomain,
          folderName,
          targetPath,
          kickstartFile: "kickstart.php",
          backupFile: backupFileName,
        },
      }, { status: 400 });
    }

    // Step 1: Connect to both servers and stream files directly
    const sftpStorage = new SftpClient();
    const sftpTarget = new SftpClient();

    try {
      // Connect to Vautron 6 (storage)
      await sftpStorage.connect({
        host: storageServer.sshHost,
        port: storageServer.sshPort || 22,
        username: storageServer.sshUsername,
        password: storageServer.sshPassword,
        readyTimeout: 60000, // 60 seconds
      });

      // Connect to target server
      await sftpTarget.connect({
        host: server.sshHost,
        port: server.sshPort || 22,
        username: server.sshUsername,
        password: server.sshPassword,
        readyTimeout: 60000, // 60 seconds
        keepaliveInterval: 10000,
        keepaliveCountMax: 30,
      });

      // Create target directory
      await sftpTarget.mkdir(targetPath, true);

      // Download kickstart.php from Vautron 6 (small file - can use buffer)
      const kickstartBuffer = await sftpStorage.get(`${BACKUP_PATH}/kickstart.php`) as Buffer;
      await sftpTarget.put(kickstartBuffer, `${targetPath}/kickstart.php`);

      // Download .htaccess from Vautron 6 (small file - can use buffer)
      try {
        const htaccessBuffer = await sftpStorage.get(`${BACKUP_PATH}/.htaccess`) as Buffer;
        await sftpTarget.put(htaccessBuffer, `${targetPath}/.htaccess`);
        console.log("✓ Transferred .htaccess from Vautron 6");
      } catch (error) {
        console.warn("⚠ No .htaccess found in backup folder:", error);
      }

      // Stream large backup file directly from Vautron 6 to target server
      // This avoids loading the entire file into memory
      const sourceStream = (await sftpStorage.get(`${BACKUP_PATH}/${backupFileName}`) as unknown) as Readable;
      await sftpTarget.put(sourceStream, `${targetPath}/${backupFileName}`);

      // Close storage connection, keep target connection open
      await sftpStorage.end();

      // Step 2: Set ownership and permissions using target server's SSH connection
      // Use the underlying SSH2 connection from sftpTarget
      const { Client } = await import("ssh2");
      const sshClient = (sftpTarget as any).client;

      if (!sshClient) {
        throw new Error("Could not access SSH client from SFTP connection");
      }

      const customerUsername = customer.loginname;

      const commands = [
        `chown -R ${customerUsername}:${customerUsername} ${targetPath}`,
        `chmod -R 775 ${targetPath}`,
        `chmod 644 ${targetPath}/.htaccess 2>/dev/null || true`,
        `chmod 664 ${targetPath}/*.php ${targetPath}/*.jpa ${targetPath}/*.zip 2>/dev/null || true`,
      ].join(" && ");

      await new Promise<void>((resolve, reject) => {
        sshClient.exec(commands, (err: Error, stream: any) => {
          if (err) {
            reject(err);
            return;
          }

          let stdout = "";
          let stderr = "";

          stream
            .on("close", (code: number) => {
              if (code !== 0) {
                reject(new Error(`chown/chmod failed with code ${code}: ${stderr}`));
              } else {
                resolve();
              }
            })
            .on("data", (data: Buffer) => {
              stdout += data.toString();
            })
            .stderr.on("data", (data: Buffer) => {
              stderr += data.toString();
            });
        });
      });

      // Now close the SFTP connection
      await sftpTarget.end();

      return NextResponse.json({
        success: true,
        message: `Joomla-Installation erfolgreich vorbereitet in ${folderName}`,
        installUrl,
        databaseName,
        info: {
          customerNo,
          customerDocumentRoot: customer.documentroot,
          standardDomain,
          folderName,
          targetPath,
          kickstartFile: "kickstart.php",
          backupFile: backupFileName,
          databaseName,
        },
      });
    } catch (error) {
      // Clean up connections
      try {
        await sftpStorage.end();
      } catch {}
      try {
        await sftpTarget.end();
      } catch {}

      console.error("Error installing Joomla:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Installation failed" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error installing Joomla (outer):", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Installation failed" },
      { status: 500 }
    );
  }
}
