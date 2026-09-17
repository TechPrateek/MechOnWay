import { NextRequest, NextResponse } from "next/server";
import { requestStore } from "@/lib/data/store";
import { updateRequestStatusSchema } from "@/lib/validations/request";

interface RouteContext {
  params: Promise<{ requestId: string }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { requestId } = await context.params;
    const request = requestStore.getById(requestId);

    if (!request) {
      return NextResponse.json(
        { success: false, error: "Roadside request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: request });
  } catch (error) {
    console.error("Error fetching request:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { requestId } = await context.params;
    const body = await req.json();
    const validated = updateRequestStatusSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validated.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = requestStore.updateStatus(requestId, validated.data);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Roadside request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Error updating request:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 422 }
    );
  }
}
