import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { ApiAcceptedResponse, ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { parseRequest } from "../http/validation.js";
import { DevicesService } from "./devices.service.js";

const deviceListQuerySchema = z
  .object({
    homeId: z.string().uuid().optional(),
    roomId: z.string().uuid().optional(),
    connectionStatus: z
      .enum(["ONLINE", "OFFLINE", "CONNECTING", "ERROR"])
      .optional()
  })
  .strict();

const relayCommandBodySchema = z.object({ relayState: z.boolean() }).strict();
const deviceIdSchema = z.string().uuid();
const idempotencyKeySchema = z.string().min(8).max(120);

@ApiTags("devices")
@ApiBearerAuth()
@Controller("v1/devices")
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  @ApiOkResponse({ description: "Devices visible to the authenticated user" })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() rawQuery: Record<string, unknown>
  ) {
    const query = parseRequest(deviceListQuerySchema, rawQuery);
    return this.devices.listForUser(user.id, query);
  }

  @Post(":deviceId/commands/relay")
  @ApiAcceptedResponse({ description: "Durable relay command accepted for delivery" })
  requestRelayState(
    @CurrentUser() user: AuthenticatedUser,
    @Param("deviceId") rawDeviceId: string,
    @Headers("idempotency-key") rawIdempotencyKey: string | undefined,
    @Body() rawBody: unknown
  ) {
    const deviceId = parseRequest(deviceIdSchema, rawDeviceId);
    const idempotencyKey = parseRequest(idempotencyKeySchema, rawIdempotencyKey);
    const body = parseRequest(relayCommandBodySchema, rawBody);
    return this.devices.requestRelayState(
      user.id,
      deviceId,
      body.relayState,
      idempotencyKey
    );
  }
}
