"use client";

import {
  Activity,
  ArrowUpRight,
  House,
  CalendarClock,
  CircleDollarSign,
  LoaderCircle,
  PlugZap,
  ShieldAlert,
  Wifi,
  Zap,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";
import { createClient } from "../lib/supabase/client";
import { EnergyChart } from "./energy-chart";
import { PowerToggle } from "./power-toggle";
import { ApplianceIcon } from "./appliance-icon";
import { HomeFloorPlan } from "./home-floor-plan";
import { roomName, type RoomSummary } from "../lib/rooms";

type Home = { id: string; name: string; currency: string };
type Device = {
  id: string;
  homeId: string;
  roomId: string | null;
  name: string;
  type: string;
  room: { name: string } | null;
  state: {
    connectionStatus: "ONLINE" | "OFFLINE" | "CONNECTING" | "ERROR";
    relayState: boolean;
    powerW: number | null;
    lastSeenAt: string | null;
  } | null;
};
type Schedule = {
  id: string;
  deviceId: string;
  name: string;
  enabled: boolean;
  nextRunAt: string | null;
  desiredRelayState: boolean;
  device: { name: string };
};
type EnergyPoint = { deviceId: string; bucketStart: string; energyKwh: number };
type EnergyResponse = {
  energyKwh: number;
  estimatedCost: number | null;
  currency: string | null;
  points: EnergyPoint[];
};

export function ConnectedDashboard({ demo }: { demo: boolean }) {
  const t = useTranslations("Dashboard");
  const d = useTranslations("Device");
  const locale = useLocale();
  const [homes, setHomes] = useState<Home[]>([]);
  const [selectedHomeId, setSelectedHomeId] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [energy, setEnergy] = useState<EnergyResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const number = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale],
  );
  const dateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Bangkok",
      }),
    [locale],
  );

  const load = useCallback(
    async (background = false) => {
      if (!background) setLoading(true);
      setError(false);
      try {
        const [homeItems, deviceItems, scheduleItems] = await Promise.all([
          apiRequest<Home[]>("/v1/homes"),
          apiRequest<Device[]>("/v1/devices"),
          apiRequest<Schedule[]>("/v1/schedules"),
        ]);
        setHomes(homeItems);
        const homeId = homeItems.find((home) => home.id === selectedHomeId)?.id ?? homeItems[0]?.id;
        const homeDevices = deviceItems.filter((device) => device.homeId === homeId);
        setDevices(homeDevices);
        setSchedules(scheduleItems.filter((schedule) => homeDevices.some((device) => device.id === schedule.deviceId)));
        if (homeId) {
          const to = new Date();
          to.setUTCDate(to.getUTCDate() + 1);
          to.setUTCHours(0, 0, 0, 0);
          const from = new Date(to);
          from.setUTCDate(from.getUTCDate() - 7);
          const query = new URLSearchParams({
            homeId,
            bucket: "DAY",
            from: from.toISOString(),
            to: to.toISOString(),
          });
          const [usage, homeRooms] = await Promise.all([
            apiRequest<EnergyResponse>(`/v1/energy?${query}`),
            apiRequest<RoomSummary[]>(`/v1/homes/${homeId}/rooms`),
          ]);
          setEnergy(usage);
          setRooms(homeRooms);
        } else {
          setEnergy(undefined);
          setRooms([]);
        }
        setUpdatedAt(new Date());
      } catch {
        setError(true);
      } finally {
        if (!background) setLoading(false);
      }
    },
    [selectedHomeId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const activeHome = homes.find((home) => home.id === selectedHomeId) ?? homes[0];
  const homeId = activeHome?.id;
  useEffect(() => {
    if (!homeId) return;
    if (demo) {
      const timer = setInterval(() => void load(true), 5_000);
      return () => clearInterval(timer);
    }
    const client = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        void load(true);
      }, 1_500);
    };
    const channel = client
      .channel(`home:${homeId}`, { config: { private: true } })
      .on("broadcast", { event: "telemetry.updated" }, refresh)
      .on("broadcast", { event: "device.state" }, refresh)
      .on("broadcast", { event: "device.availability" }, refresh)
      .on("broadcast", { event: "command.updated" }, refresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [demo, homeId, load]);

  const totalPower = devices.reduce(
    (sum, device) => sum + (device.state?.powerW ?? 0),
    0,
  );
  const onlineCount = devices.filter(
    (device) => device.state?.connectionStatus === "ONLINE",
  ).length;
  const daily = new Map<string, number>();
  const byDevice = new Map<string, number>();
  for (const point of energy?.points ?? []) {
    const key = point.bucketStart.slice(0, 10);
    daily.set(key, (daily.get(key) ?? 0) + point.energyKwh);
    byDevice.set(
      point.deviceId,
      (byDevice.get(point.deviceId) ?? 0) + point.energyKwh,
    );
  }
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date());
  const todayEnergy = daily.get(todayKey) ?? 0;
  const tariffRate =
    energy?.estimatedCost != null && energy.energyKwh > 0
      ? energy.estimatedCost / energy.energyKwh
      : null;
  const todayCost = tariffRate == null ? null : todayEnergy * tariffRate;
  const chartData = [...daily.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, value]) => ({
      label: new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Bangkok",
      }).format(new Date(`${day}T00:00:00Z`)),
      value,
    }));
  const weeklyAverage = chartData.length
    ? (energy?.energyKwh ?? 0) / chartData.length
    : 0;
  const topDeviceId = [...byDevice.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0]?.[0];
  const topDevice = devices.find((device) => device.id === topDeviceId);
  const nextSchedule = schedules
    .filter((schedule) => schedule.enabled && schedule.nextRunAt)
    .sort((left, right) =>
      String(left.nextRunAt).localeCompare(String(right.nextRunAt)),
    )[0];

  if (loading)
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-[92rem] items-center justify-center px-5">
        <LoaderCircle className="animate-spin text-[#239443]" size={28} />
        <span className="ml-3 font-bold text-[#637067]">{t("loading")}</span>
      </main>
    );
  if (error && !updatedAt)
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-5 text-center">
        <ShieldAlert className="text-red-500" size={38} />
        <h1 className="mt-4 text-xl font-black">{t("loadFailed")}</h1>
        <button
          onClick={() => void load()}
          className="mt-5 rounded-2xl bg-[#285b70] px-5 py-3 font-bold text-white"
        >
          {t("retry")}
        </button>
      </main>
    );

  return (
    <main className="dashboard-main mx-auto max-w-[92rem] px-5 py-7 md:px-8 lg:px-10 lg:py-10">
      {error ? (
        <div
          role="alert"
          className="mb-5 flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
        >
          <span>{t("refreshFailed")}</span>
          <button onClick={() => void load(true)} className="underline">
            {t("retry")}
          </button>
        </div>
      ) : null}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-[#315f72]">
            <House size={17} aria-hidden="true" />
            {homes.length > 1 ? (
              <select aria-label={locale === "th" ? "เลือกบ้าน" : "Select home"} value={homeId} onChange={(event) => setSelectedHomeId(event.target.value)} className="rounded-lg border border-[#c9dce5] bg-white px-2 py-1">
                {homes.map((home) => <option value={home.id} key={home.id}>{home.name}</option>)}
              </select>
            ) : activeHome?.name ?? t("eyebrow")}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
            {locale === "th" ? "ภาพรวมบ้าน" : "Home overview"}
          </h1>
        </div>
        <div className="panel min-w-36 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold text-[#315f72]"><Zap size={16} aria-hidden="true" />{t("livePower")}</p>
          <p className="metric-number mt-1 text-2xl font-black">{number.format(totalPower)} <small className="text-sm">W</small></p>
        </div>
      </header>
      <HomeFloorPlan rooms={rooms} devices={devices} locale={locale} />
      {updatedAt && <p className="mt-2 text-xs text-[#5d6b71]">{t("updatedAt", { value: dateTime.format(updatedAt) })}</p>}
      <nav className="ruan-shortcuts mt-6" aria-label={locale === "th" ? "ทางลัด" : "Shortcuts"}>
        {([
          ["/devices", PlugZap, "อุปกรณ์และการควบคุม", "Devices & controls"],
          ["/energy", CircleDollarSign, "พลังงานและค่าไฟ", "Energy & costs"],
          ["/home/rooms", House, "บ้านและห้อง", "Home & rooms"],
          ["/schedules", CalendarClock, "ตารางเวลา", "Schedules"],
        ] as const).map(([href, Icon, th, en]) => {
          return (
            <Link key={href} href={href} className="panel">
              <Icon size={20} aria-hidden="true" />
              <span>{locale === "th" ? th : en}</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
      <section className="dashboard-metrics stagger-in mt-6 grid gap-4 sm:grid-cols-3">
        {[
          {
            label: t("online"),
            value: `${onlineCount} / ${devices.length}`,
            unit: "",
            icon: Wifi,
            color: "text-[#245b70] bg-[#e2f0f5]",
          },
          {
            label: t("todayEnergy"),
            value: number.format(todayEnergy),
            unit: "kWh",
            icon: Activity,
            color: "text-[#2678b9] bg-[#eaf4fb]",
          },
          {
            label: t("estimatedCost"),
            value: todayCost == null ? "—" : number.format(todayCost),
            unit: energy?.currency ?? homes[0]?.currency ?? "THB",
            icon: CircleDollarSign,
            color: "text-[#a96b0a] bg-[#fff5df]",
          },
        ].map(({ label, value, unit, icon: Icon, color }) => (
          <article
            key={label}
            className="panel flex items-center gap-4 p-5 md:p-6"
          >
            <span
              className={`grid size-12 shrink-0 place-items-center rounded-2xl ${color}`}
            >
              <Icon size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold text-[#748078]">{label}</p>
              <p className="metric-number mt-1 text-2xl font-black">
                {value}{" "}
                <span className="text-sm font-semibold text-[#6e796f]">
                  {unit}
                </span>
              </p>
            </div>
          </article>
        ))}
      </section>

      <div className="dashboard-content stagger-in mt-6 grid gap-6 xl:grid-cols-[1.18fr_.82fr]">
        <section className="panel p-5 md:p-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">{t("devices")}</h2>
              <p className="mt-1 text-xs text-[#778279]">
                {onlineCount} {d("online")} · {devices.length - onlineCount}{" "}
                {d("offline")}
              </p>
            </div>
            <Link
              href="/devices"
              className="rounded-full bg-[#e6f2f6] px-4 py-2 text-xs font-bold text-[#1a7f38]"
            >
              {t("viewAll")}
            </Link>
          </div>
          <div className="stagger-in mt-5 grid gap-3 sm:grid-cols-2">
            {devices.length === 0 ? (
              <div className="col-span-full rounded-3xl border border-dashed border-[#bdd7c2] bg-[#f1f8f2] p-8 text-center">
                <p className="text-sm font-semibold text-[#477552]">
                  {t("empty")}
                </p>
                <Link
                  href="/devices/add"
                  className="mt-4 inline-block rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#315f72]"
                >
                  {t("addDevice")}
                </Link>
              </div>
            ) : (
              devices.map((device) => {
                const online = device.state?.connectionStatus === "ONLINE";
                return (
                  <article
                    key={device.id}
                    className="device-card flex min-h-32 items-center gap-4 p-4"
                  >
                    <span className={`device-icon ${online ? "" : "is-off"}`}>
                      <ApplianceIcon name={device.name} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/devices/${device.id}`}
                        className="truncate font-bold hover:text-[#315f72]"
                      >
                        {device.name}
                      </Link>
                      <p className="mt-1 truncate text-xs text-[#7b857d]">
                        {device.room ? roomName(device.room, locale) : "—"}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className={`status-dot ${online ? "is-online" : ""}`} />
                        <span
                          className={`text-xs font-semibold ${online ? "text-[#258b41]" : "text-[#89928b]"}`}
                        >
                          {online ? d("online") : d("offline")}
                        </span>
                        <span className="ml-auto text-sm font-black tabular-nums">
                          {number.format(device.state?.powerW ?? 0)} W
                        </span>
                      </div>
                    </div>
                    <PowerToggle
                      deviceId={device.id}
                      initialState={device.state?.relayState ?? false}
                      demo={demo}
                      unavailable={demo && !online}
                      onConfirmed={() => void load(true)}
                    />
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="panel p-5 md:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">{t("lastSevenDays")}</h2>
              <p className="mt-1 text-xs text-[#778279]">
                {t("weeklyAverage")}: {number.format(weeklyAverage)} kWh
              </p>
            </div>
            {topDevice ? (
              <div className="rounded-2xl bg-[#e9f7ec] px-3 py-2 text-right">
                <span className="block text-[.65rem] text-[#4f735a]">
                  {t("topConsumer")}
                </span>
                <strong className="block max-w-32 truncate text-sm text-[#188039]">
                  {topDevice.name}
                </strong>
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            {chartData.length ? (
              <EnergyChart data={chartData} />
            ) : (
              <div className="flex h-64 items-center justify-center text-center text-sm font-semibold text-[#778179]">
                {t("noEnergy")}
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#f4f7f4] p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-white text-[#218e40]">
              <CalendarClock size={19} />
            </span>
            <div>
              <p className="text-xs text-[#768078]">{t("nextSchedule")}</p>
              <p className="mt-1 text-sm font-bold">
                {nextSchedule?.nextRunAt
                  ? `${nextSchedule.name} · ${dateTime.format(new Date(nextSchedule.nextRunAt))}`
                  : t("noSchedule")}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
