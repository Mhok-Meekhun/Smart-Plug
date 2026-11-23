import { roomCategories } from "./rooms";

type Home = { id: string; name: string; timezone: string; currency: string };
type Room = { id: string; homeId: string; name: string; icon: string | null; sortOrder: number };
type Appliance = {
  id: string; homeId: string; roomId: string; name: string; watts: number;
  online: boolean; relayState: boolean; createdAt: number;
};
type Schedule = {
  id: string; deviceId: string; name: string; kind: "ONCE" | "REPEATING";
  desiredRelayState: boolean; timezone: string; executeAt: string | null;
  localTime: string | null; weekdays: number[]; enabled: boolean;
  nextRunAt: string | null; lastRunAt: string | null;
  executions: { id: string; scheduledFor: string; status: "COMMAND_CREATED" | "SKIPPED"; failureMessage: null }[];
};
type Tariff = { id: string; homeId: string; name: string; currency: string; flatRatePerKwh: number; updatedAt: string };
type DemoData = {
  layoutVersion?: number;
  startedAt: number;
  tick: number;
  homes: Home[];
  rooms: Room[];
  devices: Appliance[];
  schedules: Schedule[];
  tariffs: Record<string, Tariff>;
  pairing: { id: string; pairingCode: string; expiresAt: string } | null;
  profile: { id: string; email: string; displayName: string; locale: string; timezone: string; updatedAt: string };
  usage: Record<string, Record<string, number>>;
};

const key = "ruan-ai-smart-home-demo-v1";
const timezone = "Asia/Bangkok";
const dayMs = 86_400_000;
const bangkokOffset = 7 * 3_600_000;
const iso = (time: number) => new Date(time).toISOString();
const dayKey = (time: number) => iso(time + bangkokOffset).slice(0, 10);
const dayStart = (day: string) => Date.parse(`${day}T00:00:00+07:00`);
let memory: DemoData | undefined;

function demoLayout(now: number) {
  const rooms = roomCategories.map(({ en, key }, sortOrder) => ({
    id: `demo-room-${sortOrder}`, homeId: "demo-home", name: en, icon: key, sortOrder,
  }));
  const appliances = [
    ["demo-tv", "Smart TV", 0, 65, true, true],
    ["demo-fan", "Ceiling fan", 1, 28, true, true],
    ["demo-lamp", "Floor lamp", 0, 12, true, false],
    ["demo-fridge", "Refrigerator", 2, 106, true, true],
    ["demo-kettle", "Electric kettle", 2, 1500, false, false],
    ["demo-ac", "Air conditioner", 1, 850, true, false],
    ["demo-microwave", "Microwave", 2, 1100, true, false],
    ["demo-dining-light", "Dining lamp", 4, 18, true, false],
    ["demo-washer", "Washing machine", 5, 450, true, false],
  ] as const;
  const devices = appliances.map(([id, name, room, watts, online, relayState]) => ({
    id, name, homeId: "demo-home", roomId: rooms[room]!.id, watts, online, relayState, createdAt: now,
  }));
  return { rooms, devices };
}

function seed(now: number): DemoData {
  const home = { id: "demo-home", name: "Ruan Residence", timezone, currency: "THB" };
  return {
    layoutVersion: 2, startedAt: now, tick: now, homes: [home], ...demoLayout(now),
    schedules: [{
      id: "demo-evening", deviceId: "demo-tv", name: "TV bedtime", kind: "REPEATING",
      desiredRelayState: false, timezone, executeAt: null, localTime: "22:30",
      weekdays: [0, 1, 2, 3, 4, 5, 6], enabled: true, nextRunAt: nextOccurrence("22:30", [0, 1, 2, 3, 4, 5, 6], now),
      lastRunAt: null, executions: [],
    }],
    tariffs: { [home.id]: { id: "demo-tariff", homeId: home.id, name: "Demo flat rate", currency: "THB", flatRatePerKwh: 4.2, updatedAt: iso(now) } },
    pairing: null,
    profile: { id: "demo-profile", email: "demo@example.com", displayName: "RUAN AI Demo", locale: "th", timezone, updatedAt: iso(now) },
    usage: {},
  };
}

function read(now: number): DemoData {
  let data: DemoData | undefined;
  try {
    const stored = localStorage.getItem(key);
    if (stored) data = JSON.parse(stored) as DemoData;
  } catch { /* Keep the demo usable when storage is unavailable. */ }
  data ??= memory ?? seed(now);
  if (data.layoutVersion !== 2) {
    const layout = demoLayout(now);
    const roomIds = new Set(data.rooms.map(({ id }) => id));
    const deviceIds = new Set(data.devices.map(({ id }) => id));
    data.rooms.push(...layout.rooms.filter(({ id }) => !roomIds.has(id)));
    data.devices.push(...layout.devices.filter(({ id }) => !deviceIds.has(id)));
    data.layoutVersion = 2;
  }
  return data;
}

function save(data: DemoData) {
  memory = data;
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* In-memory session. */ }
}

function nextOccurrence(time: string | null, weekdays: number[], after: number) {
  if (!time) return null;
  for (let offset = 0; offset <= 7; offset++) {
    const day = dayKey(after + offset * dayMs);
    if (!weekdays.includes(new Date(`${day}T00:00:00Z`).getUTCDay())) continue;
    const candidate = Date.parse(`${day}T${time}:00+07:00`);
    if (candidate > after) return iso(candidate);
  }
  return null;
}

function addUsage(data: DemoData, from: number, to: number) {
  let start = Math.max(from, to - 31 * dayMs);
  while (start < to) {
    const day = dayKey(start);
    const end = Math.min(to, dayStart(day) + dayMs);
    for (const device of data.devices) {
      if (!device.relayState || !device.online) continue;
      const days = data.usage[device.id] ??= {};
      days[day] = (days[day] ?? 0) + device.watts * (end - start) / 3_600_000_000;
    }
    start = end;
  }
}

function advance(data: DemoData, now: number) {
  if (now <= data.tick) return;
  let cursor = data.tick;
  while (true) {
    const due = data.schedules.filter((item) => item.enabled && item.nextRunAt && Date.parse(item.nextRunAt) <= now)
      .sort((a, b) => Date.parse(a.nextRunAt!) - Date.parse(b.nextRunAt!))[0];
    if (!due?.nextRunAt) break;
    const at = Date.parse(due.nextRunAt);
    addUsage(data, cursor, at);
    cursor = Math.max(cursor, at);
    const device = data.devices.find((item) => item.id === due.deviceId);
    if (device?.online) device.relayState = due.desiredRelayState;
    due.executions.unshift({ id: `${due.id}-${at}`, scheduledFor: due.nextRunAt, status: device?.online ? "COMMAND_CREATED" : "SKIPPED", failureMessage: null });
    due.executions = due.executions.slice(0, 8);
    due.lastRunAt = due.nextRunAt;
    due.enabled = due.kind === "REPEATING";
    due.nextRunAt = due.enabled ? nextOccurrence(due.localTime, due.weekdays, at) : null;
  }
  addUsage(data, cursor, now);
  data.tick = now;
}

function historicalUsage(data: DemoData, device: Appliance, day: string) {
  const hours: Record<string, number> = {
    "demo-tv": 3.5, "demo-fan": 7, "demo-lamp": 3, "demo-fridge": 8, "demo-kettle": 0.18,
    "demo-ac": 1.9, "demo-microwave": 0.12, "demo-dining-light": 2.5, "demo-washer": 0.65,
  };
  const baseline = device.id.startsWith("demo-") && day <= dayKey(data.startedAt)
    ? device.watts / 1000 * (hours[device.id] ?? 0) * (0.72 + Number(day.slice(-2)) % 7 * 0.085)
    : 0;
  return baseline + (data.usage[device.id]?.[day] ?? 0);
}

function deviceView(data: DemoData, device: Appliance, now: number) {
  const watts = device.online && device.relayState ? device.watts : 0;
  return {
    ...device, type: "SIMULATED_SMART_PLUG", firmwareVersion: "demo-1.0",
    ratedCurrentA: 7.5, lifecycleStatus: "ACTIVE",
    home: data.homes.find((home) => home.id === device.homeId),
    room: data.rooms.find((room) => room.id === device.roomId) ?? null,
    state: {
      connectionStatus: device.online ? "ONLINE" : "OFFLINE",
      relayState: device.relayState, powerW: device.online ? watts : null,
      voltageV: device.online ? 231.2 : null, currentA: device.online ? watts / 231.2 : null,
      energyKwh: Array.from({ length: 31 }, (_, day) =>
        historicalUsage(data, device, dayKey(now - day * dayMs))
      ).reduce((sum, value) => sum + value, 0),
      lastSeenAt: iso(device.online ? now : data.startedAt - 90_000), updatedAt: iso(now),
    },
  };
}

function energyView(data: DemoData, query: URLSearchParams) {
  const homeId = query.get("homeId");
  const deviceId = query.get("deviceId");
  const devices = data.devices.filter((device) => device.homeId === homeId && (!deviceId || device.id === deviceId));
  const points = [];
  const from = Date.parse(query.get("from") ?? "");
  const to = Date.parse(query.get("to") ?? "");
  for (let at = from; at < to; at += dayMs) {
    const day = dayKey(at);
    for (const device of devices) {
      if (day < dayKey(device.createdAt) && !device.id.startsWith("demo-")) continue;
      points.push({
        deviceId: device.id, bucketStart: `${day}T00:00:00.000Z`,
        energyKwh: historicalUsage(data, device, day),
        averagePowerW: device.watts * 0.6, peakPowerW: device.watts, sampleCount: 24,
      });
    }
  }
  const energyKwh = points.reduce((sum, point) => sum + point.energyKwh, 0);
  const tariff = homeId ? data.tariffs[homeId] : undefined;
  return { points, energyKwh, estimatedCost: tariff ? energyKwh * tariff.flatRatePerKwh : null, currency: tariff?.currency ?? "THB" };
}

export function demoRequest(path: string, init: RequestInit) {
  const url = new URL(path, "https://demo.invalid");
  const [, resource, id, action] = url.pathname.split("/").filter(Boolean);
  const method = init.method ?? "GET";
  const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
  const now = Date.now();
  const data = read(now);
  advance(data, now);
  const findDevice = (deviceId: string | undefined) => {
    const device = data.devices.find((item) => item.id === deviceId);
    if (!device) throw new Error("Device unavailable");
    return device;
  };
  const findHome = () => {
    const home = data.homes.find((item) => item.id === id);
    if (!home) throw new Error("Home unavailable");
    return home;
  };
  const createDevice = () => {
    const room = data.rooms.find((item) => item.id === body.roomId && item.homeId === body.homeId);
    if (!room) throw new Error("Choose a room");
    const device: Appliance = {
      id: crypto.randomUUID(), name: String(body.name).trim(), homeId: room.homeId,
      roomId: room.id, watts: 45, online: true, relayState: false, createdAt: now,
    };
    data.devices.push(device);
    return deviceView(data, device, now);
  };
  let result: unknown;

  switch (resource) {
    case "me":
      if (method === "PATCH") {
        const { displayName, locale, timezone: zone } = body;
        data.profile = {
          ...data.profile, displayName: displayName ?? data.profile.displayName,
          locale: locale ?? data.profile.locale, timezone: zone ?? data.profile.timezone, updatedAt: iso(now),
        };
      }
      result = data.profile;
      break;
    case "homes":
      if (!id) {
        if (method === "POST") {
          const home = { id: crypto.randomUUID(), name: String(body.name).trim(), timezone, currency: "THB" };
          data.homes.push(home);
          result = home;
        } else {
          result = data.homes.map((home) => ({ ...home, _count: {
            rooms: data.rooms.filter((room) => room.homeId === home.id).length,
            devices: data.devices.filter((device) => device.homeId === home.id).length,
          } }));
        }
      } else if (action === "rooms") {
        const home = findHome();
        if (method === "POST") {
          const room = { id: crypto.randomUUID(), name: String(body.name).trim(), homeId: home.id, icon: body.icon ?? null, sortOrder: data.rooms.length };
          data.rooms.push(room);
          result = room;
        } else {
          result = data.rooms.filter((room) => room.homeId === home.id).map((room) => ({
            ...room, _count: { devices: data.devices.filter((device) => device.roomId === room.id).length },
          }));
        }
      } else if (action === "tariff") {
        const home = findHome();
        if (method !== "GET") {
          if (!Number.isFinite(body.flatRatePerKwh) || body.flatRatePerKwh < 0) throw new Error("Invalid rate");
          data.tariffs[home.id] = {
            id: data.tariffs[home.id]?.id ?? crypto.randomUUID(), homeId: home.id,
            name: String(body.name).trim(), currency: home.currency, flatRatePerKwh: body.flatRatePerKwh, updatedAt: iso(now),
          };
        }
        result = data.tariffs[home.id] ?? null;
      }
      break;
    case "devices":
      if (id === "simulated" && method === "POST") result = createDevice();
      else if (action === "commands" && method === "POST") {
        const device = findDevice(id);
        if (!device.online) throw new Error("Device offline");
        device.relayState = body.relayState === true;
        result = { confirmed: true, desiredRelayState: device.relayState };
      } else if (id) result = deviceView(data, findDevice(id), now);
      else result = data.devices.map((device) => deviceView(data, device, now));
      break;
    case "energy":
      result = energyView(data, url.searchParams);
      break;
    case "provisioning":
      if (id === "virtual") {
        const pairing = {
          id: crypto.randomUUID(),
          pairingCode: crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase(),
          expiresAt: iso(now + 600_000),
        };
        data.pairing = pairing;
        result = { ...pairing, hardwareId: `demo:${pairing.id}`, expiresInSeconds: 600, virtual: true };
      } else if (id === "claim") {
        if (!data.pairing || Date.parse(data.pairing.expiresAt) <= now || String(body.pairingCode).replaceAll("-", "").toUpperCase() !== data.pairing.pairingCode) {
          throw new Error("Invalid pairing code");
        }
        result = { device: createDevice(), virtual: true, brokerRegistration: "PENDING" };
        data.pairing = null;
      }
      break;
    case "schedules": {
      if (method === "POST") {
        findDevice(body.deviceId);
        const schedule: Schedule = {
          id: crypto.randomUUID(), deviceId: body.deviceId, name: String(body.name).trim(),
          kind: body.kind, desiredRelayState: body.desiredRelayState, timezone,
          executeAt: body.executeAt ?? null, localTime: body.localTime ?? null,
          weekdays: body.weekdays ?? [], enabled: true, nextRunAt: null, lastRunAt: null, executions: [],
        };
        schedule.nextRunAt = schedule.kind === "ONCE" ? schedule.executeAt : nextOccurrence(schedule.localTime, schedule.weekdays, now);
        if (!schedule.nextRunAt || !(Date.parse(schedule.nextRunAt) > now)) throw new Error("Invalid schedule");
        data.schedules.unshift(schedule);
        result = { ...schedule, device: findDevice(schedule.deviceId) };
      } else if (id && method === "PATCH") {
        const schedule = data.schedules.find((item) => item.id === id);
        if (!schedule) throw new Error("Schedule unavailable");
        schedule.enabled = body.enabled === true;
        schedule.nextRunAt = !schedule.enabled ? null : schedule.kind === "ONCE" ? schedule.executeAt : nextOccurrence(schedule.localTime, schedule.weekdays, now);
        if (schedule.nextRunAt && Date.parse(schedule.nextRunAt) <= now) throw new Error("Schedule has expired");
        result = { ...schedule, device: findDevice(schedule.deviceId) };
      } else {
        const filter = url.searchParams.get("deviceId");
        result = data.schedules.filter((item) => !filter || item.deviceId === filter)
          .map((item) => ({ ...item, device: findDevice(item.deviceId) }));
      }
      break;
    }
  }
  if (result === undefined) throw new Error("Demo operation unavailable");
  save(data);
  return result;
}
