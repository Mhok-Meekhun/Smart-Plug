import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { environment } from "../config/environment.js";
import type { AuthenticatedUser } from "./auth.types.js";

const claimsSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email().optional(),
  role: z.string().min(1).default("authenticated")
});

@Injectable()
export class SupabaseJwtVerifier {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor() {
    const config = environment();
    this.issuer =
      config.SUPABASE_JWT_ISSUER ?? `${config.SUPABASE_URL}/auth/v1`;
    this.audience = config.SUPABASE_JWT_AUDIENCE;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`)
    );
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience
      });
      const claims = claimsSchema.parse(payload);
      return {
        id: claims.sub,
        role: claims.role,
        ...(claims.email ? { email: claims.email } : {})
      };
    } catch {
      throw new UnauthorizedException({
        code: "INVALID_ACCESS_TOKEN",
        messageKey: "errors.invalidAccessToken"
      });
    }
  }
}
