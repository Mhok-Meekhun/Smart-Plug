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
});
