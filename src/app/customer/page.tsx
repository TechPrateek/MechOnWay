"use client";

import React from "react";
import Link from "next/link";
import {
  Car,
  AlertCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Wrench,
  ArrowRight,
  Plus,
  AlertTriangle,
  Zap,
  Disc,
  Fuel,
  Flame,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/common/button";
import { StatusIndicator } from "@/components/common/status-indicator";
import { MOCK_SAVED_VEHICLES, BREAKDOWN_CATEGORIES_META } from "@/lib/data/mock-data";
import { useRequests } from "@/lib/data/use-store";
import { BreakdownCategory } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { normalizeRequestStatus } from "@/lib/lifecycle/status-machine";

const QUICK_CATEGORIES: { type: BreakdownCategory; label: string; icon: React.ElementType }[] = [
  { type: "flat_tyre", label: "Flat Tyre", icon: Disc },
  { type: "battery_issue", label: "Battery Issue", icon: Zap },
  { type: "engine_problem", label: "Engine Problem", icon: Wrench },
  { type: "fuel_problem", label: "Fuel Delivery", icon: Fuel },
  { type: "overheating", label: "Overheating", icon: Flame },
  { type: "accident_assistance", label: "Accident Recovery", icon: AlertTriangle },
  { type: "general_repair", label: "General Repair", icon: Wrench },
  { type: "other", label: "Other Problem", icon: HelpCircle },
];

export default function CustomerDashboardPage() {
  const requests = useRequests();

  const activeRequest = requests.find((r) => {
    const s = normalizeRequestStatus(r.status);
    return [
      "SEARCHING",
      "MATCHED",
      "REQUESTED",
      "ACCEPTED",
      "ON_THE_WAY",
      "ARRIVED",
      "IN_SERVICE",
    ].includes(s);
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-8">
      {/* MVP NOTICE & SAFETY ADVISORY */}
      <div className="space-y-3">
        {/* MVP Prototype Badge Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-bold uppercase text-[10px] tracking-wider">
              MVP Prototype
            </span>
            <span className="text-slate-300">
              MechOnWay is currently in local pilot mode with mock dispatch telemetry.
            </span>
          </div>
          <span className="text-slate-400 text-[11px] font-mono shrink-0">
            Local Store Active
          </span>
        </div>

        {/* Critical Emergency Warning */}
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex items-start gap-3 text-xs text-rose-900 dark:text-rose-200">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-rose-950 dark:text-rose-100">
              Life Safety &amp; Highway Emergency Notice:
            </p>
            <p className="leading-relaxed text-rose-800 dark:text-rose-300">
              If you or anyone in your vehicle is injured, or if you are stopped in an active high-speed highway lane, 
              immediately call <strong>911 / Emergency Services</strong>. MechOnWay provides non-emergency mechanical roadside 
              assistance only.
            </p>
          </div>
        </div>
      </div>

      {/* CUSTOMER HEADER & MAIN CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
              Customer Dashboard
            </h1>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              Active Session
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Alex Mercer • +1 (555) 301-4491 • Default Location: San Francisco, CA
          </p>
        </div>

        <Link href="/customer/request">
          <Button
            variant="emergency"
            size="lg"
            leftIcon={<AlertCircle className="w-5 h-5" />}
            className="shadow-md shadow-amber-500/15 font-bold text-sm sm:text-base w-full sm:w-auto"
          >
            Request Roadside Assistance
          </Button>
        </Link>
      </div>

      {/* ACTIVE REQUEST CARD */}
      {activeRequest ? (
        <div className="rounded-2xl border-2 border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-600" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-950 dark:text-white">
                    Active Roadside Request #{activeRequest.id}
                  </h2>
                  <span className="text-[11px] font-mono bg-amber-500/20 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded font-bold uppercase">
                    {activeRequest.serviceType.replace("_", " ")}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  {activeRequest.vehicle.make} {activeRequest.vehicle.model} ({activeRequest.vehicle.type}) • Reported {formatDateTime(activeRequest.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusIndicator status={activeRequest.status} size="sm" />
              <Link href={`/customer/track/${activeRequest.id}`}>
                <Button
                  variant="emergency"
                  size="sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Track Dispatch
                </Button>
              </Link>
            </div>
          </div>

          <div className="pt-3 border-t border-amber-200/60 dark:border-amber-800/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="truncate">{activeRequest.location.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {activeRequest.estimatedArrivalMinutes
                  ? `~${activeRequest.estimatedArrivalMinutes} min ETA (Distance: ${activeRequest.mechanicDistanceKm ?? 2.2} km)`
                  : "Scanning nearby mechanics"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                Upfront Locked Quote: {formatCurrency(activeRequest.estimatedPrice)}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state for active request */
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-8 text-center bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 mx-auto flex items-center justify-center">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              No Active Dispatches
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Your vehicles are clear. When an unexpected flat, battery failure, or engine trouble occurs, click below for rapid assistance.
            </p>
          </div>
          <Link href="/customer/request">
            <Button variant="outline" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Create New Roadside Request
            </Button>
          </Link>
        </div>
      )}

      {/* FAST REQUEST BY BREAKDOWN CATEGORY CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">
              Breakdown Categories
            </h2>
            <p className="text-xs text-slate-500">
              Select your issue for pre-configured diagnostic equipment dispatch.
            </p>
          </div>
          <Link
            href="/customer/request"
            className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
          >
            <span>Custom request form</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const meta = BREAKDOWN_CATEGORIES_META[cat.type];
            return (
              <Link
                key={cat.type}
                href={`/customer/request?category=${cat.type}`}
                className="group p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-sm transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-700 dark:text-slate-300 flex items-center justify-center mb-3 transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {cat.label}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                    {meta?.tagline}
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Est. from</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(meta?.estimatedBasePrice || 50)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* SAVED VEHICLES SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">
              My Registered Vehicles
            </h2>
            <p className="text-xs text-slate-500">
              Select a vehicle to auto-populate compatibility parameters during breakdown.
            </p>
          </div>
          <Link href="/customer/request">
            <Button variant="outline" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Add Vehicle
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MOCK_SAVED_VEHICLES.map((veh) => (
            <div
              key={veh.id}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
                    <Car className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {veh.type} {veh.isEV ? "• EV" : ""}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {veh.year} {veh.make} {veh.model}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Plate: {veh.licensePlate} • {veh.color}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href={`/customer/request?vehicleId=${veh.id}`}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1"
                >
                  <span>Dispatch help for this vehicle</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RECENT ASSISTANCE REQUESTS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">
              Assistance History
            </h2>
            <p className="text-xs text-slate-500">
              Recent roadside tickets, technician diagnostics, and receipts.
            </p>
          </div>
          <Link
            href="/history"
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-950 flex items-center gap-1"
          >
            <span>View all ({requests.length})</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8 text-center text-slate-500 text-xs">
            No service history yet. Your completed requests and invoices will appear here.
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden shadow-sm">
            {requests.slice(0, 4).map((req) => (
              <div
                key={req.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 shrink-0 mt-0.5">
                    <Wrench className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {req.serviceType.replace("_", " ").toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500 font-medium">
                        {req.vehicle.year} {req.vehicle.make} {req.vehicle.model}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {req.location.address}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      {formatDateTime(req.createdAt)} • #{req.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(req.finalPrice || req.estimatedPrice)}
                    </div>
                    <StatusIndicator status={req.status} size="sm" />
                  </div>

                  <Link href={`/customer/track/${req.id}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
