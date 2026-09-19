import {
  GeoPoint,
  Mechanic,
  MechanicStatus,
  ServiceType,
  VehicleType,
} from "@/types";
import { assignNearestMechanic } from "../matching/engine";
import {
  IMechanicRepository,
  getMechanicRepository,
} from "../repositories";

export class MechanicService {
  private customRepo?: IMechanicRepository;

  constructor(mechanicRepo?: IMechanicRepository) {
    this.customRepo = mechanicRepo;
  }

  private get mechanicRepo(): IMechanicRepository {
    return this.customRepo || getMechanicRepository();
  }

  async listMechanics(filters?: { onlineOnly?: boolean }): Promise<Mechanic[]> {
    const all = await this.mechanicRepo.listAll();
    if (filters?.onlineOnly) {
      return all.filter((m) => m.isOnline);
    }
    return all;
  }

  async getById(id: string): Promise<Mechanic | null> {
    return this.mechanicRepo.getById(id);
  }

  async updateStatus(
    id: string,
    status: MechanicStatus,
    isOnline?: boolean
  ): Promise<Mechanic | null> {
    return this.mechanicRepo.updateStatus(id, status, isOnline);
  }

  async findBestMatch(
    customerLoc: GeoPoint,
    serviceType: ServiceType,
    vehicleType: VehicleType
  ): Promise<{
    mechanic: Mechanic;
    distanceKm: number;
    distanceMiles: number;
    estimatedArrivalMinutes: number;
    explanation: string;
  } | null> {
    const mechanics = await this.mechanicRepo.listAll();
    const match = assignNearestMechanic(
      {
        requestId: "temp-preview",
        customerId: "cust-preview",
        vehicleType,
        issueCategory: serviceType,
        description: "Preview matching",
        latitude: customerLoc.lat,
        longitude: customerLoc.lng,
        status: "pending",
        createdAt: new Date().toISOString(),
      },
      mechanics
    );

    if (!match.success || !match.selectedMechanic) return null;

    const km = match.distanceKm || 2.0;
    return {
      mechanic: match.selectedMechanic,
      distanceKm: km,
      distanceMiles: Math.round((km / 1.60934) * 10) / 10,
      estimatedArrivalMinutes: match.estimatedArrivalMinutes || 8,
      explanation: match.explanation,
    };
  }
}

export const mechanicService = new MechanicService();
