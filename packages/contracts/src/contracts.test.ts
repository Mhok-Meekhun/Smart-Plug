import { describe, expect, it } from "vitest";
import {
  commandAcknowledgementPayloadSchema,
  deviceTopic,
  parseDeviceTopic,
  relayCommandPayloadSchema,
  telemetryPayloadSchema
} from "./index.js";

const timestamp = "2026-08-15T14:25:30.000Z";

describe("MQTT payload contracts", () => {
  it("accepts valid telemetry and rejects impossible voltage", () => {
    const payload = {
      schemaVersion: 1,
      messageId: "msg_0001",
      deviceId: "plug_001",
      deviceTimestamp: timestamp,
      sequence: 42,
      voltageV: 223.4,
      currentA: 0.291,
      powerW: 65,
      energyKwh: 1.253,
      frequencyHz: 50,
      powerFactor: 0.98,
      rssiDbm: -57
    };

    expect(telemetryPayloadSchema.parse(payload)).toEqual(payload);
    expect(
      telemetryPayloadSchema.safeParse({ ...payload, voltageV: 400 }).success
    ).toBe(false);
  });

  it("requires command expiry to be after issue time", () => {
    const result = relayCommandPayloadSchema.safeParse({
      schemaVersion: 1,
      commandId: "cmd_0001",
      deviceId: "plug_001",
      type: "SET_RELAY",
      requestedState: true,
      issuedAt: timestamp,
      expiresAt: timestamp
    });

    expect(result.success).toBe(false);
  });

  it("supports a failed acknowledgement with a stable error code", () => {
    const result = commandAcknowledgementPayloadSchema.safeParse({
      schemaVersion: 1,
      messageId: "msg_0002",
      commandId: "cmd_0001",
      deviceId: "plug_001",
      deviceTimestamp: timestamp,
      status: "FAILED",
      confirmedRelayState: false,
      errorCode: "RELAY_READBACK_MISMATCH"
    });

    expect(result.success).toBe(true);
  });
});

describe("MQTT topics", () => {
  it("builds and parses a versioned device topic", () => {
    const topic = deviceTopic("plug_001", "telemetry");
    expect(topic).toBe("v1/devices/plug_001/telemetry");
    expect(parseDeviceTopic(topic)).toEqual({
      version: "v1",
      deviceId: "plug_001",
      kind: "telemetry"
    });
  });

  it("rejects topics outside the contract", () => {
    expect(parseDeviceTopic("devices/plug_001/telemetry")).toBeNull();
    expect(parseDeviceTopic("v1/devices/plug_001/admin")).toBeNull();
  });
});
