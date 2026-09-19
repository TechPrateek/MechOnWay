import fs from "fs/promises";
import path from "path";
import os from "os";
import { Mechanic, MechanicStatus, RoadsideRequest } from "@/types";
import { IMechanicRepository, IRequestRepository } from "./types";
import { MOCK_MECHANICS, MOCK_REQUESTS } from "../data/mock-data";

/**
 * Resolves the persistent local data directory across different runtime environments:
 * 1. Explicit override directory (e.g. from constructor or test fixtures)
 * 2. Explicit LOCAL_DATA_DIR environment variable
 * 3. AWS Lambda / SAM local container: /tmp/mechonway-data (the only writable directory in Lambda)
 * 4. Local development host (Windows / Linux / Next.js): <cwd>/.data
 */
export function resolveDataDir(overrideDir?: string): string {
  if (overrideDir) return path.resolve(overrideDir);
  if (process.env.LOCAL_DATA_DIR) return path.resolve(process.env.LOCAL_DATA_DIR);

  // AWS Lambda or SAM local container runtime detection
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT || process.env.AWS_EXECUTION_ENV) {
    return path.join(os.tmpdir(), "mechonway-data");
  }

  return path.join(process.cwd(), ".data");
}

/**
 * Ensures a directory is created and verified to be writable.
 * Automatically falls back to os.tmpdir() if the target filesystem is read-only (EROFS).
 */
async function ensureWritableDirectory(targetDir: string): Promise<string> {
  try {
    await fs.mkdir(targetDir, { recursive: true });
    // Write probe to verify write permissions
    const probe = path.join(targetDir, `.probe-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.writeFile(probe, "ok");
    await fs.unlink(probe).catch(() => {});
    return targetDir;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      const fallback = path.join(os.tmpdir(), "mechonway-data");
      await fs.mkdir(fallback, { recursive: true });
      return fallback;
    }
    throw err;
  }
}

/**
 * In-process promise queue mutex to serialize concurrent write operations
 * and prevent interleaved race conditions.
 */
class AsyncLock {
  private queue: Promise<void> = Promise.resolve();

  acquire<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.then(() => {}, () => {});
    return next;
  }
}

/**
 * Generic filesystem-backed JSON store.
 * - Automatically initializes with seeded mock data if the file is missing or empty.
 * - Safely recovers from malformed/corrupted JSON.
 * - Uses atomic write operations (write-to-tmp then rename).
 * - Synchronizes with an in-memory cache checked against filesystem mtime.
 */
export class FileStore<T extends { id?: string; mechanicId?: string }> {
  private filename: string;
  private defaultData: T[];
  private customDir?: string;
  private effectiveDir: string | null = null;
  private lock = new AsyncLock();
  private memoryCache: T[] | null = null;
  private lastMtime = 0;

  constructor(filename: string, defaultData: T[], customDir?: string) {
    this.filename = filename;
    this.defaultData = defaultData;
    this.customDir = customDir;
  }

  private async getFilePath(): Promise<string> {
    if (!this.effectiveDir) {
      const desired = resolveDataDir(this.customDir);
      this.effectiveDir = await ensureWritableDirectory(desired);
    }
    return path.join(this.effectiveDir, this.filename);
  }

  async readAll(): Promise<T[]> {
    const filePath = await this.getFilePath();

    try {
      const stat = await fs.stat(filePath);
      // If cached and file on disk hasn't changed, return fast memory copy
      if (this.memoryCache && stat.mtimeMs <= this.lastMtime) {
        return [...this.memoryCache];
      }

      const raw = await fs.readFile(filePath, "utf-8");
      const trimmed = raw.trim();

      if (!trimmed) {
        // File exists but is empty -> write defaults
        await this.writeAll(this.defaultData);
        return [...this.defaultData];
      }

      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        this.memoryCache = parsed as T[];
        this.lastMtime = stat.mtimeMs;
        return [...this.memoryCache];
      }

      console.warn(`[FileStore] Contents of ${filePath} was not an array. Restoring defaults.`);
      await this.writeAll(this.defaultData);
      return [...this.defaultData];
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "ENOENT") {
        // First run: file does not exist yet -> initialize with defaults
        await this.writeAll(this.defaultData);
        return [...this.defaultData];
      }
      if (err instanceof SyntaxError) {
        // Corrupted JSON -> backup corrupted file and reinitialize defaults
        console.error(`[FileStore] Malformed JSON in ${filePath}. Reinitializing with defaults:`, err.message);
        const backup = `${filePath}.corrupt-${Date.now()}`;
        await fs.rename(filePath, backup).catch(() => {});
        await this.writeAll(this.defaultData);
        return [...this.defaultData];
      }
      throw err;
    }
  }

  async writeAll(items: T[]): Promise<void> {
    return this.lock.acquire(async () => {
      const filePath = await this.getFilePath();
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      const json = JSON.stringify(items, null, 2);
      const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;

      try {
        await fs.writeFile(tempPath, json, "utf-8");
        await fs.rename(tempPath, filePath);
      } catch {
        // Fallback for Windows file-locks or cross-device moves
        try {
          await fs.writeFile(filePath, json, "utf-8");
        } finally {
          await fs.unlink(tempPath).catch(() => {});
        }
      }

      this.memoryCache = [...items];
      try {
        const stat = await fs.stat(filePath);
        this.lastMtime = stat.mtimeMs;
      } catch {
        this.lastMtime = Date.now();
      }
    });
  }

  async reset(initial?: T[]): Promise<void> {
    const data = initial ? [...initial] : [...this.defaultData];
    await this.writeAll(data);
  }

  getSnapshot(): T[] {
    return this.memoryCache ? [...this.memoryCache] : [...this.defaultData];
  }
}

/**
 * Filesystem-backed Request Repository.
 * Persists assistance requests across Lambda invocations and process restarts.
 */
export class LocalRequestRepository implements IRequestRepository {
  private fileStore: FileStore<RoadsideRequest>;

  constructor(dataDir?: string) {
    this.fileStore = new FileStore<RoadsideRequest>("requests.json", MOCK_REQUESTS, dataDir);
  }

  async getById(id: string): Promise<RoadsideRequest | null> {
    const all = await this.listAll();
    const found = all.find((r) => r.id === id || (r as { requestId?: string }).requestId === id);
    return found ? { ...found } : null;
  }

  async listAll(): Promise<RoadsideRequest[]> {
    const all = await this.fileStore.readAll();
    // Return sorted by creation date newest first
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async create(request: RoadsideRequest): Promise<RoadsideRequest> {
    const all = await this.fileStore.readAll();
    // Avoid duplicate insertions if an existing record shares the same ID
    const updated = [request, ...all.filter((r) => r.id !== request.id)];
    await this.fileStore.writeAll(updated);
    return { ...request };
  }

  async update(request: RoadsideRequest): Promise<RoadsideRequest> {
    const all = await this.fileStore.readAll();
    const idx = all.findIndex((r) => r.id === request.id);
    if (idx !== -1) {
      all[idx] = { ...request };
      await this.fileStore.writeAll(all);
    } else {
      all.unshift({ ...request });
      await this.fileStore.writeAll(all);
    }
    return { ...request };
  }

  async delete(id: string): Promise<void> {
    const all = await this.fileStore.readAll();
    const updated = all.filter((r) => r.id !== id && (r as { requestId?: string }).requestId !== id);
    await this.fileStore.writeAll(updated);
  }

  async reset(initial?: RoadsideRequest[]): Promise<void> {
    await this.fileStore.reset(initial);
  }

  getSnapshot(): RoadsideRequest[] {
    return this.fileStore.getSnapshot();
  }

  subscribe(): () => void {
    return () => {};
  }
}

/**
 * Filesystem-backed Mechanic Repository.
 * Persists technician profiles, status changes, and dispatch availability across invocations.
 */
export class LocalMechanicRepository implements IMechanicRepository {
  private fileStore: FileStore<Mechanic>;

  constructor(dataDir?: string) {
    this.fileStore = new FileStore<Mechanic>("mechanics.json", MOCK_MECHANICS, dataDir);
  }

  async getById(id: string): Promise<Mechanic | null> {
    const all = await this.listAll();
    const found = all.find((m) => m.id === id || m.mechanicId === id);
    return found ? { ...found } : null;
  }

  async listAll(): Promise<Mechanic[]> {
    return this.fileStore.readAll();
  }

  async save(mechanic: Mechanic): Promise<Mechanic> {
    const all = await this.fileStore.readAll();
    const targetId = mechanic.mechanicId || mechanic.id;
    const idx = all.findIndex((m) => m.id === targetId || m.mechanicId === targetId);

    if (idx !== -1) {
      all[idx] = { ...mechanic };
    } else {
      all.push({ ...mechanic });
    }

    await this.fileStore.writeAll(all);
    return { ...mechanic };
  }

  async updateStatus(id: string, status: MechanicStatus, isOnline?: boolean): Promise<Mechanic | null> {
    const all = await this.fileStore.readAll();
    const idx = all.findIndex((m) => m.id === id || m.mechanicId === id);
    if (idx === -1) return null;

    const existing = all[idx];
    const nextOnline = isOnline !== undefined ? isOnline : (existing.isOnline ?? true);
    const isBusy = status === "assigned" || status === "en_route" || status === "on_site";
    const nextAvailable = nextOnline && !isBusy;

    const currentStatus = !nextOnline
      ? "offline"
      : isBusy
      ? (status === "en_route" || status === "on_site" ? status : "busy")
      : "available";

    const updatedMechanic: Mechanic = {
      ...existing,
      status,
      isOnline: nextOnline,
      isAvailable: nextAvailable,
      currentStatus,
    };

    all[idx] = updatedMechanic;
    await this.fileStore.writeAll(all);
    return { ...updatedMechanic };
  }

  async reset(initial?: Mechanic[]): Promise<void> {
    await this.fileStore.reset(initial);
  }

  getSnapshot(): Mechanic[] {
    return this.fileStore.getSnapshot();
  }

  subscribe(): () => void {
    return () => {};
  }
}

export const localRequestRepository = new LocalRequestRepository();
export const localMechanicRepository = new LocalMechanicRepository();
