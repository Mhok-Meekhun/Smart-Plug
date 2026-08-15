import { deviceIdSchema } from "./common.js";

export const mqttMessageKinds = [
  "telemetry",
  "state",
  "commands",
  "acks",
  "availability",
  "errors",
  "bootstrap"
] as const;

export type MqttMessageKind = (typeof mqttMessageKinds)[number];

const messageKindSet = new Set<string>(mqttMessageKinds);

export function deviceTopic(
  deviceId: string,
  kind: MqttMessageKind,
  prefix = "v1"
): string {
  const validatedId = deviceIdSchema.parse(deviceId);
  return `${prefix}/devices/${validatedId}/${kind}`;
}

export function parseDeviceTopic(topic: string): {
  version: "v1";
  deviceId: string;
  kind: MqttMessageKind;
} | null {
  const parts = topic.split("/");
  if (
    parts.length !== 4 ||
    parts[0] !== "v1" ||
    parts[1] !== "devices" ||
    !parts[2] ||
    !parts[3] ||
    !messageKindSet.has(parts[3])
  ) {
    return null;
  }

  const deviceId = deviceIdSchema.safeParse(parts[2]);
  if (!deviceId.success) {
    return null;
  }

  return {
    version: "v1",
    deviceId: deviceId.data,
    kind: parts[3] as MqttMessageKind
  };
}
