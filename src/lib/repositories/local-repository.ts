import { Mechanic, MechanicStatus, RoadsideRequest } from "@/types";
import { IMechanicRepository, IRequestRepository } from "./types";
import { requestStore, mechanicStore } from "../data/store";

export class LocalRequestRepository implements IRequestRepository {
  async getById(id: string): Promise<RoadsideRequest | null> {
    const found = requestStore.getById(id);
    return found ? { ...found } : null;
  }

  async listAll(): Promise<RoadsideRequest[]> {
    return [...requestStore.listAll()];
  }

  async create(request: RoadsideRequest): Promise<RoadsideRequest> {
    const all = requestStore.listAll();
    const updated = [request, ...all.filter((r) => r.id !== request.id)];
    requestStore.reset(updated);
    return { ...request };
  }

  async update(request: RoadsideRequest): Promise<RoadsideRequest> {
    const all = requestStore.listAll();
    const idx = all.findIndex((r) => r.id === request.id);
    if (idx !== -1) {
      all[idx] = { ...request };
      requestStore.reset([...all]);
    }
    return { ...request };
  }

  async delete(id: string): Promise<void> {
    const all = requestStore.listAll();
    const updated = all.filter((r) => r.id !== id);
    requestStore.reset(updated);
  }

  async reset(initial?: RoadsideRequest[]): Promise<void> {
    requestStore.reset(initial);
  }

  getSnapshot(): RoadsideRequest[] {
    return requestStore.getSnapshot();
  }

  subscribe(listener: () => void): () => void {
    return requestStore.subscribe(listener);
  }
}

export class LocalMechanicRepository implements IMechanicRepository {
  async getById(id: string): Promise<Mechanic | null> {
    const found = mechanicStore.getById(id);
    return found ? { ...found } : null;
  }

  async listAll(): Promise<Mechanic[]> {
    return [...mechanicStore.listAll()];
  }

  async save(mechanic: Mechanic): Promise<Mechanic> {
    const all = mechanicStore.listAll();
    const idx = all.findIndex((m) => m.id === mechanic.id || m.mechanicId === mechanic.id);
    if (idx !== -1) {
      all[idx] = { ...mechanic };
    } else {
      all.push({ ...mechanic });
    }
    mechanicStore.reset([...all]);
    return { ...mechanic };
  }

  async updateStatus(id: string, status: MechanicStatus, isOnline?: boolean): Promise<Mechanic | null> {
    return mechanicStore.updateStatus(id, status, isOnline);
  }

  async reset(initial?: Mechanic[]): Promise<void> {
    mechanicStore.reset(initial);
  }

  getSnapshot(): Mechanic[] {
    return mechanicStore.getSnapshot();
  }

  subscribe(listener: () => void): () => void {
    return mechanicStore.subscribe(listener);
  }
}

export const localRequestRepository = new LocalRequestRepository();
export const localMechanicRepository = new LocalMechanicRepository();
