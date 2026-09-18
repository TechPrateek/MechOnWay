import { IMechanicRepository, IRequestRepository } from "./types";
import { localRequestRepository, localMechanicRepository } from "./local-repository";
import { DynamoDBRequestRepository, DynamoDBMechanicRepository } from "./dynamodb-repository";

export * from "./types";
export * from "./local-repository";
export * from "./dynamodb-repository";

let currentRequestRepo: IRequestRepository | null = null;
let currentMechanicRepo: IMechanicRepository | null = null;

export function getRequestRepository(): IRequestRepository {
  if (currentRequestRepo) return currentRequestRepo;

  const provider = process.env.STORAGE_PROVIDER || "local";
  if (provider.toLowerCase() === "dynamodb") {
    currentRequestRepo = new DynamoDBRequestRepository();
  } else {
    currentRequestRepo = localRequestRepository;
  }
  return currentRequestRepo;
}

export function getMechanicRepository(): IMechanicRepository {
  if (currentMechanicRepo) return currentMechanicRepo;

  const provider = process.env.STORAGE_PROVIDER || "local";
  if (provider.toLowerCase() === "dynamodb") {
    currentMechanicRepo = new DynamoDBMechanicRepository();
  } else {
    currentMechanicRepo = localMechanicRepository;
  }
  return currentMechanicRepo;
}

/**
 * Allows overriding repositories in tests or specific runtimes
 */
export function setRepositoryOverrides(overrides: {
  requestRepo?: IRequestRepository | null;
  mechanicRepo?: IMechanicRepository | null;
}) {
  if (overrides.requestRepo !== undefined) currentRequestRepo = overrides.requestRepo;
  if (overrides.mechanicRepo !== undefined) currentMechanicRepo = overrides.mechanicRepo;
}
