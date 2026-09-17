import { NextResponse } from "next/server";
import { requestStore } from "@/lib/data/store";
import { createRequestSchema } from "@/lib/validations/request";

export async function GET() {
  try {
    const requests = requestStore.listAll();
    return NextResponse.json({ success: true, data: requests });
  } catch (error) {
    console.error("Failed to list requests:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch roadside requests" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = createRequestSchema.safeParse(body);

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

    const newRequest = requestStore.create(validated.data);
    return NextResponse.json(
      { success: true, data: newRequest },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating roadside request:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
