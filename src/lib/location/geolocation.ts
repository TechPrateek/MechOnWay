import { GeoPoint } from "@/types";

export type GeolocationResult =
  | {
      success: true;
      coords: GeoPoint;
      accuracyMeters?: number;
      timestamp: number;
    }
  | {
      success: false;
      errorType: "unsupported" | "denied" | "unavailable" | "timeout" | "unknown";
      message: string;
    };

/**
 * Validates whether latitude and longitude are valid geographical coordinates.
 * Latitude must be between -90 and +90.
 * Longitude must be between -180 and +180.
 */
export function validateCoordinates(
  lat: unknown,
  lng: unknown
): { isValid: boolean; error?: string } {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return {
      isValid: false,
      error: "Coordinates must be numeric values.",
    };
  }

  if (Number.isNaN(lat) || Number.isNaN(lng) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      isValid: false,
      error: "Coordinates must be finite, non-NaN numbers.",
    };
  }

  if (lat < -90 || lat > 90) {
    return {
      isValid: false,
      error: `Latitude (${lat}) must be between -90 and 90 degrees.`,
    };
  }

  if (lng < -180 || lng > 180) {
    return {
      isValid: false,
      error: `Longitude (${lng}) must be between -180 and 180 degrees.`,
    };
  }

  return { isValid: true };
}

/**
 * Masks coordinate precision to prevent exposing sensitive exact physical locations unnecessarily.
 * Truncating to 3 decimal places gives ~110m resolution (neighborhood block level).
 */
export function maskCoordinatePrecision(
  coords: GeoPoint,
  decimals = 3
): GeoPoint {
  const factor = Math.pow(10, decimals);
  return {
    lat: Math.round(coords.lat * factor) / factor,
    lng: Math.round(coords.lng * factor) / factor,
  };
}

/**
 * Formats a privacy-safe location string for public/unauthorized views.
 */
export function formatPrivacyLocation(address: string, coords: GeoPoint): string {
  const masked = maskCoordinatePrecision(coords, 2);
  const cityState = address.split(",").slice(-2).join(",").trim();
  return `${cityState || "Regional Zone"} (Approx: ${masked.lat.toFixed(2)}°, ${masked.lng.toFixed(2)}°)`;
}

/**
 * Requests device GPS geolocation permission via browser navigator API.
 * Handles permission denial, timeout, and unsupported browsers gracefully.
 */
export async function requestBrowserGeolocation(options?: {
  timeoutMs?: number;
  highAccuracy?: boolean;
}): Promise<GeolocationResult> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return {
      success: false,
      errorType: "unsupported",
      message:
        "Browser geolocation is not supported by your current browser. You can choose a demo location instead.",
    };
  }

  const timeout = options?.timeoutMs ?? 8000;
  const enableHighAccuracy = options?.highAccuracy ?? true;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const rawLat = position.coords.latitude;
        const rawLng = position.coords.longitude;
        const validation = validateCoordinates(rawLat, rawLng);

        if (!validation.isValid) {
          resolve({
            success: false,
            errorType: "unavailable",
            message: `Received invalid GPS coordinates from browser: ${validation.error}`,
          });
          return;
        }

        resolve({
          success: true,
          coords: {
            lat: parseFloat(rawLat.toFixed(5)),
            lng: parseFloat(rawLng.toFixed(5)),
          },
          accuracyMeters: Math.round(position.coords.accuracy),
          timestamp: position.timestamp,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            resolve({
              success: false,
              errorType: "denied",
              message:
                "Location permission was denied. You can select a pre-configured demo location or enter your address manually.",
            });
            break;
          case error.POSITION_UNAVAILABLE:
            resolve({
              success: false,
              errorType: "unavailable",
              message:
                "GPS satellite signal is unavailable at your location. Please select a demo location.",
            });
            break;
          case error.TIMEOUT:
            resolve({
              success: false,
              errorType: "timeout",
              message:
                "Location request timed out. Please select a demo location or try again.",
            });
            break;
          default:
            resolve({
              success: false,
              errorType: "unknown",
              message:
                "An unexpected error occurred while querying your device GPS sensor.",
            });
        }
      },
      {
        timeout,
        enableHighAccuracy,
        maximumAge: 30000,
      }
    );
  });
}
