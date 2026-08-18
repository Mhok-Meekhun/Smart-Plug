import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../database/prisma.service.js";
import { AccountService } from "./account.service.js";

const user = {
  id: "3f683723-da0e-42cd-8407-4b3f524f5af3",
  email: "owner@example.com",
  role: "authenticated"
};

describe("AccountService", () => {
  it("loads only the authenticated user's profile", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: user.id,
      displayName: "Owner",
      locale: "TH",
      timezone: "Asia/Bangkok",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const prisma = { profile: { findUnique } } as unknown as PrismaService;

    const result = await new AccountService(prisma).getProfile(user);

    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: user.id } }));
    expect(result).toMatchObject({ email: user.email, locale: "th" });
  });

  it("maps public locale values to the database enum", async () => {
    const update = vi.fn().mockResolvedValue({
      id: user.id,
      displayName: "New name",
      locale: "EN",
      timezone: "Asia/Singapore",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const prisma = { profile: { update } } as unknown as PrismaService;

    const result = await new AccountService(prisma).updateProfile(user, {
      displayName: "New name",
      locale: "en",
      timezone: "Asia/Singapore"
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: user.id },
      data: { displayName: "New name", locale: "EN", timezone: "Asia/Singapore" }
    }));
    expect(result.locale).toBe("en");
  });
});
