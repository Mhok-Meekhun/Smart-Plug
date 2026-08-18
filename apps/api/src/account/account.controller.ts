import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { parseRequest } from "../http/validation.js";
import { AccountService } from "./account.service.js";

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  locale: z.enum(["th", "en"]).optional(),
  timezone: z.string().trim().min(1).max(80).refine(isIanaTimezone).optional()
}).strict().refine((value) => Object.keys(value).length > 0);

@ApiTags("account")
@ApiBearerAuth()
@Controller("v1/me")
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  @ApiOkResponse({ description: "The authenticated user's account profile" })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.account.getProfile(user);
  }

  @Patch()
  @ApiOkResponse({ description: "The authenticated user's profile preferences were updated" })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() rawBody: unknown
  ) {
    return this.account.updateProfile(
      user,
      parseRequest(updateProfileSchema, rawBody)
    );
  }
}
