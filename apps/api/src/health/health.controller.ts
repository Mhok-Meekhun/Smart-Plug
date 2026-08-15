import {
  Controller,
  Get,
  ServiceUnavailableException
} from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/public.decorator.js";
import { PrismaService } from "../database/prisma.service.js";

@ApiTags("health")
@Public()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("health")
  @ApiOkResponse({ description: "Process liveness" })
  health() {
    return { status: "ok", service: "smart-home-api" };
  }

  @Get("ready")
  @ApiOkResponse({ description: "Database readiness" })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ready", database: "connected" };
    } catch {
      throw new ServiceUnavailableException({
        code: "DATABASE_UNAVAILABLE",
        messageKey: "errors.serviceUnavailable"
      });
    }
  }
}
