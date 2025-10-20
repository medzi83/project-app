import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';


type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const logoFile = formData.get("logo") as File | null;
    const logoIconFile = formData.get("logoIcon") as File | null;

    const agency = await prisma.agency.findUnique({
      where: { id },
    });

    if (!agency) {
      return NextResponse.json({ success: false, message: "Agency not found" }, { status: 404 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "agencies");

    // Ensure upload directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    let logoPath = agency.logoPath;
    let logoIconPath = agency.logoIconPath;

    // Handle main logo upload
    if (logoFile && logoFile.size > 0) {
      // Delete old logo if exists
      if (agency.logoPath) {
        const oldLogoPath = path.join(process.cwd(), "public", agency.logoPath);
        if (existsSync(oldLogoPath)) {
          await unlink(oldLogoPath);
        }
      }

      const logoBytes = await logoFile.arrayBuffer();
      const logoBuffer = Buffer.from(logoBytes);

      const logoExt = path.extname(logoFile.name);
      const logoFileName = `${id}-logo${logoExt}`;
      const logoFilePath = path.join(uploadDir, logoFileName);

      await writeFile(logoFilePath, logoBuffer);
      logoPath = `/uploads/agencies/${logoFileName}`;
    }

    // Handle icon logo upload
    if (logoIconFile && logoIconFile.size > 0) {
      // Delete old icon if exists
      if (agency.logoIconPath) {
        const oldIconPath = path.join(process.cwd(), "public", agency.logoIconPath);
        if (existsSync(oldIconPath)) {
          await unlink(oldIconPath);
        }
      }

      const iconBytes = await logoIconFile.arrayBuffer();
      const iconBuffer = Buffer.from(iconBytes);

      const iconExt = path.extname(logoIconFile.name);
      const iconFileName = `${id}-icon${iconExt}`;
      const iconFilePath = path.join(uploadDir, iconFileName);

      await writeFile(iconFilePath, iconBuffer);
      logoIconPath = `/uploads/agencies/${iconFileName}`;
    }

    // Update agency with new logo paths
    const updatedAgency = await prisma.agency.update({
      where: { id },
      data: {
        logoPath: logoPath || undefined,
        logoIconPath: logoIconPath || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      logoPath: updatedAgency.logoPath,
      logoIconPath: updatedAgency.logoIconPath,
    });
  } catch (error) {
    console.error("Error uploading agency logos:", error);
    return NextResponse.json(
      { success: false, message: "Error uploading logos" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getAuthSession();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // "logo" or "icon"

    const agency = await prisma.agency.findUnique({
      where: { id },
    });

    if (!agency) {
      return NextResponse.json({ success: false, message: "Agency not found" }, { status: 404 });
    }

    if (type === "logo" && agency.logoPath) {
      const logoPath = path.join(process.cwd(), "public", agency.logoPath);
      if (existsSync(logoPath)) {
        await unlink(logoPath);
      }
      await prisma.agency.update({
        where: { id },
        data: { logoPath: null },
      });
    } else if (type === "icon" && agency.logoIconPath) {
      const iconPath = path.join(process.cwd(), "public", agency.logoIconPath);
      if (existsSync(iconPath)) {
        await unlink(iconPath);
      }
      await prisma.agency.update({
        where: { id },
        data: { logoIconPath: null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting agency logo:", error);
    return NextResponse.json(
      { success: false, message: "Error deleting logo" },
      { status: 500 }
    );
  }
}
