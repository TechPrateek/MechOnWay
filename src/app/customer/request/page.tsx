"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Bike,
  Car,
  Truck,
  HelpCircle,
  Wrench,
  Disc,
  Zap,
  Fuel,
  Flame,
  AlertTriangle,
  MapPin,
  LocateFixed,
  Phone,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  AlertCircle,
  Map,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/common/button";
import {
  DEMO_LOCATIONS,
  BREAKDOWN_CATEGORIES_META,
  MOCK_SAVED_VEHICLES,
} from "@/lib/data/mock-data";
import { VehicleType, BreakdownCategory, DemoLocation } from "@/types";
import { createRequestSchema, CreateRequestInput } from "@/lib/validations/request";
import { formatCurrency } from "@/lib/utils";
import { apiClient } from "@/lib/api/client";
import {
  requestBrowserGeolocation,
  validateCoordinates,
} from "@/lib/location/geolocation";
import { RoadsideMapWrapper } from "@/components/map/map-wrapper";

const VEHICLE_OPTIONS: { type: VehicleType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: "motorcycle", label: "Motorcycle", icon: Bike, desc: "Bikes & cruisers" },
  { type: "scooter", label: "Scooter", icon: Bike, desc: "Mopeds & e-scooters" },
  { type: "car", label: "Car", icon: Car, desc: "Sedans, hatchbacks, coupes" },
  { type: "suv", label: "SUV", icon: Car, desc: "Crossovers & 4x4s" },
  { type: "truck", label: "Truck", icon: Truck, desc: "Pickups & light commercial" },
  { type: "other", label: "Other", icon: HelpCircle, desc: "Vans, trailers, EV specialty" },
];

const BREAKDOWN_OPTIONS: {
  type: BreakdownCategory;
  label: string;
  icon: React.ElementType;
  hint: string;
}[] = [
  { type: "engine_problem", label: "Engine problem", icon: Wrench, hint: "Stalling, noises, won't start" },
  { type: "flat_tyre", label: "Flat tyre", icon: Disc, hint: "Punctured, blowout, low pressure" },
  { type: "battery_issue", label: "Battery issue", icon: Zap, hint: "Dead battery, clicking, electrical" },
  { type: "fuel_problem", label: "Fuel problem", icon: Fuel, hint: "Ran out of fuel or EV charge boost" },
  {
    type: "accident_assistance",
    label: "Accident-related assistance",
    icon: AlertTriangle,
    hint: "Collision recovery (Call 911 if injuries)",
  },
  { type: "overheating", label: "Overheating", icon: Flame, hint: "Radiator steam, temp gauge red" },
  { type: "general_repair", label: "General repair", icon: Wrench, hint: "Belts, brakes, rattles, fluids" },
  { type: "other", label: "Other", icon: HelpCircle, hint: "Lockout, stuck in ditch, unknown" },
];

const SERVICE_TO_CATEGORY_MAP: Record<string, BreakdownCategory> = {
  flat_tyre: "flat_tyre",
  flat_tire: "flat_tyre",
  battery_issue: "battery_issue",
  dead_battery: "battery_issue",
  engine_problem: "engine_problem",
  engine_breakdown: "engine_problem",
  fuel_problem: "fuel_problem",
  fuel_delivery: "fuel_problem",
  accident_assistance: "accident_assistance",
  overheating: "overheating",
  general_repair: "general_repair",
  towing: "general_repair",
  lockout: "other",
  stuck_winch: "other",
  other: "other",
};

function RequestFlowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryCategory = searchParams.get("category");
  const queryService = searchParams.get("service");
  const queryLocation = searchParams.get("location");
  const queryVehicleId = searchParams.get("vehicleId");

  // Step state: 1 = Details, 2 = Review & Confirm
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Form states
  const [vehicleType, setVehicleType] = useState<VehicleType>(() => {
    if (queryVehicleId) {
      const saved = MOCK_SAVED_VEHICLES.find((v) => v.id === queryVehicleId);
      if (saved) return saved.type;
    }
    return "car";
  });
  const [vehicleBrandModel, setVehicleBrandModel] = useState<string>(() => {
    if (queryVehicleId) {
      const saved = MOCK_SAVED_VEHICLES.find((v) => v.id === queryVehicleId);
      if (saved) return `${saved.make} ${saved.model} (${saved.year})`;
    }
    return "";
  });

  const [breakdownCategory, setBreakdownCategory] = useState<BreakdownCategory>(() => {
    const raw = queryCategory || queryService;
    if (raw && SERVICE_TO_CATEGORY_MAP[raw]) {
      return SERVICE_TO_CATEGORY_MAP[raw];
    }
    return "flat_tyre";
  });
  const [description, setDescription] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("Alex Mercer");
  const [phoneNumber, setPhoneNumber] = useState<string>("+91 98110 54321");

  // Location state
  const [locationAddress, setLocationAddress] = useState<string>(() => {
    if (queryLocation) {
      try {
        return decodeURIComponent(queryLocation);
      } catch {
        return queryLocation;
      }
    }
    return DEMO_LOCATIONS[0].address;
  });
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number }>({
    lat: DEMO_LOCATIONS[0].lat,
    lng: DEMO_LOCATIONS[0].lng,
  });
  const [selectedDemoId, setSelectedDemoId] = useState<string>(() => {
    return queryLocation ? "" : "loc-1";
  });
  const [landmark, setLandmark] = useState<string>(() => {
    return queryLocation ? "Reported breakdown spot" : DEMO_LOCATIONS[0].landmark;
  });
  const [geoStatus, setGeoStatus] = useState<{
    type: "info" | "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [showMapPreview, setShowMapPreview] = useState<boolean>(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Browser geolocation handler
  const handleUseGeolocation = async () => {
    setIsLocating(true);
    setGeoStatus({
      type: "info",
      message: "Requesting device location permission... Please grant access when prompted.",
    });
    setSelectedDemoId("");

    const res = await requestBrowserGeolocation({ timeoutMs: 8000, highAccuracy: true });
    setIsLocating(false);

    if (res.success) {
      const { lat, lng } = res.coords;
      const validation = validateCoordinates(lat, lng);
      if (!validation.isValid) {
        setGeoStatus({
          type: "error",
          message: validation.error || "Device reported invalid coordinates.",
        });
        return;
      }
      setCoordinates({ lat, lng });
      setLocationAddress(`Device GPS Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      setLandmark(
        res.accuracyMeters
          ? `Device Sensor (±${Math.round(res.accuracyMeters)}m precision)`
          : "Device GPS Sensor"
      );
      setGeoStatus({
        type: "success",
        message: `✓ Device location verified${
          res.accuracyMeters ? ` (accuracy: ±${Math.round(res.accuracyMeters)}m)` : ""
        }.`,
      });
      setTimeout(() => setGeoStatus(null), 5000);
    } else {
      if (res.errorType === "denied") {
        setGeoStatus({
          type: "warning",
          message:
            "Location permission was denied. You can choose a preset demo location below or enter an address.",
        });
      } else if (res.errorType === "timeout") {
        setGeoStatus({
          type: "warning",
          message: "Location request timed out. Retaining current coordinates.",
        });
      } else if (res.errorType === "unsupported") {
        setGeoStatus({
          type: "warning",
          message:
            "Browser geolocation is unsupported in this environment. Please choose a preset demo location.",
        });
      } else {
        setGeoStatus({
          type: "warning",
          message: res.message || "Unable to acquire location. Defaulted to demo coordinates.",
        });
      }
    }
  };

  const handleSelectDemoLocation = (loc: DemoLocation) => {
    const val = validateCoordinates(loc.lat, loc.lng);
    if (!val.isValid) {
      setGeoStatus({
        type: "error",
        message: "Invalid coordinates detected on demo preset.",
      });
      return;
    }
    setSelectedDemoId(loc.id);
    setLocationAddress(loc.address);
    setCoordinates({ lat: loc.lat, lng: loc.lng });
    setLandmark(loc.landmark);
    setGeoStatus({
      type: "info",
      message: `Selected preset demo location: ${loc.name}`,
    });
    setTimeout(() => setGeoStatus(null), 3500);
  };

  // Price calculation
  const meta = BREAKDOWN_CATEGORIES_META[breakdownCategory];
  let calculatedPrice = meta.estimatedBasePrice;
  if (vehicleType === "truck") calculatedPrice += 25;
  if (vehicleType === "suv") calculatedPrice += 10;
  if (vehicleType === "motorcycle" || vehicleType === "scooter") calculatedPrice -= 10;

  // Validate Step 1 before moving to Review
  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate coordinates
    const coordValidation = validateCoordinates(coordinates.lat, coordinates.lng);
    if (!coordValidation.isValid) {
      setErrors({
        locationAddress: coordValidation.error || "Coordinates are invalid.",
      });
      return;
    }

    // Validate with Zod
    const validationResult = createRequestSchema.safeParse({
      customerName,
      customerPhone: phoneNumber,
      breakdownCategory,
      issueDescription: description || `${meta.name} on ${vehicleType}`,
      urgency: breakdownCategory === "accident_assistance" ? "critical_highway" : "standard",
      vehicle: {
        type: vehicleType,
        make: vehicleBrandModel || vehicleType.toUpperCase(),
        model: vehicleBrandModel ? "" : "Vehicle",
      },
      location: {
        address: locationAddress,
        coordinates,
        landmark,
      },
    });

    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      const formatted = validationResult.error.format();

      if (formatted.customerPhone?._errors?.length) {
        fieldErrors.customerPhone = formatted.customerPhone._errors[0];
      }
      if (formatted.issueDescription?._errors?.length) {
        fieldErrors.issueDescription = formatted.issueDescription._errors[0];
      }
      if (formatted.location?.address?._errors?.length) {
        fieldErrors.locationAddress = formatted.location.address._errors[0];
      }
      if (formatted.customerName?._errors?.length) {
        fieldErrors.customerName = formatted.customerName._errors[0];
      }

      setErrors(fieldErrors);
      return;
    }

    setCurrentStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Final Submit
  const handleConfirmSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrors({});

    try {
      const payload: CreateRequestInput = {
        customerId: "cust-" + Date.now().toString().slice(-6),
        customerName,
        customerPhone: phoneNumber,
        serviceType: breakdownCategory,
        breakdownCategory,
        issueDescription: description || `${meta.name} needed for ${vehicleBrandModel || vehicleType}`,
        urgency: breakdownCategory === "accident_assistance" ? "critical_highway" : "standard",
        vehicle: {
          type: vehicleType,
          make: vehicleBrandModel ? vehicleBrandModel.split(" ")[0] : vehicleType.toUpperCase(),
          model: vehicleBrandModel ? vehicleBrandModel.split(" ").slice(1).join(" ") : "Model",
          year: 2022,
          licensePlate: "Pending",
          isEV: false,
        },
        location: {
          address: locationAddress,
          coordinates,
          landmark: landmark || undefined,
          isDemo: !!selectedDemoId,
        },
      };

      const newRequest = await apiClient.requests.create(payload);
      if (!newRequest?.id) {
        throw new Error("No request ID returned from AWS API");
      }

      // Forward to matching radar screen with the real AWS request ID
      router.push(`/customer/matching/${newRequest.id}`);
    } catch (err) {
      console.error("Submission error:", err);
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : "An unexpected error occurred. Please try again.";
      setErrors({ form: msg });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-6">
      {/* Back Button */}
      <div>
        <Link
          href="/customer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>

        {/* Page Title with Step Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white tracking-tight">
              Request Roadside Assistance
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {currentStep === 1
                ? "Step 1 of 2: Vehicle & Breakdown Details"
                : "Step 2 of 2: Review & Confirm Dispatch"}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span
              className={`px-3 py-1 rounded-full ${
                currentStep === 1
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              1. Details
            </span>
            <span className="text-slate-300 dark:text-slate-700">→</span>
            <span
              className={`px-3 py-1 rounded-full ${
                currentStep === 2
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              2. Review
            </span>
          </div>
        </div>
      </div>

      {/* Safety & MVP Notice Banner */}
      <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold uppercase text-[10px]">
            MVP Notice
          </span>
          <span className="text-slate-300 text-[11px]">
            This is an MVP simulator. No real money or towing charges will be applied.
          </span>
        </div>
      </div>

      {/* Accident Safety Warning Banner */}
      {breakdownCategory === "accident_assistance" && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500 text-rose-950 dark:text-rose-100 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-700 dark:text-rose-300">
            <ShieldAlert className="w-5 h-5" />
            <span>Emergency Medical &amp; Police Advisory</span>
          </div>
          <p className="leading-relaxed">
            If there are any injured passengers or immediate traffic hazards, immediately dial <strong>911</strong> before requesting roadside mechanical help.
            MechOnWay is for vehicle towing and mechanical breakdown assistance only.
          </p>
        </div>
      )}

      {/* STEP 1: FORM INPUTS */}
      {currentStep === 1 && (
        <form onSubmit={handleProceedToReview} className="space-y-6">
          {/* SECTION 1: VEHICLE TYPE */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                1. Select Vehicle Type *
              </label>
              <span className="text-xs text-slate-400">Required</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {VEHICLE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = vehicleType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setVehicleType(opt.type)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected
                            ? "bg-amber-500 text-slate-950"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs sm:text-sm">{opt.label}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Optional Brand / Model */}
            <div className="pt-2">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Vehicle Brand / Model <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={vehicleBrandModel}
                onChange={(e) => setVehicleBrandModel(e.target.value)}
                placeholder="e.g. Toyota RAV4, Tesla Model 3, Ford F-150, Honda Activa"
                className="w-full mt-1.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* SECTION 2: BREAKDOWN CATEGORY */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                2. Breakdown Problem *
              </label>
              <span className="text-xs text-slate-400">Select closest match</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {BREAKDOWN_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = breakdownCategory === opt.type;
                const metaInfo = BREAKDOWN_CATEGORIES_META[opt.type];
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setBreakdownCategory(opt.type)}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs sm:text-sm truncate">
                          {opt.label}
                        </span>
                        <span className="text-[11px] font-mono font-semibold text-slate-500">
                          {formatCurrency(metaInfo?.estimatedBasePrice || 50)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {opt.hint}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detailed Description */}
            <div className="pt-2">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Describe What Happened *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.issueDescription) {
                    setErrors({ ...errors, issueDescription: "" });
                  }
                }}
                placeholder="e.g. Engine started clicking loudly and lost all acceleration on the ramp. Hazard lights are on."
                className="w-full mt-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              />
              {errors.issueDescription && (
                <p className="text-xs text-rose-600 mt-1 font-medium">
                  {errors.issueDescription}
                </p>
              )}
            </div>
          </div>

          {/* SECTION 3: LOCATION & GPS */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                3. Stranded Location &amp; Coordinates *
              </label>
              <button
                type="button"
                onClick={handleUseGeolocation}
                disabled={isLocating}
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline disabled:opacity-50"
              >
                <LocateFixed className={`w-3.5 h-3.5 ${isLocating ? "animate-spin text-amber-500" : ""}`} />
                <span>{isLocating ? "Acquiring GPS..." : "Use Browser Geolocation"}</span>
              </button>
            </div>

            {geoStatus && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  geoStatus.type === "success"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                    : geoStatus.type === "error"
                    ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200"
                    : geoStatus.type === "warning"
                    ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                    : "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
                }`}
              >
                {geoStatus.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : geoStatus.type === "error" ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : geoStatus.type === "warning" ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <LocateFixed className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-spin" />
                )}
                <span className="leading-relaxed">{geoStatus.message}</span>
              </div>
            )}

            {/* Demo Locations Selector */}
            <div>
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide block mb-1.5">
                Or select a preset demo location:
              </span>
              <div className="flex flex-wrap gap-2">
                {DEMO_LOCATIONS.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelectDemoLocation(loc)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      selectedDemoId === loc.id
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950 border-slate-900 dark:border-white font-bold"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Address input */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Location Address / Street / Mile Marker *
              </label>
              <div className="relative mt-1">
                <MapPin className="w-4 h-4 text-amber-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={locationAddress}
                  onChange={(e) => {
                    setLocationAddress(e.target.value);
                    setSelectedDemoId("");
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
              </div>
              {errors.locationAddress && (
                <p className="text-xs text-rose-600 mt-1 font-medium">
                  {errors.locationAddress}
                </p>
              )}
            </div>

            {/* Coordinates Display & Map Preview Toggle */}
            <div className="p-3.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-semibold">GPS Coordinates:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold">
                    {coordinates.lat.toFixed(4)}° N, {coordinates.lng.toFixed(4)}° W
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMapPreview((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>{showMapPreview ? "Hide Map Preview" : "Preview on Map (Optional)"}</span>
                  {showMapPreview ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </div>

              {/* Optional Map Preview - OpenStreetMap via Leaflet (Non-mandatory) */}
              {showMapPreview && (
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Click anywhere on the map to adjust your breakdown pin.</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      OpenStreetMap • Free public tiles
                    </span>
                  </div>
                  <RoadsideMapWrapper
                    customerLocation={{
                      address: locationAddress,
                      coordinates,
                      landmark,
                    }}
                    showRouteContext={false}
                    allowClickToSelect={true}
                    onSelectLocation={(newCoords) => {
                      const val = validateCoordinates(newCoords.lat, newCoords.lng);
                      if (val.isValid) {
                        setCoordinates(newCoords);
                        setSelectedDemoId("");
                        setLocationAddress(`Pinned Location (${newCoords.lat.toFixed(4)}, ${newCoords.lng.toFixed(4)})`);
                        setLandmark("Custom Map Pinpoint");
                      }
                    }}
                    height="280px"
                  />
                </div>
              )}
            </div>

            {/* Landmark / Notes */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Landmark or Parking Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Near highway exit sign, hazard lights on"
                className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* SECTION 4: CONTACT INFO */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm space-y-4">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              4. Contact Information *
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full mt-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                />
                {errors.customerName && (
                  <p className="text-xs text-rose-600 mt-1 font-medium">
                    {errors.customerName}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Direct Phone Number *
                </label>
                <div className="relative mt-1">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      if (errors.customerPhone) {
                        setErrors({ ...errors, customerPhone: "" });
                      }
                    }}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-colors"
                  />
                </div>
                {errors.customerPhone && (
                  <p className="text-xs text-rose-600 mt-1 font-medium">
                    {errors.customerPhone}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Form navigation button */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="emergency"
              size="lg"
              className="w-full sm:w-auto px-8 font-bold text-base shadow-md shadow-amber-500/20"
              rightIcon={<ArrowRight className="w-5 h-5" />}
            >
              Review Request Summary
            </Button>
          </div>
        </form>
      )}

      {/* STEP 2: REQUEST REVIEW & SUBMIT */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">
                Review Your Roadside Assistance Request
              </h2>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Edit Details
              </button>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">
                  Vehicle Information
                </span>
                <p className="font-bold text-sm text-slate-900 dark:text-white capitalize">
                  {vehicleType}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  {vehicleBrandModel ? vehicleBrandModel : "No brand/model specified"}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">
                  Breakdown Category
                </span>
                <p className="font-bold text-sm text-slate-900 dark:text-white">
                  {meta.name}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  {meta.tagline}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1 sm:col-span-2">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">
                  Stranded Location &amp; Coordinates
                </span>
                <p className="font-bold text-sm text-slate-900 dark:text-white">
                  {locationAddress}
                </p>
                <div className="text-slate-500 font-mono text-[11px] pt-1">
                  GPS: {coordinates.lat.toFixed(4)}° N, {coordinates.lng.toFixed(4)}° W
                  {landmark ? ` • Landmark: ${landmark}` : ""}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">
                  Customer Contact
                </span>
                <p className="font-bold text-sm text-slate-900 dark:text-white">
                  {customerName}
                </p>
                <p className="text-slate-600 dark:text-slate-400 font-mono">
                  {phoneNumber}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 space-y-1">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">
                  Response Window
                </span>
                <p className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  ~{meta.typicalEtaMinutes} Minutes Typical Arrival
                </p>
                <p className="text-slate-500">Nearest mobile unit dispatched</p>
              </div>
            </div>

            {/* Description quote */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase block mb-1">
                Symptom Notes
              </span>
              <p className="text-xs text-slate-800 dark:text-slate-200 italic">
                &ldquo;{description || `${meta.name} on ${vehicleType}`}&rdquo;
              </p>
            </div>

            {/* Pricing Strip */}
            <div className="p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">
                  Guaranteed Upfront Dispatch Estimate
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-3xl font-black font-mono">
                    {formatCurrency(calculatedPrice)}
                  </span>
                  <span className="text-xs text-slate-400">Fixed rate (MVP Demo)</span>
                </div>
              </div>
              <div className="text-xs text-slate-400 text-left sm:text-right">
                <span>Direct technician matching algorithm</span>
              </div>
            </div>

            {errors.form && (
              <p className="text-xs text-rose-600 font-medium">{errors.form}</p>
            )}

            {/* Final Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setCurrentStep(1)}
                className="w-full sm:w-auto"
              >
                ← Back to Edit
              </Button>

              <Button
                type="button"
                variant="emergency"
                size="lg"
                isLoading={isSubmitting}
                onClick={handleConfirmSubmit}
                className="w-full sm:w-auto px-8 font-bold text-base shadow-lg shadow-amber-500/20"
                rightIcon={<ArrowRight className="w-5 h-5" />}
              >
                Find Nearest Available Mechanic
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RequestPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm text-slate-500">
          Loading assistance form...
        </div>
      }
    >
      <RequestFlowContent />
    </Suspense>
  );
}
