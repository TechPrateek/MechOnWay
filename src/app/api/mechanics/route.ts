import { NextResponse } from "next/server";
import { mechanicStore } from "@/lib/data/store";
import { z } from "zod";

const updateMechanicSchema = z.object({
  id: z.string().min(1),
  isOnline: z.boolean().optional(),
  status: z.enum(["idle", "assigned", "en_route", "on_site"]).optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const onlineOnly = searchParams.get("online") === "true";

    let mechanics = mechanicStore.listAll();
    if (onlineOnly) {
      mechanics = mechanics.filter((m) => m.isOnline);
    }

    return NextResponse.json({ success: true, data: mechanics });
  } catch (error) {
    console.error("Error fetching mechanics:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const validated = updateMechanicSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed" },
        { status: 400 }
      );
    }

    const current = mechanicStore.getById(validated.data.id);
    if (!current) {
      return NextResponse.json(
        { success: false, error: "Mechanic not found" },
        { status: 404 }
      );
    }

    const updated = mechanicStore.updateStatus(
      validated.data.id,
      validated.data.status ?? current.status,
      validated.data.isOnline
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating mechanic:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
