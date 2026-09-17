"use client";

import { useSyncExternalStore } from "react";
import { requestStore, mechanicStore } from "./store";
import { RoadsideRequest, Mechanic } from "@/types";
import { MOCK_REQUESTS, MOCK_MECHANICS } from "./mock-data";

const serverDefaultRequests: RoadsideRequest[] = [...MOCK_REQUESTS];
const serverDefaultMechanics: Mechanic[] = [...MOCK_MECHANICS];

export function useRequests(): RoadsideRequest[] {
  return useSyncExternalStore(
    requestStore.subscribe,
    requestStore.getSnapshot,
    () => serverDefaultRequests
  );
}

export function useMechanics(): Mechanic[] {
  return useSyncExternalStore(
    mechanicStore.subscribe,
    mechanicStore.getSnapshot,
    () => serverDefaultMechanics
  );
}
