import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import fs from "fs/promises";
import { LocalRequestRepository, LocalMechanicRepository } from "../local-repository";
import { RoadsideRequest } from "@/types";

describe("Filesystem-backed Local Repositories", () => {
  let testDataDir: string;
  let reqRepo: LocalRequestRepository;
  let mechRepo: LocalMechanicRepository;

  beforeEach(async () => {
    // Isolated temporary directory per test suite run
    testDataDir = path.join(
      os.tmpdir(),
      `mechonway-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(testDataDir, { recursive: true });
    reqRepo = new LocalRequestRepository(testDataDir);
    mechRepo = new LocalMechanicRepository(testDataDir);
  });

  afterEach(async () => {
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {});
  });

  describe("Automatic Initialization & Seed Data", () => {
    it("automatically creates requests.json with seeded mock requests if file is absent", async () => {
      const requests = await reqRepo.listAll();
      expect(requests.length).toBeGreaterThan(0);

      // Verify the file was physically written to disk
      const filePath = path.join(testDataDir, "requests.json");
      const stat = await fs.stat(filePath);
      expect(stat.isFile()).toBe(true);

      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(requests.length);
    });

    it("automatically creates mechanics.json with seeded mock mechanics if file is absent", async () => {
      const mechanics = await mechRepo.listAll();
      expect(mechanics.length).toBeGreaterThan(0);

      const filePath = path.join(testDataDir, "mechanics.json");
      const stat = await fs.stat(filePath);
      expect(stat.isFile()).toBe(true);
    });

    it("gracefully recovers and reseeds when JSON file contains empty or corrupted data", async () => {
      const filePath = path.join(testDataDir, "requests.json");
      await fs.writeFile(filePath, "{ corrupt json ... invalid syntax", "utf-8");

      const requests = await reqRepo.listAll();
      expect(requests.length).toBeGreaterThan(0);
    });
  });

  describe("Cross-Invocation Persistence (Simulating Separate Lambda Invocations)", () => {
    it("retrieves a newly created request from a brand-new repository instance", async () => {
      const sampleRequest: RoadsideRequest = {
        id: "req-test-persist-101",
        customerId: "cust-test",
        customerName: "Prateek Yadav",
        customerPhone: "+919876543210",
        vehicle: {
          type: "car",
          make: "Maruti",
          model: "Swift",
          year: 2022,
        },
        serviceType: "flat_tyre",
        breakdownCategory: "flat_tyre",
        issueDescription: "Flat tyre near the city center",
        urgency: "standard",
        location: {
          address: "City Center",
          coordinates: { lat: 37.7749, lng: -122.4194 },
          landmark: "Main Road",
        },
        status: "SEARCHING",
        estimatedPrice: 65,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [
          {
            status: "SEARCHING",
            timestamp: new Date().toISOString(),
            title: "Roadside Assistance Requested",
            description: "Logged assistance call",
          },
        ],
      };

      // 1. Invocation A creates the request
      await reqRepo.create(sampleRequest);

      // 2. Invocation B initializes a completely separate repository instance in a different memory context
      const separateInvocationRepo = new LocalRequestRepository(testDataDir);

      // 3. Invocation B must find the exact same request by ID
      const retrieved = await separateInvocationRepo.getById("req-test-persist-101");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe("req-test-persist-101");
      expect(retrieved?.customerName).toBe("Prateek Yadav");
      expect(retrieved?.status).toBe("SEARCHING");

      // 4. Invocation B must include the new request in listAll()
      const all = await separateInvocationRepo.listAll();
      const foundInList = all.find((r) => r.id === "req-test-persist-101");
      expect(foundInList).toBeDefined();
    });

    it("persists status updates across separate repository instances", async () => {
      const sampleRequest: RoadsideRequest = {
        id: "req-test-update-202",
        customerId: "cust-test",
        customerName: "Alice Smith",
        customerPhone: "+15551234567",
        vehicle: { type: "car" },
        serviceType: "battery_issue",
        breakdownCategory: "battery_issue",
        issueDescription: "Battery dead",
        urgency: "standard",
        location: {
          address: "Pine St",
          coordinates: { lat: 37.78, lng: -122.41 },
        },
        status: "SEARCHING",
        estimatedPrice: 75,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [],
      };

      await reqRepo.create(sampleRequest);

      // Update in Invocation A
      const updatedData: RoadsideRequest = {
        ...sampleRequest,
        status: "ON_THE_WAY",
        assignedMechanicId: "mech-01",
        updatedAt: new Date().toISOString(),
      };
      await reqRepo.update(updatedData);

      // Read from Invocation B
      const invocationB = new LocalRequestRepository(testDataDir);
      const fetched = await invocationB.getById("req-test-update-202");
      expect(fetched?.status).toBe("ON_THE_WAY");
      expect(fetched?.assignedMechanicId).toBe("mech-01");
    });
  });

  describe("Mechanic Status Persistence", () => {
    it("persists mechanic status changes across separate instances", async () => {
      const mechanics = await mechRepo.listAll();
      const targetMechanic = mechanics[0];
      const targetId = targetMechanic.mechanicId || targetMechanic.id;

      // Update mechanic to en_route
      const updated = await mechRepo.updateStatus(targetId, "en_route", true);
      expect(updated).not.toBeNull();
      expect(updated?.status).toBe("en_route");
      expect(updated?.currentStatus).toBe("en_route");

      // Verify separate instance reads the updated mechanic status
      const separateMechRepo = new LocalMechanicRepository(testDataDir);
      const retrieved = await separateMechRepo.getById(targetId);
      expect(retrieved?.status).toBe("en_route");
      expect(retrieved?.currentStatus).toBe("en_route");
    });
  });
});
