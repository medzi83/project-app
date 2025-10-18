import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { promises as fs } from "fs";
import path from "path";

// Allow large file uploads (200 MB max)
export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

// Note: For production on Vercel, you may need to configure bodyParser
// Vercel has a 4.5 MB limit on serverless functions by default
// For larger files, consider using direct upload to storage or streaming

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

    const storageDir = path.join(process.cwd(), "storage", "joomla");

    // Create directory if it doesn't exist
    try {
      await fs.access(storageDir);
    } catch {
      await fs.mkdir(storageDir, { recursive: true });
    }

    // Delete old backup files if uploading a new backup
    if (type === "backup") {
      const files = await fs.readdir(storageDir);
      const oldBackups = files.filter((f) => f.endsWith(".jpa") || f.endsWith(".zip"));
      for (const oldBackup of oldBackups) {
        await fs.unlink(path.join(storageDir, oldBackup));
      }
    }

    // Save the file
    const fileName = type === "kickstart" ? "kickstart.php" : file.name;
    const filePath = path.join(storageDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      success: true,
      message: `${type === "kickstart" ? "kickstart.php" : "Backup"} successfully uploaded`,
      fileName,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
