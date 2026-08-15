import { z } from "zod";

export const schemaVersionSchema = z.literal(1);

export const identifierSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/, "Identifier contains unsupported characters");

export const deviceIdSchema = identifierSchema.brand<"DeviceId">();
export const messageIdSchema = identifierSchema.brand<"MessageId">();
export const commandIdSchema = identifierSchema.brand<"CommandId">();

export const isoTimestampSchema = z
  .string()
  .datetime({ offset: true, precision: 3 });

export const finiteNumberSchema = z.number().finite();

export const electricalMetricsSchema = z.object({
  voltageV: finiteNumberSchema.min(0).max(300),
  currentA: finiteNumberSchema.min(0).max(100),
  powerW: finiteNumberSchema.min(0).max(25_000),
  energyKwh: finiteNumberSchema.min(0),
  frequencyHz: finiteNumberSchema.min(40).max(70).optional(),
  powerFactor: finiteNumberSchema.min(0).max(1).optional(),
  temperatureC: finiteNumberSchema.min(-40).max(125).optional(),
  rssiDbm: finiteNumberSchema.int().min(-120).max(0).optional()
});

export type ElectricalMetrics = z.infer<typeof electricalMetricsSchema>;
