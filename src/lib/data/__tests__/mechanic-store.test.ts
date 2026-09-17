import { describe, it, expect, beforeEach } from "vitest";
import { requestStore, mechanicStore } from "../store";

describe("Mechanic Store & Dispatch Rules", () => {
  beforeEach(() => {
    requestStore.reset();
    mechanicStore.reset();
  });

  it("retrieves available mechanics", () => {
    const all = mechanicStore.listAll();
    expect(all.length).toBeGreaterThan(0);
    const mech = mechanicStore.getById(all[0].id);
    expect(mech).toBeDefined();
    expect(mech?.name).toBe(all[0].name);
  });

  it("toggles mechanic availability online/offline", () => {
    const all = mechanicStore.listAll();
    const mech = all[0];
    const offline = mechanicStore.updateStatus(mech.id, "idle", false);
    expect(offline?.isOnline).toBe(false);
    expect(offline?.isAvailable).toBe(false);

    const online = mechanicStore.updateStatus(mech.id, "idle", true);
    expect(online?.isOnline).toBe(true);
    expect(online?.isAvailable).toBe(true);
  });

  it("prevents assigning an offline mechanic", () => {
    const all = mechanicStore.listAll();
    const mech = all[0];
    // Put mechanic offline
    mechanicStore.updateStatus(mech.id, "idle", false);

    const req = requestStore.create({
      customerName: "Offline Test User",
      customerPhone: "+1 (555) 000-1111",
      breakdownCategory: "flat_tyre",
      vehicle: {
        type: "car",
        make: "Toyota",
        model: "Camry",
        year: 2021,
      },
      issueDescription: "Tire blown out",
      urgency: "standard",
      location: {
        address: "100 Test St, San Francisco, CA",
        coordinates: {
          lat: 37.7749,
          lng: -122.4194,
        },
      },
    });

    expect(() => {
      requestStore.assignMechanic(req.id, mech.id, 10, 2.0);
    }).toThrow(/currently offline or unavailable/i);

    // Restore online
    mechanicStore.updateStatus(mech.id, "idle", true);
  });

  it("prevents a mechanic from accepting conflicting requests", () => {
    const all = mechanicStore.listAll();
    const mech = all[0];
    mechanicStore.updateStatus(mech.id, "idle", true);

    const req1 = requestStore.create({
      customerName: "Customer 1",
      customerPhone: "+1 (555) 111-2222",
      breakdownCategory: "battery_issue",
      vehicle: {
        type: "car",
        make: "Honda",
        model: "Civic",
        year: 2020,
      },
      issueDescription: "Dead battery",
      urgency: "standard",
      location: {
        address: "200 First St, San Francisco, CA",
        coordinates: {
          lat: 37.78,
          lng: -122.41,
        },
      },
    });

    const req2 = requestStore.create({
      customerName: "Customer 2",
      customerPhone: "+1 (555) 333-4444",
      breakdownCategory: "flat_tyre",
      vehicle: {
        type: "suv",
        make: "Subaru",
        model: "Outback",
        year: 2022,
      },
      issueDescription: "Punctured front tyre",
      urgency: "standard",
      location: {
        address: "300 Second St, San Francisco, CA",
        coordinates: {
          lat: 37.79,
          lng: -122.42,
        },
      },
    });

    // Assign req1 to mechanic (moves to ON_THE_WAY)
    const assigned1 = requestStore.assignMechanic(req1.id, mech.id, 12, 1.5);
    expect(assigned1).toBeDefined();
    expect(assigned1?.request.status).toBe("ON_THE_WAY");

    // Attempt to assign req2 to same mechanic while req1 is active
    expect(() => {
      requestStore.assignMechanic(req2.id, mech.id, 15, 3.0);
    }).toThrow(/already has an active roadside dispatch/i);

    // Complete req1
    requestStore.updateStatus(req1.id, { status: "ARRIVED" });
    requestStore.updateStatus(req1.id, { status: "IN_SERVICE" });
    requestStore.updateStatus(req1.id, { status: "COMPLETED" });

    // Now mechanic should be able to accept req2
    const assigned2 = requestStore.assignMechanic(req2.id, mech.id, 10, 2.0);
    expect(assigned2).toBeDefined();
    expect(assigned2?.request.status).toBe("ON_THE_WAY");

    // Clean up
    requestStore.updateStatus(req2.id, { status: "ARRIVED" });
    requestStore.updateStatus(req2.id, { status: "IN_SERVICE" });
    requestStore.updateStatus(req2.id, { status: "COMPLETED" });
  });

  describe("Automatic Matching & Dispatch Flow (matchAndAssign)", () => {
    it("matches and assigns the closest available mechanic", () => {
      const all = mechanicStore.listAll();
      // Ensure mechanics are available
      for (const m of all) {
        mechanicStore.updateStatus(m.id, "idle", true);
      }

      const req = requestStore.create({
        customerName: "Matching Test User",
        customerPhone: "+1 (555) 777-8888",
        breakdownCategory: "battery_issue",
        vehicle: {
          type: "car",
          make: "Honda",
          model: "Accord",
          year: 2023,
        },
        issueDescription: "Battery clicking loudly, won't start",
        urgency: "standard",
        location: {
          address: "500 Howard St, San Francisco, CA",
          coordinates: {
            lat: 37.789,
            lng: -122.399,
          },
        },
      });

      const result = requestStore.matchAndAssign(req.id);
      expect(result).toBeDefined();
      expect(result?.matchResult.success).toBe(true);
      expect(result?.mechanic).toBeDefined();
      expect(result?.request.status).toBe("ON_THE_WAY");
      expect(result?.request.assignedMechanicId).toBeDefined();
      expect(result?.request.estimatedArrivalMinutes).toBeGreaterThan(0);
    });

    it("transitions request to NO_MECHANIC_AVAILABLE when no mechanics are online", () => {
      const all = mechanicStore.listAll();
      // Set all mechanics offline
      for (const m of all) {
        mechanicStore.updateStatus(m.id, "idle", false);
      }

      const req = requestStore.create({
        customerName: "No Mechanics Online User",
        customerPhone: "+1 (555) 999-0000",
        breakdownCategory: "engine_problem",
        vehicle: {
          type: "truck",
          make: "Ford",
          model: "F-150",
          year: 2020,
        },
        issueDescription: "Engine smoking on shoulder",
        urgency: "standard",
        location: {
          address: "I-280 Mile Marker 12, CA",
          coordinates: {
            lat: 37.74,
            lng: -122.43,
          },
        },
      });

      const result = requestStore.matchAndAssign(req.id);
      expect(result).toBeDefined();
      expect(result?.matchResult.success).toBe(false);
      expect(result?.request.status).toBe("NO_MECHANIC_AVAILABLE");
      expect(result?.matchResult.failureReason).toBe("no_available");

      // Restore mechanics online
      for (const m of all) {
        mechanicStore.updateStatus(m.id, "idle", true);
      }
    });
  });

  describe("Request Rejection, Cancellation, and History", () => {
    it("allows a technician to decline a dispatch, returning it to SEARCHING", () => {
      const all = mechanicStore.listAll();
      const tech = all[0];
      mechanicStore.updateStatus(tech.id, "idle", true);

      const req = requestStore.create({
        customerName: "Decline Test User",
        customerPhone: "+1 (555) 444-5555",
        breakdownCategory: "flat_tyre",
        vehicle: {
          type: "car",
          make: "Mazda",
          model: "3",
        },
        issueDescription: "Nail in rear tire",
        urgency: "standard",
        location: {
          address: "Mission & 16th St, San Francisco, CA",
          coordinates: { lat: 37.765, lng: -122.42 },
        },
      });

      // Dispatch transmitted to technician workbench (REQUESTED)
      requestStore.updateStatus(req.id, { status: "REQUESTED", mechanicId: tech.id });
      expect(requestStore.getById(req.id)?.status).toBe("REQUESTED");

      // Technician declines
      const declined = requestStore.rejectRequest(req.id, "Flatbed needed for custom wheels");
      expect(declined).toBeDefined();
      expect(declined?.status).toBe("SEARCHING");
      expect(declined?.assignedMechanicId).toBeUndefined();
      expect(declined?.assignedMechanic).toBeUndefined();

      // Technician status is freed back to idle
      const refreshedTech = mechanicStore.getById(tech.id);
      expect(refreshedTech?.status).toBe("idle");
    });

    it("allows a motorist to cancel an active request", () => {
      const req = requestStore.create({
        customerName: "Cancel Test Motorist",
        customerPhone: "+1 (555) 666-7777",
        breakdownCategory: "fuel_problem",
        vehicle: {
          type: "motorcycle",
          make: "Honda",
          model: "Rebel",
        },
        issueDescription: "Out of gas on highway exit",
        urgency: "standard",
        location: {
          address: "Exit 425B, San Francisco, CA",
          coordinates: { lat: 37.75, lng: -122.41 },
        },
      });

      const cancelled = requestStore.cancelRequest(req.id, "Friend brought gas can");
      expect(cancelled).toBeDefined();
      expect(cancelled?.status).toBe("CANCELLED");
    });

    it("retrieves active requests and completed history for a mechanic", () => {
      const all = mechanicStore.listAll();
      const tech = all[0];
      mechanicStore.updateStatus(tech.id, "idle", true);

      const req = requestStore.create({
        customerName: "History Test User",
        customerPhone: "+1 (555) 888-9999",
        breakdownCategory: "general_repair",
        vehicle: {
          type: "suv",
          make: "Jeep",
          model: "Wrangler",
        },
        issueDescription: "Serpentine belt loose",
        urgency: "standard",
        location: {
          address: "Potrero Hill, San Francisco, CA",
          coordinates: { lat: 37.76, lng: -122.4 },
        },
      });

      requestStore.assignMechanic(req.id, tech.id, 8, 1.0);
      const active = requestStore.getActiveForMechanic(tech.id);
      expect(active).toBeDefined();
      expect(active?.id).toBe(req.id);

      // Progress through completion
      requestStore.updateStatus(req.id, { status: "ARRIVED" });
      requestStore.updateStatus(req.id, { status: "IN_SERVICE" });
      requestStore.updateStatus(req.id, { status: "COMPLETED", diagnosticNotes: "Belt retensioned" });

      const history = requestStore.getHistoryForMechanic(tech.id);
      expect(history.some((r) => r.id === req.id)).toBe(true);

      const activeAfterCompletion = requestStore.getActiveForMechanic(tech.id);
      expect(activeAfterCompletion).toBeUndefined();
    });
  });
});
