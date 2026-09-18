import { Mechanic, MechanicStatus, RoadsideRequest } from "@/types";

export interface IRequestRepository {
  getById(id: string): Promise<RoadsideRequest | null>;
  listAll(): Promise<RoadsideRequest[]>;
  create(request: RoadsideRequest): Promise<RoadsideRequest>;
  update(request: RoadsideRequest): Promise<RoadsideRequest>;
  delete?(id: string): Promise<void>;
  reset?(initial?: RoadsideRequest[]): Promise<void>;
}

export interface IMechanicRepository {
  getById(id: string): Promise<Mechanic | null>;
  listAll(): Promise<Mechanic[]>;
  save(mechanic: Mechanic): Promise<Mechanic>;
  updateStatus(id: string, status: MechanicStatus, isOnline?: boolean): Promise<Mechanic | null>;
  reset?(initial?: Mechanic[]): Promise<void>;
}
