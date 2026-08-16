import { describe, expect, it } from "vitest";
import { nextRepeatingRun } from "./schedule.js";
import { estimateFlatRateCost } from "./tariff.js";

describe("domain calculations", () => {
  it("calculates a flat-rate estimate to currency precision", () => {
    expect(estimateFlatRateCost(3.84, 4.3)).toBe(16.51);
  });

  it("calculates a Bangkok schedule in UTC", () => {
    const next = nextRepeatingRun({ localTime: "22:30", weekdays: [0,1,2,3,4,5,6], timezone: "Asia/Bangkok" }, new Date("2026-08-16T12:00:00.000Z"));
    expect(next.toISOString()).toBe("2026-08-16T15:30:00.000Z");
  });
});
