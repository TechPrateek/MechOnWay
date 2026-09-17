"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Truck,
  Phone,
  MessageSquare,
  Car,
  CheckCircle2,
  ArrowLeft,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/common/button";
import { StatusIndicator } from "@/components/common/status-indicator";
import { requestStore, mechanicStore } from "@/lib/data/store";
import { RoadsideRequest, RequestStatus } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { maskPhoneNumber } from "@/lib/matching/engine";
import {
  isStatusTransitionAllowed,
  normalizeRequestStatus,
} from "@/lib/lifecycle/status-machine";
import { RoadsideMapWrapper } from "@/components/map/map-wrapper";

export default function RequestTrackingPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = params?.requestId;

  const [request, setRequest] = useState<RoadsideRequest | null>(() => {
    if (!requestId) return null;
    return requestStore.getById(requestId) ?? null;
  });

  const [etaMinutes, setEtaMinutes] = useState<number>(() => {
    if (!requestId) return 7;
    const req = requestStore.getById(requestId);
    return req?.estimatedArrivalMinutes || 7;
  });

  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);

  // Live countdown simulation
  useEffect(() => {
    if (!request || normalizeRequestStatus(request.status) !== "ON_THE_WAY") return;
    const interval = setInterval(() => {
      setEtaMinutes((prev) => (prev > 1 ? prev - 1 : 1));
    }, 25000);
    return () => clearInterval(interval);
  }, [request]);

  const handleAdvanceStatus = () => {
    if (!request || isAdvancing) return;
    setIsAdvancing(true);

    const currentNorm = normalizeRequestStatus(request.status);
    const flow: Partial<Record<RequestStatus, RequestStatus>> = {
      SEARCHING: "MATCHED",
      MATCHED: "ACCEPTED",
      REQUESTED: "ACCEPTED",
      ACCEPTED: "ON_THE_WAY",
      ON_THE_WAY: "ARRIVED",
      ARRIVED: "IN_SERVICE",
      IN_SERVICE: "COMPLETED",
    };

    const nextStatus = flow[currentNorm];
    if (!nextStatus) {
      setIsAdvancing(false);
      return;
    }

    try {
      const updated = requestStore.updateStatus(request.id, {
        status: nextStatus,
        diagnosticNotes:
          nextStatus === "COMPLETED"
            ? "Roadside assistance signed off. Tested and verified roadworthy."
            : undefined,
      });

      if (updated) {
        setRequest({ ...updated });
        setActionNotice(`Demo status advance: now ${nextStatus.replace(/_/g, " ")}`);
        setTimeout(() => setActionNotice(null), 3500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cannot advance status";
      setActionNotice(`Transition blocked: ${msg}`);
      setTimeout(() => setActionNotice(null), 3500);
    } finally {
      setIsAdvancing(false);
    }
  };

  const canCancel = request ? isStatusTransitionAllowed(request.status, "CANCELLED") : false;

  const handleCancelRequest = () => {
    if (!request) return;
    if (!canCancel) {
      alert("This request cannot be cancelled at this stage.");
      return;
    }
    if (confirm("Are you sure you want to cancel this roadside assistance request?")) {
      try {
        const updated = requestStore.cancelRequest(
          request.id,
          "Cancelled by motorist from live tracking dashboard"
        );
        if (updated) {
          setRequest({ ...updated });
          setActionNotice("Roadside assistance request was successfully cancelled.");
          setTimeout(() => setActionNotice(null), 3500);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Cannot cancel request";
        alert(msg);
      }
    }
  };

  if (!request) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-3">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Request Not Found
        </h2>
        <p className="text-sm text-slate-500">
          Unable to locate roadside request: {requestId}
        </p>
        <Link href="/customer">
          <Button variant="primary" className="mt-4">
            Return to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const stages: { status: RequestStatus; label: string }[] = [
    { status: "ACCEPTED", label: "Accepted" },
    { status: "ON_THE_WAY", label: "En Route" },
    { status: "ARRIVED", label: "Arrived" },
    { status: "IN_SERVICE", label: "In Service" },
    { status: "COMPLETED", label: "Completed" },
  ];

  const normalizedCurrent = normalizeRequestStatus(request.status);
  const currentStageIndex = stages.findIndex((s) => s.status === normalizedCurrent);

  const assignedTech =
    request.assignedMechanic ||
    (request.assignedMechanicId ? mechanicStore.getById(request.assignedMechanicId) : null);

  const mechanic = assignedTech || {
    name: "Elena Rostova",
    phone: "+1 (555) 489-3321",
    avatarUrl:
      "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    rating: 4.98,
    completedJobsCount: 1120,
    vehicleRig: "Chevrolet Silverado EV Rapid Response Unit",
    licensePlate: "EV-9904",
    certifications: ["Automotive Electrical (Demo)", "Roadside Safety Protocol"],
    latitude: request.location.coordinates.lat + 0.018,
    longitude: request.location.coordinates.lng - 0.015,
  };

  const mechanicCoords =
    normalizedCurrent !== "SEARCHING" &&
    normalizedCurrent !== "NO_MECHANIC_AVAILABLE" &&
    normalizedCurrent !== "CANCELLED"
      ? {
          lat: mechanic.latitude ?? request.location.coordinates.lat + 0.018,
          lng: mechanic.longitude ?? request.location.coordinates.lng - 0.015,
        }
      : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-10 space-y-6">
      {/* MVP Prototype Notice */}
      <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold uppercase text-[10px]">
            MVP Tracking Simulation
          </span>
          <span className="text-slate-300 text-[11px]">
            GPS movements and timestamps are simulated for prototype validation.
          </span>
        </div>
      </div>

      {/* Emergency Warning */}
      {request.breakdownCategory === "accident_assistance" && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-xs text-rose-900 dark:text-rose-200">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-950 dark:text-rose-100">
              Accident Emergency Reminder:
            </p>
            <p className="mt-0.5 leading-relaxed">
              If anyone is injured or if traffic is hazardous, immediately notify emergency services (911).
            </p>
          </div>
        </div>
      )}

      {/* Toast Notice */}
      {actionNotice && (
        <div className="p-3 rounded-xl bg-slate-900 text-amber-400 text-xs font-semibold flex items-center justify-between shadow-md">
          <span>⚡ {actionNotice}</span>
          <span className="text-[11px] text-slate-400">Simulation Event</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/customer"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight">
                Roadside Request Tracking
              </h1>
              <span className="font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold">
                #{request.id}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Requested {formatDateTime(request.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusIndicator status={request.status} size="md" />

          {/* Demo Simulation Control to advance stages */}
          {normalizedCurrent !== "COMPLETED" &&
            normalizedCurrent !== "CANCELLED" &&
            normalizedCurrent !== "NO_MECHANIC_AVAILABLE" && (
              <Button
                onClick={handleAdvanceStatus}
                disabled={isAdvancing}
                variant="outline"
                size="sm"
                className="text-xs ml-2 bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300 font-semibold"
              >
                {isAdvancing ? "Updating..." : "Advance Status (Demo) →"}
              </Button>
            )}
        </div>
      </div>

      {/* Stage Stepper */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-5 gap-2">
          {stages.map((stage, idx) => {
            const isDone = currentStageIndex > idx || normalizedCurrent === "COMPLETED";
            const isCurrent = normalizedCurrent === stage.status;
            return (
              <div key={stage.status} className="flex flex-col items-center text-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone
                      ? "bg-emerald-500 text-white"
                      : isCurrent
                      ? "bg-amber-500 text-slate-950 ring-4 ring-amber-500/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <span
                  className={`text-[11px] sm:text-xs font-medium mt-1.5 line-clamp-1 ${
                    isCurrent
                      ? "text-slate-950 dark:text-white font-bold"
                      : isDone
                      ? "text-slate-700 dark:text-slate-300"
                      : "text-slate-400"
                  }`}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Simulated Radar / Map view */}
        <div className="lg:col-span-7 space-y-6">
          {/* Map canvas mockup */}
          {/* Dispatch Telemetry & Live Map */}
          <div className="space-y-3">
            {/* Live ETA / Telemetry Status Header */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                      Live Telemetry &amp; Location
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-sm font-bold text-white">
                    {normalizedCurrent === "ON_THE_WAY"
                      ? `~${etaMinutes} mins estimated arrival (${
                          request.mechanicDistanceKm ? `${request.mechanicDistanceKm.toFixed(1)} km` : "2.2 km"
                        })`
                      : normalizedCurrent === "ARRIVED"
                      ? "Mechanic arrived on-site"
                      : normalizedCurrent === "IN_SERVICE"
                      ? "Service repair in progress"
                      : normalizedCurrent === "COMPLETED"
                      ? "Assistance completed"
                      : normalizedCurrent === "SEARCHING"
                      ? "Searching for nearest qualified unit..."
                      : normalizedCurrent === "ACCEPTED" || normalizedCurrent === "MATCHED"
                      ? "Assigned • Preparing mobile unit"
                      : normalizedCurrent === "NO_MECHANIC_AVAILABLE"
                      ? "No qualified mechanic available in coverage area"
                      : normalizedCurrent === "CANCELLED"
                      ? "Request cancelled by motorist"
                      : "Request completed / closed"}
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">
                  Motorist Coordinates
                </span>
                <span className="font-mono text-xs text-amber-400 font-bold">
                  {request.location.coordinates.lat.toFixed(4)}° N, {request.location.coordinates.lng.toFixed(4)}° W
                </span>
              </div>
            </div>

            {/* Interactive Leaflet Map with OpenStreetMap */}
            <RoadsideMapWrapper
              customerLocation={{
                address: request.location.address,
                coordinates: request.location.coordinates,
                landmark: request.location.landmark,
              }}
              mechanicLocation={
                mechanicCoords
                  ? {
                      name: mechanic.name,
                      vehicleRig: mechanic.vehicleRig,
                      coordinates: mechanicCoords,
                    }
                  : null
              }
              showRouteContext={
                normalizedCurrent === "ON_THE_WAY" ||
                normalizedCurrent === "ARRIVED" ||
                normalizedCurrent === "IN_SERVICE" ||
                normalizedCurrent === "ACCEPTED"
              }
              height="380px"
            />
          </div>

          {/* Timeline Activity Log */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Dispatch Event Log
            </h3>
            <div className="space-y-3">
              {request.timeline.map((ev, i) => (
                <div key={i} className="flex items-start gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {ev.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDateTime(ev.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                      {ev.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Mechanic Profile & Request Details */}
        <div className="lg:col-span-5 space-y-6">
          {/* Selected Mechanic Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <Image
                  src={mechanic.avatarUrl}
                  alt={mechanic.name}
                  width={56}
                  height={56}
                  unoptimized
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-sm"
                />
                <div>
                  <h3 className="font-bold text-base text-slate-950 dark:text-white">
                    {mechanic.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="text-amber-500 font-semibold font-mono">
                      ★ {mechanic.rating} Rating
                    </span>
                    <span>•</span>
                    <span>{mechanic.completedJobsCount} jobs</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <a
                  href={`tel:${mechanic.phone}`}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  title="Call Mechanic"
                >
                  <Phone className="w-4 h-4 text-emerald-600" />
                </a>
                <a
                  href={`sms:${mechanic.phone}`}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                  title="Message Mechanic"
                >
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                </a>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Technician Status:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  Independent Network Partner (Demo)
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Vehicle Rig:</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {mechanic.vehicleRig}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>License Plate:</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">
                  {mechanic.licensePlate}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Contact (Masked):</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">
                  {maskPhoneNumber(mechanic.phone)}
                </span>
              </div>
            </div>

            {request.matchingExplanation && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                <span className="font-bold">Match Rationale:</span> {request.matchingExplanation}
              </div>
            )}

            <div className="text-[10px] text-slate-400 italic">
              * Demo arrival estimate: calculated based on straight-line Haversine distance without live traffic API routing.
            </div>
          </div>

          {/* Vehicle & Reported Breakdown */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Vehicle &amp; Breakdown Issue
              </h3>
              <Car className="w-4 h-4 text-slate-400" />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="font-bold text-sm text-slate-900 dark:text-white capitalize">
                {request.vehicle.type}: {request.vehicle.make} {request.vehicle.model}
              </div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                Breakdown: {request.serviceType.replace("_", " ").toUpperCase()}
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white">
                Symptom Notes:
              </span>{" "}
              {request.issueDescription}
            </div>

            {request.diagnosticNotes && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                <span className="font-bold">Technician Diagnostic:</span> {request.diagnosticNotes}
              </div>
            )}
          </div>

          {/* Locked Quote & Billing */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Upfront Locked Pricing
            </h3>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Base Service ({request.serviceType.replace("_", " ")})</span>
                <span className="font-mono font-medium">
                  {formatCurrency(request.estimatedPrice)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between font-bold text-sm text-slate-900 dark:text-white">
                <span>Total Guaranteed Price</span>
                <span className="font-mono text-base">
                  {formatCurrency(request.finalPrice || request.estimatedPrice)}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {canCancel ? (
                <button
                  type="button"
                  onClick={handleCancelRequest}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold"
                >
                  Cancel Request
                </button>
              ) : normalizedCurrent === "COMPLETED" ? (
                <span className="text-xs text-emerald-600 font-semibold">
                  Service Completed &amp; Locked
                </span>
              ) : normalizedCurrent === "CANCELLED" ? (
                <span className="text-xs text-rose-600 font-semibold">
                  Request Cancelled
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  Work in progress (cancellation locked)
                </span>
              )}

              <Link
                href="/customer"
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-medium"
              >
                Customer Dashboard →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
