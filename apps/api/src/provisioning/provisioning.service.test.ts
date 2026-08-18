import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { ProvisioningService } from "./provisioning.service.js";

const userId = "3f683723-da0e-42cd-8407-4b3f524f5af3";
const pairingId = "fddbf22a-4d82-43ab-b270-97923c77ad22";
const homeId = "da659e0e-11fd-48f6-9cf2-e3698d00eec2";
const roomId = "76ed781f-d183-4d61-8442-b022f7cd88bd";

function pairing(overrides: Record<string, unknown> = {}) {
  return {
    id: pairingId,
    hardwareId: "virtual:hardware-1",
    tokenHash: "hash",
    status: "AVAILABLE",
    firmwareVersion: "virtual-1.0.0",
    isVirtual: true,
    createdBy: userId,
    claimedBy: null,
    deviceId: null,
    expiresAt: new Date(Date.now() + 60_000),
    claimedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe("ProvisioningService", () => {
  it("returns a virtual code once while persisting only its hash", async () => {
    const create = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: pairingId, hardwareId: data.hardwareId, expiresAt: data.expiresAt }));
    const prisma = { devicePairingToken: { count: vi.fn().mockResolvedValue(0), create } } as unknown as PrismaService;

    const result = await new ProvisioningService(prisma).createVirtualPairingCode(userId);

    expect(result.pairingCode).toMatch(/^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) }) }));
    expect(create.mock.calls[0]?.[0].data.tokenHash).not.toContain(result.pairingCode.replaceAll("-", ""));
  });

  it("rejects an expired code and records a sanitized failure", async () => {
    const audit = vi.fn().mockResolvedValue({});
    const prisma = {
      devicePairingToken: { findUnique: vi.fn().mockResolvedValue(pairing({ expiresAt: new Date(Date.now() - 1000) })) },
      deviceProvisioningEvent: { create: audit }
    } as unknown as PrismaService;

    await expect(new ProvisioningService(prisma).claim(userId, {
      pairingCode: "AAAA-BBBB-CCCC-DDDD", homeId, roomId, name: "Plug"
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ outcome: "FAILURE", metadata: { reason: "UNAVAILABLE" } }) }));
  });

  it("rejects a duplicate claim without revealing device details", async () => {
    const audit = vi.fn().mockResolvedValue({});
    const prisma = {
      devicePairingToken: { findUnique: vi.fn().mockResolvedValue(pairing({ status: "CLAIMED", claimedAt: new Date() })) },
      deviceProvisioningEvent: { create: audit }
    } as unknown as PrismaService;

    await expect(new ProvisioningService(prisma).claim(userId, {
      pairingCode: "AAAA-BBBB-CCCC-DDDD", homeId, roomId, name: "Plug"
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: "PAIRING_CODE_INVALID" }) });
  });

  it("requires owner access to the selected home and room", async () => {
    const audit = vi.fn().mockResolvedValue({});
    const prisma = {
      devicePairingToken: { findUnique: vi.fn().mockResolvedValue(pairing()) },
      home: { findFirst: vi.fn().mockResolvedValue(null) },
      deviceProvisioningEvent: { create: audit }
    } as unknown as PrismaService;

    await expect(new ProvisioningService(prisma).claim(userId, {
      pairingCode: "AAAA-BBBB-CCCC-DDDD", homeId, roomId, name: "Plug"
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ metadata: { reason: "OWNER_REQUIRED" } }) }));
  });

  it("atomically claims a valid code and stages a hashed credential", async () => {
    const transaction = {
      devicePairingToken: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), update: vi.fn().mockResolvedValue({}) },
      device: { create: vi.fn().mockResolvedValue({ id: "0af11e45-676d-4ac2-8d45-867ddb0e0e90", homeId, roomId, name: "Plug", type: "SIMULATED_SMART_PLUG", lifecycleStatus: "ACTIVE" }) },
      deviceCredential: { create: vi.fn().mockResolvedValue({ id: "adf11e45-676d-4ac2-8d45-867ddb0e0e91", credentialId: "device_public", status: "STAGED", issuedAt: new Date() }) },
      deviceProvisioningEvent: { create: vi.fn().mockResolvedValue({}) }
    };
    const prisma = {
      devicePairingToken: { findUnique: vi.fn().mockResolvedValue(pairing()) },
      home: { findFirst: vi.fn().mockResolvedValue({ id: homeId }) },
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction))
    } as unknown as PrismaService;

    const result = await new ProvisioningService(prisma).claim(userId, {
      pairingCode: "AAAA-BBBB-CCCC-DDDD", homeId, roomId, name: "Plug"
    });

    expect(transaction.deviceCredential.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ secretHash: expect.stringMatching(/^[a-f0-9]{64}$/) }) }));
    expect(result).toMatchObject({ virtual: true, brokerRegistration: "PENDING", credential: { secretReturnedOnce: true } });
  });
});
