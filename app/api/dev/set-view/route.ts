import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/authz";

// Vercel Region Configuration: Run in Frankfurt, Germany
export const runtime = 'nodejs';
export const preferredRegion = 'fra1';


export async function POST(request: Request) {
  try {
    // Nur Admins dürfen die Ansicht wechseln
    await requireRole(["ADMIN"]);

    const body = await request.json();
    const { userId } = body;

    const cookieStore = await cookies();

    if (userId) {
      // Setze Cookie für Agent-Ansicht
      cookieStore.set("dev-view-as", userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 Stunden
      });
    } else {
      // Lösche Cookie für Admin-Ansicht
      cookieStore.delete("dev-view-as");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting view:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
