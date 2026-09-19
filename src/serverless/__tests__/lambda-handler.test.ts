import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { handler } from "../lambda-handler";
import { setRepositoryOverrides } from "../../lib/repositories";
import { LocalRequestRepository, LocalMechanicRepository } from "../../lib/repositories/local-repository";

describe("Serverless Lambda Handler (SAM Local Flow)", () => {
  let testDataDir: string;
  let reqRepo: LocalRequestRepository;
  let mechRepo: LocalMechanicRepository;

  beforeEach(async () => {
    testDataDir = path.join(
      os.tmpdir(),
      `mechonway-lambda-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(testDataDir, { recursive: true });

    reqRepo = new LocalRequestRepository(testDataDir);
    mechRepo = new LocalMechanicRepository(testDataDir);
    setRepositoryOverrides({
      requestRepo: reqRepo,
      mechanicRepo: mechRepo,
    });
  });

  afterEach(async () => {
    setRepositoryOverrides({
      requestRepo: null,
      mechanicRepo: null,
    });
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {});
  });

  it("executes the complete request lifecycle across separate calls", async () => {
    // ----------------------------------------------------
    // Step 1: POST /api/requests
    // ----------------------------------------------------
    const createPayload = {
      customerName: "Prateek Yadav",
      customerPhone: "+919876543210",
      breakdownCategory: "flat_tyre",
      issueDescription: "Flat tyre near the city center",
      vehicle: {
        type: "car",
        make: "Maruti",
        model: "Swift",
        year: 2022,
      },
      location: {
        address: "City Center",
        coordinates: {
          lat: 37.7749,
          lng: -122.4194,
        },
        landmark: "Main Road",
      },
    };

    const postResponse = await handler({
      httpMethod: "POST",
      rawPath: "/api/requests",
      body: JSON.stringify(createPayload),
    });

    expect(postResponse.statusCode).toBe(201);
    const postBody = JSON.parse(postResponse.body);
    expect(postBody.success).toBe(true);
    expect(postBody.data).toBeDefined();

    const createdId = postBody.data.id;
    expect(createdId).toMatch(/^req-/);
    expect(postBody.data.customerName).toBe("Prateek Yadav");
    expect(postBody.data.status).toBe("SEARCHING");

    // ----------------------------------------------------
    // Step 2: GET /api/requests (Verify ID is included)
    // ----------------------------------------------------
    const listResponse = await handler({
      httpMethod: "GET",
      rawPath: "/api/requests",
    });

    expect(listResponse.statusCode).toBe(200);
    const listBody = JSON.parse(listResponse.body);
    expect(listBody.success).toBe(true);
    const foundInList = listBody.data.find((r: { id: string }) => r.id === createdId);
    expect(foundInList).toBeDefined();

    // ----------------------------------------------------
    // Step 3: GET /api/requests/{createdId}
    // ----------------------------------------------------
    const getResponse = await handler({
      httpMethod: "GET",
      rawPath: `/api/requests/${createdId}`,
    });

    expect(getResponse.statusCode).toBe(200);
    const getBody = JSON.parse(getResponse.body);
    expect(getBody.success).toBe(true);
    expect(getBody.data.id).toBe(createdId);
    expect(getBody.data.customerName).toBe("Prateek Yadav");
    expect(getBody.data.vehicle.make).toBe("Maruti");

    // ----------------------------------------------------
    // Step 4: POST /api/requests/match
    // ----------------------------------------------------
    const matchResponse = await handler({
      httpMethod: "POST",
      rawPath: "/api/requests/match",
      body: JSON.stringify({ requestId: createdId }),
    });

    expect(matchResponse.statusCode).toBe(200);
    const matchBody = JSON.parse(matchResponse.body);
    expect(matchBody.success).toBe(true);
    expect(matchBody.data.request.id).toBe(createdId);
    expect(matchBody.data.request.status).toBe("ON_THE_WAY");
    expect(matchBody.data.mechanic).toBeDefined();
    expect(matchBody.data.distanceKm).toBeGreaterThanOrEqual(0);

    // ----------------------------------------------------
    // Step 5: PATCH /api/requests/{createdId} (mark arrived)
    // ----------------------------------------------------
    const patchResponse = await handler({
      httpMethod: "PATCH",
      rawPath: `/api/requests/${createdId}`,
      body: JSON.stringify({
        status: "ARRIVED",
        diagnosticNotes: "Arrived at roadside vehicle location",
      }),
    });

    expect(patchResponse.statusCode).toBe(200);
    const patchBody = JSON.parse(patchResponse.body);
    expect(patchBody.success).toBe(true);
    expect(patchBody.data.status).toBe("ARRIVED");

    // ----------------------------------------------------
    // Step 6: GET /api/requests/{createdId} (verify arrived status)
    // ----------------------------------------------------
    const verifyResponse = await handler({
      httpMethod: "GET",
      rawPath: `/api/requests/${createdId}`,
    });

    expect(verifyResponse.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyResponse.body);
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.data.status).toBe("ARRIVED");
    expect(verifyBody.data.timeline.length).toBeGreaterThanOrEqual(4);
  });
});
