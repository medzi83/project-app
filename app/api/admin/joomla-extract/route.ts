import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FroxlorClient } from "@/lib/froxlor";
import { generateJoomlaConfiguration } from "@/lib/joomla-config";
import SftpClient from "ssh2-sftp-client";

// Increase timeout for large archive extractions (5 minutes)
export const maxDuration = 300;

type KickstartResponse = {
  status: boolean;
  done?: boolean;
  factory?: string;
  files?: number;
  bytesIn?: number;
  bytesOut?: number;
  totalsize?: number;
  message?: string;
  Error?: string;
  lastfile?: string;
};

/**
 * Extract Joomla backup via Kickstart.php automation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverId, customerNo, folderName, installUrl, databaseName, databasePassword } = body;

    if (!serverId || !customerNo || !folderName || !installUrl || !databaseName || !databasePassword) {
      return NextResponse.json(
        { success: false, message: "serverId, customerNo, folderName, installUrl, databaseName and databasePassword are required" },
        { status: 400 }
      );
    }

    // Get server details
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server || !server.froxlorUrl || !server.froxlorApiKey || !server.froxlorApiSecret) {
      return NextResponse.json(
        { success: false, message: "Server not found or missing Froxlor credentials" },
        { status: 404 }
      );
    }

    // Get customer details from Froxlor
    const froxlorClient = new FroxlorClient({
      url: server.froxlorUrl,
      apiKey: server.froxlorApiKey,
      apiSecret: server.froxlorApiSecret,
    });

    const customer = await froxlorClient.findCustomerByNumber(customerNo);
    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found in Froxlor" },
        { status: 404 }
      );
    }

    // Find backup file name
    const path = await import("path");
    const fs = await import("fs/promises");
    const storageDir = path.join(process.cwd(), "storage", "joomla");
    const files = await fs.readdir(storageDir);
    const backupFile = files.find((f) => f.endsWith(".jpa") || f.endsWith(".zip"));

    if (!backupFile) {
      return NextResponse.json(
        { success: false, message: "No backup file found in storage" },
        { status: 404 }
      );
    }

    // Extract the archive using Kickstart.php
    const extractionResult = await extractArchive(installUrl, backupFile, folderName);

    if (!extractionResult.success) {
      return NextResponse.json(
        { success: false, message: extractionResult.message || "Extraction failed" },
        { status: 500 }
      );
    }

    // Post-process the extracted files via single SSH command
    const targetPath = `${customer.documentroot}/${folderName}`;
    // Always use localhost for MySQL since the script runs ON the server via SSH
    const mysqlHost = "localhost";

    // Wait a bit for the extraction to fully finish
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      if (!server.sshHost || !server.sshUsername || !server.sshPassword) {
        throw new Error("SSH credentials missing");
      }

      const { Client } = await import("ssh2");
      const sshClient = new Client();

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          sshClient.end();
          reject(new Error("SSH timeout after 5 minutes"));
        }, 300000); // 5 minute timeout for all post-processing (SQL import can be slow)

        sshClient
          .on("ready", () => {
            clearTimeout(timeout);

            // Escape special characters for sed
            const escapedPassword = databasePassword.replace(/[\/&']/g, '\\$&');
            const escapedDbName = databaseName.replace(/[\/&']/g, '\\$&');
            const escapedHost = mysqlHost.replace(/[\/&']/g, '\\$&');

            // Single bash script to do all post-processing
            const postProcessScript = `
cd ${targetPath} || exit 1

# 1. Rename htaccess.bak to .htaccess (Kickstart renames it)
if [ -f htaccess.bak ]; then
  mv htaccess.bak .htaccess
  echo "✓ Renamed htaccess.bak to .htaccess"
elif [ -f htaccess.txt ] && [ ! -f .htaccess ]; then
  cp htaccess.txt .htaccess
  echo "✓ Copied htaccess.txt to .htaccess"
fi

# 2. Update .htaccess RewriteBase for subfolder
if [ -f .htaccess ]; then
  sed -i 's|^# RewriteBase /$|RewriteBase /${folderName}/|' .htaccess
  chmod 644 .htaccess
  chown ${customer.loginname}:${customer.loginname} .htaccess
  echo "✓ Updated .htaccess RewriteBase"
fi

# 3. Update configuration.php with new database credentials
if [ -f configuration.php ]; then
  sed -i "s/public \\$host = '[^']*';/public \\$host = '${escapedHost}';/" configuration.php
  sed -i "s/public \\$user = '[^']*';/public \\$user = '${escapedDbName}';/" configuration.php
  sed -i "s/public \\$password = '[^']*';/public \\$password = '${escapedPassword}';/" configuration.php
  sed -i "s/public \\$db = '[^']*';/public \\$db = '${escapedDbName}';/" configuration.php
  chmod 644 configuration.php
  chown ${customer.loginname}:${customer.loginname} configuration.php
  echo "✓ Updated configuration.php with new DB credentials"
fi

# 4. Import SQL dump into database (Akeeba multi-part SQL support)
if [ -d installation/sql ]; then
  cd installation/sql

  # Check for Akeeba multi-part SQL (site.sql + site.s01, site.s02, ...)
  if [ -f site.sql ]; then
    echo "Found Akeeba multi-part SQL dump, combining parts..."
    echo "DB Host: ${escapedHost}, DB Name: ${escapedDbName}, DB User: ${escapedDbName}"

    # Read the table prefix from databases.json
    DB_PREFIX="j_"
    if [ -f databases.json ]; then
      # Extract prefix from JSON (default to j_ if not found)
      DB_PREFIX=\$(grep -oP '"prefix"\\s*:\\s*"\\K[^"]+' databases.json | head -n 1)
      if [ -z "\$DB_PREFIX" ]; then
        DB_PREFIX="j_"
      fi
      echo "Found table prefix in databases.json: \$DB_PREFIX"
    else
      echo "No databases.json found, using default prefix: \$DB_PREFIX"
    fi

    # Combine all parts into one file
    cat site.sql site.s* > /tmp/combined_${escapedDbName}.sql 2>/dev/null
    echo "Combined SQL file size: \$(wc -l < /tmp/combined_${escapedDbName}.sql) lines"

    # Replace #__ placeholder with actual table prefix
    sed -i "s/#__/\$DB_PREFIX/g" /tmp/combined_${escapedDbName}.sql
    echo "Replaced #__ with \$DB_PREFIX in SQL dump"

    # Import combined SQL (always use socket connection for local MySQL)
    # Don't use -h flag at all for localhost
    mysql -u ${escapedDbName} -p'${escapedPassword}' ${escapedDbName} < /tmp/combined_${escapedDbName}.sql 2>&1
    if [ $? -eq 0 ]; then
      echo "✓ Imported multi-part database (site.sql + parts)"
      rm -f /tmp/combined_${escapedDbName}.sql
    else
      echo "✗ Failed to import multi-part database"
      rm -f /tmp/combined_${escapedDbName}.sql
    fi
  # Standard single-file SQL dump
  elif [ -f mysql/joomla.sql ]; then
    if [ "${escapedHost}" = "localhost" ] || [ "${escapedHost}" = "127.0.0.1" ]; then
      mysql -u ${escapedDbName} -p'${escapedPassword}' ${escapedDbName} < mysql/joomla.sql 2>&1
    else
      mysql -h ${escapedHost} -u ${escapedDbName} -p'${escapedPassword}' ${escapedDbName} < mysql/joomla.sql 2>&1
    fi
    if [ $? -eq 0 ]; then
      echo "✓ Imported database from mysql/joomla.sql"
    else
      echo "✗ Failed to import database from mysql/joomla.sql"
    fi
  else
    # Try to find any .sql file (not .s## parts)
    SQLFILE=$(find . -name "*.sql" -type f ! -name "*.s[0-9]*" | head -n 1)
    if [ -n "$SQLFILE" ]; then
      if [ "${escapedHost}" = "localhost" ] || [ "${escapedHost}" = "127.0.0.1" ]; then
        mysql -u ${escapedDbName} -p'${escapedPassword}' ${escapedDbName} < "$SQLFILE" 2>&1
      else
        mysql -h ${escapedHost} -u ${escapedDbName} -p'${escapedPassword}' ${escapedDbName} < "$SQLFILE" 2>&1
      fi
      if [ $? -eq 0 ]; then
        echo "✓ Imported database from $SQLFILE"
      else
        echo "✗ Failed to import database from $SQLFILE"
      fi
    else
      echo "⚠ No SQL dump found in installation/sql folder"
    fi
  fi

  cd ../..
else
  echo "⚠ No installation/sql folder found"
fi

# 5. Remove installation folder
if [ -d installation ]; then
  rm -rf installation
  echo "✓ Removed installation folder"
fi

# 6. Remove kickstart.php and backup archive
if [ -f kickstart.php ]; then
  rm -f kickstart.php
  echo "✓ Removed kickstart.php"
fi

# Remove .jpa or .zip backup files
find . -maxdepth 1 -type f \\( -name "*.jpa" -o -name "*.zip" \\) -delete
if [ $? -eq 0 ]; then
  echo "✓ Removed backup archive files"
fi

# 7. Set ownership recursively to customer
chown -R ${customer.loginname}:${customer.loginname} ${targetPath}
echo "✓ Set ownership to ${customer.loginname}"

echo "=== POST-PROCESSING COMPLETE ==="
`;

            sshClient.exec(postProcessScript, (err, stream) => {
              if (err) {
                sshClient.end();
                reject(err);
                return;
              }

              let stdout = "";
              let stderr = "";

              stream
                .on("close", (code: number) => {
                  sshClient.end();
                  if (code !== 0) {
                    reject(new Error(`Post-processing failed with exit code ${code}: ${stderr}`));
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
          })
          .on("error", (err) => {
            clearTimeout(timeout);
            sshClient.end();
            reject(err);
          })
          .connect({
            host: server.sshHost!,
            port: server.sshPort || 22,
            username: server.sshUsername!,
            password: server.sshPassword!,
            readyTimeout: 60000, // 60 seconds to establish connection
            keepaliveInterval: 10000, // Send keepalive every 10 seconds
            keepaliveCountMax: 30, // Allow 30 missed keepalives before disconnect
          });
      });
    } catch (postProcessError) {
      console.error("ERROR: Post-processing failed:", postProcessError);
      throw new Error(`Failed to post-process installation: ${postProcessError instanceof Error ? postProcessError.message : String(postProcessError)}`);
    }

    return NextResponse.json({
      success: true,
      message: "Joomla installation erfolgreich extrahiert und konfiguriert",
      filesExtracted: extractionResult.filesExtracted,
      bytesProcessed: extractionResult.bytesProcessed,
    });
  } catch (error) {
    console.error("Joomla extract error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error during extraction",
      },
      { status: 500 }
    );
  }
}

/**
 * Extract archive using Kickstart.php AJAX API
 */
async function extractArchive(
  installUrl: string,
  backupFileName: string,
  folderName: string
): Promise<{
  success: boolean;
  message?: string;
  filesExtracted?: number;
  bytesProcessed?: number;
}> {
  try {
    // Remove /kickstart.php from URL to get base URL
    const baseUrl = installUrl.replace("/kickstart.php", "");
    const kickstartUrl = `${baseUrl}/kickstart.php`;

    // Step 1: Start extraction
    let factory: string | undefined;
    let done = false;
    let filesExtracted = 0;
    let bytesProcessed = 0;
    let iterationCount = 0;
    const maxIterations = 1000; // Safety limit

    // Initial call to start extraction
    const startParams = {
      "kickstart.setup.sourcefile": backupFileName,
      "kickstart.setup.destdir": "",
      "kickstart.procengine": "direct",
      "kickstart.setup.restoreperms": "0",
      "kickstart.setup.dryrun": "0",
    };

    const startResponse = await fetch(`${kickstartUrl}?task=startExtracting&json=${encodeURIComponent(JSON.stringify(startParams))}`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Connection": "keep-alive",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      // Longer timeout for large archives
      signal: AbortSignal.timeout(30000), // 30 seconds
    });

    const startText = await startResponse.text();

    if (!startResponse.ok) {
      return {
        success: false,
        message: `Kickstart returned HTTP ${startResponse.status}. Check if kickstart.php is accessible at ${kickstartUrl}`,
      };
    }

    const startData = parseKickstartResponse(startText);

    if (!startData.status) {
      return {
        success: false,
        message: startData.message || startData.Error || "Failed to start extraction",
      };
    }

    factory = startData.factory;
    filesExtracted = startData.files || 0;
    bytesProcessed = startData.bytesOut || 0;
    done = startData.done || false;

    // Step 2: Continue extraction until done
    while (!done && iterationCount < maxIterations) {
      iterationCount++;

      if (!factory) {
        return {
          success: false,
          message: "Missing factory state for continuation",
        };
      }

      const continueParams = {
        factory: factory,
      };

      let continueResponse;
      let retries = 0;
      const maxRetries = 3;

      // Retry logic for connection issues
      while (retries <= maxRetries) {
        try {
          continueResponse = await fetch(
            `${kickstartUrl}?task=continueExtracting&json=${encodeURIComponent(JSON.stringify(continueParams))}`,
            {
              method: "GET",
              headers: {
                "User-Agent": "Projektverwaltung-AutoInstaller/1.0",
                "Connection": "keep-alive",
              },
              // Longer timeout for large archives
              signal: AbortSignal.timeout(30000), // 30 seconds
            }
          );
          break; // Success, exit retry loop
        } catch (fetchError) {
          retries++;
          if (retries > maxRetries) {
            throw fetchError; // Give up after max retries
          }
          // Wait a bit before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      const continueText = await continueResponse.text();
      const continueData = parseKickstartResponse(continueText);

      if (!continueData.status) {
        return {
          success: false,
          message: continueData.message || continueData.Error || "Extraction failed during continuation",
        };
      }

      factory = continueData.factory;
      filesExtracted = continueData.files || filesExtracted;
      bytesProcessed = continueData.bytesOut || bytesProcessed;
      done = continueData.done || false;

      // No delay - keep extracting as fast as possible
      // The kickstart.php already has built-in timing controls
    }

    if (!done && iterationCount >= maxIterations) {
      return {
        success: false,
        message: "Extraction timeout - too many iterations",
      };
    }

    // Step 3: Cleanup
    const cleanupParams = {
      factory: factory,
    };

    const cleanupResponse = await fetch(
      `${kickstartUrl}?task=cleanUp&json=${encodeURIComponent(JSON.stringify(cleanupParams))}`,
      {
        method: "GET",
        headers: {
          "User-Agent": "Projektverwaltung-AutoInstaller/1.0",
          "Connection": "keep-alive",
        },
        signal: AbortSignal.timeout(30000), // 30 seconds
      }
    );

    const cleanupText = await cleanupResponse.text();
    const cleanupData = parseKickstartResponse(cleanupText);

    return {
      success: true,
      filesExtracted,
      bytesProcessed,
    };
  } catch (error) {
    console.error("Extract archive error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error during extraction",
    };
  }
}

/**
 * Parse Kickstart response (format: ###JSON###)
 */
function parseKickstartResponse(text: string): KickstartResponse {
  try {
    // Kickstart returns JSON wrapped in ###...###
    const match = text.match(/###(.+?)###/);
    if (match && match[1]) {
      return JSON.parse(match[1]);
    }

    // Fallback: try to parse as direct JSON
    return JSON.parse(text);
  } catch (error) {
    return {
      status: false,
      message: "Failed to parse Kickstart response",
    };
  }
}
