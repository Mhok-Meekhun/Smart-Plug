import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { SchedulesService } from "./schedules.service.js";

const userId = "3f683723-da0e-42cd-8407-4b3f524f5af3";
const deviceId = "0af11e45-676d-4ac2-8d45-867ddb0e0e90";
const scheduleId = "c166d1b2-a493-486f-b973-c51ff64e542e";

describe("SchedulesService", () => {
  it("creates a future one-time schedule with the normalized empty weekday array", async () => {
    const create = vi.fn().mockResolvedValue({ id: scheduleId });
    const prisma = {
      device: { findFirst: vi.fn().mockResolvedValue({ id: deviceId }) },
      deviceSchedule: { create }
    } as unknown as PrismaService;
    const service = new SchedulesService(prisma);

    await service.create(userId, {
      kind: "ONCE",
      deviceId,
      name: "Turn off test plug",
      desiredRelayState: false,
      timezone: "Asia/Bangkok",
      executeAt: "2099-08-18T22:30:00+07:00"
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ weekdays: [], kind: "ONCE" })
    }));
  });

  it("rejects one-time schedules in the past", async () => {
    const prisma = {
      device: { findFirst: vi.fn().mockResolvedValue({ id: deviceId }) }
    } as unknown as PrismaService;
    const service = new SchedulesService(prisma);

    await expect(service.create(userId, {
      kind: "ONCE",
      deviceId,
      name: "Expired",
      desiredRelayState: false,
      timezone: "Asia/Bangkok",
      executeAt: "2020-01-01T00:00:00+07:00"
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("deduplicates and sorts repeating weekdays", async () => {
    const create = vi.fn().mockResolvedValue({ id: scheduleId });
    const prisma = {
      device: { findFirst: vi.fn().mockResolvedValue({ id: deviceId }) },
      deviceSchedule: { create }
    } as unknown as PrismaService;
    const service = new SchedulesService(prisma);

    await service.create(userId, {
      kind: "REPEATING",
      deviceId,
      name: "Morning power",
      desiredRelayState: true,
      timezone: "Asia/Bangkok",
      localTime: "07:00",
      weekdays: [5, 1, 5, 3]
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ weekdays: [1, 3, 5] })
    }));
  });

  it("scopes execution history through the authenticated home membership", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: scheduleId });
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      deviceSchedule: { findFirst },
      scheduleExecution: { findMany }
    } as unknown as PrismaService;
    const service = new SchedulesService(prisma);

    await service.listExecutions(userId, scheduleId);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: scheduleId,
        device: { home: { members: { some: { userId } } } }
      })
    }));
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { scheduleId },
      take: 20
    }));
  });
});
