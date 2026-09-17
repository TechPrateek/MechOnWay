import { RequestStatus } from "@/types";

export type CanonicalRequestStatus =
  | "SEARCHING"
  | "MATCHED"
  | "REQUESTED"
  | "ACCEPTED"
  | "ON_THE_WAY"
  | "ARRIVED"
  | "IN_SERVICE"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_MECHANIC_AVAILABLE";

export interface StatusTransitionContext {
  assignedMechanicId?: string | null;
  actor?: "customer" | "mechanic" | "system" | "admin";
}

export interface TransitionValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Normalizes legacy lowercase statuses to modern canonical uppercase statuses
 */
export function normalizeRequestStatus(status: RequestStatus | string): CanonicalRequestStatus {
  if (!status) return "SEARCHING";

  const upper = status.toUpperCase();
  const validCanonical: CanonicalRequestStatus[] = [
    "SEARCHING",
    "MATCHED",
    "REQUESTED",
    "ACCEPTED",
    "ON_THE_WAY",
    "ARRIVED",
    "IN_SERVICE",
    "COMPLETED",
    "CANCELLED",
    "NO_MECHANIC_AVAILABLE",
  ];

  if (validCanonical.includes(upper as CanonicalRequestStatus)) {
    return upper as CanonicalRequestStatus;
  }

  // Legacy mappings
  switch (status.toLowerCase()) {
    case "pending":
    case "matching":
      return "SEARCHING";
    case "dispatched":
      return "ON_THE_WAY";
    case "arrived":
      return "ARRIVED";
    case "in_progress":
      return "IN_SERVICE";
    case "completed":
      return "COMPLETED";
    case "cancelled":
      return "CANCELLED";
    default:
      return "SEARCHING";
  }
}

/**
 * Central state transition validator enforcing all business rules:
 * 1. A completed request cannot be cancelled.
 * 2. A cancelled request cannot return to active status.
 * 3. A mechanic must be assigned before moving to accepted.
 * 4. Arbitrary or out-of-order status jumps are strictly rejected.
 *
 * @param currentStatus Current status of the request
 * @param nextStatus Proposed target status
 * @param context Context containing assigned mechanic ID and caller info
 */
export function canTransitionStatus(
  currentStatus: RequestStatus,
  nextStatus: RequestStatus,
  context?: StatusTransitionContext
): TransitionValidationResult {
  const current = normalizeRequestStatus(currentStatus);
  const next = normalizeRequestStatus(nextStatus);

  // Idempotent transitions (same status) are allowed (e.g. updating diagnostic notes)
  if (current === next) {
    return { allowed: true };
  }

  // RULE 1: A completed request cannot be cancelled or modified
  if (current === "COMPLETED") {
    return {
      allowed: false,
      reason: "A completed request cannot be cancelled.",
    };
  }

  // RULE 2: A cancelled request cannot return to active status
  if (current === "CANCELLED") {
    return {
      allowed: false,
      reason: "A cancelled request cannot return to active status.",
    };
  }

  // RULE 3: A mechanic must be assigned before moving to accepted
  if (next === "ACCEPTED") {
    const hasMechanic = Boolean(context?.assignedMechanicId && context.assignedMechanicId.trim().length > 0);
    if (!hasMechanic) {
      return {
        allowed: false,
        reason: "A mechanic must be assigned before moving to accepted.",
      };
    }
  }

  // RULE 4: Validate against the formal state transition graph
  const allowedTransitions: Record<CanonicalRequestStatus, CanonicalRequestStatus[]> = {
    SEARCHING: ["MATCHED", "REQUESTED", "ACCEPTED", "NO_MECHANIC_AVAILABLE", "CANCELLED"],
    MATCHED: ["REQUESTED", "ACCEPTED", "SEARCHING", "NO_MECHANIC_AVAILABLE", "CANCELLED"],
    REQUESTED: ["ACCEPTED", "SEARCHING", "NO_MECHANIC_AVAILABLE", "CANCELLED"],
    ACCEPTED: ["ON_THE_WAY", "SEARCHING", "CANCELLED"],
    ON_THE_WAY: ["ARRIVED", "CANCELLED"],
    ARRIVED: ["IN_SERVICE", "CANCELLED"],
    IN_SERVICE: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
    NO_MECHANIC_AVAILABLE: ["SEARCHING", "CANCELLED"],
  };

  const validTargets = allowedTransitions[current] || [];

  if (!validTargets.includes(next)) {
    return {
      allowed: false,
      reason: `Invalid status transition from ${current} to ${next}.`,
    };
  }

  return { allowed: true };
}

/**
 * Boolean convenience helper for UI conditionals
 */
export function isStatusTransitionAllowed(
  currentStatus: RequestStatus,
  nextStatus: RequestStatus,
  context?: StatusTransitionContext
): boolean {
  return canTransitionStatus(currentStatus, nextStatus, context).allowed;
}

/**
 * Returns the list of all permitted next statuses from a given status
 */
export function getAllowedNextStatuses(
  currentStatus: RequestStatus,
  context?: StatusTransitionContext
): CanonicalRequestStatus[] {
  const current = normalizeRequestStatus(currentStatus);
  const candidateTargets: CanonicalRequestStatus[] = [
    "SEARCHING",
    "MATCHED",
    "REQUESTED",
    "ACCEPTED",
    "ON_THE_WAY",
    "ARRIVED",
    "IN_SERVICE",
    "COMPLETED",
    "CANCELLED",
    "NO_MECHANIC_AVAILABLE",
  ];

  return candidateTargets.filter(
    (target) => canTransitionStatus(current, target, context).allowed && target !== current
  );
}

/**
 * Generates standardized timeline event descriptions for every status change
 */
export function getTimelineEventForStatus(
  status: RequestStatus,
  details?: {
    mechanicName?: string;
    vehicleRig?: string;
    reason?: string;
    diagnosticNotes?: string;
  }
): { title: string; description: string } {
  const normalized = normalizeRequestStatus(status);

  switch (normalized) {
    case "SEARCHING":
      return {
        title: "Searching for Suitable Mechanic",
        description: "Scanning nearby available certified mobile technicians in your coverage zone.",
      };
    case "MATCHED":
      return {
        title: "Mechanic Candidate Matched",
        description: details?.mechanicName
          ? `Identified qualified specialist ${details.mechanicName} (${details.vehicleRig || "Mobile Rig"}).`
          : "Qualified mobile technician identified by matching engine.",
      };
    case "REQUESTED":
      return {
        title: "Dispatch Request Sent",
        description: details?.mechanicName
          ? `Work order transmitted to ${details.mechanicName}. Awaiting technician acceptance.`
          : "Work order transmitted to technician workbench.",
      };
    case "ACCEPTED":
      return {
        title: "Work Order Accepted",
        description: details?.mechanicName
          ? `${details.mechanicName} has accepted your roadside assistance call.`
          : "Technician accepted roadside assistance call.",
      };
    case "ON_THE_WAY":
      return {
        title: "Mechanic En Route",
        description: details?.mechanicName
          ? `${details.mechanicName} has departed and is travelling to your GPS location.`
          : "Technician is on the way to your vehicle.",
      };
    case "ARRIVED":
      return {
        title: "Mechanic Arrived On-Site",
        description: details?.mechanicName
          ? `${details.mechanicName} has arrived on-site and initiated vehicle inspection.`
          : "Technician has arrived at vehicle location.",
      };
    case "IN_SERVICE":
      return {
        title: "Repair Work In Progress",
        description: "Diagnostics, part adjustments, and roadside repair actively underway.",
      };
    case "COMPLETED":
      return {
        title: "Assistance Completed",
        description: details?.diagnosticNotes
          ? `Service completed successfully. Note: ${details.diagnosticNotes}`
          : "Roadside assistance signed off. Vehicle cleared safe for travel.",
      };
    case "CANCELLED":
      return {
        title: "Service Cancelled",
        description: details?.reason
          ? `Roadside request was cancelled: ${details.reason}`
          : "Roadside assistance request was cancelled.",
      };
    case "NO_MECHANIC_AVAILABLE":
      return {
        title: "No Mechanic Available",
        description: "All regional mechanics are currently busy on active jobs or offline.",
      };
  }
}
