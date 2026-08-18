import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { DevicesService } from "./devices.service.js";

describe("DevicesService", () => {
  it("loads device detail only through the authenticated membership boundary", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "0af11e45-676d-4ac2-8d45-867ddb0e0e90",
      ratedCurrentA: { toNumber: () => 16 },
      state: null
    });
    const prisma = { device: { findFirst } } as unknown as PrismaService;
    const service = new DevicesService(prisma);

    await service.getForUser(
      "3f683723-da0e-42cd-8407-4b3f524f5af3",
      "0af11e45-676d-4ac2-8d45-867ddb0e0e90"
    );

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "0af11e45-676d-4ac2-8d45-867ddb0e0e90",
        home: { members: { some: { userId: "3f683723-da0e-42cd-8407-4b3f524f5af3" } } }
      }
    }));
  });

  it("scopes device filters inside the authenticated membership boundary", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { device: { findMany } } as unknown as PrismaService;
    const service = new DevicesService(prisma);

    await service.listForUser("3f683723-da0e-42cd-8407-4b3f524f5af3", {
      homeId: "da659e0e-11fd-48f6-9cf2-e3698d00eec2",
      connectionStatus: "ONLINE"
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          home: {
            members: {
              some: { userId: "3f683723-da0e-42cd-8407-4b3f524f5af3" }
            }
          },
          homeId: "da659e0e-11fd-48f6-9cf2-e3698d00eec2",
          state: { connectionStatus: "ONLINE" }
        }
      })
    );
  });

  it("creates a durable command and outbox entry after ownership validation", async () => {
    const created = {
      id: "fddbf22a-4d82-43ab-b270-97923c77ad22",
      deviceId: "0af11e45-676d-4ac2-8d45-867ddb0e0e90",
      requestedBy: "3f683723-da0e-42cd-8407-4b3f524f5af3",
      desiredRelayState: true,
      status: "PENDING",
      idempotencyKey: "request-0001",
      requestedAt: new Date("2026-08-16T12:00:00Z"),
      expiresAt: new Date("2026-08-16T12:00:30Z")
    };
    const transaction = {
      deviceCommand: { create: vi.fn().mockResolvedValue(created) },
      deviceCommandOutbox: { create: vi.fn().mockResolvedValue({}) }
    };
    const prisma = {
      device: { findFirst: vi.fn().mockResolvedValue({ id: created.deviceId, type: "SMART_PLUG" }) },
      deviceCommand: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction))
    } as unknown as PrismaService;
    const service = new DevicesService(prisma);

    const result = await service.requestRelayState(
      created.requestedBy,
      created.deviceId,
      true,
      created.idempotencyKey
    );

    expect(result).toMatchObject({
      commandId: created.id,
      status: "PENDING",
      confirmed: false
    });
    expect(transaction.deviceCommandOutbox.create).toHaveBeenCalledWith({
      data: { commandId: created.id }
    });
  });

  it("creates an explicit simulated device only inside an owned home and room", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "home-1" });
    const create = vi.fn().mockResolvedValue({
      id: "device-1",
      type: "SIMULATED_SMART_PLUG",
      state: null
    });
    const createMany = vi.fn().mockResolvedValue({ count: 7 });
    const transaction = {
      device: { create },
      energyAggregate: { createMany }
    };
    const prisma = {
      home: { findFirst },
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction))
    } as unknown as PrismaService;
    const service = new DevicesService(prisma);

    await service.createSimulatedDevice(
      "3f683723-da0e-42cd-8407-4b3f524f5af3",
      {
        homeId: "da659e0e-11fd-48f6-9cf2-e3698d00eec2",
        roomId: "76ed781f-d183-4d61-8442-b022f7cd88bd",
        name: "Test plug"
      }
    );

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        members: { some: { userId: "3f683723-da0e-42cd-8407-4b3f524f5af3", role: "OWNER" } },
        rooms: { some: { id: "76ed781f-d183-4d61-8442-b022f7cd88bd" } }
      })
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: "SIMULATED_SMART_PLUG", lifecycleStatus: "ACTIVE" })
    }));
    expect(createMany).toHaveBeenCalledWith({ data: expect.arrayContaining([
      expect.objectContaining({ deviceId: "device-1", bucketSize: "DAY" })
    ]) });
  });

  it("acknowledges simulated relay commands and updates reported state", async () => {
    const requestedAt = new Date("2026-08-18T10:00:00Z");
    const created = {
      id: "fddbf22a-4d82-43ab-b270-97923c77ad22",
      deviceId: "0af11e45-676d-4ac2-8d45-867ddb0e0e90",
      desiredRelayState: true,
      status: "ACKNOWLEDGED",
      requestedAt,
      expiresAt: new Date(requestedAt.getTime() + 30_000)
    };
    const transaction = {
      deviceCommand: { create: vi.fn().mockResolvedValue(created) },
      deviceState: { update: vi.fn().mockResolvedValue({}) }
    };
    const prisma = {
      device: { findFirst: vi.fn().mockResolvedValue({ id: created.deviceId, type: "SIMULATED_SMART_PLUG" }) },
      deviceCommand: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction))
    } as unknown as PrismaService;
    const service = new DevicesService(prisma);

    const result = await service.requestRelayState(
      "3f683723-da0e-42cd-8407-4b3f524f5af3",
      created.deviceId,
      true,
      "request-simulator-1"
    );

    expect(result).toMatchObject({ status: "ACKNOWLEDGED", confirmed: true });
    expect(transaction.deviceState.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ relayState: true, powerW: 65 })
    }));
  });
});
