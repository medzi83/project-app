import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

// POST: Status und/oder Kommentar für Bilder setzen
export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nicht authentifiziert" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "AGENT") {
      return NextResponse.json({ success: false, error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json();
    const { type, id, complete, comment } = body as {
      type: "menuItem" | "logo" | "general";
      id: string; // menuItemId oder projectId (für logo/general)
      complete?: boolean;
      comment?: string | null;
    };

    if (!type || !id) {
      return NextResponse.json(
        { success: false, error: "type und id sind erforderlich" },
        { status: 400 }
      );
    }

    const userName = session.user.name || "Unbekannt";
    const userId = session.user.id;
    const now = new Date();

    if (type === "menuItem") {
      // Update WebDocuMenuItem
      const updateData: Record<string, unknown> = {};

      if (typeof complete === "boolean") {
        updateData.imagesComplete = complete;
        updateData.imagesReviewedAt = now;
        updateData.imagesReviewedById = userId;
        updateData.imagesReviewedByName = userName;
      }

      if (comment !== undefined) {
        updateData.imagesAgentComment = comment;
        // Auch Reviewed-Infos setzen wenn nur Kommentar
        if (!updateData.imagesReviewedAt) {
          updateData.imagesReviewedAt = now;
          updateData.imagesReviewedById = userId;
          updateData.imagesReviewedByName = userName;
        }
      }

      const updated = await prisma.webDocuMenuItem.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          imagesComplete: true,
          imagesAgentComment: true,
          imagesReviewedAt: true,
          imagesReviewedByName: true,
        },
      });

      return NextResponse.json({ success: true, data: updated });
    } else if (type === "logo") {
      // Update WebDocumentation für Logo
      const updateData: Record<string, unknown> = {};

      if (typeof complete === "boolean") {
        updateData.logoImagesComplete = complete;
        updateData.logoImagesReviewedAt = now;
        updateData.logoImagesReviewedById = userId;
        updateData.logoImagesReviewedByName = userName;
      }

      if (comment !== undefined) {
        updateData.logoImagesAgentComment = comment;
        if (!updateData.logoImagesReviewedAt) {
          updateData.logoImagesReviewedAt = now;
          updateData.logoImagesReviewedById = userId;
          updateData.logoImagesReviewedByName = userName;
        }
      }

      const updated = await prisma.webDocumentation.update({
        where: { projectId: id },
        data: updateData,
        select: {
          projectId: true,
          logoImagesComplete: true,
          logoImagesAgentComment: true,
          logoImagesReviewedAt: true,
          logoImagesReviewedByName: true,
        },
      });

      return NextResponse.json({ success: true, data: updated });
    } else if (type === "general") {
      // Update WebDocumentation für allgemeines Material
      const updateData: Record<string, unknown> = {};

      if (typeof complete === "boolean") {
        updateData.generalImagesComplete = complete;
        updateData.generalImagesReviewedAt = now;
        updateData.generalImagesReviewedById = userId;
        updateData.generalImagesReviewedByName = userName;
      }

      if (comment !== undefined) {
        updateData.generalImagesAgentComment = comment;
        if (!updateData.generalImagesReviewedAt) {
          updateData.generalImagesReviewedAt = now;
          updateData.generalImagesReviewedById = userId;
          updateData.generalImagesReviewedByName = userName;
        }
      }

      const updated = await prisma.webDocumentation.update({
        where: { projectId: id },
        data: updateData,
        select: {
          projectId: true,
          generalImagesComplete: true,
          generalImagesAgentComment: true,
          generalImagesReviewedAt: true,
          generalImagesReviewedByName: true,
        },
      });

      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: "Ungültiger Typ" }, { status: 400 });
  } catch (error) {
    console.error("Error updating material review:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}

// GET: Status und Kommentare für ein Projekt abrufen
export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "Nicht authentifiziert" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "AGENT") {
      return NextResponse.json({ success: false, error: "Keine Berechtigung" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "projectId ist erforderlich" },
        { status: 400 }
      );
    }

    // Lade WebDocumentation mit MenuItems
    const webDoku = await prisma.webDocumentation.findUnique({
      where: { projectId },
      select: {
        logoImagesComplete: true,
        logoImagesAgentComment: true,
        logoImagesReviewedAt: true,
        logoImagesReviewedByName: true,
        generalImagesComplete: true,
        generalImagesAgentComment: true,
        generalImagesReviewedAt: true,
        generalImagesReviewedByName: true,
        menuItems: {
          where: { needsImages: true },
          select: {
            id: true,
            name: true,
            imagesComplete: true,
            imagesAgentComment: true,
            imagesReviewedAt: true,
            imagesReviewedByName: true,
          },
        },
      },
    });

    if (!webDoku) {
      return NextResponse.json({ success: false, error: "WebDocumentation nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        logo: {
          complete: webDoku.logoImagesComplete,
          comment: webDoku.logoImagesAgentComment,
          reviewedAt: webDoku.logoImagesReviewedAt,
          reviewedByName: webDoku.logoImagesReviewedByName,
        },
        general: {
          complete: webDoku.generalImagesComplete,
          comment: webDoku.generalImagesAgentComment,
          reviewedAt: webDoku.generalImagesReviewedAt,
          reviewedByName: webDoku.generalImagesReviewedByName,
        },
        menuItems: webDoku.menuItems.map((m) => ({
          id: m.id,
          name: m.name,
          complete: m.imagesComplete,
          comment: m.imagesAgentComment,
          reviewedAt: m.imagesReviewedAt,
          reviewedByName: m.imagesReviewedByName,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching material review:", error);
    return NextResponse.json(
      { success: false, error: "Interner Serverfehler" },
      { status: 500 }
    );
  }
}
