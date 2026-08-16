import { estimateFlatRateCost } from "@smart-home/domain";
import { Injectable } from "@nestjs/common";
import type { EnergyBucketSize } from "../generated/prisma/enums.js";
import { PrismaService } from "../database/prisma.service.js";

export interface EnergyQuery {deviceId?:string|undefined;homeId?:string|undefined;bucket:EnergyBucketSize;from:string;to:string}

@Injectable()
export class EnergyService {
  constructor(private readonly prisma:PrismaService){}
  async history(userId:string,query:EnergyQuery){
    const points=await this.prisma.energyAggregate.findMany({
      where:{device:{home:{members:{some:{userId}}},...(query.homeId?{homeId:query.homeId}:{}),...(query.deviceId?{id:query.deviceId}:{})},bucketSize:query.bucket,bucketStart:{gte:new Date(query.from),lt:new Date(query.to)}},
      select:{deviceId:true,bucketStart:true,energyKwh:true,averagePowerW:true,peakPowerW:true,sampleCount:true},orderBy:{bucketStart:"asc"}
    });
    const energyKwh=points.reduce((sum,point)=>sum+point.energyKwh.toNumber(),0);
    const tariff=query.homeId?await this.prisma.electricityTariff.findFirst({where:{homeId:query.homeId,home:{members:{some:{userId}}},effectiveFrom:{lte:new Date()}},orderBy:{effectiveFrom:"desc"}}):null;
    return {from:query.from,to:query.to,bucket:query.bucket,energyKwh,estimatedCost:tariff?estimateFlatRateCost(energyKwh,tariff.flatRatePerKwh.toNumber()):null,currency:tariff?.currency??null,points:points.map((point)=>({...point,energyKwh:point.energyKwh.toNumber(),averagePowerW:point.averagePowerW.toNumber(),peakPowerW:point.peakPowerW.toNumber()}))};
  }
}
