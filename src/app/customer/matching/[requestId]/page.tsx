"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  CheckCircle2,
  Clock,
  MapPin,
  Wrench,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/common/button";
import { requestStore } from "@/lib/data/store";
import { useRequests } from "@/lib/data/use-store";
import { Mechanic } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { maskPhoneNumber } from "@/lib/matching/engine";

export default function FindingMechanicPage() {
  const params = useParams<{ requestId: string }>();
  const router = useRouter();
  const requestId = params?.requestId;

  const requests = useRequests();
  const request = requests.find((r) => r.id === requestId) || null;

  const [matchedMechanic, setMatchedMechanic] = useState<Mechanic | null>(() => {
    if (!requestId) return null;
    const existing = requestStore.getById(requestId);
    return existing?.assignedMechanic ?? null;
  });

  const [matchExplanation, setMatchExplanation] = useState<string | null>(() => {
    if (!requestId) return null;
    const existing = requestStore.getById(requestId);
    return existing?.matchingExplanation ?? null;
  });

  const [failureReason, setFailureReason] = useState<string | null>(null);

  const [matchingStep, setMatchingStep] = useState<number>(() => {
    if (!requestId) return 1;
    const existing = requestStore.getById(requestId);
    return existing?.assignedMechanic ? 4 : 1;
  });

  const [isCompleted, setIsCompleted] = useState<boolean>(() => {
    if (!requestId) return false;
    const existing = requestStore.getById(requestId);
    return !!existing?.assignedMechanic;
  });

  const [retryCount, setRetryCount] = useState(0);

  const hasAssigned = Boolean(request?.assignedMechanic);

  useEffect(() => {
    if (!requestId || !request || hasAssigned) {
      return;
    }

    const t1 = setTimeout(() => {
      setMatchingStep(2);
    }, 1200);

    const t2 = setTimeout(() => {
      setMatchingStep(3);
    }, 2400);

    const t3 = setTimeout(() => {
      const result = requestStore.matchAndAssign(requestId);
      if (result) {
        if (result.matchResult.success && result.mechanic) {
          setMatchedMechanic(result.mechanic);
          setMatchExplanation(result.matchResult.explanation);
        } else {
          setMatchedMechanic(null);
          setFailureReason(result.matchResult.explanation);
        }
      }
      setMatchingStep(4);
      setIsCompleted(true);
    }, 3800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [requestId, retryCount, hasAssigned, request]);

  const isNotFound = !requestId || (!request && requests.length > 0);

  const handleRetry = () => {
    setMatchingStep(1);
    setIsCompleted(false);
    setFailureReason(null);
    setRetryCount((prev) => prev + 1);
  };

  const handleProceedToTrack = () => {
    if (requestId) {
      router.push(`/customer/track/${requestId}`);
    }
  };

  if (isNotFound) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-950 dark:text-white">
          Roadside Request Not Found
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          We could not locate request ID <span className="font-mono font-semibold">{requestId}</span>. It may have expired or was submitted in a different browser session.
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Button onClick={() => router.push("/customer/request")} variant="emergency">
            Create New Request
          </Button>
          <Button onClick={() => router.push("/customer")} variant="outline">
            Customer Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 lg:py-16 space-y-6">
      {/* MVP Disclaimer */}
      <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold uppercase text-[10px]">
            MVP Matching Simulation
          </span>
          <span className="text-slate-300 text-[11px]">
            Demonstrating capability and proximity matching with network mobile mechanics.
          </span>
        </div>
      </div>

      {/* Emergency Advisory if accident category */}
      {request?.breakdownCategory === "accident_assistance" && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-start gap-2.5 text-xs text-rose-900 dark:text-rose-200">
          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>
            If this accident involves personal injury, road blockage, or hazardous fluids, call <strong>911</strong> immediately.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>MATCHING ENGINE IN PROGRESS</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
          {isCompleted
            ? matchedMechanic
              ? "Mechanic Selected & Dispatched!"
              : "No Suitable Mechanic Found"
            : "Finding Suitable Mechanic Nearby..."}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Request ID: <span className="font-mono font-semibold">{requestId}</span> • Evaluating vehicle compatibility, tools, and availability
        </p>
      </div>

      {/* Radar Animation Box */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 p-8 text-white relative overflow-hidden shadow-2xl">
        {/* Radar concentric circles */}
        <div className="flex flex-col items-center justify-center py-6 relative">
          <div className="relative flex items-center justify-center">
            {/* Outer pulse */}
            <div className="absolute w-64 h-64 rounded-full border border-amber-500/20 animate-ping opacity-30 pointer-events-none" />
            {/* Middle circle */}
            <div className="w-52 h-52 rounded-full border border-slate-700/60 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full border-t border-amber-500/80 animate-spin" />
              {/* Inner circle */}
              <div className="w-36 h-36 rounded-full border border-slate-700 flex items-center justify-center bg-slate-900/60">
                {isCompleted && matchedMechanic ? (
                  <div className="flex flex-col items-center justify-center text-center p-2">
                    <Image
                      src={matchedMechanic.avatarUrl}
                      alt={matchedMechanic.name}
                      width={56}
                      height={56}
                      unoptimized
                      className="w-14 h-14 rounded-full object-cover border-2 border-amber-500 shadow-md mb-1"
                    />
                    <span className="text-[11px] font-bold text-white leading-tight">
                      {matchedMechanic.name}
                    </span>
                    <span className="text-[9px] text-amber-400 font-medium">
                      ★ {matchedMechanic.rating} Rating
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <Wrench className="w-8 h-8 text-amber-400 -rotate-45 animate-pulse" />
                    <span className="text-[10px] text-slate-400 font-mono mt-1">
                      {isCompleted ? "NO MATCH" : "SCANNING"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status message */}
          <div className="mt-8 text-center max-w-md">
            <p className="text-sm font-semibold text-white">
              {matchingStep === 1 && "1. Scanning nearby mechanics within coverage zone..."}
              {matchingStep === 2 && "2. Checking vehicle compatibility & onboard diagnostic tools..."}
              {matchingStep === 3 && "3. Calculating Haversine distance in km & evaluating ratings..."}
              {matchingStep === 4 &&
                (matchedMechanic
                  ? "4. Dispatch confirmed! Nearest qualified mechanic assigned."
                  : "4. Matching completed — no suitable mechanic currently available.")}
            </p>
          </div>
        </div>

        {/* Live Criteria Breakdown */}
        <div className="mt-6 pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            {matchingStep >= 1 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span>Proximity Filter (km)</span>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            {matchingStep >= 2 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span>Vehicle &amp; Tool Matched</span>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            {matchingStep >= 4 ? (
              matchedMechanic ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-rose-400 shrink-0" />
              )
            ) : (
              <Clock className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span>Active &amp; Available</span>
          </div>
        </div>
      </div>

      {/* Unmatched / Failure Resolution Box */}
      {isCompleted && !matchedMechanic && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 p-6 sm:p-7 shadow-sm space-y-4">
          <div className="flex items-start gap-3 text-rose-900 dark:text-rose-200">
            <ShieldAlert className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-bold text-base text-slate-950 dark:text-white">
                Unable to Assign a Certified Mechanic
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {failureReason ||
                  request?.matchingExplanation ||
                  "No nearby mechanics are currently available that match both your vehicle type and requested breakdown service."}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <div className="font-semibold text-slate-900 dark:text-white">
              Recommended Next Steps:
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1">
              <li>Wait 2-3 minutes as active mechanics finish jobs and toggle available.</li>
              <li>Verify if your breakdown can be handled under General Repair.</li>
              <li>For emergency towing or severe road hazards, call 911 or highway patrol.</li>
            </ul>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <Button
              onClick={handleRetry}
              variant="emergency"
              size="md"
              className="w-full sm:w-auto font-semibold"
            >
              Retry Matching Scan
            </Button>
            <Button
              onClick={() => router.push("/customer/request")}
              variant="outline"
              size="md"
              className="w-full sm:w-auto"
            >
              Modify Assistance Request
            </Button>
            <Button
              onClick={() => router.push("/customer")}
              variant="ghost"
              size="md"
              className="w-full sm:w-auto text-slate-500"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      )}

      {/* Matched Details / Proceed Card */}
      {isCompleted && matchedMechanic && request && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3.5">
              <Image
                src={matchedMechanic.avatarUrl}
                alt={matchedMechanic.name}
                width={52}
                height={52}
                unoptimized
                className="w-13 h-13 rounded-2xl object-cover border border-slate-200 shadow-sm"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-950 dark:text-white">
                    {matchedMechanic.name}
                  </h3>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold px-2 py-0.5 rounded">
                    Network Mechanic
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Rig: {matchedMechanic.vehicleRig} • Plate: {matchedMechanic.licensePlate}
                </p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Phone: {maskPhoneNumber(matchedMechanic.phone)}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Estimated Arrival
              </div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                ~{request.estimatedArrivalMinutes || 8} mins ({request.mechanicDistanceKm ?? 2.2} km)
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                * Demo travel estimate (without live traffic routing API)
              </div>
            </div>
          </div>

          {/* Engine Explanation Box */}
          {(matchExplanation || request.matchingExplanation) && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <span className="font-bold">Matching Engine Rationale:</span>{" "}
              {matchExplanation || request.matchingExplanation}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="truncate">Destination: {request.location.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Service: {request.serviceType.replace("_", " ").toUpperCase()}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 leading-relaxed">
            <strong>Location Privacy Notice:</strong> Customer location details are transmitted securely over masked coordinates to protect your privacy while waiting on-site.
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              Total Upfront Rate:{" "}
              <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                {formatCurrency(request.estimatedPrice)}
              </span>
            </div>

            <Button
              onClick={handleProceedToTrack}
              variant="emergency"
              size="lg"
              className="w-full sm:w-auto font-bold shadow-md shadow-amber-500/15"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Track Request Status
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
