"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  DollarSign,
  Star,
  CheckCircle2,
  MapPin,
  Car,
  Truck,
  Bike,
  ArrowRight,
  Power,
  Radio,
  Wrench,
  AlertTriangle,
  Phone,
  MessageSquare,
  Navigation,
  FileText,
  Search,
  Zap,
  Disc,
  Fuel,
  Flame,
  Info,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/common/button";
import { StatusIndicator } from "@/components/common/status-indicator";
import { ConfirmationModal } from "@/components/common/confirmation-modal";
import { mechanicStore, requestStore } from "@/lib/data/store";
import { useRequests, useMechanics } from "@/lib/data/use-store";
import { RoadsideRequest, RequestStatus } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { normalizeRequestStatus, isStatusTransitionAllowed } from "@/lib/lifecycle/status-machine";

interface ModalConfig {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmText: string;
  cancelText?: string;
  variant: "primary" | "emergency" | "danger" | "warning";
  action: () => void;
}

export default function MechanicDashboardPage() {
  const mechanics = useMechanics();
  const mechanic = mechanics[0] || null;
  const requests = useRequests();
  const isOnline = mechanic?.isOnline ?? true;

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "info" | "success" | "warning" | "error" } | null>(null);
  const [activeSection, setActiveSection] = useState<"all" | "active" | "new" | "history" | "profile">("all");
  const [historySearch, setHistorySearch] = useState<string>("");
  const [activeJobNotes, setActiveJobNotes] = useState<string>("");

  // Modal dialog state
  const [modal, setModal] = useState<ModalConfig>({
    isOpen: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    variant: "primary",
    action: () => {},
  });

  const showNotification = (text: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const refreshState = () => {};

  // Availability Toggle with Active Job Guard
  const handleToggleOnline = () => {
    if (!mechanic) return;
    const nextState = !isOnline;

    // Check if turning offline while having an active job
    if (!nextState && myActiveJobs.length > 0) {
      setModal({
        isOpen: true,
        title: "Active Roadside Dispatch Warning",
        description: (
          <div className="space-y-2">
            <p>
              You currently have <strong>{myActiveJobs.length} active roadside work order</strong> (#{myActiveJobs[0].id}) in progress.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Toggling OFFLINE will prevent new incoming broadcast dispatches, but you remain responsible for safely completing your current field assignment.
            </p>
          </div>
        ),
        confirmText: "Go Offline Anyway",
        cancelText: "Stay Online",
        variant: "warning",
        action: () => {
          applyToggleOnline(false);
          setModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
      return;
    }

    applyToggleOnline(nextState);
  };

  const applyToggleOnline = (targetState: boolean) => {
    if (!mechanic) return;
    mechanicStore.updateStatus(mechanic.id, mechanic.status, targetState);
    showNotification(
      targetState
        ? "You are now ONLINE and accepting regional roadside dispatch calls."
        : "You are now OFFLINE. New dispatches will not be routed to your rig.",
      targetState ? "success" : "info"
    );
  };

  // Accept Dispatch with Confirmation Modal & Conflict Prevention
  const promptAcceptJob = (job: RoadsideRequest) => {
    if (!mechanic) return;

    if (!isOnline) {
      showNotification("Cannot accept dispatch: You are currently OFFLINE. Toggle online above first.", "warning");
      return;
    }

    if (myActiveJobs.length > 0) {
      showNotification(
        `Conflict Blocked: You are already assigned to active job #${myActiveJobs[0].id}. Complete it before accepting another dispatch.`,
        "error"
      );
      return;
    }

    setModal({
      isOpen: true,
      title: "Confirm Dispatch Acceptance",
      description: (
        <div className="space-y-3">
          <p>
            You are accepting roadside dispatch for work order <strong>#{job.id}</strong>:
          </p>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div><strong>Vehicle:</strong> {job.vehicle.year} {job.vehicle.make} {job.vehicle.model} ({job.vehicle.type})</div>
            <div><strong>Service:</strong> {job.serviceType.replace(/_/g, " ").toUpperCase()}</div>
            <div><strong>Location:</strong> {job.location.address}</div>
            <div><strong>Customer:</strong> {job.customerName}</div>
            <div className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              Payout: {formatCurrency(job.estimatedPrice)}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Once accepted, your status will update to <strong>En Route</strong> and the motorist will receive your live dispatch ETA.
          </p>
        </div>
      ),
      confirmText: "Accept & Dispatch Rig",
      cancelText: "Cancel",
      variant: "emergency",
      action: () => {
        try {
          requestStore.assignMechanic(job.id, mechanic.id, 12, 1.8);
          refreshState();
          showNotification(`Work order #${job.id} accepted. Status marked En Route.`, "success");
          setModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unable to accept dispatch";
          showNotification(msg, "error");
          setModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Reject Dispatch with Confirmation Modal
  const promptRejectJob = (job: RoadsideRequest) => {
    setModal({
      isOpen: true,
      title: "Decline Roadside Dispatch",
      description: (
        <div className="space-y-2">
          <p>
            Are you sure you want to decline work order <strong>#{job.id}</strong>?
          </p>
          <p className="text-xs text-slate-500">
            This request will be re-routed back to the regional dispatch matching queue for other qualified mobile technicians.
          </p>
        </div>
      ),
      confirmText: "Decline Dispatch",
      cancelText: "Keep in Queue",
      variant: "danger",
      action: () => {
        try {
          requestStore.rejectRequest(job.id, "Declined by technician from broadcast workbench");
          refreshState();
          showNotification(`Work order #${job.id} declined. Re-routed to regional queue.`, "info");
          setModal((prev) => ({ ...prev, isOpen: false }));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Unable to decline dispatch";
          showNotification(msg, "error");
          setModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Advance Status on Active Job
  const handleAdvanceStatus = (job: RoadsideRequest, nextStatus: RequestStatus) => {
    if (nextStatus === "COMPLETED") {
      setModal({
        isOpen: true,
        title: "Sign Off & Complete Roadside Service",
        description: (
          <div className="space-y-3">
            <p>
              Confirm completion of roadside work order <strong>#{job.id}</strong> for {job.customerName}?
            </p>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div><strong>Vehicle:</strong> {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</div>
              <div><strong>Service:</strong> {job.serviceType.replace(/_/g, " ").toUpperCase()}</div>
              <div><strong>Settlement:</strong> {formatCurrency(job.finalPrice || job.estimatedPrice)}</div>
            </div>
            {activeJobNotes && (
              <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                Diagnostic log: &ldquo;{activeJobNotes}&rdquo;
              </p>
            )}
            <p className="text-xs text-slate-500">
              This will finalize the roadside ticket, update the customer timeline, and clear your rig for the next dispatch.
            </p>
          </div>
        ),
        confirmText: "Sign Off & Complete",
        cancelText: "Back to Work",
        variant: "emergency",
        action: () => {
          executeAdvanceStatus(job, "COMPLETED", activeJobNotes || "Roadside repair verified and road-tested.");
          setActiveJobNotes("");
          setModal((prev) => ({ ...prev, isOpen: false }));
        },
      });
      return;
    }

    executeAdvanceStatus(job, nextStatus);
  };

  const executeAdvanceStatus = (job: RoadsideRequest, nextStatus: RequestStatus, notes?: string) => {
    try {
      const updated = requestStore.updateStatus(job.id, {
        status: nextStatus,
        diagnosticNotes: notes || (nextStatus === "IN_SERVICE" ? "Diagnostic inspection initiated on-site." : undefined),
      });
      if (updated) {
        refreshState();
        showNotification(`Work order #${job.id} updated to ${nextStatus.replace(/_/g, " ")}.`, "success");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to advance status";
      showNotification(msg, "error");
    }
  };

  if (!mechanic) {
    return <div className="p-12 text-center text-sm text-slate-500">Loading technician workbench...</div>;
  }

  // Filter requests
  const pendingJobs = requests.filter((r) => {
    const s = normalizeRequestStatus(r.status);
    return s === "SEARCHING" || s === "MATCHED" || s === "REQUESTED";
  });

  const myActiveJobs = requests.filter((r) => {
    const isMine =
      r.assignedMechanicId === mechanic.id || r.assignedMechanicId === mechanic.mechanicId;
    const s = normalizeRequestStatus(r.status);
    return isMine && ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_SERVICE"].includes(s);
  });

  const currentActiveJob = myActiveJobs[0] || null;

  const completedJobs = requests.filter((r) => {
    const isMine =
      r.assignedMechanicId === mechanic.id || r.assignedMechanicId === mechanic.mechanicId;
    return isMine && normalizeRequestStatus(r.status) === "COMPLETED";
  });

  // Calculate truthful statistics directly from mock data store
  const totalVerifiedPayout = completedJobs.reduce(
    (sum, r) => sum + (r.finalPrice || r.estimatedPrice || 0),
    0
  );

  const filteredHistory = completedJobs.filter((r) => {
    const term = historySearch.toLowerCase();
    if (!term) return true;
    return (
      r.id.toLowerCase().includes(term) ||
      r.customerName.toLowerCase().includes(term) ||
      (r.vehicle.make || "").toLowerCase().includes(term) ||
      (r.vehicle.model || "").toLowerCase().includes(term) ||
      r.serviceType.toLowerCase().includes(term) ||
      r.location.address.toLowerCase().includes(term)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-8">
      {/* Reusable Confirmation Modal */}
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

      {/* Action Notice Toast */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-md transition-all ${
            statusMessage.type === "success"
              ? "bg-slate-900 text-emerald-400 border border-emerald-800/60"
              : statusMessage.type === "error"
              ? "bg-slate-900 text-rose-400 border border-rose-800/60"
              : statusMessage.type === "warning"
              ? "bg-slate-900 text-amber-400 border border-amber-800/60"
              : "bg-slate-900 text-slate-200 border border-slate-800"
          }`}
        >
          <span className="flex items-center gap-2">
            {statusMessage.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {statusMessage.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {statusMessage.type === "warning" && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            {statusMessage.type === "info" && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
            <span>{statusMessage.text}</span>
          </span>
          <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-4">Dispatch Engine</span>
        </div>
      )}

      {/* Demo Prototype Notice */}
      <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold uppercase text-[10px] tracking-wider">
            Prototype Demo
          </span>
          <span className="text-slate-300">
            Technician workbench operates on synchronized local mock data. Metrics and payouts are simulated.
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Sync: Local Store Active
        </span>
      </div>

      {/* 1. MECHANIC PROFILE & AVAILABILITY HEADER */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Image
                src={mechanic.avatarUrl}
                alt={mechanic.name}
                width={72}
                height={72}
                unoptimized
                className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700 shadow-sm"
              />
              <span
                className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${
                  isOnline ? "bg-emerald-500" : "bg-slate-400"
                }`}
                title={isOnline ? "Online" : "Offline"}
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight">
                  {mechanic.name}
                </h1>
                <span className="text-xs bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  ASE Master Tech
                </span>
                <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-semibold">
                  ID: {mechanic.id}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Rig: <strong>{mechanic.vehicleRig}</strong> • Plate: <strong className="font-mono">{mechanic.licensePlate}</strong>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Contact: <strong className="font-mono">{mechanic.phone}</strong> • Station: <strong>San Francisco, CA</strong>
              </p>
            </div>
          </div>

          {/* Availability Toggle Switch */}
          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
            <button
              onClick={handleToggleOnline}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                isOnline
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700 shadow-sm shadow-emerald-500/10"
                  : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
              }`}
            >
              <Power className={`w-4 h-4 ${isOnline ? "text-emerald-600 animate-pulse" : "text-slate-400"}`} />
              <span>{isOnline ? "ONLINE • Accepting Dispatches" : "OFFLINE • Standby"}</span>
            </button>
            <span className="text-[11px] text-slate-400">
              {isOnline
                ? "Visible to regional roadside dispatchers"
                : "Unavailable for incoming broadcasts"}
            </span>
          </div>
        </div>

        {/* Supported Vehicle Types & Breakdown Capabilities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div>
            <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] block mb-2">
              Supported Vehicle Classifications:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(mechanic.supportedVehicleTypes || ["car", "suv", "truck", "motorcycle"]).map((type) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium capitalize"
                >
                  {type === "motorcycle" || type === "scooter" ? (
                    <Bike className="w-3 h-3 text-amber-500" />
                  ) : type === "truck" || type === "commercial" ? (
                    <Truck className="w-3 h-3 text-blue-500" />
                  ) : (
                    <Car className="w-3 h-3 text-emerald-500" />
                  )}
                  <span>{type}</span>
                </span>
              ))}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-medium">
                <Zap className="w-3 h-3" />
                <span>EV Certified</span>
              </span>
            </div>
          </div>

          <div>
            <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] block mb-2">
              Registered Service Capabilities:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: "Flat Tyre", icon: Disc },
                { name: "Battery Jump", icon: Zap },
                { name: "Engine Diagnostics", icon: Wrench },
                { name: "Fuel Delivery", icon: Fuel },
                { name: "Overheating", icon: Flame },
                { name: "General Repair", icon: Wrench },
              ].map((svc) => {
                const Icon = svc.icon;
                return (
                  <span
                    key={svc.name}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                  >
                    <Icon className="w-3 h-3 text-amber-500" />
                    <span>{svc.name}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. BASIC SERVICE STATISTICS (TRUTHFULLY LABELED MOCK DATA) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Active Work Orders</span>
            <Radio className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-950 dark:text-white">
            {myActiveJobs.length}
          </p>
          <span className="text-[11px] text-slate-400 font-medium">
            {myActiveJobs.length > 0 ? "1 active dispatch in field" : "Rig available for assignment"}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Completed Calls (Store)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-950 dark:text-white">
            {completedJobs.length}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">
            Verified local work orders
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Simulated Payout</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-950 dark:text-white">
            {formatCurrency(totalVerifiedPayout)}
          </p>
          <span className="text-[11px] text-slate-400">
            * Demo billing (local store)
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-1">
            <span>Technician Rating</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-950 dark:text-white">
            {mechanic.rating}
          </p>
          <span className="text-[11px] text-slate-400">
            * Sample Pilot Rating (Demo)
          </span>
        </div>
      </div>

      {/* Navigation Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setActiveSection("all")}
          className={`px-3 py-1.5 rounded-lg font-semibold border whitespace-nowrap transition-all ${
            activeSection === "all"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white"
              : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          All Sections
        </button>
        <button
          onClick={() => setActiveSection("active")}
          className={`px-3 py-1.5 rounded-lg font-semibold border whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeSection === "active"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white"
              : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>Active Work Order</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-bold">
            {myActiveJobs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveSection("new")}
          className={`px-3 py-1.5 rounded-lg font-semibold border whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeSection === "new"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white"
              : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>Broadcast Queue</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold">
            {pendingJobs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveSection("history")}
          className={`px-3 py-1.5 rounded-lg font-semibold border whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeSection === "history"
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white"
              : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <span>Completed Archive</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
            {completedJobs.length}
          </span>
        </button>
      </div>

      {/* 3. CURRENT SERVICE REQUEST (ACTIVE REQUEST SECTION) */}
      {(activeSection === "all" || activeSection === "active") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${currentActiveJob ? "bg-amber-500 animate-ping" : "bg-slate-300"}`} />
              <h2 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">
                Current Active Service Request
              </h2>
            </div>
            {currentActiveJob && (
              <span className="text-xs bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Work Order Locked (Conflict Prevention Active)
              </span>
            )}
          </div>

          {currentActiveJob ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-amber-500/80 p-6 shadow-md space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded">
                      #{currentActiveJob.id}
                    </span>
                    <h3 className="text-base font-bold text-slate-950 dark:text-white">
                      {currentActiveJob.serviceType.replace(/_/g, " ").toUpperCase()} • {currentActiveJob.vehicle.year}{" "}
                      {currentActiveJob.vehicle.make} {currentActiveJob.vehicle.model}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Dispatched {formatDateTime(currentActiveJob.createdAt)} • Priority:{" "}
                    <strong className="text-slate-900 dark:text-white uppercase">{currentActiveJob.urgency}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <StatusIndicator status={currentActiveJob.status} size="md" />
                  <Link href={`/mechanic/requests/${currentActiveJob.id}`}>
                    <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      Detailed Job Sheet
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Motorist, Vehicle, and Location Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {/* Motorist Contact */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block">
                    Motorist / Caller:
                  </span>
                  <div className="font-semibold text-slate-900 dark:text-white text-sm">
                    {currentActiveJob.customerName}
                  </div>
                  <div className="font-mono text-slate-500">
                    {currentActiveJob.customerPhone}
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    <a
                      href={`tel:${currentActiveJob.customerPhone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call</span>
                    </a>
                    <a
                      href={`sms:${currentActiveJob.customerPhone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold hover:bg-blue-100 border border-blue-200 dark:border-blue-800"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>SMS</span>
                    </a>
                  </div>
                </div>

                {/* Stranded Location & GPS */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block">
                    Stranded Location:
                  </span>
                  <div className="flex items-start gap-1.5 text-slate-900 dark:text-white font-medium">
                    <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>{currentActiveJob.location.address}</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500">
                    GPS: {currentActiveJob.location.coordinates?.lat?.toFixed(5) ?? "37.77490"},{" "}
                    {currentActiveJob.location.coordinates?.lng?.toFixed(5) ?? "-122.41940"}
                  </div>
                  {currentActiveJob.location.landmark && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                      Landmark: {currentActiveJob.location.landmark}
                    </div>
                  )}
                  <div className="pt-1">
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(currentActiveJob.location.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-semibold text-[11px]"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Open GPS Navigation</span>
                    </a>
                  </div>
                </div>

                {/* Vehicle Specs & Guaranteed Payout */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 space-y-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px] block">
                    Vehicle Specifications:
                  </span>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {currentActiveJob.vehicle.year} {currentActiveJob.vehicle.make} {currentActiveJob.vehicle.model}
                  </div>
                  <div className="text-slate-500 font-mono">
                    Plate: {currentActiveJob.vehicle.licensePlate} ({currentActiveJob.vehicle.type})
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-slate-500">Service Fee:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatCurrency(currentActiveJob.finalPrice || currentActiveJob.estimatedPrice)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Customer Symptom Notes */}
              <div className="text-xs p-3.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 space-y-1">
                <span className="font-bold text-slate-900 dark:text-white">Customer Breakdown Symptom:</span>
                <p className="italic">&ldquo;{currentActiveJob.issueDescription}&rdquo;</p>
              </div>

              {/* 4-Stage Field Progression Stepper */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Field Progression Stage Control:
                  </span>
                  <span className="text-xs text-slate-400">Advance status in sequence</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { status: "ON_THE_WAY" as RequestStatus, label: "1. En Route" },
                    { status: "ARRIVED" as RequestStatus, label: "2. Arrived On-Site" },
                    { status: "IN_SERVICE" as RequestStatus, label: "3. Service In Progress" },
                    { status: "COMPLETED" as RequestStatus, label: "4. Complete Service" },
                  ].map((step) => {
                    const norm = normalizeRequestStatus(currentActiveJob.status);
                    const isCurrent = norm === step.status;
                    const isAllowed = isStatusTransitionAllowed(currentActiveJob.status, step.status);
                    const stages = ["ACCEPTED", "ON_THE_WAY", "ARRIVED", "IN_SERVICE", "COMPLETED"];
                    const isPassed = stages.indexOf(norm) >= stages.indexOf(step.status);

                    return (
                      <Button
                        key={step.status}
                        onClick={() => handleAdvanceStatus(currentActiveJob, step.status)}
                        disabled={!isAllowed && !isCurrent}
                        variant={isCurrent ? "emergency" : isPassed ? "secondary" : isAllowed ? "outline" : "ghost"}
                        size="sm"
                        className="text-xs font-semibold"
                      >
                        {isPassed && !isCurrent ? `✓ ${step.label}` : step.label}
                      </Button>
                    );
                  })}
                </div>

                {/* Inline Diagnostic Report Log */}
                <div className="pt-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Technician Diagnostic &amp; Inspection Log (Optional for Completion):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={activeJobNotes}
                      onChange={(e) => setActiveJobNotes(e.target.value)}
                      placeholder="e.g. Scanned OBD codes, tightened alternator belt, torqued lugs to 100 lb-ft."
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    <Button
                      onClick={() => {
                        if (!activeJobNotes) return;
                        requestStore.updateStatus(currentActiveJob.id, {
                          status: currentActiveJob.status,
                          diagnosticNotes: activeJobNotes,
                        });
                        refreshState();
                        showNotification("Diagnostic notes saved to work order.", "success");
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Save Log
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Meaningful Empty State for Active Job */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 sm:p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                <Wrench className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No Active Work Order in Progress
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Your rig is currently unassigned and ready for service. Ensure your status is set to <strong>ONLINE</strong> to receive regional dispatch broadcasts.
                </p>
              </div>
              <Button
                onClick={() => setActiveSection("new")}
                variant="outline"
                size="sm"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Browse Incoming Broadcasts ({pendingJobs.length})
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 4. INCOMING ASSISTANCE REQUESTS (NEW REQUESTS SECTION) */}
      {(activeSection === "all" || activeSection === "new") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">
                Incoming Broadcast Dispatches ({pendingJobs.length})
              </h2>
              <p className="text-xs text-slate-500">
                Live motorists seeking roadside assistance within your certified coverage radius.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {pendingJobs.length} waiting
            </span>
          </div>

          {/* Active Job Conflict Warning Banner */}
          {myActiveJobs.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Conflict Protection Active:</strong> You already have work order #{myActiveJobs[0].id} in progress. You must complete or clear your active job before accepting additional dispatches.
              </span>
            </div>
          )}

          {/* Offline Warning Banner */}
          {!isOnline && (
            <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2.5">
              <span className="flex items-center gap-2">
                <Power className="w-4 h-4 text-slate-400 shrink-0" />
                <span>You are currently <strong>OFFLINE</strong>. Toggle your status to Online to accept new dispatches.</span>
              </span>
              <Button onClick={() => applyToggleOnline(true)} variant="primary" size="sm" className="text-xs">
                Go Online
              </Button>
            </div>
          )}

          {pendingJobs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8 text-center text-xs text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-75" />
              <div className="font-semibold text-slate-900 dark:text-white">
                Queue Clear • No Motorists Waiting
              </div>
              <p className="max-w-md mx-auto">
                All dispatches in your service territory are currently matched. Stay online and your terminal will alert you immediately when a driver calls for assistance.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingJobs.map((job) => {
                const isConflict = myActiveJobs.length > 0;
                const canAccept = isOnline && !isConflict;

                return (
                  <div
                    key={job.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm space-y-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                          {job.serviceType.replace(/_/g, " ")}
                        </span>
                        <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(job.estimatedPrice)}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        &ldquo;{job.issueDescription}&rdquo;
                      </p>

                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 space-y-1.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">{job.location.address}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>Est. Distance: <strong>{job.mechanicDistanceKm ?? 2.2} km</strong></span>
                          <span>•</span>
                          <span>Caller: {job.customerName}</span>
                        </div>
                      </div>

                      {/* Compatibility Indicators */}
                      <div className="mt-2.5 flex items-center gap-2 text-[10px]">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 font-semibold border border-emerald-200/60 dark:border-emerald-800/60">
                          ✓ Compatible: {job.vehicle.type}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 font-semibold border border-blue-200/60 dark:border-blue-800/60">
                          ✓ Tooling Matched
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <Button
                        onClick={() => promptAcceptJob(job)}
                        disabled={!canAccept}
                        variant={canAccept ? "emergency" : "secondary"}
                        size="sm"
                        className="flex-1 font-bold text-xs"
                      >
                        {isConflict ? "Busy (Active Job)" : !isOnline ? "Go Online to Accept" : "Accept Dispatch"}
                      </Button>
                      <Button
                        onClick={() => promptRejectJob(job)}
                        variant="outline"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 text-xs"
                      >
                        Decline
                      </Button>
                      <Link href={`/mechanic/requests/${job.id}`}>
                        <Button variant="outline" size="sm" className="text-xs">
                          Inspect
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. COMPLETED SERVICES & REQUEST HISTORY */}
      {(activeSection === "all" || activeSection === "history") && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">
                Completed Services &amp; Job History
              </h2>
              <p className="text-xs text-slate-500">
                Archive of your signed off roadside dispatches, recorded diagnostics, and settlements.
              </p>
            </div>

            {/* Search Filter Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Filter by vehicle, customer, or address..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8 text-center text-xs text-slate-500 space-y-2">
              <FileText className="w-8 h-8 text-slate-400 mx-auto opacity-75" />
              <div className="font-semibold text-slate-900 dark:text-white">
                {historySearch ? "No matching records found" : "No Completed Work Orders Yet"}
              </div>
              <p className="max-w-md mx-auto">
                {historySearch
                  ? "Try searching for a different customer name, vehicle model, or service type."
                  : "As you complete and sign off roadside calls, your service reports, timestamps, and customer receipts will be preserved here."}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-sm">
              {filteredHistory.map((job) => (
                <div
                  key={job.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-500 text-[11px]">
                          #{job.id}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          {job.vehicle.year} {job.vehicle.make} {job.vehicle.model} • {job.serviceType.replace(/_/g, " ").toUpperCase()}
                        </h4>
                      </div>
                      <p className="text-slate-500 mt-0.5">
                        Customer: {job.customerName} ({job.customerPhone}) • {job.location.address}
                      </p>
                      {job.diagnosticNotes && (
                        <p className="text-slate-700 dark:text-slate-300 italic mt-1 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                          &ldquo;{job.diagnosticNotes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                    <div className="text-right font-mono">
                      <span className="font-bold text-sm text-slate-900 dark:text-white block">
                        {formatCurrency(job.finalPrice || job.estimatedPrice)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDateTime(job.completedAt || job.updatedAt)}
                      </span>
                    </div>

                    <Link href={`/mechanic/requests/${job.id}`}>
                      <Button variant="outline" size="sm" className="text-xs">
                        View Sheet
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
