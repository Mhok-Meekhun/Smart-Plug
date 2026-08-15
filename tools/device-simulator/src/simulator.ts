import {
  type AvailabilityPayload,
  type CommandAcknowledgementPayload,
  type DeviceStatePayload,
  type RelayCommandPayload,
  type TelemetryPayload,
  availabilityPayloadSchema,
  commandAcknowledgementPayloadSchema,
  deviceStatePayloadSchema,
  relayCommandPayloadSchema,
  telemetryPayloadSchema
} from "@smart-home/contracts";

export interface SimulatorOptions {
  deviceId: string;
  seed?: number;
  baseVoltageV?: number;
  activePowerW?: number;
  initialEnergyKwh?: number;
  firmwareVersion?: string;
}

export class SmartPlugSimulator {
  readonly deviceId: string;
  readonly firmwareVersion: string;

  private seed: number;
  private sequence = 0;
  private messageSequence = 0;
  private online = false;
  private relayState = false;
  private energyKwh: number;
  private readonly baseVoltageV: number;
  private readonly activePowerW: number;
  private readonly acknowledgements = new Map<
    string,
    CommandAcknowledgementPayload
  >();

  constructor(options: SimulatorOptions) {
    this.deviceId = options.deviceId;
    this.seed = options.seed ?? 1;
    this.baseVoltageV = options.baseVoltageV ?? 223;
    this.activePowerW = options.activePowerW ?? 65;
    this.energyKwh = options.initialEnergyKwh ?? 1.25;
    this.firmwareVersion = options.firmwareVersion ?? "sim-0.1.0";
  }

  connect(at: Date): AvailabilityPayload {
    this.online = true;
    return this.availability(true, "CONNECTED", at);
  }

  disconnect(at: Date): AvailabilityPayload {
    this.online = false;
    return this.availability(false, "GRACEFUL_DISCONNECT", at);
  }

  heartbeat(at: Date): AvailabilityPayload {
    this.assertOnline();
    return this.availability(true, "HEARTBEAT", at);
  }

  tick(seconds: number, at: Date): TelemetryPayload {
    this.assertOnline();
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error("Tick duration must be a positive finite number");
    }

    const voltageV = this.round(this.baseVoltageV + this.noise(0.9), 1);
    const powerW = this.relayState
      ? this.round(Math.max(0, this.activePowerW + this.noise(1.4)), 1)
      : 0;
    const currentA = this.round(powerW / voltageV, 3);
    this.energyKwh += (powerW * seconds) / 3_600_000;
    this.sequence += 1;

    return telemetryPayloadSchema.parse({
      ...this.envelope(at),
      sequence: this.sequence,
      voltageV,
      currentA,
      powerW,
      energyKwh: this.round(this.energyKwh, 6),
      frequencyHz: 50,
      powerFactor: this.relayState ? 0.98 : 0,
      rssiDbm: -57
    });
  }

  receiveCommand(
    input: RelayCommandPayload,
    receivedAt: Date
  ): CommandAcknowledgementPayload {
    this.assertOnline();
    const command = relayCommandPayloadSchema.parse(input);
    if (command.deviceId !== this.deviceId) {
      throw new Error("Command targets a different device");
    }

    const previous = this.acknowledgements.get(command.commandId);
    if (previous) {
      return previous;
    }

    const expired = Date.parse(command.expiresAt) <= receivedAt.getTime();
    if (!expired) {
      this.relayState = command.requestedState;
    }

    const acknowledgement = commandAcknowledgementPayloadSchema.parse({
      ...this.envelope(receivedAt),
      commandId: command.commandId,
      status: expired ? "FAILED" : "ACKNOWLEDGED",
      confirmedRelayState: this.relayState,
      ...(expired ? { errorCode: "COMMAND_EXPIRED" } : {})
    });

    this.acknowledgements.set(command.commandId, acknowledgement);
    return acknowledgement;
  }

  manualToggle(at: Date): DeviceStatePayload {
    this.assertOnline();
    this.relayState = !this.relayState;
    this.sequence += 1;
    return this.state(at);
  }

  state(at: Date): DeviceStatePayload {
    return deviceStatePayloadSchema.parse({
      ...this.envelope(at),
      sequence: this.sequence,
      relayState: this.relayState
    });
  }

  private availability(
    online: boolean,
    reason: AvailabilityPayload["reason"],
    at: Date
  ): AvailabilityPayload {
    return availabilityPayloadSchema.parse({
      ...this.envelope(at),
      online,
      reason,
      firmwareVersion: this.firmwareVersion
    });
  }

  private envelope(at: Date) {
    this.messageSequence += 1;
    return {
      schemaVersion: 1 as const,
      messageId: `sim_${String(this.messageSequence).padStart(8, "0")}`,
      deviceId: this.deviceId,
      deviceTimestamp: at.toISOString()
    };
  }

  private assertOnline(): void {
    if (!this.online) {
      throw new Error("Simulator is offline");
    }
  }

  private noise(amplitude: number): number {
    this.seed = (this.seed * 1_664_525 + 1_013_904_223) >>> 0;
    return ((this.seed / 0x1_0000_0000) * 2 - 1) * amplitude;
  }

  private round(value: number, precision: number): number {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
  }
}
