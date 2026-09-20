"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Disc,
  Zap,
  Wrench,
  Truck,
  Fuel,
  Key,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Clock,
  LocateFixed,
} from "lucide-react";
import { SERVICE_METAS } from "@/lib/data/mock-data";
import { ServiceType } from "@/types";
import { Button } from "@/components/common/button";
import { formatCurrency } from "@/lib/utils";

const ISSUE_OPTIONS: { type: ServiceType; label: string; icon: React.ElementType }[] = [
  { type: "flat_tire", label: "Flat Tire", icon: Disc },
  { type: "dead_battery", label: "Dead Battery", icon: Zap },
  { type: "engine_breakdown", label: "Engine / Stalled", icon: Wrench },
  { type: "towing", label: "Towing", icon: Truck },
  { type: "lockout", label: "Lockout", icon: Key },
  { type: "fuel_delivery", label: "Fuel / EV Boost", icon: Fuel },
];

export function QuickDispatchWidget() {
  const router = useRouter();
  const [selectedService, setSelectedService] = useState<ServiceType>("flat_tire");
  const [locationInput, setLocationInput] = useState("Pari Chowk, Greater Noida, UP");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const activeMeta = SERVICE_METAS[selectedService];

  const handleUseCurrentLocation = () => {
    setIsDetectingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {
          setIsDetectingLocation(false);
          setLocationInput("Current Location (28.4744, 77.5040 - Pari Chowk)");
        },
        () => {
          setIsDetectingLocation(false);
          setLocationInput("Current Location (GPS Pinpoint Greater Noida)");
        },
        { timeout: 3000 }
      );
    } else {
      setTimeout(() => {
        setIsDetectingLocation(false);
        setLocationInput("Current GPS Location (Simulated)");
      }, 600);
    }
  };

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = new URLSearchParams({
      service: selectedService,
      location: locationInput,
    });
    router.push(`/customer/request?${query.toString()}`);
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-900/5 overflow-hidden">
      {/* Header bar */}
      <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Instant Roadside Dispatch
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Priority Queue Active</span>
        </div>
      </div>

      <form onSubmit={handleDispatch} className="p-5 sm:p-6 space-y-5">
        {/* Step 1: Select Issue */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            1. What happened to your vehicle?
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ISSUE_OPTIONS.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedService === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => setSelectedService(item.type)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "border-amber-500 bg-amber-50/80 text-amber-950 font-semibold shadow-sm dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium leading-tight">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Location Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              2. Where is your vehicle stranded?
            </label>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isDetectingLocation}
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline disabled:opacity-50"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              <span>{isDetectingLocation ? "Locating..." : "Use Current GPS"}</span>
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <MapPin className="w-4 h-4 text-amber-500" />
            </div>
            <input
              type="text"
              required
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="Street address, highway exit, or landmark..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        {/* Upfront Estimate Strip */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Estimated Response
              </p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                ~{activeMeta.typicalEtaMinutes} minutes (Live)
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Upfront Base Rate
            </p>
            <p className="text-base font-bold text-slate-900 dark:text-white font-mono">
              {formatCurrency(activeMeta.estimatedBasePrice)}
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="emergency"
          size="lg"
          className="w-full text-base font-bold shadow-md shadow-amber-500/10"
          rightIcon={<ArrowRight className="w-5 h-5" />}
        >
          Find Nearest Available Mechanic
        </Button>

        <p className="text-center text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2">
          <span>✓ No subscription required</span>
          <span>•</span>
          <span>✓ Guaranteed upfront pricing</span>
          <span>•</span>
          <span>✓ 100% Insured</span>
        </p>
      </form>
    </div>
  );
}
