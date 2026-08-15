import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "./current-user.decorator.js";
import type { AuthenticatedUser } from "./auth.types.js";

@ApiTags("account")
@ApiBearerAuth()
@Controller("v1/me")
export class MeController {
  @Get()
  @ApiOkResponse({ description: "The authenticated Supabase user" })
  getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
