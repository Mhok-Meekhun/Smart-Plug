import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { parseRequest } from "../http/validation.js";
import { HomesService } from "./homes.service.js";

const createHomeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(80).default("Asia/Bangkok"),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).default("THB")
}).strict();

const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(120),
  icon: z.string().trim().min(1).max(60).optional()
}).strict();

const tariffSchema = z.object({
  name: z.string().trim().min(1).max(120).default("Estimated flat rate"),
  flatRatePerKwh: z.number().positive().max(100)
}).strict();

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

  @Post()
  @ApiCreatedResponse({ description: "Home created with the current user as owner" })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() rawBody: unknown
  ) {
    return this.homes.createHome(user.id, parseRequest(createHomeSchema, rawBody));
  }

  @Get(":homeId/rooms")
  @ApiOkResponse({ description: "Rooms in an authorized home" })
  listRooms(
    @CurrentUser() user: AuthenticatedUser,
    @Param("homeId", new ParseUUIDPipe({ version: "4" })) homeId: string
  ) {
    return this.homes.listRooms(user.id, homeId);
  }

  @Post(":homeId/rooms")
  @ApiCreatedResponse({ description: "Room created in an owned home" })
  createRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param("homeId", new ParseUUIDPipe({ version: "4" })) homeId: string,
    @Body() rawBody: unknown
  ) {
    return this.homes.createRoom(
      user.id,
      homeId,
      parseRequest(createRoomSchema, rawBody)
    );
  }

  @Get(":homeId/tariff")
  @ApiOkResponse({ description: "Current estimated electricity tariff" })
  getTariff(
    @CurrentUser() user: AuthenticatedUser,
    @Param("homeId", new ParseUUIDPipe({ version: "4" })) homeId: string
  ) {
    return this.homes.getTariff(user.id, homeId);
  }

  @Put(":homeId/tariff")
  @ApiOkResponse({ description: "Estimated flat electricity tariff saved" })
  updateTariff(
    @CurrentUser() user: AuthenticatedUser,
    @Param("homeId", new ParseUUIDPipe({ version: "4" })) homeId: string,
    @Body() rawBody: unknown
  ) {
    return this.homes.updateTariff(
      user.id,
      homeId,
      parseRequest(tariffSchema, rawBody)
    );
  }
}
