"use client";

import {
  Activity,
  LoaderCircle,
  MapPin,
  PlugZap,
  Plus,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Link } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";
import { PowerToggle } from "./power-toggle";

type Device = {
  id: string;
  name: string;
  type: string;
  room: { name: string } | null;
  state: {
    connectionStatus: "ONLINE" | "OFFLINE" | "CONNECTING" | "ERROR";
    relayState: boolean;
    voltageV: number | null;
    currentA: number | null;
    powerW: number | null;
    energyKwh: number | null;
  } | null;
};

export function DeviceList() {
  const t = useTranslations("Devices");
  const deviceText = useTranslations("Device");
  const locale = useLocale();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    apiRequest<Device[]>("/v1/devices")
      .then(setDevices)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:px-8 lg:px-10 lg:py-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-[#238e41]">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-.04em] md:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#68736a]">
            {t("subtitle")}
          </p>
        </div>
        <Link
          href="/devices/add"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#209842] px-5 font-bold text-white shadow-lg shadow-green-900/15"
        >
          <Plus size={18} />
          {t("add")}
        </Link>
      </div>

      {loading ? (
        <div className="panel mt-7 flex min-h-72 items-center justify-center gap-3 p-8 text-sm font-semibold text-[#58705f]">
          <LoaderCircle className="animate-spin" size={20} />
          {t("loading")}
        </div>
      ) : null}
      {error ? (
        <div className="panel mt-7 flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center">
          <WifiOff className="text-red-500" size={34} />
          <p className="font-bold">{t("loadFailed")}</p>
          <button
            onClick={load}
            className="rounded-2xl bg-[#edf7ef] px-5 py-2.5 font-bold text-[#187b36]"
          >
            {t("retry")}
          </button>
        </div>
      ) : null}
      {!loading && !error && devices.length === 0 ? (
        <div className="panel mt-7 flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-[#eaf7ed] text-[#219442]">
            <PlugZap size={30} />
          </span>
          <h2 className="mt-5 text-xl font-black">{t("emptyTitle")}</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#6b766d]">
            {t("emptyBody")}
          </p>
          <Link
            href="/devices/add"
            className="mt-5 rounded-2xl bg-[#209842] px-5 py-3 font-bold text-white"
          >
            {t("emptyAction")}
          </Link>
        </div>
      ) : null}

      {!loading && !error && devices.length > 0 ? (
        <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {devices.map((device) => {
            const online = device.state?.connectionStatus === "ONLINE";
            const simulated = device.type === "SIMULATED_SMART_PLUG";
            return (
              <article key={device.id} className="panel p-5 md:p-6">
                <div className="flex items-start gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#eaf7ed] text-[#1e8e3e]">
                    <PlugZap size={23} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/devices/${device.id}`}
                        className="truncate font-black hover:text-[#168039]"
                      >
                        {device.name}
                      </Link>
                      {simulated ? (
                        <span className="rounded-full bg-[#f0ebfb] px-2 py-1 text-[.62rem] font-bold text-[#69449e]">
                          {t("simulated")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#78827a]">
                      <MapPin size={13} />
                      {device.room?.name ?? t("noRoom")}
                    </p>
                  </div>
                  <PowerToggle
                    deviceId={device.id}
                    initialState={Boolean(device.state?.relayState)}
                    demo={false}
                  />
                </div>
                <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#f5f8f5] p-3">
                  <span
                    className={`flex items-center gap-2 text-xs font-bold ${online ? "text-[#218d40]" : "text-[#7d867f]"}`}
                  >
                    {online ? <Wifi size={15} /> : <WifiOff size={15} />}{" "}
                    {online ? deviceText("online") : deviceText("offline")}
                  </span>
                  <span className="metric-number flex items-center gap-1 font-black">
                    <Zap size={15} className="text-[#e9a31b]" />
                    {number.format(device.state?.powerW ?? 0)} W
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-[#e5ebe6] p-2">
                    <dt className="text-[.65rem] text-[#7b857d]">
                      {t("voltage")}
                    </dt>
                    <dd className="metric-number mt-1 text-sm font-bold">
                      {number.format(device.state?.voltageV ?? 0)} V
                    </dd>
                  </div>
                  <div className="rounded-xl border border-[#e5ebe6] p-2">
                    <dt className="text-[.65rem] text-[#7b857d]">
                      {t("current")}
                    </dt>
                    <dd className="metric-number mt-1 text-sm font-bold">
                      {number.format(device.state?.currentA ?? 0)} A
                    </dd>
                  </div>
                  <div className="rounded-xl border border-[#e5ebe6] p-2">
                    <dt className="text-[.65rem] text-[#7b857d]">
                      {t("energy")}
                    </dt>
                    <dd className="metric-number mt-1 text-sm font-bold">
                      {number.format(device.state?.energyKwh ?? 0)} kWh
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-center gap-2 text-[.68rem] text-[#7c867e]">
                  <Activity size={13} />
                  {simulated ? t("simulatorReady") : t("waitingForDevice")}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
