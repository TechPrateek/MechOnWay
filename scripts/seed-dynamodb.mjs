/**
 * Standalone DynamoDB Seeder Script for MechOnWay
 *
 * Seeds or updates realistic Greater Noida & Delhi NCR mechanics in DynamoDB.
 * Uses PutCommand to safely upsert records without deleting or altering tables.
 *
 * Usage:
 *   node scripts/seed-dynamodb.mjs [prod|dev|staging]
 *   or
 *   npm run seed:dynamodb
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const stage = process.argv[2] || process.env.ENVIRONMENT || "prod";
const region = process.env.AWS_REGION || "ap-south-1";
const tableName = process.env.DYNAMODB_TABLE_MECHANICS || `MechOnWay-Mechanics-${stage}`;

const DELHI_NCR_MECHANICS = [
  {
    id: "mech-001",
    mechanicId: "mech-001",
    name: "Rajesh Sharma",
    phone: "+91 98101 23456",
    avatarUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80",
    rating: 4.9,
    reviewCount: 318,
    isOnline: true,
    isAvailable: true,
    currentStatus: "available",
    status: "idle",
    specialties: ["flat_tire", "battery_jump", "fuel_delivery", "lockout"],
    vehicleTypes: ["sedan", "suv", "hatchback", "two_wheeler"],
    currentLocation: {
      address: "Alpha 1 Commercial Belt, near Pari Chowk, Greater Noida, UP",
      coordinates: { lat: 28.4780, lng: 77.5015 },
    },
    serviceRadiusKm: 25,
    pricing: { baseFee: 350, perKmRate: 25, hourlyRate: 300 },
    stats: { completedJobs: 412, acceptanceRate: 98, averageRating: 4.9, responseTimeMinutes: 7 },
  },
  {
    id: "mech-002",
    mechanicId: "mech-002",
    name: "Priya Verma",
    phone: "+91 98112 34567",
    avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    rating: 4.8,
    reviewCount: 245,
    isOnline: true,
    isAvailable: true,
    currentStatus: "available",
    status: "idle",
    specialties: ["battery_jump", "engine_trouble", "diagnostics", "lockout"],
    vehicleTypes: ["sedan", "suv", "electric", "hybrid", "hatchback"],
    currentLocation: {
      address: "Knowledge Park III, Institutional Area, Greater Noida, UP",
      coordinates: { lat: 28.4623, lng: 77.4984 },
    },
    serviceRadiusKm: 30,
    pricing: { baseFee: 400, perKmRate: 30, hourlyRate: 400 },
    stats: { completedJobs: 290, acceptanceRate: 96, averageRating: 4.8, responseTimeMinutes: 9 },
  },
  {
    id: "mech-003",
    mechanicId: "mech-003",
    name: "Vikram 'Tork' Singh",
    phone: "+91 98183 45678",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    rating: 4.7,
    reviewCount: 189,
    isOnline: true,
    isAvailable: true,
    currentStatus: "available",
    status: "idle",
    specialties: ["towing", "flat_tire", "winch_out"],
    vehicleTypes: ["suv", "sedan", "truck", "commercial", "hatchback"],
    currentLocation: {
      address: "Noida-Greater Noida Expressway, Sector 142 Advant Hub, Noida, UP",
      coordinates: { lat: 28.5085, lng: 77.4140 },
    },
    serviceRadiusKm: 40,
    pricing: { baseFee: 800, perKmRate: 45, hourlyRate: 500 },
    stats: { completedJobs: 215, acceptanceRate: 94, averageRating: 4.7, responseTimeMinutes: 14 },
  },
  {
    id: "mech-004",
    mechanicId: "mech-004",
    name: "Mohammad Imran",
    phone: "+91 98714 56789",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    rating: 4.6,
    reviewCount: 134,
    isOnline: true,
    isAvailable: true,
    currentStatus: "available",
    status: "idle",
    specialties: ["flat_tire", "battery_jump", "fuel_delivery", "minor_repair"],
    vehicleTypes: ["two_wheeler", "hatchback", "sedan"],
    currentLocation: {
      address: "Sector 62 Electronic City, near Fortis Hospital, Noida, UP",
      coordinates: { lat: 28.6280, lng: 77.3649 },
    },
    serviceRadiusKm: 20,
    pricing: { baseFee: 250, perKmRate: 20, hourlyRate: 250 },
    stats: { completedJobs: 178, acceptanceRate: 95, averageRating: 4.6, responseTimeMinutes: 11 },
  },
  {
    id: "mech-005",
    mechanicId: "mech-005",
    name: "Gurpreet 'Paaji' Singh",
    phone: "+91 99105 67890",
    avatarUrl: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
    rating: 4.9,
    reviewCount: 420,
    isOnline: true,
    isAvailable: false,
    currentStatus: "busy",
    status: "assigned",
    specialties: ["towing", "engine_trouble", "flat_tire", "winch_out"],
    vehicleTypes: ["truck", "commercial", "suv"],
    currentLocation: {
      address: "Yamuna Expressway Corridor, Zero Point Interchange, Greater Noida, UP",
      coordinates: { lat: 28.4210, lng: 77.5320 },
    },
    serviceRadiusKm: 50,
    pricing: { baseFee: 950, perKmRate: 50, hourlyRate: 600 },
    stats: { completedJobs: 560, acceptanceRate: 99, averageRating: 4.9, responseTimeMinutes: 18 },
  },
];

async function seedDynamoDB() {
  console.log(`\n========================================`);
  console.log(` MechOnWay DynamoDB Seeder`);
  console.log(` Target Table: ${tableName}`);
  console.log(` AWS Region  : ${region}`);
  console.log(`========================================\n`);

  const client = new DynamoDBClient({ region });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  let successCount = 0;
  for (const mechanic of DELHI_NCR_MECHANICS) {
    try {
      console.log(`Upserting ${mechanic.name} (${mechanic.id}) at [${mechanic.currentLocation.coordinates.lat}, ${mechanic.currentLocation.coordinates.lng}]...`);
      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: mechanic,
        })
      );
      console.log(`  -> Success!`);
      successCount++;
    } catch (err) {
      console.error(`  -> Failed to upsert ${mechanic.id}:`, err.message);
    }
  }

  console.log(`\nFinished: ${successCount}/${DELHI_NCR_MECHANICS.length} mechanics seeded successfully.\n`);
}

seedDynamoDB().catch((err) => {
  console.error("Seeder encountered fatal error:", err);
  process.exit(1);
});
