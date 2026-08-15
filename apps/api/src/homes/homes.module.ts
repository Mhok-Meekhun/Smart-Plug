import { Module } from "@nestjs/common";
import { HomesController } from "./homes.controller.js";
import { HomesService } from "./homes.service.js";

@Module({
  controllers: [HomesController],
  providers: [HomesService]
})
export class HomesModule {}
