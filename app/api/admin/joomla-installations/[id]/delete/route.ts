import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { FroxlorClient } from "@/lib/froxlor";
import { Client as SSHClient } from "ssh2";

type DeleteResult = {
  success: boolean;
  message: string;
  details: {
    filesDeleted: boolean;
    filesMessage: string;
    databaseDeleted: boolean;
    databaseMessage: string;
    recordDeleted: boolean;
  };
};

/**
 * DELETE /api/admin/joomla-installations/[id]/delete
 * Deletes a Joomla installation including:
 * - Files on the server via SSH
 * - Database via Froxlor API
 * - Database record
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<DeleteResult>> {
  try {
    const session = await getAuthSession();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        {
          success: false,
          message: "Nicht autorisiert",
          details: {
            filesDeleted: false,
            filesMessage: "Keine Berechtigung",
            databaseDeleted: false,
            databaseMessage: "Keine Berechtigung",
            recordDeleted: false,
          },
        },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Get installation details
    const installation = await prisma.joomlaInstallation.findUnique({
      where: { id },
      include: {
        server: true,
        client: true,
      },
    });

    if (!installation) {
      return NextResponse.json(
        {
          success: false,
          message: "Installation nicht gefunden",
          details: {
            filesDeleted: false,
            filesMessage: "Installation nicht gefunden",
            databaseDeleted: false,
            databaseMessage: "Installation nicht gefunden",
            recordDeleted: false,
          },
        },
        { status: 404 }
      );
    }

    const result: DeleteResult = {
      success: true,
      message: "",
      details: {
        filesDeleted: false,
        filesMessage: "",
        databaseDeleted: false,
        databaseMessage: "",
        recordDeleted: false,
      },
    };

    // 1. Delete files via SSH
    console.log(`Deleting installation ${installation.standardDomain}/${installation.folderName} (${id})`);

    if (installation.server.sshHost && installation.server.sshUsername) {
      try {
        const sshPassword = installation.server.sshPassword || undefined;

        if (!sshPassword) {
          result.details.filesMessage = "Kein SSH-Passwort konfiguriert";
          result.success = false;
        } else {
          const filesDeleted = await deleteFilesViaSSH(
            installation.server.sshHost,
            installation.server.sshPort || 22,
            installation.server.sshUsername,
            installation.installPath,
            sshPassword
          );

          result.details.filesDeleted = filesDeleted.success;
          result.details.filesMessage = filesDeleted.message;

          if (!filesDeleted.success) {
            result.success = false;
          }
        }
      } catch (error) {
        console.error('Error deleting files:', error);
        result.details.filesMessage = `Fehler beim Löschen der Dateien: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`;
        result.success = false;
      }
    } else {
      result.details.filesMessage = "Keine SSH-Konfiguration vorhanden";
      result.success = false;
    }

    // 2. Delete database via Froxlor
    if (
      installation.server.froxlorUrl &&
      installation.server.froxlorApiKey &&
      installation.server.froxlorApiSecret
    ) {
      try {
        const froxlorClient = new FroxlorClient({
          url: installation.server.froxlorUrl,
          apiKey: installation.server.froxlorApiKey,
          apiSecret: installation.server.froxlorApiSecret,
        });

        const dbResult = await froxlorClient.deleteDatabase(installation.databaseName);

        result.details.databaseDeleted = dbResult.success;
        result.details.databaseMessage = dbResult.message;

        if (!dbResult.success) {
          // Don't fail the entire operation if database is already deleted
          if (dbResult.message.includes("not found") || dbResult.message.includes("nicht gefunden") || dbResult.message.includes("does not exist")) {
            result.details.databaseMessage = "Datenbank war bereits gelöscht";
            result.details.databaseDeleted = true;
          } else {
            console.error('Database deletion failed:', dbResult.message);
            result.success = false;
          }
        }
      } catch (error) {
        console.error('Error deleting database:', error);
        result.details.databaseMessage = `Fehler beim Löschen der Datenbank: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`;
        result.success = false;
      }
    } else {
      result.details.databaseMessage = "Keine Froxlor-Konfiguration vorhanden";
      result.success = false;
    }

    // CRITICAL: Only delete the database record if files AND database were successfully deleted
    // This prevents orphaned data on the server if the deletion fails
    if (!result.details.filesDeleted && !result.details.filesMessage.includes("bereits gelöscht") && !result.details.filesMessage.includes("nicht gefunden")) {
      result.message = "Dateien konnten nicht gelöscht werden. Datensatz wird NICHT gelöscht um Datenverlust zu vermeiden.";
      return NextResponse.json(result, { status: 500 });
    }

    if (!result.details.databaseDeleted && !result.details.databaseMessage.includes("bereits gelöscht")) {
      result.message = "Datenbank konnte nicht gelöscht werden. Datensatz wird NICHT gelöscht um Datenverlust zu vermeiden.";
      return NextResponse.json(result, { status: 500 });
    }

    // 3. Delete database record (ONLY if files and database were successfully deleted)
    try {
      await prisma.joomlaInstallation.delete({
        where: { id },
      });
      result.details.recordDeleted = true;
    } catch (error) {
      result.details.recordDeleted = false;
      result.success = false;
      result.message = `Fehler beim Löschen des Datensatzes: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`;

      return NextResponse.json(result, { status: 500 });
    }

    // Build final message
    const messages: string[] = [];
    if (result.details.filesDeleted) {
      messages.push("Dateien gelöscht");
    } else if (result.details.filesMessage.includes("bereits gelöscht") || result.details.filesMessage.includes("nicht gefunden")) {
      messages.push("Dateien waren bereits gelöscht");
    }

    if (result.details.databaseDeleted) {
      messages.push("Datenbank gelöscht");
    } else if (result.details.databaseMessage.includes("bereits gelöscht")) {
      messages.push("Datenbank war bereits gelöscht");
    }

    messages.push("Datensatz gelöscht");

    result.message = messages.join(", ");

    // If files/database were already deleted, still consider it a success
    if (!result.success) {
      const filesOk = result.details.filesDeleted || result.details.filesMessage.includes("bereits gelöscht") || result.details.filesMessage.includes("nicht gefunden");
      const dbOk = result.details.databaseDeleted || result.details.databaseMessage.includes("bereits gelöscht");

      if (filesOk && dbOk && result.details.recordDeleted) {
        result.success = true;
        result.message += " (einige Ressourcen waren bereits gelöscht)";
      }
    }

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    console.error("Error deleting Joomla installation:", error);
    return NextResponse.json(
      {
        success: false,
        message: `Fehler beim Löschen: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`,
        details: {
          filesDeleted: false,
          filesMessage: "",
          databaseDeleted: false,
          databaseMessage: "",
          recordDeleted: false,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Validate that the path is safe to delete
 * STRICT: Only allows deletion of paths matching /var/customers/webs/CUSTOMER/INSTALLATION
 */
function validateDeletionPath(installPath: string): { valid: boolean; error?: string } {
  // Remove any trailing slashes for consistent checking
  const normalizedPath = installPath.replace(/\/+$/, '');

  // Prevent path traversal attempts
  if (normalizedPath.includes('..')) {
    return { valid: false, error: 'Pfad darf keine ".." enthalten (Path Traversal verhindert)' };
  }

  // STRICT: Path must match the exact pattern /var/customers/webs/CUSTOMER/INSTALLATION
  // Pattern: /var/customers/webs/[customer-folder]/[installation-folder]
  const pathPattern = /^\/var\/customers\/webs\/[^\/]+\/[^\/]+$/;

  if (!pathPattern.test(normalizedPath)) {
    return {
      valid: false,
      error: `Pfad muss exakt dem Muster /var/customers/webs/KUNDE/INSTALLATION entsprechen. Erhaltener Pfad: ${normalizedPath}`
    };
  }

  // Additional safety: Ensure path has exactly 5 parts
  // Example: /var/customers/webs/M443322/samstagnacht4
  // Parts after split: ['var', 'customers', 'webs', 'M443322', 'samstagnacht4'] = 5 parts
  const pathParts = normalizedPath.split('/').filter(p => p.length > 0);
  if (pathParts.length !== 5) {
    return {
      valid: false,
      error: `Pfad muss genau 5 Ebenen haben (var/customers/webs/KUNDE/INSTALLATION). Gefunden: ${pathParts.length} Ebenen`
    };
  }

  // Verify the path structure
  if (pathParts[0] !== 'var' || pathParts[1] !== 'customers' || pathParts[2] !== 'webs') {
    return {
      valid: false,
      error: `Pfad muss mit /var/customers/webs/ beginnen`
    };
  }

  // Ensure customer and installation folder names are reasonable (no special chars that could be malicious)
  const customerFolder = pathParts[3];
  const installationFolder = pathParts[4];
  const safeNamePattern = /^[a-zA-Z0-9_-]+$/;

  if (!safeNamePattern.test(customerFolder)) {
    return {
      valid: false,
      error: `Kundenordner-Name enthält ungültige Zeichen: ${customerFolder}`
    };
  }

  if (!safeNamePattern.test(installationFolder)) {
    return {
      valid: false,
      error: `Installationsordner-Name enthält ungültige Zeichen: ${installationFolder}`
    };
  }

  return { valid: true };
}

/**
 * Delete files via SSH
 */
async function deleteFilesViaSSH(
  host: string,
  port: number,
  user: string,
  installPath: string,
  password?: string
): Promise<{ success: boolean; message: string }> {
  // SECURITY: Validate path before any SSH operation
  const pathValidation = validateDeletionPath(installPath);
  if (!pathValidation.valid) {
    return {
      success: false,
      message: `SICHERHEITSFEHLER: ${pathValidation.error}`,
    };
  }

  return new Promise((resolve) => {
    const conn = new SSHClient();

    const timeout = setTimeout(() => {
      conn.end();
      resolve({
        success: false,
        message: 'SSH-Verbindung timeout nach 30 Sekunden',
      });
    }, 30000);

    conn
      .on("ready", () => {
        clearTimeout(timeout);

        // Escape the path for shell - replace any single quotes with '\''
        const escapedPath = installPath.replace(/'/g, "'\\''");

        // Check if directory exists first
        conn.exec(`test -d '${escapedPath}' && echo "EXISTS" || echo "NOT_FOUND"`, (err, stream) => {
          if (err) {
            conn.end();
            resolve({
              success: false,
              message: `SSH-Befehlsfehler: ${err.message}`,
            });
            return;
          }

          let output = "";
          stream
            .on("close", () => {
              if (output.trim() === "NOT_FOUND") {
                conn.end();
                resolve({
                  success: true,
                  message: "Verzeichnis war bereits gelöscht oder nicht gefunden",
                });
                return;
              }

              // Directory exists, delete it
              conn.exec(`rm -rf '${escapedPath}'`, (err, stream) => {
                if (err) {
                  conn.end();
                  resolve({
                    success: false,
                    message: `Fehler beim Löschen: ${err.message}`,
                  });
                  return;
                }

                let stderr = "";
                stream
                  .on("close", (code: number) => {
                    conn.end();

                    if (code === 0) {
                      resolve({
                        success: true,
                        message: `Verzeichnis ${installPath} erfolgreich gelöscht`,
                      });
                    } else {
                      resolve({
                        success: false,
                        message: `Fehler beim Löschen (Exit-Code ${code}): ${stderr || 'Keine Fehlermeldung'}`,
                      });
                    }
                  })
                  .on("data", () => {
                    // stdout - not needed
                  })
                  .stderr.on("data", (data: Buffer) => {
                    stderr += data.toString();
                  });
              });
            })
            .on("data", (data: Buffer) => {
              output += data.toString();
            });
        });
      })
      .on("error", (err) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          message: `SSH-Verbindungsfehler: ${err.message}`,
        });
      })
      .connect({
        host,
        port,
        username: user,
        password,
        readyTimeout: 10000,
      });
  });
}
