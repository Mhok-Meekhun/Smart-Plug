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

  it("creates a home owned by the authenticated user", async () => {
    const create = vi.fn().mockResolvedValue({ id: "home-1" });
    const prisma = { home: { create } } as unknown as PrismaService;
    const service = new HomesService(prisma);

    await service.createHome("3f683723-da0e-42cd-8407-4b3f524f5af3", {
      name: "Bangkok Home",
      timezone: "Asia/Bangkok",
      currency: "THB"
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: "Bangkok Home",
        createdBy: "3f683723-da0e-42cd-8407-4b3f524f5af3"
      })
    }));
  });

  it("requires owner membership before creating a room", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "home-1" });
    const create = vi.fn().mockResolvedValue({ id: "room-1" });
    const prisma = { home: { findFirst }, room: { create } } as unknown as PrismaService;
    const service = new HomesService(prisma);

    await service.createRoom(
      "3f683723-da0e-42cd-8407-4b3f524f5af3",
      "da659e0e-11fd-48f6-9cf2-e3698d00eec2",
      { name: "Living room", icon: "sofa" }
    );

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        members: { some: { userId: "3f683723-da0e-42cd-8407-4b3f524f5af3", role: "OWNER" } }
      })
    }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: "Living room" })
    }));
  });
});
