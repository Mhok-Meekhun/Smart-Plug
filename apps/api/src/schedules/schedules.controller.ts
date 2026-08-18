import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { parseRequest } from "../http/validation.js";
import { SchedulesService } from "./schedules.service.js";

const listSchema = z.object({ deviceId: z.string().uuid().optional() }).strict();
const createSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ONCE"),
    deviceId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    desiredRelayState: z.boolean(),
    timezone: z.string().min(1).max(80).default("Asia/Bangkok"),
    executeAt: z.string().datetime({ offset: true })
  }).strict(),
  z.object({
    kind: z.literal("REPEATING"),
    deviceId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    desiredRelayState: z.boolean(),
    timezone: z.string().min(1).max(80).default("Asia/Bangkok"),
    localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7)
  }).strict()
]);
const patchSchema = z.object({ enabled: z.boolean() }).strict();

@ApiTags("schedules")
@ApiBearerAuth()
@Controller("v1/schedules")
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() raw: Record<string, unknown>) {
    return this.schedules.list(user.id, parseRequest(listSchema, raw));
  }

  @Get(":scheduleId/executions")
  listExecutions(@CurrentUser() user: AuthenticatedUser, @Param("scheduleId") rawId: string) {
    return this.schedules.listExecutions(user.id, parseRequest(z.string().uuid(), rawId));
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() raw: unknown) {
    return this.schedules.create(user.id, parseRequest(createSchema, raw));
  }

  @Patch(":scheduleId")
  setEnabled(
    @CurrentUser() user: AuthenticatedUser,
    @Param("scheduleId") rawId: string,
    @Body() raw: unknown
  ) {
    return this.schedules.setEnabled(
      user.id,
      parseRequest(z.string().uuid(), rawId),
      parseRequest(patchSchema, raw).enabled
    );
  }
}
