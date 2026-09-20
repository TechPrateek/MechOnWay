import {
  BreakdownCategory,
  Mechanic,
  MatchingRequestInput,
  MatchResult,
  RankedMechanic,
  RoadsideRequest,
} from "@/types";

/**
 * Earth radius in kilometers for Haversine calculations
 */
export const EARTH_RADIUS_KM = 6371;

/**
 * Validates whether latitude and longitude are valid numbers within geographical limits
 */
export function isValidCoordinate(lat: number, lon: number): boolean {
  if (typeof lat !== "number" || typeof lon !== "number") return false;
  if (Number.isNaN(lat) || Number.isNaN(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

/**
 * Calculates geographic distance in kilometers (km) between two points using the Haversine formula
 *
 * @param lat1 Customer latitude
 * @param lon1 Customer longitude
 * @param lat2 Mechanic latitude
 * @param lon2 Mechanic longitude
 * @returns Distance in kilometers rounded to two decimal places
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    throw new Error(
      `Invalid coordinates: lat1=${lat1}, lon1=${lon1}, lat2=${lat2}, lon2=${lon2}`
    );
  }

  // If points are identical, return exact zero
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const toRad = (degree: number) => (degree * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = EARTH_RADIUS_KM * c;

  // Round to 2 decimal places
  return Math.round(distanceKm * 100) / 100;
}

/**
 * Filters mechanics based on availability, vehicle compatibility, and service capability
 */
export function findEligibleMechanics(
  request: MatchingRequestInput,
  mechanics: Mechanic[]
): Mechanic[] {
  return mechanics.filter((m) => {
    // 1. Mechanic availability check
    const isOnline = m.isAvailable && (m.currentStatus === "available" || m.status === "idle");
    if (!isOnline) return false;

    // 2. Vehicle compatibility check
    const supportedVehicles = m.supportedVehicleTypes || m.compatibleVehicleTypes || [];
    const supportsVehicle =
      supportedVehicles.includes(request.vehicleType) ||
      supportedVehicles.includes("other") ||
      (request.vehicleType === "car" && supportedVehicles.includes("sedan"));
    if (!supportsVehicle) return false;

    // 3. Service capability check
    const supportedServices = m.supportedServices || m.specializations || [];
    const supportsService =
      supportedServices.includes(request.issueCategory) ||
      supportedServices.includes("other") ||
      supportedServices.includes("general_repair");
    if (!supportsService) return false;

    return true;
  });
}

/**
 * Estimates arrival time in minutes based on base response preparation time
 * and an assumed average transit speed of 40 km/h (standard urban/suburban transit).
 *
 * @param baseResponseTime Base dispatch and preparation time in minutes
 * @param distanceKm Transit distance in km
 */
export function estimateArrivalTimeMinutes(
  baseResponseTime: number,
  distanceKm: number
): number {
  const averageSpeedKmH = 35;
  const transitMinutes = (distanceKm / averageSpeedKmH) * 60;
  // Minimum 3 minutes, rounded to nearest minute
  return Math.max(3, Math.round(baseResponseTime + transitMinutes));
}

/**
 * Ranks eligible mechanics by geographic distance ascending,
 * using rating descending and mechanicId ascending as deterministic tie-breakers.
 */
export function rankMechanics(
  request: MatchingRequestInput,
  eligibleMechanics: Mechanic[]
): RankedMechanic[] {
  const ranked: RankedMechanic[] = eligibleMechanics.map((mechanic) => {
    const lat = mechanic.latitude ?? mechanic.currentLocation?.lat ?? 0;
    const lon = mechanic.longitude ?? mechanic.currentLocation?.lng ?? 0;

    const distanceKm = calculateDistance(request.latitude, request.longitude, lat, lon);
    const estimatedArrivalMinutes = estimateArrivalTimeMinutes(
      mechanic.estimatedResponseTime || 5,
      distanceKm
    );

    return {
      mechanic,
      distanceKm,
      estimatedArrivalMinutes,
    };
  });

  ranked.sort((a, b) => {
    // Primary: distance ascending
    const distDiff = a.distanceKm - b.distanceKm;
    if (Math.abs(distDiff) > 0.001) {
      return distDiff;
    }

    // Secondary: rating descending
    const ratingDiff = b.mechanic.rating - a.mechanic.rating;
    if (Math.abs(ratingDiff) > 0.001) {
      return ratingDiff;
    }

    // Tertiary: mechanicId lexicographical ascending
    const idA = a.mechanic.mechanicId || a.mechanic.id;
    const idB = b.mechanic.mechanicId || b.mechanic.id;
    return idA.localeCompare(idB);
  });

  return ranked;
}

/**
 * Masks a phone number to safeguard mechanic privacy in customer UI
 * Example: "+1 (555) 234-8901" -> "+1 (555) •••-8901"
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return "";

  // Support formatted numbers with separators: +1 (555) 234-8901, (555) 234-8901, 555-234-8901
  const formattedMatch = phone.match(
    /^((?:\+?\d+[\s.-]*)?(?:\(\d{3}\)\s*|\d{3}[\s.-]))(\d{3})([\s.-]?\d{4})$/
  );
  if (formattedMatch) {
    const prefix = formattedMatch[1];
    const suffix = formattedMatch[3];
    return `${prefix}•••${suffix}`;
  }

  // Fallback for raw numbers, e.g. 5552348901 -> 555•••8901
  if (phone.length >= 7) {
    const start = phone.slice(0, 3);
    const end = phone.slice(-4);
    return `${start}•••${end}`;
  }

  return "••••••••••";
}

/**
 * Main matching engine entry point:
 * Filters available, vehicle-compatible, and service-capable mechanics,
 * calculates Haversine distance in km, sorts deterministically,
 * and selects the closest suitable mechanic or returns a helpful failure reason.
 */
export function assignNearestMechanic(
  request: MatchingRequestInput,
  mechanics: Mechanic[],
  options?: { maxRadiusKm?: number }
): MatchResult {
  // Validate request coordinates
  if (!isValidCoordinate(request.latitude, request.longitude)) {
    return {
      success: false,
      eligibleCount: 0,
      failureReason: "invalid_coordinates",
      explanation:
        "Unable to locate your vehicle due to invalid GPS coordinates. Please verify your location or choose a demo location.",
    };
  }

  if (!mechanics || mechanics.length === 0) {
    return {
      success: false,
      eligibleCount: 0,
      failureReason: "no_mechanics",
      explanation:
        "No mechanics are registered in this coverage area yet. Please contact customer dispatch support.",
    };
  }

  // 1. Check if ANY mechanic is available
  const availableAny = mechanics.filter(
    (m) => m.isAvailable && (m.currentStatus === "available" || m.status === "idle")
  );
  if (availableAny.length === 0) {
    return {
      success: false,
      eligibleCount: 0,
      failureReason: "no_available",
      explanation:
        "All local mechanics are currently busy on active jobs or offline. Please check back in a few minutes or retry.",
    };
  }

  // 2. Check if ANY available mechanic supports the requested vehicle type
  const availableWithVehicle = availableAny.filter((m) => {
    const supportedVehicles = m.supportedVehicleTypes || m.compatibleVehicleTypes || [];
    return (
      supportedVehicles.includes(request.vehicleType) ||
      supportedVehicles.includes("other") ||
      (request.vehicleType === "car" && supportedVehicles.includes("sedan"))
    );
  });
  if (availableWithVehicle.length === 0) {
    const vehicleLabel = request.vehicleType.toUpperCase();
    return {
      success: false,
      eligibleCount: 0,
      failureReason: "no_vehicle_match",
      explanation: `No available mechanics currently support vehicle type '${vehicleLabel}'. Specialized recovery or flatbed carrier may be required.`,
    };
  }

  // 3. Check if ANY available mechanic supports the requested service category
  const availableWithService = availableWithVehicle.filter((m) => {
    const supportedServices = m.supportedServices || m.specializations || [];
    return (
      supportedServices.includes(request.issueCategory) ||
      supportedServices.includes("other") ||
      supportedServices.includes("general_repair")
    );
  });
  if (availableWithService.length === 0) {
    const serviceLabel = String(request.issueCategory).replace(/_/g, " ").toUpperCase();
    return {
      success: false,
      eligibleCount: 0,
      failureReason: "no_service_match",
      explanation: `No available mechanics are equipped for '${serviceLabel}' repairs at this time.`,
    };
  }

  // Rank eligible mechanics
  const ranked = rankMechanics(request, availableWithService);

  if (ranked.length === 0) {
    return {
      success: false,
      eligibleCount: 0,
      failureReason: "no_available",
      explanation: "No suitable mechanic found within service range.",
    };
  }

  const bestMatch = ranked[0];
  const maxRadiusKm = options?.maxRadiusKm ?? 75;

  if (bestMatch.distanceKm > maxRadiusKm) {
    return {
      success: false,
      eligibleCount: 0,
      failureReason: "no_available",
      explanation: `No available mechanics found within the active service area (${bestMatch.distanceKm} km away; maximum dispatch radius is ${maxRadiusKm} km). Please contact customer dispatch support.`,
    };
  }

  const serviceName = String(request.issueCategory).replace(/_/g, " ");

  const explanation = `Matched ${bestMatch.mechanic.name} (${bestMatch.mechanic.vehicleRig}), located ${bestMatch.distanceKm} km away. Fully equipped for ${serviceName} on your ${request.vehicleType} with a ${bestMatch.mechanic.rating}★ rating.`;

  return {
    success: true,
    selectedMechanic: bestMatch.mechanic,
    distanceKm: bestMatch.distanceKm,
    estimatedArrivalMinutes: bestMatch.estimatedArrivalMinutes,
    explanation,
    eligibleCount: ranked.length,
    rankedCandidates: ranked.map((r) => ({
      mechanicId: r.mechanic.mechanicId || r.mechanic.id,
      name: r.mechanic.name,
      distanceKm: r.distanceKm,
      rating: r.mechanic.rating,
    })),
  };
}

/**
 * Adapter helper to convert a RoadsideRequest to MatchingRequestInput
 */
export function toMatchingRequestInput(
  request: RoadsideRequest
): MatchingRequestInput {
  return {
    requestId: request.id,
    customerId: request.customerId,
    vehicleType: request.vehicle.type,
    issueCategory:
      request.breakdownCategory || (request.serviceType as BreakdownCategory),
    description: request.issueDescription,
    latitude: request.location.coordinates.lat,
    longitude: request.location.coordinates.lng,
    status: request.status,
    assignedMechanicId: request.assignedMechanicId,
    createdAt: request.createdAt,
  };
}
