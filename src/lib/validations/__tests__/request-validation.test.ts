import { describe, it, expect } from "vitest";
import {
  createRequestSchema,
  serviceLocationSchema,
  updateRequestStatusSchema,
} from "../request";

describe("Request Validation Schema (Zod)", () => {
  const validPayload = {
    customerName: "Alex Mercer",
    customerPhone: "+1 (555) 301-4491",
    breakdownCategory: "flat_tyre" as const,
    issueDescription: "Punctured right front tire on highway off-ramp.",
    urgency: "standard" as const,
    vehicle: {
      type: "car" as const,
      make: "Toyota",
      model: "Camry",
      year: 2021,
      color: "Silver",
      licensePlate: "7ABC123",
      isEV: false,
    },
    location: {
      address: "101 Market St, San Francisco, CA",
      coordinates: {
        lat: 37.7749,
        lng: -122.4194,
      },
      landmark: "Near BART entrance",
      parkingNotes: "Hazard lights on",
      isDemo: false,
    },
  };

  describe("Happy Path Creation Validation", () => {
    it("successfully parses and validates a complete, valid request payload", () => {
      const result = createRequestSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerName).toBe("Alex Mercer");
        expect(result.data.breakdownCategory).toBe("flat_tyre");
        expect(result.data.location.coordinates.lat).toBe(37.7749);
      }
    });

    it("defaults urgency to 'standard' if omitted", () => {
      const withoutUrgency = { ...validPayload };
      delete (withoutUrgency as Partial<typeof validPayload>).urgency;
      const result = createRequestSchema.safeParse(withoutUrgency);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.urgency).toBe("standard");
      }
    });
  });

  describe("Coordinate Bounds Validation", () => {
    it("accepts valid geographical coordinates within world degree bounds", () => {
      const result = serviceLocationSchema.safeParse({
        address: "Test Location",
        coordinates: { lat: 37.7749, lng: -122.4194 },
      });
      expect(result.success).toBe(true);
    });

    it("rejects latitude greater than 90 degrees", () => {
      const result = serviceLocationSchema.safeParse({
        address: "Test Location",
        coordinates: { lat: 91.5, lng: -122.4194 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("between -90 and 90 degrees");
      }
    });

    it("rejects latitude less than -90 degrees", () => {
      const result = serviceLocationSchema.safeParse({
        address: "Test Location",
        coordinates: { lat: -95.0, lng: -122.4194 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("between -90 and 90 degrees");
      }
    });

    it("rejects longitude greater than 180 degrees", () => {
      const result = serviceLocationSchema.safeParse({
        address: "Test Location",
        coordinates: { lat: 37.7749, lng: 185.0 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("between -180 and 180 degrees");
      }
    });

    it("rejects longitude less than -180 degrees", () => {
      const result = serviceLocationSchema.safeParse({
        address: "Test Location",
        coordinates: { lat: 37.7749, lng: -185.0 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("between -180 and 180 degrees");
      }
    });

    it("rejects non-numeric coordinates", () => {
      const result = serviceLocationSchema.safeParse({
        address: "Test Location",
        coordinates: { lat: "37.7749", lng: null },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Customer Information Validation", () => {
    it("rejects customer names shorter than 2 characters", () => {
      const result = createRequestSchema.safeParse({
        ...validPayload,
        customerName: "A",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("at least 2 characters");
      }
    });

    it("rejects empty customer names", () => {
      const result = createRequestSchema.safeParse({
        ...validPayload,
        customerName: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid telephone number formats", () => {
      const result = createRequestSchema.safeParse({
        ...validPayload,
        customerPhone: "not-a-number",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("valid telephone number");
      }
    });

    it("rejects phone numbers with fewer than 7 digits", () => {
      const result = createRequestSchema.safeParse({
        ...validPayload,
        customerPhone: "12345",
      });
      expect(result.success).toBe(false);
    });

    it("accepts various valid international and local phone formats", () => {
      const validNumbers = [
        "+1 (555) 301-4491",
        "555-301-4491",
        "(555) 301-4491",
        "+44 20 7946 0991",
        "5553014491",
      ];
      for (const phone of validNumbers) {
        const res = createRequestSchema.safeParse({
          ...validPayload,
          customerPhone: phone,
        });
        expect(res.success).toBe(true);
      }
    });
  });

  describe("Breakdown & Issue Description Validation", () => {
    it("rejects issue descriptions shorter than 5 characters", () => {
      const result = createRequestSchema.safeParse({
        ...validPayload,
        issueDescription: "Help",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("at least 5 characters");
      }
    });

    it("rejects invalid breakdown categories", () => {
      const result = createRequestSchema.safeParse({
        ...validPayload,
        breakdownCategory: "flying_car_malfunction",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid vehicle types", () => {
      const result = createRequestSchema.safeParse({
        ...validPayload,
        vehicle: {
          type: "submarine",
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Status Update Schema Validation", () => {
    it("validates canonical status updates", () => {
      const result = updateRequestStatusSchema.safeParse({
        status: "ON_THE_WAY",
        diagnosticNotes: "Dispatched mobile rig with hydraulic jacks.",
      });
      expect(result.success).toBe(true);
    });

    it("rejects unrecognized status values", () => {
      const result = updateRequestStatusSchema.safeParse({
        status: "TELEPORTING",
      });
      expect(result.success).toBe(false);
    });
  });
});
