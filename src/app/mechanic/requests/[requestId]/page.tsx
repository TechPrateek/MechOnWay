"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Phone,
  MessageSquare,
  Navigation,
  FileCheck,
} from "lucide-react";
import { Button } from "@/components/common/button";
import { StatusIndicator } from "@/components/common/status-indicator";
import { ConfirmationModal } from "@/components/common/confirmation-modal";
import { requestStore, mechanicStore } from "@/lib/data/store";
import { RoadsideRequest, RequestStatus } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  normalizeRequestStatus,
  isStatusTransitionAllowed,
} from "@/lib/lifecycle/status-machine";
import { RoadsideMapWrapper } from "@/components/map/map-wrapper";

export default function MechanicRequestDetailsPage() {
  const params = useParams<{ requestId: string }>();
  const requestId = params?.requestId;

  const [request, setRequest] = useState<RoadsideRequest | null>(() => {
    if (!requestId) return null;
    return requestStore.getById(requestId) ?? null;
  });
  const [diagnosticText, setDiagnosticText] = useState<string>(() => {
    if (!requestId) return "";
    return requestStore.getById(requestId)?.diagnosticNotes ?? "";
  });
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const currentTech =
    request?.assignedMechanic ||
    (request?.assignedMechanicId ? mechanicStore.getById(request.assignedMechanicId) : null) ||
    mechanicStore.listAll()[0];

  const currentTechCoords = currentTech
    ? {
        lat: currentTech.latitude,
        lng: currentTech.longitude,
      }
    : null;
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    description: React.ReactNode;
    confirmText: string;
    cancelText?: string;
    variant: "primary" | "emergency" | "danger" | "warning";
    action: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    variant: "primary",
    action: () => {},
  });

  const handleUpdateStatus = (newStatus: RequestStatus) => {
    if (!request) return;

    if (newStatus === "COMPLETED") {
      setModal({
        isOpen: true,
        title: "Sign Off & Complete Roadside Service",
        description: (
          <div className="space-y-2">
            <p>
              Are you sure you want to sign off and finalize work order <strong>#{request.id}</strong>?
            </p>
            <p className="text-xs text-slate-500">
              Confirm that repairs are verified roadworthy and diagnostic notes are saved. This settles the dispatch and marks the ticket closed.
            </p>
          </div>
        ),
        confirmText: "Sign Off & Complete",
        cancelText: "Cancel",
        variant: "emergency",
        action: () => {
          applyStatusUpdate("COMPLETED");
          setModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
      return;
    }

    applyStatusUpdate(newStatus);
  };

  const applyStatusUpdate = (newStatus: RequestStatus) => {
    if (!request) return;
    try {
      const updated = requestStore.updateStatus(request.id, {
        status: newStatus,
        diagnosticNotes: diagnosticText || undefined,
      });
      if (updated) {
        setRequest({ ...updated });
        setFeedbackNotice(`Work order updated: marked as ${newStatus.replace(/_/g, " ")}`);
        setTimeout(() => setFeedbackNotice(null), 3500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to transition status";
      setFeedbackNotice(`Action blocked: ${msg}`);
      setTimeout(() => setFeedbackNotice(null), 4000);
    }
  };

  const handleAccept = () => {
    if (!request) return;
    setModal({
      isOpen: true,
      title: "Accept Roadside Dispatch Call",
      description: (
        <div className="space-y-2">
          <p>
            Assign work order <strong>#{request.id}</strong> ({request.vehicle.year} {request.vehicle.make} {request.vehicle.model}) to your mobile rig?
          </p>
          <p className="text-xs text-slate-500">
            Location: {request.location.address}. You will be marked En Route.
          </p>
        </div>
      ),
      confirmText: "Accept Dispatch",
      cancelText: "Cancel",
      variant: "emergency",
      action: () => {
        try {
          const allMechanics = mechanicStore.listAll();
          const tech = allMechanics[0];
          if (!tech) return;
          const updated = requestStore.assignMechanic(request.id, tech.id, 12, 1.8);
          if (updated) {
            setRequest({ ...updated.request });
            setFeedbackNotice("Accepted dispatch. Assigned to your service rig.");
            setTimeout(() => setFeedbackNotice(null), 3500);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unable to accept dispatch";
          setFeedbackNotice(msg);
          setTimeout(() => setFeedbackNotice(null), 3500);
        }
        setModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleReject = () => {
    if (!request) return;
    setModal({
      isOpen: true,
      title: "Decline Roadside Dispatch",
      description: (
        <div className="space-y-2">
          <p>
            Are you sure you want to pass on work order <strong>#{request.id}</strong>?
          </p>
          <p className="text-xs text-slate-500">
            This request will be returned to the regional queue for other qualified mobile technicians.
          </p>
        </div>
      ),
      confirmText: "Decline & Re-route",
      cancelText: "Keep Dispatch",
      variant: "danger",
      action: () => {
        try {
          const updated = requestStore.rejectRequest(request.id, "Declined by technician from job sheet");
          if (updated) {
            setRequest({ ...updated });
            setFeedbackNotice("Declined dispatch. Request re-routed to regional queue.");
            setTimeout(() => setFeedbackNotice(null), 3500);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unable to decline dispatch";
          setFeedbackNotice(msg);
          setTimeout(() => setFeedbackNotice(null), 3500);
        }
        setModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleSaveNotes = (e: React.FormEvent) => {
    e.preventDefault();
    if (!request) return;
    setIsSavingNotes(true);

    const updated = requestStore.updateStatus(request.id, {
      status: request.status,
      diagnosticNotes: diagnosticText,
    });

    setIsSavingNotes(false);
    if (updated) {
      setRequest({ ...updated });
      setFeedbackNotice("Technician diagnostic report saved successfully.");
      setTimeout(() => setFeedbackNotice(null), 3000);
    }
  };

  if (!request) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Job Sheet Not Found
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          Unable to locate roadside request: {requestId}
        </p>
        <Link href="/mechanic">
          <Button variant="primary" className="mt-4">
            Return to Mechanic Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-6">
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={modal.isOpen}
        onClose={() => setModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={modal.action}
        title={modal.title}
        description={modal.description}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        variant={modal.variant}
      />

      {/* Alert toast notice */}
      {feedbackNotice && (
        <div className="p-3.5 rounded-xl bg-slate-900 text-amber-400 text-xs font-semibold flex items-center justify-between shadow-md">
          <span>⚡ {feedbackNotice}</span>
          <span className="text-[11px] text-slate-400">Work Order System</span>
        </div>
      )}

      {/* Top Breadcrumb & Header */}
      <div>
        <Link
          href="/mechanic"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Mechanic Dashboard</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
                Roadside Work Order
              </h1>
              <span className="font-mono text-xs text-slate-600 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md font-bold">
                #{request.id}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Dispatched {formatDateTime(request.createdAt)} • Priority: {request.urgency.toUpperCase()}
            </p>
          </div>

          <StatusIndicator status={request.status} size="md" />
        </div>
      </div>

      {/* WORKFLOW STATUS ACTION CONTROLS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4">
        {(() => {
          const norm = normalizeRequestStatus(request.status);

          if (
            norm === "SEARCHING" ||
            norm === "MATCHED" ||
            norm === "REQUESTED" ||
            norm === "NO_MECHANIC_AVAILABLE"
          ) {
            return (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                    Pending Dispatch Confirmation
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Review motorist breakdown details below, then accept dispatch or decline to re-route.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleAccept}
                    variant="emergency"
                    size="sm"
                    className="font-bold text-xs"
                  >
                    Accept Dispatch
                  </Button>
                  <Button
                    onClick={handleReject}
                    variant="outline"
                    size="sm"
                    className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
                  >
                    Decline &amp; Pass
                  </Button>
                </div>
              </div>
            );
          }

          if (norm === "COMPLETED") {
            return (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <div>
                  <span className="font-bold block text-sm">✓ Work Order Completed &amp; Signed Off</span>
                  <span>All roadside repairs recorded. Direct deposit settlement scheduled automatically.</span>
                </div>
                <span className="px-3 py-1 bg-emerald-500 text-white font-bold text-xs rounded-lg">
                  CLOSED
                </span>
              </div>
            );
          }

          if (norm === "CANCELLED") {
            return (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between">
                <div>
                  <span className="font-bold block text-sm">⚠ Work Order Cancelled</span>
                  <span>Motorist cancelled this roadside ticket. Your rig is freed for incoming dispatches.</span>
                </div>
                <span className="px-3 py-1 bg-rose-600 text-white font-bold text-xs rounded-lg">
                  CANCELLED
                </span>
              </div>
            );
          }

          // Active states: ACCEPTED, ON_THE_WAY, ARRIVED, IN_SERVICE
          const milestones: { status: RequestStatus; label: string; actionLabel: string }[] = [
            { status: "ON_THE_WAY", label: "1. En Route", actionLabel: "Depart (En Route) →" },
            { status: "ARRIVED", label: "2. Arrived On-Site", actionLabel: "Mark Arrived On-Site →" },
            { status: "IN_SERVICE", label: "3. Service In Progress", actionLabel: "Begin Service Repair →" },
            { status: "COMPLETED", label: "4. Sign Off & Complete", actionLabel: "Sign Off & Complete ✓" },
          ];

          const milestoneOrder = ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_SERVICE", "COMPLETED"];
          const currentOrderIdx = milestoneOrder.indexOf(norm);

          const nextMilestone = milestones.find((m) =>
            isStatusTransitionAllowed(request.status, m.status)
          );

          return (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Field Dispatch State Progression
                  </span>
                  <p className="text-xs text-slate-400">
                    Advance each stage sequentially as you service this roadside work order.
                  </p>
                </div>

                {nextMilestone && (
                  <Button
                    onClick={() => handleUpdateStatus(nextMilestone.status)}
                    variant="emergency"
                    size="sm"
                    className="font-bold text-xs shadow-sm shadow-amber-500/10"
                  >
                    Next: {nextMilestone.actionLabel}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {milestones.map((m) => {
                  const mOrderIdx = milestoneOrder.indexOf(m.status);
                  const isCurrent = norm === m.status;
                  const isPassed = currentOrderIdx >= mOrderIdx;
                  const isAllowed = isStatusTransitionAllowed(request.status, m.status);

                  return (
                    <Button
                      key={m.status}
                      onClick={() => handleUpdateStatus(m.status)}
                      disabled={!isAllowed && !isCurrent}
                      variant={
                        isCurrent
                          ? "emergency"
                          : isPassed
                          ? "secondary"
                          : isAllowed
                          ? "outline"
                          : "ghost"
                      }
                      size="sm"
                      className={`text-xs font-semibold ${
                        isPassed && !isCurrent
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          : ""
                      }`}
                    >
                      {isPassed && !isCurrent ? `✓ ${m.label}` : m.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Stranded Location, Vehicle Specs, Customer */}
        <div className="lg:col-span-7 space-y-6">
          {/* Customer & Breakdown Site Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-[11px] uppercase font-bold text-slate-400">
                  Motorist / Caller
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {request.customerName}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={`tel:${request.customerPhone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Customer</span>
                </a>
                <a
                  href={`sms:${request.customerPhone}`}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  title="Text message"
                >
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                </a>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Exact Coordinates & Address:</span>
                <div className="flex items-start gap-2 mt-1 text-slate-900 dark:text-white font-medium">
                  <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{request.location.address}</span>
                </div>
              </div>

              {request.location.landmark && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Landmark Note:
                  </span>{" "}
                  {request.location.landmark}
                </div>
              )}

              {request.location.parkingNotes && (
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 text-amber-950 dark:text-amber-200">
                  <span className="font-semibold">Access / Safety Warning:</span>{" "}
                  {request.location.parkingNotes}
                </div>
              )}

              {/* Interactive OpenStreetMap Site Canvas */}
              <div className="pt-2">
                <RoadsideMapWrapper
                  customerLocation={{
                    address: request.location.address,
                    coordinates: request.location.coordinates,
                    landmark: request.location.landmark,
                  }}
                  mechanicLocation={
                    currentTechCoords
                      ? {
                          name: currentTech.name,
                          vehicleRig: currentTech.vehicleRig,
                          coordinates: currentTechCoords,
                        }
                      : null
                  }
                  showRouteContext={true}
                  height="260px"
                />
              </div>

              <div className="pt-1 flex items-center justify-between">
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(
                    request.location.address
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Open in Mobile GPS (Google Maps)</span>
                </a>

                <span className="text-[11px] font-mono text-slate-500">
                  {request.location.coordinates.lat.toFixed(4)}° N, {request.location.coordinates.lng.toFixed(4)}° W
                </span>
              </div>
            </div>
          </div>

          {/* Vehicle Specifications */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Vehicle Target
            </h3>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <div className="font-bold text-base text-slate-900 dark:text-white">
                  {request.vehicle.year} {request.vehicle.make} {request.vehicle.model}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Plate: {request.vehicle.licensePlate} • Color: {request.vehicle.color}
                </div>
              </div>
              <span className="text-xs font-bold uppercase px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                {request.vehicle.type} {request.vehicle.isEV ? "• EV" : ""}
              </span>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-bold text-slate-900 dark:text-white">
                Customer Breakdown Description:
              </span>
              <p className="mt-1 p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 leading-relaxed">
                &ldquo;{request.issueDescription}&rdquo;
              </p>
            </div>
          </div>

          {/* Diagnostic Report Editor */}
          <form
            onSubmit={handleSaveNotes}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Technician Inspection & Diagnostic Log
              </h3>
              <FileCheck className="w-4 h-4 text-emerald-500" />
            </div>

            <textarea
              rows={4}
              value={diagnosticText}
              onChange={(e) => setDiagnosticText(e.target.value)}
              placeholder="e.g. Scanned OBD codes: P0300 resolved. Lug nuts torqued to OEM specification (129 lb-ft). Battery state of health tested at 82%."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSavingNotes}
              >
                Save Diagnostic Report
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column: Payout, Equipment Checklist, Timeline */}
        <div className="lg:col-span-5 space-y-6">
          {/* Payout Summary */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Payout & Billing
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Base Service Dispatch</span>
                <span className="font-mono font-medium">
                  {formatCurrency(request.estimatedPrice - 15)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Technician Priority Incentive</span>
                <span className="font-mono font-medium">$15.00</span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between font-bold text-sm text-slate-900 dark:text-white">
                <span>Total Payout</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-base">
                  {formatCurrency(request.finalPrice || request.estimatedPrice)}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              Direct deposit will settle automatically into your registered business account upon completion sign-off.
            </div>
          </div>

          {/* Activity Event Log */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Audit Trail
            </h3>

            <div className="space-y-3">
              {request.timeline.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatDateTime(item.timestamp)}
                    </div>
                    <p className="text-slate-500 mt-0.5">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
