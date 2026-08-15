import { z } from "zod";
import {
  commandIdSchema,
  deviceIdSchema,
  electricalMetricsSchema,
  identifierSchema,
  isoTimestampSchema,
  messageIdSchema,
  schemaVersionSchema
} from "./common.js";

const messageEnvelopeSchema = z.object({
  schemaVersion: schemaVersionSchema,
  messageId: messageIdSchema,
  deviceId: deviceIdSchema,
  deviceTimestamp: isoTimestampSchema
});

export const telemetryPayloadSchema = messageEnvelopeSchema.extend({
  sequence: z.number().int().nonnegative(),
  ...electricalMetricsSchema.shape
});

export const deviceStatePayloadSchema = messageEnvelopeSchema.extend({
  sequence: z.number().int().nonnegative(),
  relayState: z.boolean(),
  ...electricalMetricsSchema.partial().shape
});

export const relayCommandPayloadSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    commandId: commandIdSchema,
    deviceId: deviceIdSchema,
    type: z.literal("SET_RELAY"),
    requestedState: z.boolean(),
    issuedAt: isoTimestampSchema,
    expiresAt: isoTimestampSchema
  })
  .superRefine((command, context) => {
    if (Date.parse(command.expiresAt) <= Date.parse(command.issuedAt)) {
      context.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Command expiry must be later than issue time"
      });
    }
  });

export const commandAcknowledgementPayloadSchema = messageEnvelopeSchema.extend({
  commandId: commandIdSchema,
  status: z.enum(["ACKNOWLEDGED", "FAILED"]),
  confirmedRelayState: z.boolean(),
  errorCode: identifierSchema.optional()
});

export const availabilityPayloadSchema = messageEnvelopeSchema.extend({
  online: z.boolean(),
  reason: z.enum([
    "CONNECTED",
    "HEARTBEAT",
    "LWT",
    "GRACEFUL_DISCONNECT"
  ]),
  firmwareVersion: z.string().min(1).max(40).optional()
});

export const deviceErrorPayloadSchema = messageEnvelopeSchema.extend({
  code: identifierSchema,
  severity: z.enum(["WARNING", "ERROR", "CRITICAL"]),
  detail: z.string().max(500).optional(),
  commandId: commandIdSchema.optional()
});

export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;
export type DeviceStatePayload = z.infer<typeof deviceStatePayloadSchema>;
export type RelayCommandPayload = z.infer<typeof relayCommandPayloadSchema>;
export type CommandAcknowledgementPayload = z.infer<
  typeof commandAcknowledgementPayloadSchema
>;
export type AvailabilityPayload = z.infer<typeof availabilityPayloadSchema>;
export type DeviceErrorPayload = z.infer<typeof deviceErrorPayloadSchema>;
