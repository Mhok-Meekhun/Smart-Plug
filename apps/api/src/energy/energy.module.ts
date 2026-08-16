import { Module } from "@nestjs/common";
import { EnergyController } from "./energy.controller.js";
import { EnergyService } from "./energy.service.js";
@Module({controllers:[EnergyController],providers:[EnergyService]})
export class EnergyModule {}
