import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "./public.decorator.js";
import { SupabaseJwtVerifier } from "./supabase-jwt.verifier.js";

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: SupabaseJwtVerifier
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException({
        code: "MISSING_ACCESS_TOKEN",
        messageKey: "errors.authenticationRequired"
      });
    }

    const user = await this.verifier.verify(token);
    Object.assign(request, { user });
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const [scheme, token, extra] = request.headers.authorization?.split(" ") ?? [];
    return scheme === "Bearer" && token && !extra ? token : undefined;
  }
}
