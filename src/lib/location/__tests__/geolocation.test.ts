import { describe, it, expect } from "vitest";
import {
  validateCoordinates,
  maskCoordinatePrecision,
  formatPrivacyLocation,
  requestBrowserGeolocation,
} from "../geolocation";

describe("Geolocation & Coordinate Validation Utilities", () => {
  it("validates correct geographic coordinates", () => {
    expect(validateCoordinates(37.7749, -122.4194).isValid).toBe(true);
    expect(validateCoordinates(0, 0).isValid).toBe(true);
    expect(validateCoordinates(90, 180).isValid).toBe(true);
    expect(validateCoordinates(-90, -180).isValid).toBe(true);
  });

  it("rejects non-numeric or NaN coordinates", () => {
    expect(validateCoordinates("37.7749", -122.4194).isValid).toBe(false);
    expect(validateCoordinates(NaN, -122.4194).isValid).toBe(false);
    expect(validateCoordinates(37.7749, Infinity).isValid).toBe(false);
    expect(validateCoordinates(undefined, null).isValid).toBe(false);
  });

  it("rejects latitude outside -90 to +90 degrees", () => {
    const high = validateCoordinates(90.001, 10);
    expect(high.isValid).toBe(false);
    expect(high.error).toMatch(/between -90 and 90/);

    const low = validateCoordinates(-90.001, 10);
    expect(low.isValid).toBe(false);
    expect(low.error).toMatch(/between -90 and 90/);
  });

  it("rejects longitude outside -180 to +180 degrees", () => {
    const high = validateCoordinates(45, 180.001);
    expect(high.isValid).toBe(false);
    expect(high.error).toMatch(/between -180 and 180/);

    const low = validateCoordinates(45, -180.001);
    expect(low.isValid).toBe(false);
    expect(low.error).toMatch(/between -180 and 180/);
  });

  it("masks coordinate precision to preserve user privacy", () => {
    const exact = { lat: 37.78449231, lng: -122.40798124 };
    const masked3 = maskCoordinatePrecision(exact, 3);
    expect(masked3.lat).toBe(37.784);
    expect(masked3.lng).toBe(-122.408);

    const masked2 = maskCoordinatePrecision(exact, 2);
    expect(masked2.lat).toBe(37.78);
    expect(masked2.lng).toBe(-122.41);
  });

  it("formats privacy-safe location string for public views", () => {
    const formatted = formatPrivacyLocation(
      "835 Market St, San Francisco, CA 94103",
      { lat: 37.7844, lng: -122.4079 }
    );
    expect(formatted).toContain("San Francisco, CA 94103");
    expect(formatted).toContain("Approx: 37.78°, -122.41°");
  });

  it("handles unsupported environment gracefully when navigator is unavailable", async () => {
    const result = await requestBrowserGeolocation();
    // In node/vitest environment, navigator.geolocation is not available
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorType).toBe("unsupported");
      expect(result.message).toMatch(/not supported/i);
    }
  });
});
