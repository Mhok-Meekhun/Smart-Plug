import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
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
}
