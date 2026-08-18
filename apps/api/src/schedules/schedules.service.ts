import { nextRepeatingRun } from "@smart-home/domain";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

type CreateSchedule =
  | { kind: "ONCE"; deviceId: string; name: string; desiredRelayState: boolean; timezone: string; executeAt: string }
  | { kind: "REPEATING"; deviceId: string; name: string; desiredRelayState: boolean; timezone: string; localTime: string; weekdays: number[] };

function scheduleNotFound() {
  return new NotFoundException({ code: "SCHEDULE_NOT_FOUND", messageKey: "errors.scheduleNotFound" });
}

function assertTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new BadRequestException({ code: "INVALID_TIMEZONE", messageKey: "errors.invalidTimezone" });
  }
}

@Injectable()
export class SchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, query: { deviceId?: string | undefined }) {
    return this.prisma.deviceSchedule.findMany({
      where: {
        device: { home: { members: { some: { userId } } } },
        ...(query.deviceId ? { deviceId: query.deviceId } : {})
      },
      include: {
        device: { select: { id: true, name: true, type: true, room: { select: { name: true } } } },
        executions: { orderBy: { scheduledFor: "desc" }, take: 1 }
      },
      orderBy: [{ enabled: "desc" }, { nextRunAt: "asc" }, { createdAt: "desc" }]
    });
  }

  async listExecutions(userId: string, scheduleId: string) {
    const schedule = await this.prisma.deviceSchedule.findFirst({
      where: { id: scheduleId, device: { home: { members: { some: { userId } } } } },
      select: { id: true }
    });
    if (!schedule) throw scheduleNotFound();
    return this.prisma.scheduleExecution.findMany({
      where: { scheduleId },
      include: { command: { select: { status: true, acknowledgedAt: true, failureCode: true } } },
      orderBy: { scheduledFor: "desc" },
      take: 20
    });
  }

  async create(userId: string, input: CreateSchedule) {
    const device = await this.prisma.device.findFirst({
      where: { id: input.deviceId, home: { members: { some: { userId, role: "OWNER" } } } },
      select: { id: true }
    });
    if (!device) {
      throw new NotFoundException({ code: "DEVICE_NOT_FOUND", messageKey: "errors.deviceNotFound" });
    }

    assertTimezone(input.timezone);
    const now = new Date();
    const executeAt = input.kind === "ONCE" ? new Date(input.executeAt) : null;
    if (executeAt && executeAt <= now) {
      throw new BadRequestException({ code: "SCHEDULE_IN_PAST", messageKey: "errors.scheduleInPast" });
    }
    const weekdays = input.kind === "REPEATING" ? [...new Set(input.weekdays)].sort() : [];
    const nextRunAt = input.kind === "ONCE"
      ? executeAt!
      : nextRepeatingRun({ localTime: input.localTime, weekdays, timezone: input.timezone }, now);

    return this.prisma.deviceSchedule.create({
      data: {
        deviceId: input.deviceId,
        createdBy: userId,
        name: input.name,
        kind: input.kind,
        desiredRelayState: input.desiredRelayState,
        timezone: input.timezone,
        executeAt,
        localTime: input.kind === "REPEATING" ? new Date(`1970-01-01T${input.localTime}:00.000Z`) : null,
        weekdays,
        nextRunAt
      },
      include: { device: { select: { id: true, name: true, type: true, room: { select: { name: true } } } }, executions: true }
    });
  }

  async setEnabled(userId: string, scheduleId: string, enabled: boolean) {
    const schedule = await this.prisma.deviceSchedule.findFirst({
      where: { id: scheduleId, device: { home: { members: { some: { userId, role: "OWNER" } } } } }
    });
    if (!schedule) throw scheduleNotFound();

    let nextRunAt = schedule.nextRunAt;
    if (enabled && schedule.kind === "REPEATING" && schedule.localTime) {
      const localTime = schedule.localTime.toISOString().slice(11, 16);
      nextRunAt = nextRepeatingRun({
        localTime,
        weekdays: schedule.weekdays,
        timezone: schedule.timezone
      }, new Date());
    }
    if (enabled && schedule.kind === "ONCE") {
      if (!schedule.executeAt || schedule.executeAt <= new Date()) {
        throw new BadRequestException({ code: "SCHEDULE_IN_PAST", messageKey: "errors.scheduleInPast" });
      }
      nextRunAt = schedule.executeAt;
    }
    return this.prisma.deviceSchedule.update({
      where: { id: scheduleId },
      data: { enabled, nextRunAt: enabled ? nextRunAt : null },
      include: { device: { select: { id: true, name: true, type: true, room: { select: { name: true } } } }, executions: { orderBy: { scheduledFor: "desc" }, take: 1 } }
    });
  }
}
