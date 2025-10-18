import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { FroxlorClient } from "@/lib/froxlor";
import { promises as fs } from "fs";
import path from "path";
import SftpClient from "ssh2-sftp-client";

export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { serverId, customerNo, folderName, dbPassword } = body;

    console.log("Joomla install request:", { serverId, customerNo, folderName, hasDbPassword: !!dbPassword });

    if (!serverId || !customerNo || !folderName || !dbPassword) {
      console.error("Missing required fields:", { serverId: !!serverId, customerNo: !!customerNo, folderName: !!folderName, dbPassword: !!dbPassword });
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

    // Check if backup files exist
    const storageDir = path.join(process.cwd(), "storage", "joomla");
    let kickstartPath: string | null = null;
    let backupPath: string | null = null;

    try {
      const files = await fs.readdir(storageDir);

      const kickstartFile = files.find((f) => f === "kickstart.php");
      if (kickstartFile) {
        kickstartPath = path.join(storageDir, kickstartFile);
      }

      const backupFile = files.find((f) => f.endsWith(".jpa") || f.endsWith(".zip"));
      if (backupFile) {
        backupPath = path.join(storageDir, backupFile);
      }
    } catch (error) {
      return NextResponse.json(
        { error: "Joomla backup files not found. Please upload them first." },
        { status: 400 }
      );
    }

    if (!kickstartPath || !backupPath) {
      return NextResponse.json(
        { error: "kickstart.php or backup file missing. Please upload both files first." },
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
          kickstartFile: path.basename(kickstartPath),
          backupFile: path.basename(backupPath),
        },
      }, { status: 400 });
    }

    // Upload files via SFTP
    const sftp = new SftpClient();

    try {
      // Connect to server
      await sftp.connect({
        host: server.sshHost,
        port: server.sshPort || 22,
        username: server.sshUsername,
        password: server.sshPassword,
      });

      // Create target directory
      await sftp.mkdir(targetPath, true);

      // Upload kickstart.php
      await sftp.put(kickstartPath, `${targetPath}/kickstart.php`);

      // Upload backup file
      const backupFileName = path.basename(backupPath);
      await sftp.put(backupPath, `${targetPath}/${backupFileName}`);

      // Set permissions (755 for directory, 644 for files)
      await sftp.chmod(targetPath, 0o755);
      await sftp.chmod(`${targetPath}/kickstart.php`, 0o644);
      await sftp.chmod(`${targetPath}/${backupFileName}`, 0o644);

      // Change owner to customer username (important!)
      const customerUsername = customer.loginname;
      try {
        // Use exec to run chown command
        // Note: This requires SSH access with sufficient permissions
        await sftp.end();

        // Reconnect to run chown via exec
        const { Client } = await import("ssh2");
        const sshClient = new Client();

        await new Promise<void>((resolve, reject) => {
          sshClient
            .on("ready", () => {
              sshClient.exec(
                `chown -R ${customerUsername}:${customerUsername} ${targetPath}`,
                (err, stream) => {
                  if (err) {
                    reject(err);
                    return;
                  }

                  stream
                    .on("close", () => {
                      sshClient.end();
                      resolve();
                    })
                    .on("data", (data: Buffer) => {
                      console.log("STDOUT:", data.toString());
                    })
                    .stderr.on("data", (data: Buffer) => {
                      console.log("STDERR:", data.toString());
                    });
                }
              );
            })
            .on("error", reject)
            .connect({
              host: server.sshHost!,
              port: server.sshPort || 22,
              username: server.sshUsername!,
              password: server.sshPassword!,
            });
        });
      } catch (chownError) {
        console.error("Warning: Could not change file ownership:", chownError);
        // Continue anyway - files are uploaded
      }

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
          kickstartFile: path.basename(kickstartPath),
          backupFile: backupFileName,
          databaseName,
        },
      });
    } catch (uploadError) {
      await sftp.end();
      throw new Error(`SFTP upload failed: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
    }
  } catch (error) {
    console.error("Error installing Joomla:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Installation failed" },
      { status: 500 }
    );
  }
}
