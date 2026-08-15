import { Injectable } from "@nestjs/common";
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
}
