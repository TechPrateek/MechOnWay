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

const mockMechanicBase: Mechanic = {
  mechanicId: "mech-01",
  id: "mech-01",
  name: "Marcus Vance",
  phone: "+1 (555) 234-8901",
  avatarUrl: "/avatars/marcus.jpg",
  rating: 4.9,
  completedJobsCount: 840,
  vehicleRig: "Mobile Workshop Rig",
  licensePlate: "7MC-8921",
  supportedVehicleTypes: ["car", "suv", "motorcycle", "truck"],
  supportedServices: ["flat_tyre", "battery_issue", "engine_problem", "fuel_problem"],
  latitude: 37.7749,
  longitude: -122.4194,
  isAvailable: true,
  estimatedResponseTime: 5,
  currentStatus: "available",
  certifications: ["ASE Master Certified"],
};

const sampleRequest: MatchingRequestInput = {
  requestId: "req-100",
  customerId: "cust-01",
  vehicleType: "car",
  issueCategory: "flat_tyre",
  description: "Punctured right tyre on highway shoulder",
  latitude: 37.7699,
  longitude: -122.4208,
  status: "pending",
  createdAt: new Date().toISOString(),
};

describe("Haversine Distance Calculation (km)", () => {
  it("returns 0 km for identical coordinates", () => {
    const dist = calculateDistance(37.7749, -122.4194, 37.7749, -122.4194);
    expect(dist).toBe(0);
  });

  it("calculates accurate distance between known SF coordinates", () => {
    // SF Civic Center (37.7793, -122.4192) to Fisherman's Wharf (37.8080, -122.4177)
    // Real straight-line distance is ~3.19 km
    const dist = calculateDistance(37.7793, -122.4192, 37.808, -122.4177);
    expect(dist).toBeGreaterThan(3.1);
    expect(dist).toBeLessThan(3.3);
  });

  it("calculates accurate distance between SF and Oakland across the Bay", () => {
    // SF (37.7749, -122.4194) to Oakland Downtown (37.8044, -122.2712) ~13.4 km
    const dist = calculateDistance(37.7749, -122.4194, 37.8044, -122.2712);
    expect(dist).toBeGreaterThan(13.0);
    expect(dist).toBeLessThan(14.0);
  });

  it("validates coordinate boundaries correctly", () => {
    expect(isValidCoordinate(37.7, -122.4)).toBe(true);
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

  it("calculates arrival time estimate using base prep time and distance", () => {
    // 5 mins base + (20 km / 40 km/h) * 60 = 5 + 30 = 35 mins
    const eta = estimateArrivalTimeMinutes(5, 20);
    expect(eta).toBe(35);
  });

  it("throws an error when passing invalid coordinates to calculateDistance", () => {
    expect(() => calculateDistance(100, 0, 37.7, -122.4)).toThrow(/Invalid coordinates/);
    expect(() => calculateDistance(37.7, -122.4, NaN, -122.4)).toThrow(/Invalid coordinates/);
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
      latitude: 37.771, // Very close to request (37.7699)
      longitude: -122.421,
      rating: 4.5,
    };

    const farMechanic: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-far",
      latitude: 37.82, // Farther away
      longitude: -122.38,
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
      latitude: 37.775,
      longitude: -122.419,
      rating: 4.95,
    };

    const lowerRating: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-low-rating",
      latitude: 37.775,
      longitude: -122.419,
      rating: 4.6,
    };

    const ranked = rankMechanics(sampleRequest, [lowerRating, higherRating]);
    expect(ranked[0].mechanic.mechanicId).toBe("mech-high-rating");
  });

  it("breaks equal distance and rating ties using mechanicId alphabetically", () => {
    const mechA: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-alpha",
      latitude: 37.775,
      longitude: -122.419,
      rating: 4.8,
    };

    const mechZ: Mechanic = {
      ...mockMechanicBase,
      mechanicId: "mech-zeta",
      latitude: 37.775,
      longitude: -122.419,
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
    expect(typeof result.estimatedArrivalMinutes).toBe("number");
    expect(result.explanation).toContain("Matched Marcus Vance");
    expect(result.eligibleCount).toBe(1);
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
    const motorcycleRequest: MatchingRequestInput = {
      ...sampleRequest,
      vehicleType: "truck",
    };
    const scooterOnlyMech: Mechanic = {
      ...mockMechanicBase,
      supportedVehicleTypes: ["scooter", "motorcycle"],
    };
    const result = assignNearestMechanic(motorcycleRequest, [scooterOnlyMech]);
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
    expect(maskPhoneNumber("5552348901")).toBe("555•••8901");
  });

  it("returns safe placeholder for empty or missing numbers", () => {
    expect(maskPhoneNumber("")).toBe("");
  });
});
