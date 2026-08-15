import { Injectable } from "@nestjs/common";
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

  private decimalToNumber(value: { toNumber(): number } | null): number | null {
    return value?.toNumber() ?? null;
  }
}
