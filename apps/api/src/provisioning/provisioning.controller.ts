import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { parseRequest } from "../http/validation.js";
import { ProvisioningService } from "./provisioning.service.js";

const claimSchema = z.object({
  pairingCode: z.string().trim().min(16).max(24),
  homeId: z.string().uuid(),
  roomId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  icon: z.string().trim().min(1).max(60).optional()
}).strict();

@ApiTags("provisioning")
@ApiBearerAuth()
@Controller("v1")
export class ProvisioningController {
  constructor(private readonly provisioning: ProvisioningService) {}

  @Post("provisioning/virtual")
  @ApiCreatedResponse({ description: "A short-lived virtual-device pairing code was created" })
  createVirtual(@CurrentUser() user: AuthenticatedUser) {
    return this.provisioning.createVirtualPairingCode(user.id);
  }

  @Post("provisioning/claim")
  @ApiCreatedResponse({ description: "A single-use pairing code was claimed and device credentials were staged" })
  claim(@CurrentUser() user: AuthenticatedUser, @Body() rawBody: unknown) {
    return this.provisioning.claim(user.id, parseRequest(claimSchema, rawBody));
  }

  @Get("devices/:deviceId/credentials")
  @ApiOkResponse({ description: "Credential metadata for an owned device; secret hashes are never returned" })
  listCredentials(
    @CurrentUser() user: AuthenticatedUser,
    @Param("deviceId", new ParseUUIDPipe({ version: "4" })) deviceId: string
  ) {
    return this.provisioning.listCredentials(user.id, deviceId);
  }

  @Post("devices/:deviceId/credentials/rotate")
  @ApiCreatedResponse({ description: "Existing credentials were revoked and a replacement was staged" })
  rotateCredential(
    @CurrentUser() user: AuthenticatedUser,
    @Param("deviceId", new ParseUUIDPipe({ version: "4" })) deviceId: string
  ) {
    return this.provisioning.rotateCredential(user.id, deviceId);
  }

  @Delete("devices/:deviceId/credentials/:credentialId")
  @ApiOkResponse({ description: "The selected device credential was revoked" })
  revokeCredential(
    @CurrentUser() user: AuthenticatedUser,
    @Param("deviceId", new ParseUUIDPipe({ version: "4" })) deviceId: string,
    @Param("credentialId", new ParseUUIDPipe({ version: "4" })) credentialId: string
  ) {
    return this.provisioning.revokeCredential(user.id, deviceId, credentialId);
  }

  @Get("devices/:deviceId/provisioning-events")
  @ApiOkResponse({ description: "Sanitized provisioning audit events for an owned device" })
  listEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Param("deviceId", new ParseUUIDPipe({ version: "4" })) deviceId: string
  ) {
    return this.provisioning.listEvents(user.id, deviceId);
  }
}
