import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { FroxlorClient } from "@/lib/froxlor";
import { Client } from "ssh2";

/**
 * Check if a customer's document root directory exists on the server.
 * This is important because Froxlor creates the directory asynchronously
 * via its cron job after a new customer is created via API.
 */
export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { serverId, customerNo } = body;

    if (!serverId || !customerNo) {
      return NextResponse.json(
        { error: "serverId and customerNo are required" },
        { status: 400 }
      );
    }

    // Get server details
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

    if (!server.sshHost || !server.sshUsername || !server.sshPassword) {
      return NextResponse.json(
        { error: "Server has no SSH credentials" },
        { status: 400 }
      );
    }

    // Get customer from Froxlor to get their document root
    const froxlorClient = new FroxlorClient({
      url: server.froxlorUrl,
      apiKey: server.froxlorApiKey,
      apiSecret: server.froxlorApiSecret,
    });

    const customer = await froxlorClient.findCustomerByNumber(customerNo);

    if (!customer) {
      return NextResponse.json(
        {
          exists: false,
          message: "Kunde nicht in Froxlor gefunden",
          customerExists: false,
        },
        { status: 200 }
      );
    }

    if (!customer.documentroot) {
      return NextResponse.json(
        {
          exists: false,
          message: "Kunde hat kein Document Root",
          customerExists: true,
          documentRoot: null,
        },
        { status: 200 }
      );
    }

    // Normalize document root path
    const documentRoot = customer.documentroot.replace(/\/+$/, '');

    // Check if directory exists via SSH
    const directoryExists = await checkDirectoryExists(
      server.sshHost,
      server.sshPort || 22,
      server.sshUsername,
      server.sshPassword,
      documentRoot
    );

    return NextResponse.json({
      exists: directoryExists,
      customerExists: true,
      documentRoot: documentRoot,
      loginname: customer.loginname,
      message: directoryExists
        ? "Kundenverzeichnis existiert"
        : "Kundenverzeichnis existiert noch nicht. Froxlor-Cron muss noch laufen.",
    });

  } catch (error) {
    console.error("Error checking customer directory:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check directory" },
      { status: 500 }
    );
  }
}

/**
 * Check if a directory exists on a remote server via SSH
 */
async function checkDirectoryExists(
  host: string,
  port: number,
  username: string,
  password: string,
  path: string
): Promise<boolean> {
  return new Promise((resolve) => {
    const client = new Client();

    const timeout = setTimeout(() => {
      client.end();
      resolve(false);
    }, 10000); // 10 second timeout

    client
      .on("ready", () => {
        // Use test -d to check if directory exists
        client.exec(`test -d "${path}" && echo "EXISTS" || echo "NOT_EXISTS"`, (err, stream) => {
          if (err) {
            clearTimeout(timeout);
            client.end();
            resolve(false);
            return;
          }

          let output = "";

          stream
            .on("close", () => {
              clearTimeout(timeout);
              client.end();
              resolve(output.trim() === "EXISTS");
            })
            .on("data", (data: Buffer) => {
              output += data.toString();
            })
            .stderr.on("data", () => {
              // Ignore stderr
            });
        });
      })
      .on("error", () => {
        clearTimeout(timeout);
        client.end();
        resolve(false);
      })
      .connect({
        host,
        port,
        username,
        password,
        readyTimeout: 5000,
      });
  });
}
