import { Mechanic, MechanicStatus, RoadsideRequest } from "@/types";
import { CreateRequestInput, UpdateRequestStatusInput } from "../validations/request";

export const AWS_API_BASE_URL = "https://nijdxn0jjb.execute-api.ap-south-1.amazonaws.com";

/**
 * Returns the configured API Gateway base URL.
 * Uses NEXT_PUBLIC_API_BASE_URL if set, or defaults to the deployed AWS API Gateway in the browser.
 */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (url !== undefined && url !== "") {
    return url.replace(/\/+$/, "");
  }
  // In browser runtime, always default to the live AWS API base URL
  if (typeof window !== "undefined") {
    return AWS_API_BASE_URL;
  }
  return "";
}

export function isApiConfigured(): boolean {
  return !!getApiBaseUrl();
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = body?.error || `API request failed with HTTP ${res.status}: ${res.statusText}`;
    throw new Error(errorMsg);
  }

  return body?.data ?? body;
}

export const apiClient = {
  isConfigured: isApiConfigured,
  getBaseUrl: getApiBaseUrl,

  requests: {
    async list(): Promise<RoadsideRequest[]> {
      return request<RoadsideRequest[]>("/api/requests", { method: "GET" });
    },

    async get(id: string): Promise<RoadsideRequest | null> {
      try {
        return await request<RoadsideRequest>(`/api/requests/${encodeURIComponent(id)}`, {
          method: "GET",
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("404")) return null;
        throw err;
      }
    },

    async create(input: CreateRequestInput): Promise<RoadsideRequest> {
      return request<RoadsideRequest>("/api/requests", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    async match(requestId: string): Promise<{
      request?: RoadsideRequest;
      mechanic?: Mechanic;
      distanceKm?: number;
      estimatedArrivalMinutes?: number;
      explanation?: string;
      rankedCandidates?: Array<{ mechanicId: string; name: string; distanceKm: number }>;
      success?: boolean;
      failureReason?: string;
      error?: string;
    }> {
      return request("/api/requests/match", {
        method: "POST",
        body: JSON.stringify({ requestId }),
      });
    },

    async updateStatus(id: string, input: UpdateRequestStatusInput): Promise<RoadsideRequest> {
      return request<RoadsideRequest>(`/api/requests/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },

    async cancel(id: string, reason?: string): Promise<RoadsideRequest> {
      return this.updateStatus(id, {
        status: "CANCELLED",
        cancellationReason: reason,
      });
    },
  },

  mechanics: {
    async list(options?: { onlineOnly?: boolean }): Promise<Mechanic[]> {
      const qs = options?.onlineOnly ? "?online=true" : "";
      return request<Mechanic[]>(`/api/mechanics${qs}`, { method: "GET" });
    },

    async updateStatus(
      id: string,
      status?: MechanicStatus,
      isOnline?: boolean
    ): Promise<Mechanic> {
      return request<Mechanic>("/api/mechanics", {
        method: "PATCH",
        body: JSON.stringify({ id, status, isOnline }),
      });
    },
  },
};
