import { describe, it, expect } from "vitest";
import {
  calculateDistance,
  isValidCoordinate,
  findEligibleMechanics,
  rankMechanics,
  assignNearestMechanic,
  maskPhoneNumber,
  estimateArrivalTimeMinutes,
  EARTH_RADIUS_KM,
} from "../engine";
import { Mechanic, MatchingRequestInput } from "@/types";
import { MOCK_MECHANICS } from "../../data/mock-data";

const mockMechanicBase: Mechanic = {
  mechanicId: "mech-01",
  id: "mech-01",
  name: "Rajesh Sharma",
  phone: "+91 98101 23456",
  avatarUrl: "/avatars/rajesh.jpg",
  rating: 4.95,
  completedJobsCount: 840,
  vehicleRig: "Mahindra Bolero Mobile Workshop Rig",
  licensePlate: "UP 16 AB 8921",
  supportedVehicleTypes: ["car", "suv", "motorcycle", "truck", "sedan"],
  supportedServices: ["flat_tyre", "battery_issue", "engine_problem", "fuel_problem"],
  latitude: 28.4780,
  longitude: 77.5015,
  isAvailable: true,
  estimatedResponseTime: 5,
  currentStatus: "available",
  certifications: ["ITI Certified Automobile Master Technician"],
};

const sampleRequest: MatchingRequestInput = {
  requestId: "req-100",
  customerId: "cust-01",
  vehicleType: "car",
  issueCategory: "flat_tyre",
  description: "Punctured right tyre near Pari Chowk",
  latitude: 28.4744,
  longitude: 77.5040,
  status: "pending",
  createdAt: new Date().toISOString(),
};

describe("Haversine Distance Calculation (km)", () => {
  it("returns 0 km for identical coordinates", () => {
    const dist = calculateDistance(28.4744, 77.5040, 28.4744, 77.5040);
    expect(dist).toBe(0);
  });

  it("calculates accurate distance between Pari Chowk and Knowledge Park III in Greater Noida", () => {
    // Pari Chowk (28.4744, 77.5040) to Knowledge Park III (28.4623, 77.4984)
    // Real straight-line distance is ~1.46 km
    const dist = calculateDistance(28.4744, 77.5040, 28.4623, 77.4984);
    expect(dist).toBeGreaterThan(1.3);
    expect(dist).toBeLessThan(1.6);
  });

  it("calculates accurate distance between Pari Chowk and Sector 62 Noida", () => {
    // Pari Chowk (28.4744, 77.5040) to Sector 62 Noida (28.6280, 77.3649) ~21.7 km
    const dist = calculateDistance(28.4744, 77.5040, 28.6280, 77.3649);
    expect(dist).toBeGreaterThan(20.0);
    expect(dist).toBeLessThan(23.0);
  });

  it("validates coordinate boundaries correctly", () => {
    expect(isValidCoordinate(28.47, 77.50)).toBe(true);
    expect(isValidCoordinate(90, 180)).toBe(true);
    expect(isValidCoordinate(-90, -180)).toBe(true);

    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(-91, 0)).toBe(false);
    expect(isValidCoordinate(0, 181)).toBe(false);
    expect(isValidCoordinate(0, -181)).toBe(false);
    expect(isValidCoordinate(NaN, 0)).toBe(false);
  });

  it("uses Earth radius of 6371 km", () => {
    expect(EARTH_RADIUS_KM).toBe(6371);
  });

  it("calculates arrival time estimate using realistic 35 km/h urban transit speed and base prep", () => {
    // 5 mins base + (20 km / 35 km/h) * 60 = 5 + 34.28 = 39 mins
    const eta20 = estimateArrivalTimeMinutes(5, 20);
    expect(eta20).toBe(39);

    // 5 mins base + (35 km / 35 km/h) * 60 = 5 + 60 = 65 mins
    const eta35 = estimateArrivalTimeMinutes(5, 35);
    expect(eta35).toBe(65);

    // Proximity dispatch: 0.47 km (Pari Chowk technician) -> 5 + 0.8 = 6 mins
    const etaProximity = estimateArrivalTimeMinutes(5, 0.47);
    expect(etaProximity).toBe(6);
  });

  it("throws an error when passing invalid coordinates to calculateDistance", () => {
    expect(() => calculateDistance(100, 0, 28.47, 77.50)).toThrow(/Invalid coordinates/);
    expect(() => calculateDistance(28.47, 77.50, NaN, 77.50)).toThrow(/Invalid coordinates/);
  });
});

describe("Mechanic Eligibility Filtering", () => {
  it("includes available mechanics matching vehicle and service", () => {
    const eligible = findEligibleMechanics(sampleRequest, [mockMechanicBase]);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].mechanicId).toBe("mech-01");
  });

  it("excludes mechanics who are not available (isAvailable: false)", () => {
    const offlineMechanic: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-offline",
      isAvailable: false,
    };
    const eligible = findEligibleMechanics(sampleRequest, [offlineMechanic]);
    expect(eligible).toHaveLength(0);
  });

  it("excludes mechanics whose currentStatus is busy or offline", () => {
    const busyMechanic: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-busy",
      isAvailable: true,
      currentStatus: "busy",
      status: "assigned",
    };
    const eligible = findEligibleMechanics(sampleRequest, [busyMechanic]);
    expect(eligible).toHaveLength(0);
  });

  it("excludes mechanics who do not support the vehicle type", () => {
    const bikeOnlyMechanic: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-bike",
      supportedVehicleTypes: ["motorcycle", "scooter"],
    };
    // sampleRequest has vehicleType: "car"
    const eligible = findEligibleMechanics(sampleRequest, [bikeOnlyMechanic]);
    expect(eligible).toHaveLength(0);
  });

  it("excludes mechanics who do not support the service category", () => {
    const towOnlyMechanic: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-tow",
      supportedServices: ["accident_assistance"],
    };
    // sampleRequest has issueCategory: "flat_tyre"
    const eligible = findEligibleMechanics(sampleRequest, [towOnlyMechanic]);
    expect(eligible).toHaveLength(0);
  });
});

describe("Deterministic Ranking & Tie Breaking", () => {
  it("ranks closer mechanic first", () => {
    const closeMechanic: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-close",
      latitude: 28.4780, // Alpha 1 (~0.47 km from Pari Chowk)
      longitude: 77.5015,
      rating: 4.5,
    };

    const farMechanic: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-far",
      latitude: 28.6280, // Sector 62 Noida (~21.7 km away)
      longitude: 77.3649,
      rating: 5.0, // higher rating, but farther
    };

    const ranked = rankMechanics(sampleRequest, [farMechanic, closeMechanic]);
    expect(ranked[0].mechanic.mechanicId).toBe("mech-close");
    expect(ranked[1].mechanic.mechanicId).toBe("mech-far");
    expect(ranked[0].distanceKm).toBeLessThan(ranked[1].distanceKm);
  });

  it("breaks distance ties using higher rating", () => {
    // Both at identical coordinates
    const higherRating: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-high-rating",
      latitude: 28.4780,
      longitude: 77.5015,
      rating: 4.95,
    };

    const lowerRating: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-low-rating",
      latitude: 28.4780,
      longitude: 77.5015,
      rating: 4.6,
    };

    const ranked = rankMechanics(sampleRequest, [lowerRating, higherRating]);
    expect(ranked[0].mechanic.mechanicId).toBe("mech-high-rating");
  });

  it("breaks equal distance and rating ties using mechanicId alphabetically", () => {
    const mechA: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-alpha",
      latitude: 28.4780,
      longitude: 77.5015,
      rating: 4.8,
    };

    const mechZ: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-zeta",
      latitude: 28.4780,
      longitude: 77.5015,
      rating: 4.8,
    };

    const ranked = rankMechanics(sampleRequest, [mechZ, mechA]);
    expect(ranked[0].mechanic.mechanicId).toBe("mech-alpha");
  });
});

describe("Nearest Mechanic Assignment & Edge Cases", () => {
  it("successfully assigns the nearest mechanic with distance in km and ETA", () => {
    const result = assignNearestMechanic(sampleRequest, [mockMechanicBase]);
    expect(result.success).toBe(true);
    expect(result.selectedMechanic?.mechanicId).toBe("mech-01");
    expect(typeof result.distanceKm).toBe("number");
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.distanceKm).toBeLessThan(1.0); // Pari Chowk to Alpha 1 is ~0.47 km
    expect(typeof result.estimatedArrivalMinutes).toBe("number");
    expect(result.estimatedArrivalMinutes).toBeLessThan(10); // realistic arrival < 10 mins
    expect(result.explanation).toContain("Matched Rajesh Sharma");
    expect(result.eligibleCount).toBe(1);
  });

  it("ranks real Delhi NCR demo mechanics and selects closest candidate", () => {
    // Pari Chowk test request (28.4744, 77.5040) with MOCK_MECHANICS
    const result = assignNearestMechanic(sampleRequest, MOCK_MECHANICS);
    expect(result.success).toBe(true);
    expect(result.selectedMechanic?.id).toBe("mech-001"); // Rajesh Sharma is ~0.47 km away
    expect(result.distanceKm).toBeCloseTo(0.47, 1);
    expect(result.estimatedArrivalMinutes).toBe(6);
    expect(result.rankedCandidates).toBeDefined();
    // Busy mech-005 should be excluded
    const candidateIds = result.rankedCandidates?.map((c) => c.mechanicId);
    expect(candidateIds).not.toContain("mech-005");
  });

  it("handles out-of-coverage requests (>75 km) cleanly without thousands of minutes", () => {
    const jaipurRequest: MatchingRequestInput = {
      ...sampleRequest,
      latitude: 26.9124, // Jaipur, Rajasthan (~235 km from Greater Noida)
      longitude: 75.7873,
    };
    const result = assignNearestMechanic(jaipurRequest, MOCK_MECHANICS);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe("no_available");
    expect(result.explanation).toContain("75 km");
  });

  it("handles empty mechanics list with helpful explanation", () => {
    const result = assignNearestMechanic(sampleRequest, []);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe("no_mechanics");
    expect(result.explanation).toContain("No mechanics are registered in this coverage area");
  });

  it("handles case where all mechanics are offline or busy", () => {
    const busyMechanic: Mechanic = {
      ...mockMechanicBase,
      isAvailable: false,
      currentStatus: "busy",
    };
    const result = assignNearestMechanic(sampleRequest, [busyMechanic]);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe("no_available");
    expect(result.explanation).toContain("All local mechanics are currently busy");
  });

  it("handles unsupported vehicle type with clear diagnostic explanation", () => {
    const truckRequest: MatchingRequestInput = {
      ...sampleRequest,
      vehicleType: "truck",
    };
    const carOnlyMech: Mechanic = {
      ...mockMechanicBase,
      supportedVehicleTypes: ["car"],
      compatibleVehicleTypes: ["car"],
    };
    const result = assignNearestMechanic(truckRequest, [carOnlyMech]);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe("no_vehicle_match");
    expect(result.explanation).toContain("TRUCK");
  });

  it("handles unsupported service category with clear diagnostic explanation", () => {
    const overheatRequest: MatchingRequestInput = {
      ...sampleRequest,
      issueCategory: "overheating",
    };
    const tireOnlyMech: Mechanic = {
      ...mockMechanicBase,
      supportedServices: ["flat_tyre"],
      specializations: ["flat_tyre"],
    };
    const result = assignNearestMechanic(overheatRequest, [tireOnlyMech]);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe("no_service_match");
    expect(result.explanation).toContain("OVERHEATING");
  });

  it("handles invalid GPS coordinates gracefully", () => {
    const invalidRequest: MatchingRequestInput = {
      ...sampleRequest,
      latitude: 95.0, // Invalid latitude
    };
    const result = assignNearestMechanic(invalidRequest, [mockMechanicBase]);
    expect(result.success).toBe(false);
    expect(result.failureReason).toBe("invalid_coordinates");
    expect(result.explanation).toContain("invalid GPS coordinates");
  });
});

describe("Privacy & Phone Masking", () => {
  it("masks standard formatted phone numbers", () => {
    expect(maskPhoneNumber("+1 (555) 234-8901")).toBe("+1 (555) •••-8901");
    expect(maskPhoneNumber("(555) 489-3321")).toBe("(555) •••-3321");
  });

  it("masks raw numbers while preserving prefix and suffix", () => {
    expect(maskPhoneNumber("9810123456")).toBe("981•••3456");
  });

  it("returns safe placeholder for empty or missing numbers", () => {
    expect(maskPhoneNumber("")).toBe("");
  });
});
