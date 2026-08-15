import { describe, expect, it } from "vitest";
import { type RelayCommandPayload } from "@smart-home/contracts";
import { SmartPlugSimulator } from "./simulator.js";

const connectedAt = new Date("2026-08-15T14:25:30.000Z");

function command(
  overrides: Partial<RelayCommandPayload> = {}
): RelayCommandPayload {
  return {
    schemaVersion: 1,
    commandId: "cmd_0001",
    deviceId: "plug_001",
    type: "SET_RELAY",
    requestedState: true,
    issuedAt: "2026-08-15T14:25:31.000Z",
    expiresAt: "2026-08-15T14:25:41.000Z",
    ...overrides
  };
}

describe("SmartPlugSimulator", () => {
  it("generates deterministic telemetry and accumulates energy", () => {
    const first = new SmartPlugSimulator({ deviceId: "plug_001", seed: 42 });
    const second = new SmartPlugSimulator({ deviceId: "plug_001", seed: 42 });
    first.connect(connectedAt);
    second.connect(connectedAt);
    first.receiveCommand(command(), new Date("2026-08-15T14:25:32.000Z"));
    second.receiveCommand(command(), new Date("2026-08-15T14:25:32.000Z"));

    const firstTelemetry = first.tick(
      5,
      new Date("2026-08-15T14:25:35.000Z")
    );
    const secondTelemetry = second.tick(
      5,
      new Date("2026-08-15T14:25:35.000Z")
    );

    expect(firstTelemetry).toEqual(secondTelemetry);
    expect(firstTelemetry.powerW).toBeGreaterThan(0);
    expect(firstTelemetry.energyKwh).toBeGreaterThan(1.25);
  });

  it("returns the same acknowledgement for a duplicate command", () => {
    const simulator = new SmartPlugSimulator({ deviceId: "plug_001" });
    simulator.connect(connectedAt);
    const first = simulator.receiveCommand(
      command(),
      new Date("2026-08-15T14:25:32.000Z")
    );
    const duplicate = simulator.receiveCommand(
      command(),
      new Date("2026-08-15T14:25:33.000Z")
    );

    expect(duplicate).toEqual(first);
    expect(duplicate.confirmedRelayState).toBe(true);
  });

  it("rejects an expired command without changing the relay", () => {
    const simulator = new SmartPlugSimulator({ deviceId: "plug_001" });
    simulator.connect(connectedAt);
    const acknowledgement = simulator.receiveCommand(
      command(),
      new Date("2026-08-15T14:25:42.000Z")
    );

    expect(acknowledgement.status).toBe("FAILED");
    expect(acknowledgement.errorCode).toBe("COMMAND_EXPIRED");
    expect(acknowledgement.confirmedRelayState).toBe(false);
  });

  it("reports a physical manual toggle as confirmed state", () => {
    const simulator = new SmartPlugSimulator({ deviceId: "plug_001" });
    simulator.connect(connectedAt);

    const state = simulator.manualToggle(
      new Date("2026-08-15T14:25:34.000Z")
    );

    expect(state.relayState).toBe(true);
  });
});
