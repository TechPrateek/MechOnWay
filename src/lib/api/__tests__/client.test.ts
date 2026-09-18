import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient, getApiBaseUrl, isApiConfigured } from "../client";
import { CreateRequestInput } from "../../validations/request";

describe("API Client (Frontend -> Cloud Bridge)", () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
  });

  describe("Configuration & Environment Detection", () => {
    it("reports not configured when NEXT_PUBLIC_API_BASE_URL is unset", () => {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
      expect(isApiConfigured()).toBe(false);
      expect(getApiBaseUrl()).toBe("");
    });

    it("normalizes trailing slashes on configured base URL", () => {
      process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.mechonway.com/stage///";
      expect(isApiConfigured()).toBe(true);
      expect(getApiBaseUrl()).toBe("https://api.mechonway.com/stage");
    });
  });

  describe("Request Endpoints", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.mechonway.com";
    });

    it("fetches list of requests via GET /api/requests", async () => {
      const mockData = [{ id: "req-1", status: "SEARCHING" }];
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockData }),
      } as Response);

      const result = await apiClient.requests.list();

      expect(fetchSpy).toHaveBeenCalledWith("https://api.mechonway.com/api/requests", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockData);
    });

    it("creates a new request via POST /api/requests", async () => {
      const payload: CreateRequestInput = {
        customerName: "Alex Rivera",
        customerPhone: "+1 (555) 321-7654",
        breakdownCategory: "battery_issue",
        urgency: "standard",
        vehicle: { type: "car", make: "Tesla", model: "Model 3" },
        issueDescription: "Dead 12V battery",
        location: {
          address: "100 Market St, SF",
          coordinates: { lat: 37.79, lng: -122.4 },
        },
      };

      const created = { id: "req-999", ...payload, status: "SEARCHING" };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: created }),
      } as Response);

      const result = await apiClient.requests.create(payload);

      expect(fetchSpy).toHaveBeenCalledWith("https://api.mechonway.com/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(result).toEqual(created);
    });

    it("executes matching engine dispatch via POST /api/requests/match", async () => {
      const matchResponse = {
        success: true,
        data: {
          request: { id: "req-101", status: "ON_THE_WAY" },
          mechanic: { mechanicId: "mech-1", name: "Dave Miller" },
          distanceKm: 3.2,
          estimatedArrivalMinutes: 11,
          explanation: "Closest certified roadside technician",
        },
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => matchResponse,
      } as Response);

      const result = await apiClient.requests.match("req-101");

      expect(fetchSpy).toHaveBeenCalledWith("https://api.mechonway.com/api/requests/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: "req-101" }),
      });
      expect(result).toEqual(matchResponse.data);
    });

    it("updates request status via PATCH /api/requests/{id}", async () => {
      const updated = { id: "req-101", status: "ARRIVED" };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: updated }),
      } as Response);

      const result = await apiClient.requests.updateStatus("req-101", {
        status: "ARRIVED",
      });

      expect(fetchSpy).toHaveBeenCalledWith("https://api.mechonway.com/api/requests/req-101", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARRIVED" }),
      });
      expect(result).toEqual(updated);
    });

    it("throws clear error when HTTP response fails", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ success: false, error: "Validation failed on status transition" }),
      } as Response);

      await expect(
        apiClient.requests.updateStatus("req-101", { status: "COMPLETED" })
      ).rejects.toThrow("Validation failed on status transition");
    });
  });

  describe("Mechanic Endpoints", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.mechonway.com";
    });

    it("fetches mechanics with query params via GET /api/mechanics?online=true", async () => {
      const mockMechanics = [{ mechanicId: "mech-1", name: "Sarah Connor", isOnline: true }];

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockMechanics }),
      } as Response);

      const result = await apiClient.mechanics.list({ onlineOnly: true });

      expect(fetchSpy).toHaveBeenCalledWith("https://api.mechonway.com/api/mechanics?online=true", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      expect(result).toEqual(mockMechanics);
    });

    it("updates mechanic status via PATCH /api/mechanics", async () => {
      const updatedMechanic = {
        mechanicId: "mech-1",
        status: "en_route",
        isOnline: true,
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: updatedMechanic }),
      } as Response);

      const result = await apiClient.mechanics.updateStatus("mech-1", "en_route", true);

      expect(fetchSpy).toHaveBeenCalledWith("https://api.mechonway.com/api/mechanics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "mech-1", status: "en_route", isOnline: true }),
      });
      expect(result).toEqual(updatedMechanic);
    });
  });
});
