import { requestService, mechanicService } from "@/lib/services";
import { createRequestSchema, updateRequestStatusSchema } from "@/lib/validations/request";
import { z } from "zod";

const matchSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
});

const updateMechanicSchema = z.object({
  id: z.string().min(1),
  isOnline: z.boolean().optional(),
  status: z.enum(["idle", "assigned", "en_route", "on_site"]).optional(),
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  "Content-Type": "application/json",
};

interface LambdaHttpEvent {
  rawPath?: string;
  path?: string;
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
    };
    httpMethod?: string;
  };
  httpMethod?: string;
  queryStringParameters?: Record<string, string | undefined>;
  pathParameters?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
}

interface LambdaHttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function jsonResponse(statusCode: number, data: unknown): LambdaHttpResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(data),
  };
}

export async function handler(event: LambdaHttpEvent): Promise<LambdaHttpResponse> {
  const method = (
    event.requestContext?.http?.method ||
    event.httpMethod ||
    event.requestContext?.httpMethod ||
    "GET"
  ).toUpperCase();

  const rawPath = event.rawPath || event.path || event.requestContext?.http?.path || "/";
  // Strip query string and remove trailing slashes for resilient route matching
  const path = rawPath.split("?")[0].replace(/\/+$/, "") || "/";

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  try {
    const rawBody = event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf-8")
        : event.body
      : "{}";

    const parseBody = () => {
      try {
        return JSON.parse(rawBody);
      } catch {
        return {};
      }
    };

    // Route: /api/requests/match
    if (path.endsWith("/api/requests/match") || path.endsWith("/requests/match")) {
      if (method === "POST") {
        const validated = matchSchema.safeParse(parseBody());
        if (!validated.success) {
          return jsonResponse(400, { success: false, error: "Invalid request payload", details: validated.error.flatten() });
        }
        const result = await requestService.matchAndAssign(validated.data.requestId);
        if (!result) {
          return jsonResponse(404, { success: false, error: "Roadside assistance request not found" });
        }
        if (!result.matchResult.success || !result.mechanic) {
          return jsonResponse(200, {
            success: false,
            failureReason: result.matchResult.failureReason,
            error: result.matchResult.explanation,
            request: result.request,
          });
        }
        return jsonResponse(200, {
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
      }
    }

    // Route: /api/requests/{requestId}
    const reqDetailMatch = path.match(/(?:\/api)?\/requests\/([a-zA-Z0-9_-]+)$/);
    if (reqDetailMatch) {
      const requestId = reqDetailMatch[1];

      if (method === "GET") {
        const request = await requestService.getById(requestId);
        if (!request) {
          return jsonResponse(404, { success: false, error: "Roadside request not found" });
        }
        return jsonResponse(200, { success: true, data: request });
      }

      if (method === "PATCH") {
        const validated = updateRequestStatusSchema.safeParse(parseBody());
        if (!validated.success) {
          return jsonResponse(400, { success: false, error: "Validation failed", details: validated.error.flatten() });
        }
        const updated = await requestService.updateStatus(requestId, validated.data);
        return jsonResponse(200, { success: true, data: updated });
      }
    }

    // Route: /api/requests
    if (path.endsWith("/api/requests") || path.endsWith("/requests")) {
      if (method === "GET") {
        const requests = await requestService.listAll();
        return jsonResponse(200, { success: true, data: requests });
      }

      if (method === "POST") {
        const validated = createRequestSchema.safeParse(parseBody());
        if (!validated.success) {
          return jsonResponse(400, { success: false, error: "Validation failed", details: validated.error.flatten() });
        }
        const created = await requestService.createRequest(validated.data);
        return jsonResponse(201, { success: true, data: created });
      }
    }

    // Route: /api/mechanics
    if (path.endsWith("/api/mechanics") || path.endsWith("/mechanics")) {
      if (method === "GET") {
        const onlineOnly = event.queryStringParameters?.online === "true";
        const mechanics = await mechanicService.listMechanics({ onlineOnly });
        return jsonResponse(200, { success: true, data: mechanics });
      }

      if (method === "PATCH") {
        const validated = updateMechanicSchema.safeParse(parseBody());
        if (!validated.success) {
          return jsonResponse(400, { success: false, error: "Validation failed", details: validated.error.flatten() });
        }
        const current = await mechanicService.getById(validated.data.id);
        if (!current) {
          return jsonResponse(404, { success: false, error: "Mechanic not found" });
        }
        const updated = await mechanicService.updateStatus(
          validated.data.id,
          validated.data.status ?? current.status ?? "idle",
          validated.data.isOnline
        );
        return jsonResponse(200, { success: true, data: updated });
      }
    }

    // 404 for unmatched route
    return jsonResponse(404, { success: false, error: `Route ${method} ${path} not found` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error(`Lambda Handler Error [${method} ${path}]:`, error);
    return jsonResponse(500, { success: false, error: message });
  }
}
