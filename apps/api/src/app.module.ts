import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module.js";
import { MeController } from "./auth/me.controller.js";
import { SupabaseAuthGuard } from "./auth/supabase-auth.guard.js";
import { DatabaseModule } from "./database/database.module.js";
import { DevicesModule } from "./devices/devices.module.js";
import { HealthController } from "./health/health.controller.js";
import { HomesModule } from "./homes/homes.module.js";

@Module({
  imports: [DatabaseModule, AuthModule, HomesModule, DevicesModule],
  controllers: [HealthController, MeController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard
    }
  ]
})
export class AppModule {}
