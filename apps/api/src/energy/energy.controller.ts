import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { parseRequest } from "../http/validation.js";
import { EnergyService } from "./energy.service.js";

const querySchema = z.object({
  deviceId: z.string().uuid().optional(),
  homeId: z.string().uuid().optional(),
  bucket: z.enum(["MINUTE","HOUR","DAY"]).default("HOUR"),
  from: z.string().datetime({offset:true}),
  to: z.string().datetime({offset:true})
}).strict().refine((value) => Date.parse(value.to) > Date.parse(value.from), {path:["to"]});

@ApiTags("energy")
@ApiBearerAuth()
@Controller("v1/energy")
export class EnergyController {
  constructor(private readonly energy: EnergyService) {}
  @Get()
  history(@CurrentUser() user: AuthenticatedUser,@Query() raw:Record<string,unknown>){return this.energy.history(user.id,parseRequest(querySchema,raw));}
}
