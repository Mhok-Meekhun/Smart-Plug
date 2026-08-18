import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service.js";

type ClaimInput = {
  pairingCode: string;
  homeId: string;
  roomId: string;
  name: string;
  icon?: string | undefined;
};

@Injectable()
export class ProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  async createVirtualPairingCode(userId: string) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.prisma.devicePairingToken.count({
      where: { createdBy: userId, isVirtual: true, createdAt: { gte: since } }
    });
    if (recentCount >= 10) {
      throw new HttpException({ code: "PAIRING_RATE_LIMITED", messageKey: "errors.pairingRateLimited" }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const rawCode = randomBytes(8).toString("hex").toUpperCase();
    const displayCode = rawCode.match(/.{1,4}/g)?.join("-") ?? rawCode;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const pairing = await this.prisma.devicePairingToken.create({
      data: {
        hardwareId: `virtual:${randomUUID()}`,
        tokenHash: this.hash(rawCode),
        firmwareVersion: "virtual-provisioning-1.0.0",
        isVirtual: true,
        createdBy: userId,
        expiresAt,
        events: {
          create: { actorUserId: userId, action: "PAIRING_CODE_CREATED", outcome: "SUCCESS", metadata: { virtual: true } }
        }
      },
      select: { id: true, hardwareId: true, expiresAt: true }
    });
    return { ...pairing, pairingCode: displayCode, expiresInSeconds: 600, virtual: true };
  }

  async claim(userId: string, input: ClaimInput) {
    const normalizedCode = input.pairingCode.replaceAll("-", "").toUpperCase();
    if (!/^[A-F0-9]{16}$/.test(normalizedCode)) {
      throw new BadRequestException({ code: "PAIRING_CODE_INVALID", messageKey: "errors.pairingCodeInvalid" });
    }

    const pairing = await this.prisma.devicePairingToken.findUnique({
      where: { tokenHash: this.hash(normalizedCode) }
    });
    const now = new Date();
    if (!pairing || pairing.status !== "AVAILABLE" || pairing.expiresAt <= now) {
      await this.auditFailure(userId, pairing?.id, "PAIRING_CLAIM_REJECTED", pairing ? { reason: "UNAVAILABLE" } : { reason: "NOT_FOUND" });
      throw new BadRequestException({ code: "PAIRING_CODE_INVALID", messageKey: "errors.pairingCodeInvalid" });
    }

    const authorizedHome = await this.prisma.home.findFirst({
      where: {
        id: input.homeId,
        members: { some: { userId, role: "OWNER" } },
        rooms: { some: { id: input.roomId } }
      },
      select: { id: true }
    });
    if (!authorizedHome) {
      await this.auditFailure(userId, pairing.id, "PAIRING_CLAIM_REJECTED", { reason: "OWNER_REQUIRED" });
      throw new NotFoundException({ code: "HOME_OR_ROOM_NOT_FOUND", messageKey: "errors.homeOrRoomNotFound" });
    }

    const credentialSecret = randomBytes(32).toString("base64url");
    const credentialPublicId = `device_${randomUUID()}`;
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const reserved = await transaction.devicePairingToken.updateMany({
          where: { id: pairing.id, status: "AVAILABLE", expiresAt: { gt: now } },
          data: { status: "CLAIMED", claimedBy: userId, claimedAt: now }
        });
        if (reserved.count !== 1) {
          throw new ConflictException({ code: "PAIRING_CODE_USED", messageKey: "errors.pairingCodeUsed" });
        }

        const device = await transaction.device.create({
          data: {
            hardwareId: pairing.hardwareId,
            homeId: input.homeId,
            roomId: input.roomId,
            name: input.name,
            type: pairing.isVirtual ? "SIMULATED_SMART_PLUG" : "SMART_PLUG",
            icon: input.icon ?? "plug",
            firmwareVersion: pairing.firmwareVersion,
            lifecycleStatus: "ACTIVE",
            state: {
              create: pairing.isVirtual
                ? { connectionStatus: "ONLINE", voltageV: 230, currentA: 0, powerW: 0, energyKwh: 0, sequence: 0, lastSeenAt: now }
                : { connectionStatus: "OFFLINE" }
            }
          },
          select: { id: true, homeId: true, roomId: true, name: true, type: true, lifecycleStatus: true }
        });
        const credential = await transaction.deviceCredential.create({
          data: {
            deviceId: device.id,
            credentialId: credentialPublicId,
            secretHash: this.hash(credentialSecret),
            issuedBy: userId
          },
          select: { id: true, credentialId: true, status: true, issuedAt: true }
        });
        await transaction.devicePairingToken.update({ where: { id: pairing.id }, data: { deviceId: device.id } });
        await transaction.deviceProvisioningEvent.create({
          data: { actorUserId: userId, homeId: input.homeId, deviceId: device.id, pairingTokenId: pairing.id, action: "DEVICE_CLAIMED", outcome: "SUCCESS", metadata: { virtual: pairing.isVirtual, credentialId: credential.id } }
        });
        return {
          device,
          credential: { ...credential, secret: credentialSecret, secretReturnedOnce: true },
          virtual: pairing.isVirtual,
          brokerRegistration: "PENDING"
        };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({ code: "DEVICE_ALREADY_CLAIMED", messageKey: "errors.deviceAlreadyClaimed" });
      }
      throw error;
    }
  }

  async listCredentials(userId: string, deviceId: string) {
    await this.requireOwner(userId, deviceId);
    return this.prisma.deviceCredential.findMany({
      where: { deviceId },
      select: { id: true, credentialId: true, status: true, issuedAt: true, activatedAt: true, lastUsedAt: true, expiresAt: true, revokedAt: true },
      orderBy: { issuedAt: "desc" }
    });
  }

  async rotateCredential(userId: string, deviceId: string) {
    const device = await this.requireOwner(userId, deviceId);
    const secret = randomBytes(32).toString("base64url");
    const now = new Date();
    return this.prisma.$transaction(async (transaction) => {
      const previous = await transaction.deviceCredential.findFirst({ where: { deviceId, status: { in: ["STAGED", "ACTIVE"] } }, orderBy: { issuedAt: "desc" } });
      if (previous) await transaction.deviceCredential.update({ where: { id: previous.id }, data: { status: "REVOKED", revokedAt: now } });
      const credential = await transaction.deviceCredential.create({
        data: { deviceId, credentialId: `device_${randomUUID()}`, secretHash: this.hash(secret), issuedBy: userId, ...(previous ? { rotatedFromId: previous.id } : {}) },
        select: { id: true, credentialId: true, status: true, issuedAt: true }
      });
      await transaction.deviceProvisioningEvent.create({ data: { actorUserId: userId, homeId: device.homeId, deviceId, action: "CREDENTIAL_ROTATED", outcome: "SUCCESS", metadata: { credentialId: credential.id, replacedCredentialId: previous?.id ?? null } } });
      return { ...credential, secret, secretReturnedOnce: true, brokerRegistration: "PENDING" };
    }, { isolationLevel: "Serializable" });
  }

  async revokeCredential(userId: string, deviceId: string, credentialId: string) {
    const device = await this.requireOwner(userId, deviceId);
    const credential = await this.prisma.deviceCredential.findFirst({ where: { id: credentialId, deviceId } });
    if (!credential) throw new NotFoundException({ code: "CREDENTIAL_NOT_FOUND", messageKey: "errors.credentialNotFound" });
    if (credential.status === "REVOKED") return { id: credential.id, status: credential.status, revokedAt: credential.revokedAt };
    const now = new Date();
    const updated = await this.prisma.deviceCredential.update({ where: { id: credential.id }, data: { status: "REVOKED", revokedAt: now }, select: { id: true, status: true, revokedAt: true } });
    await this.prisma.deviceProvisioningEvent.create({ data: { actorUserId: userId, homeId: device.homeId, deviceId, action: "CREDENTIAL_REVOKED", outcome: "SUCCESS", metadata: { credentialId: credential.id } } });
    return updated;
  }

  async listEvents(userId: string, deviceId: string) {
    await this.requireOwner(userId, deviceId);
    return this.prisma.deviceProvisioningEvent.findMany({
      where: { deviceId },
      select: { id: true, action: true, outcome: true, metadata: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50
    }).then((events) => events.map((event) => ({ ...event, id: event.id.toString() })));
  }

  private async requireOwner(userId: string, deviceId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, home: { members: { some: { userId, role: "OWNER" } } } },
      select: { id: true, homeId: true }
    });
    if (!device) throw new NotFoundException({ code: "DEVICE_NOT_FOUND", messageKey: "errors.deviceNotFound" });
    return device;
  }

  private async auditFailure(userId: string, pairingTokenId: string | undefined, action: string, metadata: Record<string, string>) {
    await this.prisma.deviceProvisioningEvent.create({
      data: { actorUserId: userId, ...(pairingTokenId ? { pairingTokenId } : {}), action, outcome: "FAILURE", metadata }
    });
  }

  private hash(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
