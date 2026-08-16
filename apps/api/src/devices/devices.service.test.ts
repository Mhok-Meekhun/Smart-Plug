import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { DevicesService } from "./devices.service.js";

describe("DevicesService", () => {
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
      device: { findFirst: vi.fn().mockResolvedValue({ id: created.deviceId }) },
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
});
