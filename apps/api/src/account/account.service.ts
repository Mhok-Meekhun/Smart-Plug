import { Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { PrismaService } from "../database/prisma.service.js";

type ProfileUpdate = {
  displayName?: string | undefined;
  locale?: "th" | "en" | undefined;
  timezone?: string | undefined;
};

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(user: AuthenticatedUser) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        displayName: true,
        locale: true,
        timezone: true,
        createdAt: true,
        updatedAt: true
      }
    });
    if (!profile) this.missingProfile();
    return this.serialize(profile, user.email);
  }

  async updateProfile(user: AuthenticatedUser, input: ProfileUpdate) {
    const profile = await this.prisma.profile.update({
      where: { id: user.id },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.locale !== undefined ? { locale: input.locale === "th" ? "TH" : "EN" } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {})
      },
      select: {
        id: true,
        displayName: true,
        locale: true,
        timezone: true,
        createdAt: true,
        updatedAt: true
      }
    }).catch((error: unknown) => {
      if (this.isMissingRecord(error)) this.missingProfile();
      throw error;
    });
    return this.serialize(profile, user.email);
  }

  private serialize<T extends { locale: "TH" | "EN" }>(profile: T, email?: string) {
    return {
      ...profile,
      locale: profile.locale === "TH" ? "th" : "en",
      ...(email ? { email } : {})
    };
  }

  private missingProfile(): never {
    throw new NotFoundException({
      code: "PROFILE_NOT_FOUND",
      messageKey: "errors.profileNotFound"
    });
  }

  private isMissingRecord(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
  }
}
