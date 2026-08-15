import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { HomesService } from "./homes.service.js";

@ApiTags("homes")
@ApiBearerAuth()
@Controller("v1/homes")
export class HomesController {
  constructor(private readonly homes: HomesService) {}

  @Get()
  @ApiOkResponse({ description: "Homes visible to the authenticated user" })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.homes.listForUser(user.id);
  }

  @Get(":homeId/rooms")
  @ApiOkResponse({ description: "Rooms in an authorized home" })
  listRooms(
    @CurrentUser() user: AuthenticatedUser,
    @Param("homeId", new ParseUUIDPipe({ version: "4" })) homeId: string
  ) {
    return this.homes.listRooms(user.id, homeId);
  }
}
