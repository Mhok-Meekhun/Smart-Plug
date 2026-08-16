import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
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

  async listForUser(userId: string, filters: DeviceListFilters) {
    const devices = await this.prisma.device.findMany({
      where: {
        home: { members: { some: { userId } } },
        ...(filters.homeId ? { homeId: filters.homeId } : {}),
        ...(filters.roomId ? { roomId: filters.roomId } : {}),
        ...(filters.connectionStatus
          ? { state: { connectionStatus: filters.connectionStatus } }
          : {})
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
            lastSeenAt: true
          }
        }
      },
      orderBy: [{ room: { sortOrder: "asc" } }, { name: "asc" }]
    });

    return devices.map((device) => ({
      ...device,
      state: device.state
        ? {
            ...device.state,
            voltageV: this.decimalToNumber(device.state.voltageV),
            currentA: this.decimalToNumber(device.state.currentA),
            powerW: this.decimalToNumber(device.state.powerW),
            energyKwh: this.decimalToNumber(device.state.energyKwh)
          }
        : null
    }));
  }

  async requestRelayState(
    userId: string,
    deviceId: string,
    desiredRelayState: boolean,
    idempotencyKey: string
  ) {
    const device = await this.prisma.device.findFirst({
      where: {
        id: deviceId,
        home: { members: { some: { userId } } }
      },
      select: { id: true }
    });
    if (!device) {
      throw new NotFoundException({
        code: "DEVICE_NOT_FOUND",
        messageKey: "errors.deviceNotFound"
      });
    }

    const existing = await this.prisma.deviceCommand.findUnique({
      where: { deviceId_idempotencyKey: { deviceId, idempotencyKey } }
    });
    if (existing) {
      if (existing.desiredRelayState !== desiredRelayState) {
        throw new ConflictException({
          code: "IDEMPOTENCY_KEY_REUSED",
          messageKey: "errors.idempotencyKeyReused"
        });
      }
      return this.commandResponse(existing);
    }

    const requestedAt = new Date();
    const expiresAt = new Date(requestedAt.getTime() + 30_000);
    const command = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.deviceCommand.create({
        data: {
          deviceId,
          requestedBy: userId,
          desiredRelayState,
          idempotencyKey,
          requestedAt,
          expiresAt
        }
      });
      await transaction.deviceCommandOutbox.create({
        data: { commandId: created.id }
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
      confirmed: command.status === "ACKNOWLEDGED"
    };
  }

  private decimalToNumber(value: { toNumber(): number } | null): number | null {
    return value?.toNumber() ?? null;
  }
}
