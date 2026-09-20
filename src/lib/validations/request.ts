import { z } from "zod";

export const vehicleTypeEnum = z.enum([
  "motorcycle",
  "scooter",
  "car",
  "suv",
  "truck",
  "other",
  "sedan",
  "ev",
  "commercial",
]);

export const breakdownCategoryEnum = z.enum([
  "engine_problem",
  "flat_tyre",
  "battery_issue",
  "fuel_problem",
  "accident_assistance",
  "overheating",
  "general_repair",
  "other",
  "flat_tire",
  "dead_battery",
  "engine_breakdown",
  "towing",
  "fuel_delivery",
  "lockout",
  "stuck_winch",
]);

export const urgencyEnum = z.enum([
  "standard",
  "high",
  "critical_highway",
]);

export const vehicleSchema = z.object({
  type: vehicleTypeEnum,
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().min(1950).max(2027).optional(),
  color: z.string().optional(),
  licensePlate: z.string().optional(),
  isEV: z.boolean().optional(),
});

export const serviceLocationSchema = z.object({
  address: z.string().min(3, "Location address or landmark is required"),
  coordinates: z.object({
    lat: z
      .number()
      .min(-90, "Latitude must be between -90 and 90 degrees")
      .max(90, "Latitude must be between -90 and 90 degrees"),
    lng: z
      .number()
      .min(-180, "Longitude must be between -180 and 180 degrees")
      .max(180, "Longitude must be between -180 and 180 degrees"),
  }),
  landmark: z.string().optional(),
  parkingNotes: z.string().optional(),
  isDemo: z.boolean().optional(),
});

export const createRequestSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(2, "Please enter your name (at least 2 characters)"),
  customerPhone: z
    .string()
    .min(7, "Phone number must be at least 7 digits")
    .regex(
      /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9()]*$/,
      "Please enter a valid telephone number (digits, spaces, hyphens)"
    ),
  breakdownCategory: breakdownCategoryEnum,
  serviceType: breakdownCategoryEnum.optional(),
  issueDescription: z
    .string()
    .min(5, "Please describe the problem (at least 5 characters)"),
  urgency: urgencyEnum.default("standard"),
  vehicle: vehicleSchema,
  location: serviceLocationSchema,
});

export const requestStatusEnum = z.enum([
  "SEARCHING",
  "MATCHED",
  "REQUESTED",
  "ACCEPTED",
  "ON_THE_WAY",
  "ARRIVED",
  "IN_SERVICE",
  "COMPLETED",
  "CANCELLED",
  "NO_MECHANIC_AVAILABLE",
  "pending",
  "matching",
  "dispatched",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
]);

export const updateRequestStatusSchema = z.object({
  status: requestStatusEnum,
  mechanicId: z.string().optional(),
  diagnosticNotes: z.string().optional(),
  finalPrice: z.number().optional(),
  cancellationReason: z.string().optional(),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>;
