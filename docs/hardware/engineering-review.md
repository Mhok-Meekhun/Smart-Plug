# Hardware and metrology review notes

This document records the professor's feedback for the ESP32/PZEM smart-plug
prototype. It is a design-review checklist, not wiring guidance or evidence of
electrical certification. Mains-side work and tests require a qualified
electrical reviewer; de-energize and disconnect the unit before any physical
inspection or firmware connection changes.

## Review items and software implications

| Feedback | Required follow-up | Software consequence |
| --- | --- | --- |
| Consider a shunt to address phase shift. | Confirm whether this means the PZEM 10 A shunt variant, a separate shunt, or another measurement change. Compare the selected sensor against a reference meter with representative loads, including low-power-factor loads. Review isolation and current/thermal ratings before selecting it. | Do not add a phase correction factor until the exact sensor and measured error are known. Preserve raw measured values and calibration metadata. |
| Verify whether the power supply is isolated; its DC ground may be hazardous. | Verify the exact supply part and revision, its input/output isolation documentation, assembled-board spacing/barriers, and the PZEM serial-interface isolation. Do not treat a supply's isolation rating as certification of the complete plug. | No firmware or USB/debug connection may be treated as making a mains-powered assembly safe. Keep electrical isolation sign-off as a gate before hardware testing. |
| Disconnect line power before programming or handling the circuit. | Follow the lab's lockout/de-energization procedure and have the qualified reviewer approve the bench setup. | Firmware flashing/debugging must be done with the approved safe setup; application software cannot replace this step. |
| Preserve energy when Wi-Fi is unavailable. | Test whether the PZEM cumulative energy register survives both Wi-Fi loss and a full device power cycle. Decide whether ESP32 nonvolatile state and a bounded store-and-forward buffer are also required. Include reset/rollover handling. | Publish a monotonic cumulative `energyKwh`; never reset the PZEM counter during normal startup. Buffer timestamped samples while offline where practical, then replay idempotently. Database aggregation must use measurement time for delayed samples, not blindly treat them as newly measured. |
| Calculate delay when sending parameters. | Measure PZEM read duration, sample interval, publish interval, broker/worker/database time, and dashboard update time separately. Derive end-to-end telemetry latency from device and server timestamps under normal and degraded Wi-Fi. | Keep `deviceTimestamp` as measurement time and `server_received_at` as receipt time. Do not confuse the report's remote-command response target (2 seconds on a normal network) with telemetry freshness. |
| Check whether resolution fits the load. | List the intended appliance/load range and compare its minimum current/power against the exact PZEM variant's starting threshold, register resolution, CT ratio, and reference-instrument uncertainty. | Preserve the instrument's available precision; do not display extra decimal places as if they improve accuracy. Mark readings below the validated range as low-confidence/under-range. |
| Confirm true-RMS behavior and whether DC loads are supported. | The cited PZEM-004T V3.0 manual describes AC measurement and does not establish true-RMS performance. Verify with a true-RMS reference across representative waveforms. Do not use it to measure DC loads; select an appropriate DC-capable sensor if DC measurement enters scope. | Document this device as AC-only unless validation proves otherwise; reject/label unsupported measurement modes rather than presenting them as valid. |

## Measurement questions to close before firmware control

- Identify the exact meter: PZEM-004T-10A (built-in shunt) or PZEM-004T-100A
  (external CT). The report's 7.5 A continuous prototype target is not the same
  as the measurement range or a certified load rating.
- Confirm measured current/power resolution and the minimum reliable load on
  the actual unit. The manual's register resolution and a variant's start
  current are different specifications; test both.
- Establish calibration/phase-error handling from reference measurements.
  Avoid software compensation that would conceal a hardware or isolation issue.
- Define sample and publish intervals only after measuring PZEM read time and
  the report's intended response behavior. Log enough timing metadata to
  calculate median and p95 delay.
- Keep over-current software trips supplemental to the independently reviewed
  hardware protection. Validate trip persistence, reset authorization, and
  network-loss behavior using simulation/approved test equipment first.

## Safe software milestone order

1. Validate topic/payload device identity and MQTT contract using the simulator.
2. Bring up ESP32 serial logging and PZEM read-only measurement; do not switch
   a relay.
3. Compare resolution, phase error, and supported waveforms against reference
   instruments using an approved test bench.
4. Add monotonic energy persistence and offline buffering, including reboot,
   meter-reset, duplicate replay, and Wi-Fi-loss tests.
5. Add LCD reporting and timestamp/delay instrumentation.
6. Only after hardware sign-off, implement relay commands, confirmed state,
   over-current trip, and failsafe behavior.
