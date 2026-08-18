"use client";

import {
  Activity,
  ArrowLeft,
  CalendarClock,
  CircleGauge,
  Clock3,
  Gauge,
  LoaderCircle,
  MapPin,
  PlugZap,
  ShieldCheck,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";
import { createClient } from "../lib/supabase/client";
import { EnergyChart } from "./energy-chart";
import { PowerToggle } from "./power-toggle";

type Device = {
  id: string;
  homeId: string;
  name: string;
  type: string;
  firmwareVersion: string | null;
  ratedCurrentA: number;
  lifecycleStatus: string;
  home: { name: string; timezone: string; currency: string };
  room: { name: string } | null;
  state: {
    connectionStatus: "ONLINE" | "OFFLINE" | "CONNECTING" | "ERROR";
    relayState: boolean;
    voltageV: number | null;
    currentA: number | null;
    powerW: number | null;
    energyKwh: number | null;
    lastSeenAt: string | null;
    updatedAt: string;
  } | null;
};
type EnergyResponse = {
  energyKwh: number;
  points: Array<{ bucketStart: string; energyKwh: number }>;
};
type Schedule = {
  id: string;
  name: string;
  enabled: boolean;
  nextRunAt: string | null;
  desiredRelayState: boolean;
};

export function DeviceDetail({ deviceId }: { deviceId: string }) {
  const t = useTranslations("DeviceDetail");
  const d = useTranslations("Device");
  const locale = useLocale();
  const [device, setDevice] = useState<Device>();
  const [energy, setEnergy] = useState<EnergyResponse>();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const number = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }),
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
        const item = await apiRequest<Device>(`/v1/devices/${deviceId}`);
        setDevice(item);
        const to = new Date();
        to.setUTCDate(to.getUTCDate() + 1);
        to.setUTCHours(0, 0, 0, 0);
        const from = new Date(to);
        from.setUTCDate(from.getUTCDate() - 7);
        const energyQuery = new URLSearchParams({
          homeId: item.homeId,
          deviceId: item.id,
          bucket: "DAY",
          from: from.toISOString(),
          to: to.toISOString(),
        });
        const [energyData, scheduleItems] = await Promise.all([
          apiRequest<EnergyResponse>(`/v1/energy?${energyQuery}`),
          apiRequest<Schedule[]>(`/v1/schedules?deviceId=${item.id}`),
        ]);
        setEnergy(energyData);
        setSchedules(scheduleItems);
      } catch {
        setError(true);
      } finally {
        if (!background) setLoading(false);
      }
    },
    [deviceId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!device?.homeId) return;
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
      .channel(`home:${device.homeId}`, { config: { private: true } })
      .on("broadcast", { event: "telemetry.updated" }, refresh)
      .on("broadcast", { event: "device.state" }, refresh)
      .on("broadcast", { event: "device.availability" }, refresh)
      .on("broadcast", { event: "command.updated" }, refresh)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [device?.homeId, load]);

  if (loading)
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-5">
        <LoaderCircle className="animate-spin text-[#239443]" size={28} />
        <span className="ml-3 font-bold text-[#637067]">{t("loading")}</span>
      </main>
    );
  if (error || !device)
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-5 text-center">
        <WifiOff className="text-red-500" size={38} />
        <h1 className="mt-4 text-xl font-black">{t("loadFailed")}</h1>
        <div className="mt-5 flex gap-3">
          <Link
            href="/devices"
            className="rounded-2xl border border-[#d8e3da] bg-white px-5 py-3 font-bold"
          >
            {t("back")}
          </Link>
          <button
            onClick={() => void load()}
            className="rounded-2xl bg-[#209842] px-5 py-3 font-bold text-white"
          >
            {t("retry")}
          </button>
        </div>
      </main>
    );

  const online = device.state?.connectionStatus === "ONLINE";
  const simulated = device.type === "SIMULATED_SMART_PLUG";
  const chartData = (energy?.points ?? []).map((point) => ({
    label: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Bangkok",
    }).format(new Date(point.bucketStart)),
    value: point.energyKwh,
  }));
  const nextSchedule = schedules
    .filter((schedule) => schedule.enabled && schedule.nextRunAt)
    .sort((left, right) =>
      String(left.nextRunAt).localeCompare(String(right.nextRunAt)),
    )[0];
  const metrics = [
    {
      label: t("voltage"),
      value: device.state?.voltageV,
      unit: "V",
      icon: Zap,
      tone: "bg-[#eaf7ed] text-[#218d40]",
    },
    {
      label: t("current"),
      value: device.state?.currentA,
      unit: "A",
      icon: Activity,
      tone: "bg-[#eaf4fb] text-[#2678b9]",
    },
    {
      label: t("power"),
      value: device.state?.powerW,
      unit: "W",
      icon: Gauge,
      tone: "bg-[#fff5df] text-[#a96b0a]",
    },
    {
      label: t("meterEnergy"),
      value: device.state?.energyKwh,
      unit: "kWh",
      icon: CircleGauge,
      tone: "bg-[#f0ebfb] text-[#69449e]",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:px-8 lg:px-10 lg:py-12">
      <Link
        href="/devices"
        className="inline-flex items-center gap-2 text-sm font-bold text-[#55705d] hover:text-[#177a36]"
      >
        <ArrowLeft size={17} />
        {t("back")}
      </Link>
      <section className="mt-5 overflow-hidden rounded-[2rem] bg-[#123d25] p-6 text-white shadow-[0_22px_60px_rgba(15,69,35,.18)] md:p-9">
        <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-[#8ee0a5]">
              <PlugZap size={28} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black tracking-[-.04em] md:text-5xl">
                  {device.name}
                </h1>
                {simulated ? (
                  <span className="rounded-full bg-violet-200/15 px-3 py-1 text-xs font-bold text-violet-100">
                    {t("simulated")}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/65">
                <MapPin size={15} />
                {device.home.name} · {device.room?.name ?? t("noRoom")}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${online ? "bg-green-300/15 text-green-100" : "bg-white/10 text-white/60"}`}
                >
                  {online ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
                  {online ? d("online") : d("offline")}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/70">
                  {t("lastSeen")}:{" "}
                  {device.state?.lastSeenAt
                    ? dateTime.format(new Date(device.state.lastSeenAt))
                    : t("never")}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-6 rounded-3xl border border-white/10 bg-white/10 p-5 md:min-w-72">
            <div>
              <p className="text-xs text-white/60">{t("confirmedRelay")}</p>
              <p className="mt-2 text-2xl font-black">
                {device.state?.relayState ? d("on") : d("off")}
              </p>
              <p className="mt-1 text-xs text-white/55">
                {t("confirmedNotice")}
              </p>
            </div>
            <PowerToggle
              deviceId={device.id}
              initialState={device.state?.relayState ?? false}
              demo={false}
              onConfirmed={() => void load(true)}
            />
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(({ label, value, unit, icon: Icon, tone }) => (
          <article
            key={label}
            className="panel p-4 md:flex md:items-center md:gap-4 md:p-5"
          >
            <span
              className={`grid size-10 place-items-center rounded-2xl ${tone}`}
            >
              <Icon size={19} />
            </span>
            <div className="mt-3 md:mt-0">
              <p className="text-xs font-bold text-[#748078]">{label}</p>
              <p className="metric-number mt-1 text-xl font-black">
                {value == null ? "—" : number.format(value)}{" "}
                <span className="text-xs font-semibold text-[#6e796f]">
                  {unit}
                </span>
              </p>
            </div>
          </article>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <section className="panel p-5 md:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">{t("energyHistory")}</h2>
              <p className="mt-1 text-xs text-[#748078]">
                {t("sevenDayTotal")}: {number.format(energy?.energyKwh ?? 0)}{" "}
                kWh
              </p>
            </div>
            <Link
              href="/energy"
              className="rounded-xl bg-[#edf7ef] px-3 py-2 text-xs font-bold text-[#187b36]"
            >
              {t("allEnergy")}
            </Link>
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
        </section>
        <div className="space-y-5">
          <section className="panel p-5 md:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[#eaf7ed] text-[#218d40]">
                <CalendarClock size={19} />
              </span>
              <div>
                <h2 className="font-black">{t("nextSchedule")}</h2>
                <p className="mt-1 text-xs text-[#748078]">
                  {t("scheduleCount", { count: schedules.length })}
                </p>
              </div>
            </div>
            {nextSchedule?.nextRunAt ? (
              <div className="mt-4 rounded-2xl bg-[#f5f8f5] p-4">
                <p className="font-bold">{nextSchedule.name}</p>
                <p className="mt-2 flex items-center gap-2 text-xs text-[#667169]">
                  <Clock3 size={14} />
                  {dateTime.format(new Date(nextSchedule.nextRunAt))}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#748078]">{t("noSchedule")}</p>
            )}
            <Link
              href="/schedules"
              className="mt-4 inline-flex text-sm font-bold text-[#187b36]"
            >
              {t("manageSchedules")}
            </Link>
          </section>
          <section className="panel flex gap-3 p-5 text-sm leading-6 text-[#4f6c56]">
            <ShieldCheck className="mt-0.5 shrink-0 text-[#219442]" size={20} />
            <div>
              <p className="font-black">{t("safeStateTitle")}</p>
              <p className="mt-1 text-xs leading-5">
                {simulated ? t("simulatedStateBody") : t("physicalStateBody")}
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
