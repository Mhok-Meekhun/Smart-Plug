import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { DeviceConnectionStatus } from "../generated/prisma/enums.js";
import { PrismaService } from "../database/prisma.service.js";

export interface DeviceListFilters {
  homeId?: string | undefined;
  roomId?: string | undefined;
  connectionStatus?: DeviceConnectionStatus | undefined;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async getForUser(userId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, home: { members: { some: { userId } } } },
      select: {
        id: true,
        homeId: true,
        roomId: true,
        name: true,
        type: true,
        icon: true,
        firmwareVersion: true,
        ratedCurrentA: true,
        lifecycleStatus: true,
        createdAt: true,
        home: { select: { name: true, timezone: true, currency: true } },
        room: { select: { name: true } },
        state: {
          select: {
            connectionStatus: true,
            relayState: true,
            voltageV: true,
            currentA: true,
            powerW: true,
            energyKwh: true,
            lastSeenAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!device) {
      throw new NotFoundException({
        code: "DEVICE_NOT_FOUND",
        messageKey: "errors.deviceNotFound",
      });
    }
    return {
      ...device,
      ratedCurrentA: device.ratedCurrentA.toNumber(),
      state: device.state
        ? {
            ...device.state,
            voltageV: this.decimalToNumber(device.state.voltageV),
            currentA: this.decimalToNumber(device.state.currentA),
            powerW: this.decimalToNumber(device.state.powerW),
            energyKwh: this.decimalToNumber(device.state.energyKwh),
          }
        : null,
    };
  }

  async listForUser(userId: string, filters: DeviceListFilters) {
    const devices = await this.prisma.device.findMany({
      where: {
        home: { members: { some: { userId } } },
        ...(filters.homeId ? { homeId: filters.homeId } : {}),
        ...(filters.roomId ? { roomId: filters.roomId } : {}),
        ...(filters.connectionStatus
          ? { state: { connectionStatus: filters.connectionStatus } }
          : {}),
      },
      select: {
        id: true,
        homeId: true,
        roomId: true,
        name: true,
        type: true,
        icon: true,
        firmwareVersion: true,
        lifecycleStatus: true,
        room: { select: { name: true } },
        state: {
          select: {
            connectionStatus: true,
            relayState: true,
            voltageV: true,
            currentA: true,
            powerW: true,
            energyKwh: true,
            lastSeenAt: true,
          },
        },
      },
      orderBy: [{ room: { sortOrder: "asc" } }, { name: "asc" }],
    });

    return devices.map((device) => ({
      ...device,
      state: device.state
        ? {
            ...device.state,
            voltageV: this.decimalToNumber(device.state.voltageV),
            currentA: this.decimalToNumber(device.state.currentA),
            powerW: this.decimalToNumber(device.state.powerW),
            energyKwh: this.decimalToNumber(device.state.energyKwh),
          }
        : null,
    }));
  }

  async createSimulatedDevice(
    userId: string,
    input: {
      homeId: string;
      roomId: string;
      name: string;
      icon?: string | undefined;
    },
  ) {
    const authorizedHome = await this.prisma.home.findFirst({
      where: {
        id: input.homeId,
        members: { some: { userId, role: "OWNER" } },
        rooms: { some: { id: input.roomId } },
      },
      select: { id: true },
    });
    if (!authorizedHome) {
      throw new NotFoundException({
        code: "HOME_OR_ROOM_NOT_FOUND",
        messageKey: "errors.homeOrRoomNotFound",
      });
    }

    const now = new Date();
    const device = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.device.create({
        data: {
          hardwareId: `sim:${randomUUID()}`,
          homeId: input.homeId,
          roomId: input.roomId,
          name: input.name,
          type: "SIMULATED_SMART_PLUG",
          icon: input.icon ?? "plug",
          firmwareVersion: "simulator-1.0.0",
          lifecycleStatus: "ACTIVE",
          state: {
            create: {
              connectionStatus: "ONLINE",
              relayState: false,
              voltageV: 230,
              currentA: 0,
              powerW: 0,
              energyKwh: 0,
              sequence: 0,
              lastSeenAt: now,
            },
          },
        },
        select: {
          id: true,
          homeId: true,
          roomId: true,
          name: true,
          type: true,
          icon: true,
          firmwareVersion: true,
          lifecycleStatus: true,
          state: true,
        },
      });
      await transaction.energyAggregate.createMany({
        data: this.simulatedDailyAggregates(created.id, now),
      });
      return created;
    });

    return {
      ...device,
      state: device.state
        ? {
            ...device.state,
            voltageV: this.decimalToNumber(device.state.voltageV),
            currentA: this.decimalToNumber(device.state.currentA),
            powerW: this.decimalToNumber(device.state.powerW),
            energyKwh: this.decimalToNumber(device.state.energyKwh),
            sequence: device.state.sequence?.toString() ?? null,
          }
        : null,
    };
  }

  async requestRelayState(
    userId: string,
    deviceId: string,
    desiredRelayState: boolean,
    idempotencyKey: string,
  ) {
    const device = await this.prisma.device.findFirst({
      where: {
        id: deviceId,
        home: { members: { some: { userId } } },
      },
      select: { id: true, type: true },
    });
    if (!device) {
      throw new NotFoundException({
        code: "DEVICE_NOT_FOUND",
        messageKey: "errors.deviceNotFound",
      });
    }

    const existing = await this.prisma.deviceCommand.findUnique({
      where: { deviceId_idempotencyKey: { deviceId, idempotencyKey } },
    });
    if (existing) {
      if (existing.desiredRelayState !== desiredRelayState) {
        throw new ConflictException({
          code: "IDEMPOTENCY_KEY_REUSED",
          messageKey: "errors.idempotencyKeyReused",
        });
      }
      return this.commandResponse(existing);
    }

    const requestedAt = new Date();
    const expiresAt = new Date(requestedAt.getTime() + 30_000);
    if (device.type === "SIMULATED_SMART_PLUG") {
      const command = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.deviceCommand.create({
          data: {
            deviceId,
            requestedBy: userId,
            desiredRelayState,
            idempotencyKey,
            status: "ACKNOWLEDGED",
            requestedAt,
            sentAt: requestedAt,
            acknowledgedAt: requestedAt,
            expiresAt,
            attemptCount: 1,
            acknowledgementPayload: { simulator: true },
          },
        });
        await transaction.deviceState.update({
          where: { deviceId },
          data: {
            relayState: desiredRelayState,
            currentA: desiredRelayState ? 0.28 : 0,
            powerW: desiredRelayState ? 65 : 0,
            lastSeenAt: requestedAt,
            sequence: { increment: 1 },
          },
        });
        return created;
      });
      return this.commandResponse(command);
    }

    const command = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.deviceCommand.create({
        data: {
          deviceId,
          requestedBy: userId,
          desiredRelayState,
          idempotencyKey,
          requestedAt,
          expiresAt,
        },
      });
      await transaction.deviceCommandOutbox.create({
        data: { commandId: created.id },
      });
      return created;
    });

    return this.commandResponse(command);
  }

  private commandResponse(command: {
    id: string;
    deviceId: string;
    desiredRelayState: boolean;
    status: string;
    requestedAt: Date;
    expiresAt: Date;
  }) {
    return {
      commandId: command.id,
      deviceId: command.deviceId,
      desiredRelayState: command.desiredRelayState,
      status: command.status,
      requestedAt: command.requestedAt,
      expiresAt: command.expiresAt,
      confirmed: command.status === "ACKNOWLEDGED",
    };
  }

  private decimalToNumber(value: { toNumber(): number } | null): number | null {
    return value?.toNumber() ?? null;
  }

  private simulatedDailyAggregates(deviceId: string, now: Date) {
    const pattern = [0.82, 1.04, 0.76, 1.18, 1.31, 0.94, 1.12];
    const today = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    return pattern.map((energyKwh, index) => ({
      deviceId,
      bucketSize: "DAY" as const,
      bucketStart: new Date(today - (pattern.length - index) * 86_400_000),
      sampleCount: 288,
      energyKwh,
      averagePowerW: Math.round((energyKwh * 1000) / 24),
      peakPowerW: 65,
      minimumVoltageV: 226.4,
      maximumVoltageV: 233.2,
    }));
  }
}
