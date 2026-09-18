import { NextResponse } from "next/server";
import { requestService } from "@/lib/services";
import { z } from "zod";

const matchSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const validated = matchSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request payload" },
        { status: 400 }
      );
    }

    const result = await requestService.matchAndAssign(validated.data.requestId);

    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to find the specified roadside assistance request.",
        },
        { status: 404 }
      );
    }

    if (!result.matchResult.success || !result.mechanic) {
      return NextResponse.json(
        {
          success: false,
          failureReason: result.matchResult.failureReason,
          error: result.matchResult.explanation,
          request: result.request,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        request: result.request,
        mechanic: result.mechanic,
        distanceKm: result.matchResult.distanceKm,
        estimatedArrivalMinutes: result.matchResult.estimatedArrivalMinutes,
        explanation: result.matchResult.explanation,
        rankedCandidates: result.matchResult.rankedCandidates,
      },
    });
  } catch (error) {
    console.error("Matching error:", error);
    return NextResponse.json(
      { success: false, error: "Internal matching error" },
      { status: 500 }
    );
  }
}
