import {
  BreakdownCategory,
  GeoPoint,
  Mechanic,
  RoadsideRequest,
  ServiceType,
  VehicleType,
} from "@/types";
import {
  MOCK_MECHANICS,
  MOCK_REQUESTS,
  SERVICE_METAS,
} from "./mock-data";
import { CreateRequestInput, UpdateRequestStatusInput } from "../validations/request";
import {
  assignNearestMechanic,
  toMatchingRequestInput,
} from "../matching/engine";
import {
  canTransitionStatus,
  normalizeRequestStatus,
  getTimelineEventForStatus,
} from "../lifecycle/status-machine";
import { apiClient } from "../api/client";

/**
 * Calculates distance in miles between two coordinates using Haversine formula
 */
export function calculateDistanceMiles(p1: GeoPoint, p2: GeoPoint): number {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLon = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// In-memory singletons for server runtime
let requestsState: RoadsideRequest[] = [...MOCK_REQUESTS];
let mechanicsState: Mechanic[] = [...MOCK_MECHANICS];
let isClientInitialized = false;

const STORAGE_KEYS = {
  REQUESTS: "mechonway_requests_v1",
  MECHANICS: "mechonway_mechanics_v1",
};

type Listener = () => void;
const requestListeners = new Set<Listener>();
const mechanicListeners = new Set<Listener>();

function notifyRequestListeners() {
  requestListeners.forEach((l) => l());
}

function notifyMechanicListeners() {
  mechanicListeners.forEach((l) => l());
}

function getClientStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setClientStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("Local storage error:", err);
  }
}

function ensureClientInitialized() {
  if (typeof window === "undefined" || isClientInitialized) return;
  isClientInitialized = true;
  requestsState = getClientStorage(STORAGE_KEYS.REQUESTS, requestsState);
  mechanicsState = getClientStorage(STORAGE_KEYS.MECHANICS, mechanicsState);

  // If deployed with API Gateway, synchronize initial state from remote cloud
  if (apiClient.isConfigured()) {
    apiClient.requests
      .list()
      .then((remote) => {
        if (Array.isArray(remote) && remote.length > 0) {
          persistRequests(remote);
        }
      })
      .catch((err) => console.warn("Could not sync requests from API Gateway:", err));

    apiClient.mechanics
      .list()
      .then((remote) => {
        if (Array.isArray(remote) && remote.length > 0) {
          persistMechanics(remote);
        }
      })
      .catch((err) => console.warn("Could not sync mechanics from API Gateway:", err));
  }
}

function persistRequests(updated: RoadsideRequest[]): void {
  requestsState = updated;
  setClientStorage(STORAGE_KEYS.REQUESTS, updated);
  notifyRequestListeners();
}

function persistMechanics(updated: Mechanic[]): void {
  mechanicsState = updated;
  setClientStorage(STORAGE_KEYS.MECHANICS, updated);
  notifyMechanicListeners();
}

export const requestStore = {
  reset(initialRequests?: RoadsideRequest[]): void {
    const updated = initialRequests ? [...initialRequests] : [...MOCK_REQUESTS];
    persistRequests(updated);
  },

  listAll(): RoadsideRequest[] {
    ensureClientInitialized();
    return requestsState;
  },

  getSnapshot(): RoadsideRequest[] {
    ensureClientInitialized();
    return requestsState;
  },

  subscribe(listener: Listener): () => void {
    requestListeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.REQUESTS) {
        requestsState = getClientStorage(STORAGE_KEYS.REQUESTS, requestsState);
        listener();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }
    return () => {
      requestListeners.delete(listener);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    };
  },

  getById(id: string): RoadsideRequest | undefined {
    const all = this.listAll();
    return all.find((r) => r.id === id);
  },

  create(input: CreateRequestInput): RoadsideRequest {
    const id = `req-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const category = input.breakdownCategory;
    const baseMeta = SERVICE_METAS[category] || {
      estimatedBasePrice: 75,
      typicalEtaMinutes: 20,
    };

    // Calculate upfront pricing based on vehicle type and service
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
      customerId: "cust-current",
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

    const current = this.listAll();
    const updated = [newReq, ...current];
    persistRequests(updated);

    // If connected to API Gateway, sync creation to cloud database
    if (apiClient.isConfigured()) {
      apiClient.requests
        .create(input)
        .then((remoteCreated) => {
          if (remoteCreated && remoteCreated.id) {
            const list = this.listAll().map((r) => (r.id === newReq.id ? remoteCreated : r));
            persistRequests(list);
          }
        })
        .catch((err) => console.error("Failed to sync created request to API Gateway:", err));
    }

    return newReq;
  },

  matchAndAssign(requestId: string): {
    request: RoadsideRequest;
    mechanic?: Mechanic;
    matchResult: ReturnType<typeof assignNearestMechanic>;
  } | null {
    const req = this.getById(requestId);
    if (!req) return null;

    const mechanics = mechanicStore.listAll();
    const matchInput = toMatchingRequestInput(req);
    const matchResult = assignNearestMechanic(matchInput, mechanics);

    if (!matchResult.success || !matchResult.selectedMechanic) {
      // Record matching failure explanation on request and transition to NO_MECHANIC_AVAILABLE
      const current = this.listAll();
      const idx = current.findIndex((r) => r.id === requestId);
      if (idx !== -1) {
        const failureEv = getTimelineEventForStatus("NO_MECHANIC_AVAILABLE", {
          reason: matchResult.explanation,
        });
        current[idx] = {
          ...current[idx],
          status: "NO_MECHANIC_AVAILABLE",
          matchingExplanation: matchResult.explanation,
          updatedAt: new Date().toISOString(),
          timeline: [
            ...current[idx].timeline,
            {
              status: "NO_MECHANIC_AVAILABLE",
              timestamp: new Date().toISOString(),
              title: failureEv.title,
              description: matchResult.explanation,
            },
          ],
        };
        persistRequests([...current]);
      }
      return { request: this.getById(requestId) || req, matchResult };
    }

    const assigned = this.assignMechanic(
      requestId,
      matchResult.selectedMechanic.mechanicId || matchResult.selectedMechanic.id,
      matchResult.estimatedArrivalMinutes || 8,
      matchResult.distanceKm || 2.0,
      matchResult.explanation
    );

    if (!assigned) return null;

    // If connected to API Gateway, sync match execution to backend
    if (apiClient.isConfigured()) {
      apiClient.requests
        .match(requestId)
        .then((res) => {
          if (res && res.request) {
            const updatedRequest: RoadsideRequest = res.request;
            const all = this.listAll().map((r) => (r.id === requestId ? updatedRequest : r));
            persistRequests(all);
          }
        })
        .catch((err) => console.error("Failed to sync match to API Gateway:", err));
    }

    return {
      request: assigned.request,
      mechanic: assigned.mechanic,
      matchResult,
    };
  },

  assignMechanic(
    requestId: string,
    mechanicId: string,
    etaMinutes: number,
    distanceKm: number,
    explanation?: string
  ): { request: RoadsideRequest; mechanic: Mechanic } | null {
    const current = this.listAll();
    const idx = current.findIndex((r) => r.id === requestId);
    if (idx === -1) return null;

    const mechanic = mechanicStore.getById(mechanicId);
    if (!mechanic) return null;

    // Rule 1: Prevent offline mechanics from receiving new assignments
    if (mechanic.isOnline === false) {
      throw new Error(
        `Cannot assign dispatch: Mechanic ${mechanic.name} is currently offline or unavailable.`
      );
    }

    // Rule 2: Prevent a mechanic from accepting conflicting requests
    const conflicting = current.find((r) => {
      if (r.id === requestId) return false;
      const isAssigned =
        r.assignedMechanicId === mechanic.id || r.assignedMechanicId === mechanic.mechanicId;
      const norm = normalizeRequestStatus(r.status);
      return isAssigned && ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_SERVICE"].includes(norm);
    });

    if (conflicting) {
      throw new Error(
        `Cannot assign dispatch: Mechanic ${mechanic.name} already has an active roadside dispatch (#${conflicting.id} - ${conflicting.serviceType.replace(/_/g, " ")}). Complete active work order before accepting new assignments.`
      );
    }

    if (mechanic.isAvailable === false && !mechanic.isOnline) {
      throw new Error(
        `Cannot assign dispatch: Mechanic ${mechanic.name} is currently offline or unavailable.`
      );
    }

    const existing = current[idx];
    // Check transition from current status to ON_THE_WAY (progressing through MATCHED -> ACCEPTED -> ON_THE_WAY)
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

    current[idx] = updatedReq;
    persistRequests([...current]);

    // Update mechanic status to en_route
    mechanicStore.updateStatus(mechanic.mechanicId || mechanic.id, "en_route");

    return { request: updatedReq, mechanic };
  },

  updateStatus(id: string, input: UpdateRequestStatusInput): RoadsideRequest | null {
    const current = this.listAll();
    const idx = current.findIndex((r) => r.id === id);
    if (idx === -1) return null;

    const existing = current[idx];
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
    const assignedMechanic = assignedMechId ? mechanicStore.getById(assignedMechId) : existing.assignedMechanic;

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

    current[idx] = updatedReq;
    persistRequests([...current]);

    // If connected to API Gateway, sync status transition to cloud database
    if (apiClient.isConfigured()) {
      apiClient.requests
        .updateStatus(id, input)
        .catch((err) => console.error("Failed to sync status update to API Gateway:", err));
    }

    // If completed or cancelled, release the mechanic
    if (
      (nextStatus === "COMPLETED" || nextStatus === "CANCELLED") &&
      existing.assignedMechanicId
    ) {
      mechanicStore.updateStatus(existing.assignedMechanicId, "idle");
    }

    return updatedReq;
  },

  async syncWithBackend(): Promise<RoadsideRequest[]> {
    if (!apiClient.isConfigured()) return this.listAll();
    try {
      const remote = await apiClient.requests.list();
      if (Array.isArray(remote)) {
        persistRequests(remote);
      }
      return this.listAll();
    } catch (err) {
      console.warn("Manual request sync failed:", err);
      return this.listAll();
    }
  },

  rejectRequest(id: string, reason?: string): RoadsideRequest | null {
    const current = this.listAll();
    const idx = current.findIndex((r) => r.id === id);
    if (idx === -1) return null;

    const existing = current[idx];
    const prevMechanicId = existing.assignedMechanicId;

    // Transition back to SEARCHING so another mechanic can be matched
    const validation = canTransitionStatus(existing.status, "SEARCHING");
    if (!validation.allowed) {
      throw new Error(validation.reason || "Cannot reject request in current status.");
    }

    if (prevMechanicId) {
      mechanicStore.updateStatus(prevMechanicId, "idle");
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

    current[idx] = updatedReq;
    persistRequests([...current]);
    return updatedReq;
  },

  cancelRequest(id: string, reason?: string): RoadsideRequest | null {
    return this.updateStatus(id, {
      status: "CANCELLED",
      cancellationReason: reason,
    });
  },

  getActiveForMechanic(mechanicId: string): RoadsideRequest | undefined {
    const all = this.listAll();
    return all.find((r) => {
      const isAssigned = r.assignedMechanicId === mechanicId;
      const norm = normalizeRequestStatus(r.status);
      return isAssigned && ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_SERVICE"].includes(norm);
    });
  },

  getHistoryForMechanic(mechanicId: string): RoadsideRequest[] {
    const all = this.listAll();
    return all.filter((r) => {
      const isAssigned = r.assignedMechanicId === mechanicId;
      const norm = normalizeRequestStatus(r.status);
      return isAssigned && norm === "COMPLETED";
    });
  },
};

export const mechanicStore = {
  reset(initialMechanics?: Mechanic[]): void {
    const updated = initialMechanics ? [...initialMechanics] : [...MOCK_MECHANICS];
    persistMechanics(updated);
  },

  listAll(): Mechanic[] {
    ensureClientInitialized();
    return mechanicsState;
  },

  getSnapshot(): Mechanic[] {
    ensureClientInitialized();
    return mechanicsState;
  },

  subscribe(listener: Listener): () => void {
    mechanicListeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.MECHANICS) {
        mechanicsState = getClientStorage(STORAGE_KEYS.MECHANICS, mechanicsState);
        listener();
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
    }
    return () => {
      mechanicListeners.delete(listener);
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", onStorage);
      }
    };
  },

  getById(id: string): Mechanic | undefined {
    return this.listAll().find((m) => m.id === id || m.mechanicId === id);
  },

  updateStatus(id: string, status: Mechanic["status"], isOnline?: boolean): Mechanic | null {
    const list = this.listAll();
    const idx = list.findIndex((m) => m.id === id || m.mechanicId === id);
    if (idx === -1) return null;

    const nextOnline = isOnline !== undefined ? isOnline : (list[idx].isOnline ?? true);
    const isBusy = status === "assigned" || status === "en_route" || status === "on_site";
    const nextAvailable = nextOnline && !isBusy;

    list[idx] = {
      ...list[idx],
      status,
      isOnline: nextOnline,
      isAvailable: nextAvailable,
      currentStatus: !nextOnline
        ? "offline"
        : isBusy
        ? (status === "en_route" || status === "on_site" ? status : "busy")
        : "available",
    };

    persistMechanics([...list]);

    // If connected to API Gateway, sync mechanic availability to cloud database
    if (apiClient.isConfigured()) {
      apiClient.mechanics
        .updateStatus(id, status, nextOnline)
        .catch((err) => console.error("Failed to sync mechanic status to API Gateway:", err));
    }

    return list[idx];
  },

  async syncWithBackend(): Promise<Mechanic[]> {
    if (!apiClient.isConfigured()) return this.listAll();
    try {
      const remote = await apiClient.mechanics.list();
      if (Array.isArray(remote)) {
        persistMechanics(remote);
      }
      return this.listAll();
    } catch (err) {
      console.warn("Manual mechanic sync failed:", err);
      return this.listAll();
    }
  },

  findBestMatch(
    customerLoc: GeoPoint,
    serviceType: ServiceType,
    vehicleType: VehicleType
  ): {
    mechanic: Mechanic;
    distanceKm: number;
    distanceMiles: number;
    estimatedArrivalMinutes: number;
    explanation: string;
  } | null {
    const mechanics = this.listAll();
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
  },
};

