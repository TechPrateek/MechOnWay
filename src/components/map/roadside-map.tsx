"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  MapPin,
  Truck,
  AlertTriangle,
  Info,
  List,
  Layers,
  ExternalLink,
} from "lucide-react";
import { GeoPoint } from "@/types";
import { Button } from "@/components/common/button";

export interface RoadsideMapProps {
  customerLocation: {
    address: string;
    coordinates: GeoPoint;
    landmark?: string;
  };
  mechanicLocation?: {
    name: string;
    vehicleRig?: string;
    coordinates: GeoPoint;
  } | null;
  height?: string;
  className?: string;
  showRouteContext?: boolean;
  allowClickToSelect?: boolean;
  onSelectLocation?: (coords: GeoPoint) => void;
}

export function RoadsideMap({
  customerLocation,
  mechanicLocation,
  height = "340px",
  className = "",
  showRouteContext = true,
  allowClickToSelect = false,
  onSelectLocation,
}: RoadsideMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [mapError, setMapError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (viewMode !== "map" || !mapContainerRef.current) return;

    let isMounted = true;

    async function initializeLeaflet() {
      try {
        // Dynamic import of Leaflet on client-side to prevent Next.js SSR crashes
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");

        if (!isMounted || !mapContainerRef.current) return;

        // Clean up any existing map instance on re-render
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const custCoords: [number, number] = [
          customerLocation.coordinates.lat,
          customerLocation.coordinates.lng,
        ];

        // Create map instance
        const map = L.map(mapContainerRef.current, {
          center: custCoords,
          zoom: 14,
          zoomControl: true,
          scrollWheelZoom: false, // Prevent accidental scrolling while browsing page
        });

        mapInstanceRef.current = map;

        // Add OpenStreetMap public tiles (Free, zero paid API keys needed)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        }).addTo(map);

        // Custom Customer Marker (Pulsing Rose Icon)
        const customerIcon = L.divIcon({
          className: "custom-leaflet-customer-marker",
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
              <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(225, 29, 72, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="width: 30px; height: 30px; border-radius: 50%; background: #e11d48; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25); border: 2px solid white;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const custMarker = L.marker(custCoords, { icon: customerIcon }).addTo(map);
        custMarker.bindPopup(
          `<div style="font-size: 12px; font-weight: bold; color: #0f172a;">
            Motorist Breakdown Location
            <div style="font-size: 11px; font-weight: normal; color: #475569; margin-top: 2px;">
              ${customerLocation.address}
            </div>
          </div>`
        );

        // If Mechanic location is present, plot mechanic marker & route polyline
        if (mechanicLocation) {
          const mechCoords: [number, number] = [
            mechanicLocation.coordinates.lat,
            mechanicLocation.coordinates.lng,
          ];

          const mechanicIcon = L.divIcon({
            className: "custom-leaflet-mechanic-marker",
            html: `
              <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
                <div style="width: 30px; height: 30px; border-radius: 50%; background: #f59e0b; color: #0f172a; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25); border: 2px solid white;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                </div>
              </div>
            `,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          });

          const mechMarker = L.marker(mechCoords, { icon: mechanicIcon }).addTo(map);
          mechMarker.bindPopup(
            `<div style="font-size: 12px; font-weight: bold; color: #0f172a;">
              ${mechanicLocation.name}
              <div style="font-size: 11px; font-weight: normal; color: #475569; margin-top: 2px;">
                ${mechanicLocation.vehicleRig || "Rapid Response Rig"}
              </div>
            </div>`
          );

          // Spatial Trajectory Polyline (Dashed Line)
          if (showRouteContext) {
            L.polyline([mechCoords, custCoords], {
              color: "#f59e0b",
              weight: 3,
              dashArray: "6, 8",
              opacity: 0.85,
            }).addTo(map);
          }

          // Fit bounds to show both customer and mechanic comfortably
          map.fitBounds([mechCoords, custCoords], {
            padding: [40, 40],
            maxZoom: 15,
          });
        }

        // Click to pick location (for demo creation mode)
        if (allowClickToSelect && onSelectLocation) {
          map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
            const newLat = parseFloat(e.latlng.lat.toFixed(5));
            const newLng = parseFloat(e.latlng.lng.toFixed(5));
            onSelectLocation({ lat: newLat, lng: newLng });
          });
        }

        setIsLoaded(true);
      } catch (err: unknown) {
        console.error("Leaflet initialization failed:", err);
        setMapError(
          "Unable to render interactive map canvas. Switched to structured location view."
        );
        setViewMode("list");
      }
    }

    initializeLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [
    customerLocation,
    mechanicLocation,
    showRouteContext,
    allowClickToSelect,
    onSelectLocation,
    viewMode,
  ]);

  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm space-y-0 ${className}`}>
      {/* Map Toolbar / Mode Switch */}
      <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
          <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="truncate max-w-[200px] sm:max-w-xs font-semibold">
            {customerLocation.address}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              viewMode === "map"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Interactive Map</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition-all ${
              viewMode === "list"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List Details</span>
          </button>
        </div>
      </div>

      {/* Main Map Viewport */}
      {viewMode === "map" ? (
        <div className="relative">
          {/* Map canvas container */}
          <div
            ref={mapContainerRef}
            style={{ height, minHeight: "260px" }}
            className="w-full z-0 bg-slate-100 dark:bg-slate-800"
          />

          {/* Loading indicator */}
          {!isLoaded && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 dark:bg-slate-800/80 z-10 text-xs text-slate-500 font-medium">
              Loading OpenStreetMap tiles...
            </div>
          )}

          {/* Click to select hint badge */}
          {allowClickToSelect && (
            <div className="absolute top-2 left-2 z-10 bg-slate-900/90 text-white text-[10px] px-2.5 py-1 rounded-md shadow-md backdrop-blur-sm pointer-events-none">
              📍 Click anywhere on map to reposition coordinates
            </div>
          )}
        </div>
      ) : (
        /* Fallback List / Details Card View */
        <div className="p-5 space-y-4 text-xs">
          {mapError && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{mapError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer Location */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span>Motorist Breakdown Location</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                {customerLocation.address}
              </p>
              <div className="font-mono text-[11px] text-slate-400">
                GPS: {customerLocation.coordinates.lat.toFixed(5)}, {customerLocation.coordinates.lng.toFixed(5)}
              </div>
              {customerLocation.landmark && (
                <div className="text-[11px] text-slate-500 italic">
                  Landmark: {customerLocation.landmark}
                </div>
              )}
            </div>

            {/* Mechanic Location (if assigned) */}
            {mechanicLocation ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <Truck className="w-4 h-4 text-amber-500" />
                  <span>Assigned Technician: {mechanicLocation.name}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  Rig: {mechanicLocation.vehicleRig || "Mobile Workshop Unit"}
                </p>
                <div className="font-mono text-[11px] text-slate-400">
                  GPS: {mechanicLocation.coordinates.lat.toFixed(5)}, {mechanicLocation.coordinates.lng.toFixed(5)}
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold">
                  Status: Rig En Route
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 text-center">
                Awaiting technician assignment to plot dispatch coordinates.
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(customerLocation.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Google Maps App</span>
            </a>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setViewMode("map")}
            >
              Return to Map
            </Button>
          </div>
        </div>
      )}

      {/* Mandatory Regulatory & Routing Disclaimer Banner */}
      <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-start gap-2">
        <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <span>
          <strong>Routing Context Notice:</strong> Map shows spatial trajectory context using OpenStreetMap. This is <strong>not a live turn-by-turn traffic route</strong>, and arrival times are demo simulated estimates without live GPS vehicle telemetry.
        </span>
      </div>
    </div>
  );
}
