import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { HomesService } from "./homes.service.js";

describe("HomesService", () => {
  it("always scopes home queries to the authenticated user", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { home: { findMany } } as unknown as PrismaService;
    const service = new HomesService(prisma);

    await service.listForUser("3f683723-da0e-42cd-8407-4b3f524f5af3");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          members: {
            some: { userId: "3f683723-da0e-42cd-8407-4b3f524f5af3" }
          }
        }
      })
    );
  });

  it("scopes room queries through both home and membership", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { room: { findMany } } as unknown as PrismaService;
    const service = new HomesService(prisma);

    await service.listRooms(
      "3f683723-da0e-42cd-8407-4b3f524f5af3",
      "da659e0e-11fd-48f6-9cf2-e3698d00eec2"
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          homeId: "da659e0e-11fd-48f6-9cf2-e3698d00eec2",
          home: {
            members: {
              some: { userId: "3f683723-da0e-42cd-8407-4b3f524f5af3" }
            }
          }
        }
      })
    );
  });
});
