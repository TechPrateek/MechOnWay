import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { Mechanic, MechanicStatus, RoadsideRequest } from "@/types";
import { IMechanicRepository, IRequestRepository } from "./types";
import { MOCK_REQUESTS, MOCK_MECHANICS } from "../data/mock-data";

function getDynamoDocClient(): DynamoDBDocumentClient {
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  });

  return DynamoDBDocumentClient.from(client, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: true,
    },
  });
}

export class DynamoDBRequestRepository implements IRequestRepository {
  private tableName: string;
  private docClient: DynamoDBDocumentClient;

  constructor(tableName?: string, client?: DynamoDBDocumentClient) {
    this.tableName = tableName || process.env.DYNAMODB_TABLE_REQUESTS || "MechOnWay-Requests";
    this.docClient = client || getDynamoDocClient();
  }

  async getById(id: string): Promise<RoadsideRequest | null> {
    try {
      const response = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { requestId: id },
        })
      );
      return (response.Item as RoadsideRequest) || null;
    } catch (err) {
      console.error(`DynamoDB getById error on ${this.tableName}:`, err);
      throw new Error(`Failed to retrieve request ${id} from DynamoDB`);
    }
  }

  async listAll(): Promise<RoadsideRequest[]> {
    try {
      const response = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
        })
      );
      const items = (response.Items as RoadsideRequest[]) || [];
      if (items.length === 0) {
        try {
          await Promise.all(
            MOCK_REQUESTS.map((req) =>
              this.docClient.send(
                new PutCommand({
                  TableName: this.tableName,
                  Item: { ...req, requestId: req.id },
                })
              )
            )
          );
          return [...MOCK_REQUESTS];
        } catch {
          return [...MOCK_REQUESTS];
        }
      }
      // Sort newest first
      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      console.error(`DynamoDB listAll error on ${this.tableName}:`, err);
      throw new Error(`Failed to list requests from DynamoDB`);
    }
  }

  async create(request: RoadsideRequest): Promise<RoadsideRequest> {
    try {
      const item = {
        ...request,
        requestId: request.id, // Primary key
      };
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
        })
      );
      return request;
    } catch (err) {
      console.error(`DynamoDB create error on ${this.tableName}:`, err);
      throw new Error(`Failed to create request in DynamoDB`);
    }
  }

  async update(request: RoadsideRequest): Promise<RoadsideRequest> {
    try {
      const item = {
        ...request,
        requestId: request.id,
      };
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
        })
      );
      return request;
    } catch (err) {
      console.error(`DynamoDB update error on ${this.tableName}:`, err);
      throw new Error(`Failed to update request ${request.id} in DynamoDB`);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { requestId: id },
        })
      );
    } catch (err) {
      console.error(`DynamoDB delete error on ${this.tableName}:`, err);
      throw new Error(`Failed to delete request ${id} from DynamoDB`);
    }
  }
}

export class DynamoDBMechanicRepository implements IMechanicRepository {
  private tableName: string;
  private docClient: DynamoDBDocumentClient;

  constructor(tableName?: string, client?: DynamoDBDocumentClient) {
    this.tableName = tableName || process.env.DYNAMODB_TABLE_MECHANICS || "MechOnWay-Mechanics";
    this.docClient = client || getDynamoDocClient();
  }

  async getById(id: string): Promise<Mechanic | null> {
    try {
      const response = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { mechanicId: id },
        })
      );
      return (response.Item as Mechanic) || null;
    } catch (err) {
      console.error(`DynamoDB getById error on ${this.tableName}:`, err);
      throw new Error(`Failed to retrieve mechanic ${id} from DynamoDB`);
    }
  }

  async listAll(): Promise<Mechanic[]> {
    try {
      const response = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
        })
      );
      const items = (response.Items as Mechanic[]) || [];
      if (items.length === 0) {
        try {
          await Promise.all(
            MOCK_MECHANICS.map((mech) =>
              this.docClient.send(
                new PutCommand({
                  TableName: this.tableName,
                  Item: { ...mech, mechanicId: mech.mechanicId || mech.id },
                })
              )
            )
          );
          return [...MOCK_MECHANICS];
        } catch {
          return [...MOCK_MECHANICS];
        }
      }
      return items;
    } catch (err) {
      console.error(`DynamoDB listAll error on ${this.tableName}:`, err);
      throw new Error(`Failed to list mechanics from DynamoDB`);
    }
  }

  async save(mechanic: Mechanic): Promise<Mechanic> {
    try {
      const item = {
        ...mechanic,
        mechanicId: mechanic.mechanicId || mechanic.id,
      };
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: item,
        })
      );
      return mechanic;
    } catch (err) {
      console.error(`DynamoDB save error on ${this.tableName}:`, err);
      throw new Error(`Failed to save mechanic in DynamoDB`);
    }
  }

  async updateStatus(id: string, status: MechanicStatus, isOnline?: boolean): Promise<Mechanic | null> {
    try {
      const existing = await this.getById(id);
      if (!existing) return null;

      const nextOnline = isOnline !== undefined ? isOnline : (existing.isOnline ?? true);
      const isBusy = status === "assigned" || status === "en_route" || status === "on_site";
      const nextAvailable = nextOnline && !isBusy;

      const currentStatus = !nextOnline
        ? "offline"
        : isBusy
        ? (status === "en_route" || status === "on_site" ? status : "busy")
        : "available";

      const response = await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { mechanicId: id },
          UpdateExpression:
            "SET #status = :status, isOnline = :isOnline, isAvailable = :isAvailable, currentStatus = :currentStatus",
          ExpressionAttributeNames: {
            "#status": "status",
          },
          ExpressionAttributeValues: {
            ":status": status,
            ":isOnline": nextOnline,
            ":isAvailable": nextAvailable,
            ":currentStatus": currentStatus,
          },
          ReturnValues: "ALL_NEW",
        })
      );

      return (response.Attributes as Mechanic) || null;
    } catch (err) {
      console.error(`DynamoDB updateStatus error on ${this.tableName}:`, err);
      throw new Error(`Failed to update mechanic status in DynamoDB`);
    }
  }
}
