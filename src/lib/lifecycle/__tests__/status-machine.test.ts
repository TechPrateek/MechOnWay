import { describe, it, expect } from "vitest";
import {
  canTransitionStatus,
  isStatusTransitionAllowed,
  getAllowedNextStatuses,
  normalizeRequestStatus,
  getTimelineEventForStatus,
} from "../status-machine";

describe("Request Lifecycle Status Machine", () => {
  describe("Happy Path Workflow", () => {
    const contextWithMechanic = { assignedMechanicId: "mech-001" };

    it("allows the sequential progression through full happy path", () => {
      // 1. Initial creation to matching
      expect(canTransitionStatus("SEARCHING", "MATCHED").allowed).toBe(true);

      // 2. Matched to requested
      expect(canTransitionStatus("MATCHED", "REQUESTED").allowed).toBe(true);

      // 3. Requested to accepted (with mechanic assigned)
      expect(canTransitionStatus("REQUESTED", "ACCEPTED", contextWithMechanic).allowed).toBe(true);

      // 4. Accepted to on the way
      expect(canTransitionStatus("ACCEPTED", "ON_THE_WAY").allowed).toBe(true);

      // 5. On the way to arrived
      expect(canTransitionStatus("ON_THE_WAY", "ARRIVED").allowed).toBe(true);

      // 6. Arrived to in service
      expect(canTransitionStatus("ARRIVED", "IN_SERVICE").allowed).toBe(true);

      // 7. In service to completed
      expect(canTransitionStatus("IN_SERVICE", "COMPLETED").allowed).toBe(true);
    });

    it("allows direct acceptance from MATCHED when mechanic is assigned", () => {
      expect(canTransitionStatus("MATCHED", "ACCEPTED", contextWithMechanic).allowed).toBe(true);
    });
  });

  describe("Rule 1: Completed Request Cannot Be Cancelled or Modified", () => {
    it("strictly blocks cancelling a completed request", () => {
      const result = canTransitionStatus("COMPLETED", "CANCELLED");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("completed request cannot be cancelled");
    });

    it("strictly blocks returning a completed request to any other status", () => {
      expect(canTransitionStatus("COMPLETED", "SEARCHING").allowed).toBe(false);
      expect(canTransitionStatus("COMPLETED", "IN_SERVICE").allowed).toBe(false);
      expect(canTransitionStatus("COMPLETED", "ON_THE_WAY").allowed).toBe(false);
    });
  });

  describe("Rule 2: Cancelled Request Cannot Return to Active Status", () => {
    it("strictly blocks returning a cancelled request to active statuses", () => {
      expect(canTransitionStatus("CANCELLED", "SEARCHING").allowed).toBe(false);
      expect(canTransitionStatus("CANCELLED", "ACCEPTED").allowed).toBe(false);
      expect(canTransitionStatus("CANCELLED", "ON_THE_WAY").allowed).toBe(false);
      expect(canTransitionStatus("CANCELLED", "IN_SERVICE").allowed).toBe(false);
      expect(canTransitionStatus("CANCELLED", "COMPLETED").allowed).toBe(false);
    });
  });

  describe("Rule 3: Mechanic Must Be Assigned Before Moving to Accepted", () => {
    it("rejects transition to ACCEPTED if assignedMechanicId is missing", () => {
      const result = canTransitionStatus("REQUESTED", "ACCEPTED", {});
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("mechanic must be assigned before moving to accepted");
    });

    it("rejects transition to ACCEPTED if assignedMechanicId is whitespace or null", () => {
      expect(canTransitionStatus("REQUESTED", "ACCEPTED", { assignedMechanicId: "   " }).allowed).toBe(false);
      expect(canTransitionStatus("REQUESTED", "ACCEPTED", { assignedMechanicId: null }).allowed).toBe(false);
    });

    it("allows transition to ACCEPTED if assignedMechanicId is valid", () => {
      const result = canTransitionStatus("REQUESTED", "ACCEPTED", { assignedMechanicId: "mech-42" });
      expect(result.allowed).toBe(true);
    });
  });

  describe("Cancellation Rules", () => {
    it("allows cancellation during initial search and dispatch phases", () => {
      expect(canTransitionStatus("SEARCHING", "CANCELLED").allowed).toBe(true);
      expect(canTransitionStatus("MATCHED", "CANCELLED").allowed).toBe(true);
      expect(canTransitionStatus("REQUESTED", "CANCELLED").allowed).toBe(true);
      expect(canTransitionStatus("ACCEPTED", "CANCELLED").allowed).toBe(true);
      expect(canTransitionStatus("ON_THE_WAY", "CANCELLED").allowed).toBe(true);
      expect(canTransitionStatus("ARRIVED", "CANCELLED").allowed).toBe(true);
    });

    it("disallows cancellation once service repair has begun (IN_SERVICE)", () => {
      expect(canTransitionStatus("IN_SERVICE", "CANCELLED").allowed).toBe(false);
    });
  });

  describe("Mechanic Rejection & Unavailability Paths", () => {
    it("allows mechanic to reject a request, returning it to SEARCHING", () => {
      expect(canTransitionStatus("REQUESTED", "SEARCHING").allowed).toBe(true);
    });

    it("allows marking NO_MECHANIC_AVAILABLE from SEARCHING or REQUESTED", () => {
      expect(canTransitionStatus("SEARCHING", "NO_MECHANIC_AVAILABLE").allowed).toBe(true);
      expect(canTransitionStatus("REQUESTED", "NO_MECHANIC_AVAILABLE").allowed).toBe(true);
    });

    it("allows customer to retry matching from NO_MECHANIC_AVAILABLE back to SEARCHING", () => {
      expect(canTransitionStatus("NO_MECHANIC_AVAILABLE", "SEARCHING").allowed).toBe(true);
    });
  });

  describe("Arbitrary & Invalid Jumps", () => {
    it("rejects arbitrary forward jumps", () => {
      expect(canTransitionStatus("SEARCHING", "COMPLETED").allowed).toBe(false);
      expect(canTransitionStatus("SEARCHING", "IN_SERVICE").allowed).toBe(false);
      expect(canTransitionStatus("SEARCHING", "ARRIVED").allowed).toBe(false);
      expect(canTransitionStatus("MATCHED", "COMPLETED").allowed).toBe(false);
      expect(canTransitionStatus("ON_THE_WAY", "COMPLETED").allowed).toBe(false);
    });

    it("rejects backward transitions", () => {
      expect(canTransitionStatus("ON_THE_WAY", "SEARCHING").allowed).toBe(false);
      expect(canTransitionStatus("ARRIVED", "ON_THE_WAY").allowed).toBe(false);
      expect(canTransitionStatus("IN_SERVICE", "ARRIVED").allowed).toBe(false);
    });
  });

  describe("Legacy Status Normalization", () => {
    it("normalizes legacy lowercase statuses to canonical uppercase", () => {
      expect(normalizeRequestStatus("pending")).toBe("SEARCHING");
      expect(normalizeRequestStatus("matching")).toBe("SEARCHING");
      expect(normalizeRequestStatus("dispatched")).toBe("ON_THE_WAY");
      expect(normalizeRequestStatus("arrived")).toBe("ARRIVED");
      expect(normalizeRequestStatus("in_progress")).toBe("IN_SERVICE");
      expect(normalizeRequestStatus("completed")).toBe("COMPLETED");
      expect(normalizeRequestStatus("cancelled")).toBe("CANCELLED");
    });

    it("correctly evaluates transitions when given legacy status strings", () => {
      expect(isStatusTransitionAllowed("pending", "matching")).toBe(true); // both map to SEARCHING (idempotent)
      expect(isStatusTransitionAllowed("pending", "MATCHED")).toBe(true);
      expect(isStatusTransitionAllowed("completed", "cancelled")).toBe(false);
    });
  });

  describe("getAllowedNextStatuses Helper", () => {
    it("returns correct allowed targets for SEARCHING", () => {
      const allowed = getAllowedNextStatuses("SEARCHING");
      expect(allowed).toContain("MATCHED");
      expect(allowed).toContain("REQUESTED");
      expect(allowed).toContain("NO_MECHANIC_AVAILABLE");
      expect(allowed).toContain("CANCELLED");
      expect(allowed).not.toContain("COMPLETED");
    });

    it("returns empty array for terminal COMPLETED state", () => {
      expect(getAllowedNextStatuses("COMPLETED")).toHaveLength(0);
    });

    it("returns empty array for terminal CANCELLED state", () => {
      expect(getAllowedNextStatuses("CANCELLED")).toHaveLength(0);
    });
  });

  describe("Timeline Logging Helper", () => {
    it("generates clear audit titles and descriptions for each status", () => {
      const searchEvent = getTimelineEventForStatus("SEARCHING");
      expect(searchEvent.title).toBe("Searching for Suitable Mechanic");

      const acceptedEvent = getTimelineEventForStatus("ACCEPTED", { mechanicName: "Elena Rostova" });
      expect(acceptedEvent.description).toContain("Elena Rostova has accepted");

      const completedEvent = getTimelineEventForStatus("COMPLETED", { diagnosticNotes: "Tire torqued to OEM specs." });
      expect(completedEvent.description).toContain("Tire torqued to OEM specs.");
    });
  });
});
