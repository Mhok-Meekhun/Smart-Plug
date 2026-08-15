import { Global, Module } from "@nestjs/common";
import { SupabaseJwtVerifier } from "./supabase-jwt.verifier.js";

@Global()
@Module({
  providers: [SupabaseJwtVerifier],
  exports: [SupabaseJwtVerifier]
})
export class AuthModule {}
