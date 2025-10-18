import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { promises as fs } from "fs";
import path from "path";

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

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

    const storageDir = path.join(process.cwd(), "storage", "joomla");
    const tempDir = path.join(storageDir, "temp");

    // Create directories if they don't exist
    await fs.mkdir(tempDir, { recursive: true });

    // Save chunk to temporary file
    const tempFileName = `${fileName}.part${chunkIndex}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    const buffer = Buffer.from(await chunk.arrayBuffer());
    await fs.writeFile(tempFilePath, buffer);

    // If this is the last chunk, combine all chunks
    if (chunkIndex === totalChunks - 1) {
      const finalFileName = type === "kickstart" ? "kickstart.php" : fileName;
      const finalFilePath = path.join(storageDir, finalFileName);

      // Delete old backup files if uploading a new backup
      if (type === "backup") {
        try {
          const files = await fs.readdir(storageDir);
          const oldBackups = files.filter((f) => f.endsWith(".jpa") || f.endsWith(".zip"));
          for (const oldBackup of oldBackups) {
            await fs.unlink(path.join(storageDir, oldBackup));
          }
        } catch (error) {
          // Ignore errors if no old files exist
        }
      }

      // Combine all chunks
      const writeStream = await fs.open(finalFilePath, 'w');

      try {
        for (let i = 0; i < totalChunks; i++) {
          const chunkPath = path.join(tempDir, `${fileName}.part${i}`);
          const chunkData = await fs.readFile(chunkPath);
          await writeStream.write(chunkData);
        }
      } finally {
        await writeStream.close();
      }

      // Clean up temporary files
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(tempDir, `${fileName}.part${i}`);
        try {
          await fs.unlink(chunkPath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }

      return NextResponse.json({
        success: true,
        message: `${type === "kickstart" ? "kickstart.php" : "Backup"} successfully uploaded`,
        fileName: finalFileName,
        complete: true,
      });
    }

    // Not the last chunk, just acknowledge receipt
    return NextResponse.json({
      success: true,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded`,
      complete: false,
    });
  } catch (error) {
    console.error("Error uploading chunk:", error);
    return NextResponse.json(
      { error: "Failed to upload chunk" },
      { status: 500 }
    );
  }
}
