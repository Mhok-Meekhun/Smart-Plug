export function estimateFlatRateCost(energyKwh: number, ratePerKwh: number): number {
  if (!Number.isFinite(energyKwh) || energyKwh < 0) throw new RangeError("energyKwh must be non-negative");
  if (!Number.isFinite(ratePerKwh) || ratePerKwh < 0) throw new RangeError("ratePerKwh must be non-negative");
  return Math.round(energyKwh * ratePerKwh * 100) / 100;
}
