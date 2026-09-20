import {
  BreakdownCategory,
  Mechanic,
  RoadsideRequest,
} from "@/types";
import { CreateRequestInput, UpdateRequestStatusInput } from "../validations/request";
import { SERVICE_METAS } from "../data/mock-data";
import {
  assignNearestMechanic,
  toMatchingRequestInput,
} from "../matching/engine";
import {
  canTransitionStatus,
  normalizeRequestStatus,
  getTimelineEventForStatus,
} from "../lifecycle/status-machine";
import {
  IMechanicRepository,
  IRequestRepository,
  getMechanicRepository,
  getRequestRepository,
} from "../repositories";

export interface MatchAndAssignResult {
  request: RoadsideRequest;
  mechanic?: Mechanic;
  matchResult: ReturnType<typeof assignNearestMechanic>;
}

export class RequestService {
  private customRequestRepo?: IRequestRepository;
  private customMechanicRepo?: IMechanicRepository;

  constructor(requestRepo?: IRequestRepository, mechanicRepo?: IMechanicRepository) {
    this.customRequestRepo = requestRepo;
    this.customMechanicRepo = mechanicRepo;
  }

  private get requestRepo(): IRequestRepository {
    return this.customRequestRepo || getRequestRepository();
  }

  private get mechanicRepo(): IMechanicRepository {
    return this.customMechanicRepo || getMechanicRepository();
  }

  async getById(id: string): Promise<RoadsideRequest | null> {
    return this.requestRepo.getById(id);
  }

  async listAll(): Promise<RoadsideRequest[]> {
    return this.requestRepo.listAll();
  }

  async createRequest(input: CreateRequestInput): Promise<RoadsideRequest> {
    const id = `req-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const category = input.breakdownCategory;
    const baseMeta = SERVICE_METAS[category] || {
      estimatedBasePrice: 75,
      typicalEtaMinutes: 20,
    };

    // Calculate upfront dynamic pricing based on vehicle type and service severity
    let price = baseMeta.estimatedBasePrice;
    if (input.vehicle.type === "truck" || input.vehicle.type === "commercial") {
      price += 25;
    } else if (input.vehicle.isEV || input.vehicle.type === "ev") {
      price += 15;
    } else if (input.vehicle.type === "motorcycle" || input.vehicle.type === "scooter") {
      price -= 10;
    }
    if (input.urgency === "critical_highway") {
      price += 20;
    }

    const now = new Date().toISOString();
    const newReq: RoadsideRequest = {
      id,
      customerId: input.customerId || "cust-current",
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      vehicle: {
        type: input.vehicle.type,
        make: input.vehicle.make || "Vehicle",
        model: input.vehicle.model || input.vehicle.type.toUpperCase(),
        year: input.vehicle.year || 2022,
        color: input.vehicle.color || "Standard",
        licensePlate: input.vehicle.licensePlate || "Pending",
        isEV: input.vehicle.isEV ?? false,
      },
      serviceType: category,
      breakdownCategory: category as BreakdownCategory,
      issueDescription: input.issueDescription,
      urgency: input.urgency,
      location: input.location,
      status: "SEARCHING",
      estimatedPrice: Math.max(35, price),
      createdAt: now,
      updatedAt: now,
      timeline: [
        {
          status: "SEARCHING",
          timestamp: now,
          title: "Roadside Assistance Requested",
          description: `Logged assistance call for ${input.vehicle.make || ""} ${input.vehicle.model || input.vehicle.type} (${category.replace("_", " ")}). Initiating regional mechanic match.`,
        },
      ],
    };

    return this.requestRepo.create(newReq);
  }

  async updateStatus(id: string, input: UpdateRequestStatusInput): Promise<RoadsideRequest> {
    const existing = await this.requestRepo.getById(id);
    if (!existing) {
      throw new Error(`Roadside request ${id} not found.`);
    }

    const nextStatus = normalizeRequestStatus(input.status);
    const assignedMechId = input.mechanicId || existing.assignedMechanicId;

    // Validate transition through central state machine
    const validation = canTransitionStatus(existing.status, nextStatus, {
      assignedMechanicId: assignedMechId,
    });

    if (!validation.allowed) {
      throw new Error(validation.reason || `Invalid status transition to ${nextStatus}`);
    }

    const now = new Date().toISOString();
    const assignedMechanic = assignedMechId ? await this.mechanicRepo.getById(assignedMechId) : existing.assignedMechanic;

    const ev = getTimelineEventForStatus(nextStatus, {
      mechanicName: assignedMechanic?.name,
      vehicleRig: assignedMechanic?.vehicleRig,
      reason: input.cancellationReason,
      diagnosticNotes: input.diagnosticNotes,
    });

    const updatedReq: RoadsideRequest = {
      ...existing,
      status: nextStatus,
      assignedMechanicId: assignedMechId,
      assignedMechanic: assignedMechanic || existing.assignedMechanic,
      updatedAt: now,
      finalPrice: input.finalPrice ?? existing.finalPrice ?? existing.estimatedPrice,
      diagnosticNotes: input.diagnosticNotes ?? existing.diagnosticNotes,
      completedAt: nextStatus === "COMPLETED" ? now : existing.completedAt,
      timeline: [
        ...existing.timeline,
        {
          status: nextStatus,
          timestamp: now,
          title: ev.title,
          description: input.diagnosticNotes
            ? `${ev.description} [Report: ${input.diagnosticNotes}]`
            : ev.description,
        },
      ],
    };

    const saved = await this.requestRepo.update(updatedReq);

    // If completed or cancelled, release the mechanic back to idle
    if (
      (nextStatus === "COMPLETED" || nextStatus === "CANCELLED") &&
      existing.assignedMechanicId
    ) {
      await this.mechanicRepo.updateStatus(existing.assignedMechanicId, "idle");
    }

    return saved;
  }

  async rejectRequest(id: string, reason?: string): Promise<RoadsideRequest> {
    const existing = await this.requestRepo.getById(id);
    if (!existing) {
      throw new Error(`Roadside request ${id} not found.`);
    }

    const prevMechanicId = existing.assignedMechanicId;

    // Transition back to SEARCHING so another mechanic can be matched
    const validation = canTransitionStatus(existing.status, "SEARCHING");
    if (!validation.allowed) {
      throw new Error(validation.reason || "Cannot reject request in current status.");
    }

    if (prevMechanicId) {
      await this.mechanicRepo.updateStatus(prevMechanicId, "idle");
    }

    const now = new Date().toISOString();
    const updatedReq: RoadsideRequest = {
      ...existing,
      status: "SEARCHING",
      assignedMechanicId: undefined,
      assignedMechanic: undefined,
      updatedAt: now,
      timeline: [
        ...existing.timeline,
        {
          status: "SEARCHING",
          timestamp: now,
          title: "Dispatch Declined - Re-searching",
          description: reason || "Technician was unable to accept dispatch. Finding next available qualified mechanic.",
        },
      ],
    };

    return this.requestRepo.update(updatedReq);
  }

  async cancelRequest(id: string, reason?: string): Promise<RoadsideRequest> {
    return this.updateStatus(id, {
      status: "CANCELLED",
      cancellationReason: reason,
    });
  }

  async assignMechanic(
    requestId: string,
    mechanicId: string,
    etaMinutes = 15,
    distanceKm = 2.0,
    explanation?: string
  ): Promise<{ request: RoadsideRequest; mechanic: Mechanic }> {
    const existing = await this.requestRepo.getById(requestId);
    if (!existing) {
      throw new Error(`Roadside request ${requestId} not found.`);
    }

    const mechanic = await this.mechanicRepo.getById(mechanicId);
    if (!mechanic) {
      throw new Error(`Mechanic with ID ${mechanicId} not found.`);
    }

    // Conflict prevention check: ensure mechanic does not already have an active roadside dispatch
    const allRequests = await this.requestRepo.listAll();
    const existingActive = allRequests.find((r) => {
      const isAssigned = r.assignedMechanicId === mechanicId || r.assignedMechanicId === mechanic.id;
      const isNotThisRequest = r.id !== requestId;
      const norm = normalizeRequestStatus(r.status);
      return (
        isAssigned &&
        isNotThisRequest &&
        ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_SERVICE"].includes(norm)
      );
    });

    if (existingActive) {
      throw new Error(
        `Dispatch conflict: Mechanic ${mechanic.name} already has an active roadside dispatch (#${existingActive.id}) in progress.`
      );
    }

    if (mechanic.isAvailable === false && !mechanic.isOnline) {
      throw new Error(
        `Cannot assign dispatch: Mechanic ${mechanic.name} is currently offline or unavailable.`
      );
    }

    // Check transition from current status to ON_THE_WAY
    const canAccept = canTransitionStatus(existing.status, "ACCEPTED", {
      assignedMechanicId: mechanic.mechanicId || mechanic.id,
    });
    if (!canAccept.allowed && normalizeRequestStatus(existing.status) !== "ON_THE_WAY") {
      console.warn(`Cannot assign mechanic: ${canAccept.reason}`);
    }

    const now = new Date().toISOString();
    const matchedEv = getTimelineEventForStatus("MATCHED", {
      mechanicName: mechanic.name,
      vehicleRig: mechanic.vehicleRig,
    });
    const acceptedEv = getTimelineEventForStatus("ACCEPTED", {
      mechanicName: mechanic.name,
    });
    const enRouteEv = getTimelineEventForStatus("ON_THE_WAY", {
      mechanicName: mechanic.name,
    });

    const updatedReq: RoadsideRequest = {
      ...existing,
      status: "ON_THE_WAY",
      assignedMechanicId: mechanic.mechanicId || mechanic.id,
      assignedMechanic: mechanic,
      estimatedArrivalMinutes: etaMinutes,
      mechanicDistanceKm: distanceKm,
      mechanicDistanceMiles: Math.round((distanceKm / 1.60934) * 10) / 10,
      matchingExplanation: explanation,
      updatedAt: now,
      timeline: [
        ...existing.timeline,
        {
          status: "MATCHED",
          timestamp: new Date(Date.now() - 20000).toISOString(),
          title: matchedEv.title,
          description: explanation || matchedEv.description,
        },
        {
          status: "ACCEPTED",
          timestamp: new Date(Date.now() - 10000).toISOString(),
          title: acceptedEv.title,
          description: acceptedEv.description,
        },
        {
          status: "ON_THE_WAY",
          timestamp: now,
          title: enRouteEv.title,
          description: `${mechanic.name} is en route. Estimated arrival: ~${etaMinutes} mins (${distanceKm} km).`,
        },
      ],
    };

    const saved = await this.requestRepo.update(updatedReq);
    await this.mechanicRepo.updateStatus(mechanic.mechanicId || mechanic.id, "en_route");

    return { request: saved, mechanic };
  }

  async matchAndAssign(requestId: string): Promise<MatchAndAssignResult | null> {
    const req = await this.requestRepo.getById(requestId);
    if (!req) return null;

    // Check for active dispatches across all requests to prevent assigning busy mechanics
    const allRequests = await this.requestRepo.listAll();
    const busyMechanicIds = new Set<string>();
    const nowMs = Date.now();
    const STALE_DISPATCH_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes

    for (const r of allRequests) {
      const norm = normalizeRequestStatus(r.status);
      const isAssignedActive =
        r.id !== requestId &&
        r.assignedMechanicId &&
        ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_SERVICE"].includes(norm);

      if (isAssignedActive) {
        // Dispatches older than 60 minutes are considered expired so demo mechanics are not locked indefinitely
        const reqTime = r.updatedAt ? new Date(r.updatedAt).getTime() : new Date(r.createdAt).getTime();
        const isStale = nowMs - reqTime > STALE_DISPATCH_THRESHOLD_MS;
        if (!isStale) {
          busyMechanicIds.add(r.assignedMechanicId!);
        }
      }
    }

    const allMechanics = await this.mechanicRepo.listAll();
    const availableMechanics = allMechanics.filter(
      (m) => !busyMechanicIds.has(m.mechanicId) && !busyMechanicIds.has(m.id)
    );

    const matchInput = toMatchingRequestInput(req);
    const matchResult = assignNearestMechanic(matchInput, availableMechanics);

    if (!matchResult.success || !matchResult.selectedMechanic) {
      const failureEv = getTimelineEventForStatus("NO_MECHANIC_AVAILABLE", {
        reason: matchResult.explanation,
      });
      const updatedReq: RoadsideRequest = {
        ...req,
        status: "NO_MECHANIC_AVAILABLE",
        matchingExplanation: matchResult.explanation,
        updatedAt: new Date().toISOString(),
        timeline: [
          ...req.timeline,
          {
            status: "NO_MECHANIC_AVAILABLE",
            timestamp: new Date().toISOString(),
            title: failureEv.title,
            description: matchResult.explanation,
          },
        ],
      };
      const saved = await this.requestRepo.update(updatedReq);
      return { request: saved, matchResult };
    }

    const assigned = await this.assignMechanic(
      requestId,
      matchResult.selectedMechanic.mechanicId || matchResult.selectedMechanic.id,
      matchResult.estimatedArrivalMinutes || 8,
      matchResult.distanceKm || 2.0,
      matchResult.explanation
    );

    return {
      request: assigned.request,
      mechanic: assigned.mechanic,
      matchResult,
    };
  }

  async getActiveForMechanic(mechanicId: string): Promise<RoadsideRequest | null> {
    const all = await this.requestRepo.listAll();
    const found = all.find((r) => {
      const isAssigned = r.assignedMechanicId === mechanicId;
      const norm = normalizeRequestStatus(r.status);
      return isAssigned && ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_SERVICE"].includes(norm);
    });
    return found || null;
  }

  async getHistoryForMechanic(mechanicId: string): Promise<RoadsideRequest[]> {
    const all = await this.requestRepo.listAll();
    return all.filter((r) => {
      const isAssigned = r.assignedMechanicId === mechanicId;
      const norm = normalizeRequestStatus(r.status);
      return isAssigned && norm === "COMPLETED";
    });
  }
}

export const requestService = new RequestService();
