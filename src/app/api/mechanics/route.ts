import { NextResponse } from "next/server";
import { mechanicService } from "@/lib/services";
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

    const mechanics = await mechanicService.listMechanics({ onlineOnly });

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

    const current = await mechanicService.getById(validated.data.id);
    if (!current) {
      return NextResponse.json(
        { success: false, error: "Mechanic not found" },
        { status: 404 }
      );
    }

    const updated = await mechanicService.updateStatus(
      validated.data.id,
      validated.data.status ?? current.status ?? "idle",
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
