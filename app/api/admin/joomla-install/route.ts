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
    const { serverId, customerNo, folderName, dbPassword, mysqlServerId } = body;

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

    // Get server with default database server
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: {
        databaseServers: {
          where: { isDefault: true },
          take: 1,
        },
      },
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

    // Normalize documentroot to remove trailing slashes
    const normalizedDocRoot = customer.documentroot.replace(/\/+$/, '');
    const targetPath = `${normalizedDocRoot}/${folderName}`;
    const protocol = useHttps ? "https" : "http";
    const installUrl = `${protocol}://${standardDomain}/${folderName}/kickstart.php`;

    // Determine which MySQL server to use
    // Priority: 1. User selection, 2. Default server, 3. undefined (Froxlor default)
    let froxlorDbServerId: number | undefined;

    if (mysqlServerId) {
      // User selected a specific MySQL server
      froxlorDbServerId = mysqlServerId;
      console.log(`[DEBUG] Using user-selected MySQL server ID: ${froxlorDbServerId}`);
    } else {
      // Fall back to server's default database server (if configured)
      const defaultDbServer = server.databaseServers?.[0];
      froxlorDbServerId = (defaultDbServer as any)?.froxlorDbServerId as number | undefined;
      console.log(`[DEBUG] Using default MySQL server ID: ${froxlorDbServerId}`);
    }

    console.log(`[DEBUG] Request body mysqlServerId:`, mysqlServerId);
    console.log(`[DEBUG] Final froxlorDbServerId to be used:`, froxlorDbServerId);

    // Create MySQL database in Froxlor
    const dbResult = await froxlorClient.createDatabase(
      customer.customerid,
      dbPassword,
      `Joomla Database for ${folderName}`,
      froxlorDbServerId // Pass the Froxlor database server ID
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
        keepaliveInterval: 10000, // Send keepalive every 10 seconds
        keepaliveCountMax: 30, // Allow up to 30 keepalive packets
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

      // Check if source and target are the same server
      // Compare both sshHost and ip to handle different formats
      const isSameServer =
        storageServer.sshHost === server.sshHost ||
        storageServer.ip === server.ip ||
        storageServer.sshHost === server.ip ||
        storageServer.ip === server.sshHost;

      console.log(`Storage: ${storageServer.sshHost} (${storageServer.ip}), Target: ${server.sshHost} (${server.ip}), Same: ${isSameServer}`);

      if (isSameServer) {
        console.log(`✓ Same server detected - using direct cp for faster transfer`);

        // Use direct copy command on the same server (much faster!)
        const sshClient = (sftpTarget as any).client;

        const copyCommands = [
          `cp ${BACKUP_PATH}/kickstart.php ${targetPath}/kickstart.php`,
          `cp ${BACKUP_PATH}/${backupFileName} ${targetPath}/${backupFileName}`
        ].join(" && ");

        await new Promise<void>((resolve, reject) => {
          sshClient.exec(copyCommands, (err: Error, stream: any) => {
            if (err) {
              reject(err);
              return;
            }

            let stdout = "";
            let stderr = "";

            stream
              .on("close", (code: number) => {
                if (code !== 0) {
                  reject(new Error(`cp failed with code ${code}: ${stderr}`));
                } else {
                  console.log(`✓ Files copied locally on server`);
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

        // Verify files were actually copied
        console.log(`Verifying copied files...`);
        const verifyCommands = [
          `test -f ${targetPath}/kickstart.php && echo "kickstart.php: OK" || echo "kickstart.php: MISSING"`,
          `test -f ${targetPath}/${backupFileName} && echo "${backupFileName}: OK" || echo "${backupFileName}: MISSING"`
        ].join(" && ");

        await new Promise<void>((resolve, reject) => {
          sshClient.exec(verifyCommands, (err: Error, stream: any) => {
            if (err) {
              reject(err);
              return;
            }

            let stdout = "";
            let stderr = "";

            stream
              .on("close", (code: number) => {
                console.log(`Verification output: ${stdout.trim()}`);
                if (code !== 0 || stdout.includes("MISSING")) {
                  reject(new Error(`File verification failed. One or more files are missing: ${stdout.trim()}`));
                } else {
                  console.log(`✓ All files verified successfully`);
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
      } else {
        console.log(`✓ Different servers - streaming files via SFTP`);

        // Download kickstart.php from Vautron 6 (small file - can use buffer)
        console.log(`Downloading kickstart.php...`);
        const kickstartBuffer = await sftpStorage.get(`${BACKUP_PATH}/kickstart.php`) as Buffer;
        console.log(`Uploading kickstart.php to target...`);
        await sftpTarget.put(kickstartBuffer, `${targetPath}/kickstart.php`);
        console.log(`✓ Uploaded kickstart.php`);

        // Stream large backup file using Node.js pipeline for reliable transfer
        // NOTE: .htaccess comes from the backup (htaccess.bak), not from Vautron 6
        console.log(`Starting transfer of ${backupFileName}...`);
        const transferStartTime = Date.now();

        try {
          // Start reading from source
          const readStream = sftpStorage.createReadStream(`${BACKUP_PATH}/${backupFileName}`, {
            highWaterMark: 2048 * 1024, // 2MB chunks
            autoClose: true
          });

          // Start writing to target
          const writeStream = sftpTarget.createWriteStream(`${targetPath}/${backupFileName}`, {
            highWaterMark: 2048 * 1024, // 2MB chunks
            autoClose: true
          });

          // Add progress tracking
          let bytesTransferred = 0;
          let lastLogTime = Date.now();
          readStream.on('data', (chunk: Buffer) => {
            bytesTransferred += chunk.length;
            const now = Date.now();
            // Log every 10MB or every 5 seconds
            if (bytesTransferred % (10 * 1024 * 1024) < chunk.length || now - lastLogTime > 5000) {
              const elapsedSeconds = (now - transferStartTime) / 1000;
              const mbTransferred = Math.round(bytesTransferred / (1024 * 1024));
              const speed = mbTransferred / elapsedSeconds;
              console.log(`Transferred ${mbTransferred} MB (${speed.toFixed(2)} MB/s)...`);
              lastLogTime = now;
            }
          });

          readStream.on('error', (err: Error) => {
            console.error('Read stream error:', err);
          });

          writeStream.on('error', (err: Error) => {
            console.error('Write stream error:', err);
          });

          // Pipe directly without PassThrough (simpler and faster)
          await new Promise<void>((resolve, reject) => {
            let resolved = false;

            const doResolve = (source: string) => {
              if (resolved) return;
              resolved = true;
              clearTimeout(transferTimeout);
              const transferDuration = (Date.now() - transferStartTime) / 1000;
              const mbTransferred = Math.round(bytesTransferred / (1024 * 1024));
              console.log(`✓ Transfer of ${backupFileName} completed via ${source} (${mbTransferred} MB in ${transferDuration.toFixed(1)}s)`);
              resolve();
            };

            // Add timeout for the entire transfer (5 minutes)
            const transferTimeout = setTimeout(() => {
              console.error('⚠️ Transfer timeout after 5 minutes - forcing resolve');
              console.log(`Last known: ${Math.round(bytesTransferred / (1024 * 1024))} MB transferred`);
              doResolve('timeout');
            }, 5 * 60 * 1000);

            readStream.pipe(writeStream);

            // SFTP streams don't always fire 'finish' - use 'close' as primary completion signal
            writeStream.on('close', () => {
              console.log(`[writeStream] close event fired - ${Math.round(bytesTransferred / (1024 * 1024))} MB transferred`);
              // Wait a bit to ensure all data is flushed
              setTimeout(() => doResolve('writeStream.close'), 100);
            });

            writeStream.on('finish', () => {
              console.log(`[writeStream] finish event fired - ${Math.round(bytesTransferred / (1024 * 1024))} MB transferred`);
              doResolve('writeStream.finish');
            });

            readStream.on('end', () => {
              console.log(`[readStream] end event fired - ${Math.round(bytesTransferred / (1024 * 1024))} MB transferred`);
            });

            readStream.on('close', () => {
              console.log(`[readStream] close event fired - ${Math.round(bytesTransferred / (1024 * 1024))} MB transferred`);
            });

            readStream.on('error', (err: Error) => {
              console.error('[readStream] error:', err);
              if (!resolved) {
                resolved = true;
                clearTimeout(transferTimeout);
                reject(err);
              }
            });
            writeStream.on('error', (err: Error) => {
              console.error('[writeStream] error:', err);
              if (!resolved) {
                resolved = true;
                clearTimeout(transferTimeout);
                reject(err);
              }
            });
          });
        } catch (streamError) {
          console.error(`Stream transfer failed:`, streamError);
          throw new Error(`Failed to stream backup file: ${streamError instanceof Error ? streamError.message : 'Unknown error'}`);
        }

        // Verify files were actually uploaded via SFTP
        console.log(`Verifying uploaded files...`);
        try {
          const kickstartExists = await sftpTarget.exists(`${targetPath}/kickstart.php`);
          const backupExists = await sftpTarget.exists(`${targetPath}/${backupFileName}`);

          if (!kickstartExists) {
            throw new Error(`kickstart.php not found after upload at ${targetPath}/kickstart.php`);
          }
          if (!backupExists) {
            throw new Error(`${backupFileName} not found after upload at ${targetPath}/${backupFileName}`);
          }

          console.log(`✓ All files verified successfully (kickstart.php and ${backupFileName})`);
        } catch (verifyError) {
          throw new Error(`File verification failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
        }
      }

      // Close storage connection, keep target connection open
      await sftpStorage.end();
      console.log(`✓ Storage connection closed`);

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
        `chmod 664 ${targetPath}/*.php ${targetPath}/*.jpa ${targetPath}/*.zip 2>/dev/null || true`,
      ].join(" && ");

      console.log(`Setting permissions for ${customerUsername}...`);
      const permStartTime = Date.now();

      await new Promise<void>((resolve, reject) => {
        // Add timeout for permission setting (2 minutes for large installations)
        const timeout = setTimeout(() => {
          console.error(`⚠️ Permission setting timeout after 2 minutes`);
          reject(new Error("Timeout setting permissions after 2 minutes"));
        }, 120000);

        sshClient.exec(commands, (err: Error, stream: any) => {
          if (err) {
            clearTimeout(timeout);
            console.error(`❌ SSH exec error:`, err);
            reject(err);
            return;
          }

          console.log(`⏳ chmod command started, waiting for completion...`);

          let stdout = "";
          let stderr = "";

          stream
            .on("close", (code: number) => {
              clearTimeout(timeout);
              const permDuration = ((Date.now() - permStartTime) / 1000).toFixed(1);
              console.log(`⏱️ chmod completed in ${permDuration}s with code ${code}`);

              if (code !== 0) {
                console.error(`❌ chown/chmod failed with code ${code}: ${stderr}`);
                reject(new Error(`chown/chmod failed with code ${code}: ${stderr}`));
              } else {
                console.log(`✓ Permissions set successfully in ${permDuration}s`);
                resolve();
              }
            })
            .on("data", (data: Buffer) => {
              const output = data.toString();
              stdout += output;
              if (output.trim()) console.log(`[chmod stdout]: ${output.trim()}`);
            })
            .stderr.on("data", (data: Buffer) => {
              const output = data.toString();
              stderr += output;
              if (output.trim()) console.log(`[chmod stderr]: ${output.trim()}`);
            });
        });
      });

      // Now close the SFTP connection
      console.log(`Closing target SFTP connection...`);
      await sftpTarget.end();
      console.log(`✓ Target connection closed`);

      console.log(`✓✓✓ Installation completed successfully, sending response...`);

      const response = NextResponse.json({
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

      console.log(`✓✓✓ Response object created, returning to client...`);
      return response;
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
