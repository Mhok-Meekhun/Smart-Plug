import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service.js";

@Injectable()
export class HomesService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.home.findMany({
      where: { members: { some: { userId } } },
      select: {
        id: true,
        name: true,
        timezone: true,
        currency: true,
        createdAt: true,
        _count: { select: { rooms: true, devices: true } }
      },
      orderBy: { createdAt: "asc" }
    });
  }

  createHome(
    userId: string,
    input: { name: string; timezone: string; currency: string }
  ) {
    return this.prisma.home.create({
      data: {
        name: input.name,
        timezone: input.timezone,
        currency: input.currency,
        createdBy: userId
      },
      select: {
        id: true,
        name: true,
        timezone: true,
        currency: true,
        createdAt: true
      }
    });
  }

  listRooms(userId: string, homeId: string) {
    return this.prisma.room.findMany({
      where: {
        homeId,
        home: { members: { some: { userId } } }
      },
      select: {
        id: true,
        homeId: true,
        name: true,
        icon: true,
        sortOrder: true,
        _count: { select: { devices: true } }
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
    });
  }

  async createRoom(
    userId: string,
    homeId: string,
    input: { name: string; icon?: string | undefined }
  ) {
    const home = await this.prisma.home.findFirst({
      where: {
        id: homeId,
        members: { some: { userId, role: "OWNER" } }
      },
      select: { id: true }
    });
    if (!home) {
      throw new ForbiddenException({
        code: "HOME_OWNER_REQUIRED",
        messageKey: "errors.homeOwnerRequired"
      });
    }

    try {
      return await this.prisma.room.create({
        data: {
          homeId,
          name: input.name,
          ...(input.icon ? { icon: input.icon } : {})
        },
        select: {
          id: true,
          homeId: true,
          name: true,
          icon: true,
          sortOrder: true
        }
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: "ROOM_NAME_EXISTS",
          messageKey: "errors.roomNameExists"
        });
      }
      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
