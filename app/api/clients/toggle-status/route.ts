import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/authz";

export async function POST(request: NextRequest) {
  const session = await getAuthSession();

  // Only admins can toggle client status
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { clientId, field } = await request.json();

    if (!clientId || !field) {
      return NextResponse.json(
        { error: "clientId and field are required" },
        { status: 400 }
      );
    }

    if (field !== "workStopped" && field !== "finished") {
      return NextResponse.json(
        { error: "field must be 'workStopped' or 'finished'" },
        { status: 400 }
      );
    }

    // Type assertion after validation
    const validatedField = field as "workStopped" | "finished";

    // Get current value
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { workStopped: true, finished: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Toggle the field
    const newValue = !client[validatedField];

    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: { [validatedField]: newValue },
    });

    return NextResponse.json({
      success: true,
      [validatedField]: updatedClient[validatedField],
    });
  } catch (error) {
    console.error("Error toggling client status:", error);
    return NextResponse.json(
      { error: "Failed to toggle status" },
      { status: 500 }
    );
  }
}
