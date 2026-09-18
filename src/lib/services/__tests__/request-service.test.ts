import { describe, it, expect, beforeEach } from "vitest";
import { RequestService } from "../request-service";
import { LocalRequestRepository, LocalMechanicRepository } from "../../repositories/local-repository";

describe("RequestService Domain Service", () => {
  let reqRepo: LocalRequestRepository;
  let mechRepo: LocalMechanicRepository;
  let service: RequestService;

  beforeEach(async () => {
    reqRepo = new LocalRequestRepository();
    mechRepo = new LocalMechanicRepository();
    await reqRepo.reset();
    await mechRepo.reset();
    service = new RequestService(reqRepo, mechRepo);
  });

  describe("Request Creation & Dynamic Pricing", () => {
    it("creates a standard vehicle request with base price", async () => {
      const created = await service.createRequest({
        customerName: "Sam Fisher",
        customerPhone: "+1 (555) 123-4567",
        breakdownCategory: "flat_tyre",
        urgency: "standard",
        vehicle: {
          type: "car",
          make: "Toyota",
          model: "Corolla",
        },
        issueDescription: "Punctured right rear tyre",
        location: {
          address: "Market St, San Francisco, CA",
          coordinates: { lat: 37.78, lng: -122.41 },
        },
      });

      expect(created).toBeDefined();
      expect(created.id).toMatch(/^req-/);
      expect(created.status).toBe("SEARCHING");
      expect(created.estimatedPrice).toBe(65); // base price for flat_tyre
      expect(created.timeline.length).toBe(1);
    });

    it("adjusts pricing for heavy vehicles and highway emergencies", async () => {
      const truckReq = await service.createRequest({
        customerName: "Heavy Rig Driver",
        customerPhone: "+1 (555) 987-6543",
        breakdownCategory: "engine_problem", // base: 85
        urgency: "critical_highway", // +20
        vehicle: {
          type: "truck", // +25
          make: "Freightliner",
          model: "Cascadia",
        },
        issueDescription: "Overheating on highway shoulder",
        location: {
          address: "I-80 Mile 14, CA",
          coordinates: { lat: 37.81, lng: -122.35 },
        },
      });

      expect(truckReq.estimatedPrice).toBe(85 + 25 + 20); // 130
    });

    it("applies discounts for two-wheelers", async () => {
      const motoReq = await service.createRequest({
        customerName: "Rider Alex",
        customerPhone: "+1 (555) 456-7890",
        breakdownCategory: "battery_issue", // base: 55
        urgency: "standard",
        vehicle: {
          type: "motorcycle", // -10
          make: "Kawasaki",
          model: "Ninja",
        },
        issueDescription: "Battery dead after parking",
        location: {
          address: "Valencia St, San Francisco, CA",
          coordinates: { lat: 37.76, lng: -122.42 },
        },
      });

      expect(motoReq.estimatedPrice).toBe(55 - 10); // 45
    });
  });

  describe("Lifecycle State Transitions & Validation", () => {
    it("progresses request cleanly through standard service states", async () => {
      const created = await service.createRequest({
        customerName: "Jane Doe",
        customerPhone: "+1 (555) 234-5678",
        breakdownCategory: "battery_issue",
        vehicle: { type: "car", make: "Honda", model: "Civic" },
        issueDescription: "Dead battery at grocery parking lot",
        urgency: "standard",
        location: { address: "Civic Center, SF", coordinates: { lat: 37.77, lng: -122.41 } },
      });

      const mechanics = await mechRepo.listAll();
      const tech = mechanics[0];

      // Move to REQUESTED
      const requested = await service.updateStatus(created.id, {
        status: "REQUESTED",
        mechanicId: tech.id,
      });
      expect(requested.status).toBe("REQUESTED");

      // Move to ACCEPTED
      const accepted = await service.updateStatus(created.id, {
        status: "ACCEPTED",
        mechanicId: tech.id,
      });
      expect(accepted.status).toBe("ACCEPTED");

      // Move to ON_THE_WAY
      const enRoute = await service.updateStatus(created.id, {
        status: "ON_THE_WAY",
      });
      expect(enRoute.status).toBe("ON_THE_WAY");

      // Complete job
      await service.updateStatus(created.id, { status: "ARRIVED" });
      await service.updateStatus(created.id, { status: "IN_SERVICE" });
      const completed = await service.updateStatus(created.id, {
        status: "COMPLETED",
        diagnosticNotes: "Jump started successfully.",
      });

      expect(completed.status).toBe("COMPLETED");
      expect(completed.completedAt).toBeDefined();

      // Verify technician status was freed back to idle
      const refreshedTech = await mechRepo.getById(tech.id);
      expect(refreshedTech?.status).toBe("idle");
    });

    it("rejects illegal state jumps", async () => {
      const created = await service.createRequest({
        customerName: "Bob Smith",
        customerPhone: "+1 (555) 345-6789",
        breakdownCategory: "flat_tyre",
        vehicle: { type: "car" },
        issueDescription: "Flat tyre",
        urgency: "standard",
        location: { address: "Test St", coordinates: { lat: 37.77, lng: -122.41 } },
      });

      // Jump directly from SEARCHING to COMPLETED must throw
      await expect(
        service.updateStatus(created.id, { status: "COMPLETED" })
      ).rejects.toThrow(/invalid status transition/i);
    });
  });

  describe("Conflict Prevention & Rejection", () => {
    it("prevents assigning a technician who already has an active dispatch", async () => {
      const mechanics = await mechRepo.listAll();
      const tech = mechanics[0];

      const req1 = await service.createRequest({
        customerName: "Customer One",
        customerPhone: "+1 (555) 111-0001",
        breakdownCategory: "battery_issue",
        vehicle: { type: "car" },
        issueDescription: "Dead battery",
        urgency: "standard",
        location: { address: "100 Main St", coordinates: { lat: 37.78, lng: -122.41 } },
      });

      const req2 = await service.createRequest({
        customerName: "Customer Two",
        customerPhone: "+1 (555) 111-0002",
        breakdownCategory: "flat_tyre",
        vehicle: { type: "car" },
        issueDescription: "Punctured tyre",
        urgency: "standard",
        location: { address: "200 Pine St", coordinates: { lat: 37.79, lng: -122.40 } },
      });

      // Assign tech to req1
      await service.assignMechanic(req1.id, tech.id, 10, 1.5);

      // Attempting to assign tech to req2 must fail with conflict error
      await expect(
        service.assignMechanic(req2.id, tech.id, 12, 2.0)
      ).rejects.toThrow(/already has an active roadside dispatch/i);
    });

    it("allows a technician to decline a dispatch, re-routing it to SEARCHING", async () => {
      const mechanics = await mechRepo.listAll();
      const tech = mechanics[0];

      const req = await service.createRequest({
        customerName: "Decline Motorist",
        customerPhone: "+1 (555) 222-3333",
        breakdownCategory: "fuel_problem",
        vehicle: { type: "car" },
        issueDescription: "Out of gas",
        urgency: "standard",
        location: { address: "Bay Bridge Toll Plaza", coordinates: { lat: 37.82, lng: -122.33 } },
      });

      await service.updateStatus(req.id, { status: "REQUESTED", mechanicId: tech.id });
      expect((await service.getById(req.id))?.status).toBe("REQUESTED");

      const declined = await service.rejectRequest(req.id, "Outside coverage zone");
      expect(declined.status).toBe("SEARCHING");
      expect(declined.assignedMechanicId).toBeUndefined();

      const refreshedTech = await mechRepo.getById(tech.id);
      expect(refreshedTech?.status).toBe("idle");
    });
  });

  describe("Automatic Matching & Dispatch Flow", () => {
    it("matches closest available mechanic and assigns dispatch", async () => {
      const req = await service.createRequest({
        customerName: "Proximity User",
        customerPhone: "+1 (555) 555-4321",
        breakdownCategory: "battery_issue",
        vehicle: { type: "car", make: "Honda", model: "Accord" },
        issueDescription: "Clicking sound, no start",
        urgency: "standard",
        location: { address: "Mission Bay", coordinates: { lat: 37.77, lng: -122.39 } },
      });

      const result = await service.matchAndAssign(req.id);
      expect(result).toBeDefined();
      expect(result?.matchResult.success).toBe(true);
      expect(result?.mechanic).toBeDefined();
      expect(result?.request.status).toBe("ON_THE_WAY");
      expect(result?.request.assignedMechanicId).toBeDefined();
    });

    it("transitions to NO_MECHANIC_AVAILABLE when all mechanics are offline", async () => {
      const all = await mechRepo.listAll();
      for (const m of all) {
        await mechRepo.updateStatus(m.id, "idle", false);
      }

      const req = await service.createRequest({
        customerName: "Late Night User",
        customerPhone: "+1 (555) 000-9999",
        breakdownCategory: "engine_problem",
        vehicle: { type: "truck" },
        issueDescription: "Engine stall",
        urgency: "standard",
        location: { address: "Port of SF", coordinates: { lat: 37.75, lng: -122.38 } },
      });

      const result = await service.matchAndAssign(req.id);
      expect(result).toBeDefined();
      expect(result?.matchResult.success).toBe(false);
      expect(result?.request.status).toBe("NO_MECHANIC_AVAILABLE");
    });
  });
});
