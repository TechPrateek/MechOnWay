export type VehicleType =
  | "motorcycle"
  | "scooter"
  | "car"
  | "suv"
  | "truck"
  | "other"
  | "sedan"
  | "ev"
  | "commercial";

export type BreakdownCategory =
  | "engine_problem"
  | "flat_tyre"
  | "battery_issue"
  | "fuel_problem"
  | "accident_assistance"
  | "overheating"
  | "general_repair"
  | "other";

export type ServiceType =
  | BreakdownCategory
  | "flat_tire"
  | "dead_battery"
  | "engine_breakdown"
  | "towing"
  | "fuel_delivery"
  | "lockout"
  | "stuck_winch";

export type RequestStatus =
  | "SEARCHING"
  | "MATCHED"
  | "REQUESTED"
  | "ACCEPTED"
  | "ON_THE_WAY"
  | "ARRIVED"
  | "IN_SERVICE"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_MECHANIC_AVAILABLE"
  | "pending"
  | "matching"
  | "dispatched"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface ServiceLocation {
  address: string;
  coordinates: GeoPoint;
  landmark?: string;
  parkingNotes?: string;
  isDemo?: boolean;
}

export interface Vehicle {
  id?: string;
  type: VehicleType;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  licensePlate?: string;
  isEV?: boolean;
}

export interface Mechanic {
  mechanicId: string;
  id: string; // Alias for mechanicId
  name: string;
  phone: string;
  avatarUrl: string;
  rating: number;
  completedJobsCount: number;
  vehicleRig: string; // e.g. "Ford F-250 Mobile Workshop & Lift"
  licensePlate: string;
  supportedVehicleTypes: VehicleType[];
  compatibleVehicleTypes?: VehicleType[]; // Alias for supportedVehicleTypes
  supportedServices: (BreakdownCategory | ServiceType)[];
  specializations?: (BreakdownCategory | ServiceType)[]; // Alias for supportedServices
  latitude: number;
  longitude: number;
  currentLocation?: GeoPoint & { address: string };
  isAvailable: boolean;
  isOnline?: boolean; // Backwards compatibility
  ratingCount?: number;
  estimatedResponseTime: number; // Base response time in minutes
  currentStatus: "available" | "busy" | "offline" | "en_route" | "on_site";
  status?: "idle" | "assigned" | "en_route" | "on_site"; // Backwards compatibility
  certifications: string[];
  batteryPackCapabilities?: string[];
  towingCapacityTons?: number;
}

export interface MatchingRequestInput {
  requestId: string;
  customerId: string;
  vehicleType: VehicleType;
  issueCategory: BreakdownCategory | ServiceType;
  description: string;
  latitude: number;
  longitude: number;
  status: RequestStatus;
  assignedMechanicId?: string;
  createdAt: string;
}

export interface RankedMechanic {
  mechanic: Mechanic;
  distanceKm: number;
  estimatedArrivalMinutes: number;
}

export interface MatchResult {
  success: boolean;
  selectedMechanic?: Mechanic;
  distanceKm?: number;
  estimatedArrivalMinutes?: number;
  explanation: string;
  eligibleCount: number;
  failureReason?:
    | "no_mechanics"
    | "no_available"
    | "no_vehicle_match"
    | "no_service_match"
    | "invalid_coordinates";
  rankedCandidates?: Array<{
    mechanicId: string;
    name: string;
    distanceKm: number;
    rating: number;
  }>;
}

export interface TimelineEvent {
  status: RequestStatus;
  timestamp: string;
  title: string;
  description: string;
}

export interface RoadsideRequest {
  id: string;
  requestId?: string; // Alias for id
  customerId: string;
  customerName: string;
  customerPhone: string;
  vehicle: Vehicle;
  serviceType: ServiceType;
  breakdownCategory?: BreakdownCategory;
  issueDescription: string;
  urgency: "standard" | "high" | "critical_highway";
  location: ServiceLocation;
  status: RequestStatus;
  assignedMechanicId?: string;
  assignedMechanic?: Mechanic;
  estimatedPrice: number;
  finalPrice?: number;
  estimatedArrivalMinutes?: number;
  mechanicDistanceKm?: number;
  mechanicDistanceMiles?: number;
  matchingExplanation?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  timeline: TimelineEvent[];
  diagnosticNotes?: string;
}

export interface ServiceTypeMeta {
  type: ServiceType;
  name: string;
  tagline: string;
  description: string;
  estimatedBasePrice: number;
  typicalEtaMinutes: number;
  iconName: string;
  requiredEquipment: string[];
  safetyNotice?: string;
}

export interface DemoLocation {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  landmark: string;
}
