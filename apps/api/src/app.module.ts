import { Module } from "@nestjs/common";
import { AccountModule } from "./account/account.module.js";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module.js";
import { SupabaseAuthGuard } from "./auth/supabase-auth.guard.js";
import { DatabaseModule } from "./database/database.module.js";
import { DevicesModule } from "./devices/devices.module.js";
import { EnergyModule } from "./energy/energy.module.js";
import { HealthController } from "./health/health.controller.js";
import { HomesModule } from "./homes/homes.module.js";
import { ProvisioningModule } from "./provisioning/provisioning.module.js";
import { SchedulesModule } from "./schedules/schedules.module.js";

@Module({
  imports: [DatabaseModule, AuthModule, AccountModule, HomesModule, DevicesModule, EnergyModule, SchedulesModule, ProvisioningModule],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard
    }
  ]
})
export class AppModule {}
