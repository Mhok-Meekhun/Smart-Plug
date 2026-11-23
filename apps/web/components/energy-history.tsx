"use client";

import { Activity, CircleDollarSign, LoaderCircle, PlugZap, TrendingUp, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";
import { ApplianceIcon } from "./appliance-icon";
import { EnergyChart } from "./energy-chart";

type Home = { id: string; name: string };
type Device = { id: string; homeId: string; name: string; type: string };
type EnergyPoint = {
  deviceId: string;
  bucketStart: string;
  energyKwh: number;
  averagePowerW: number;
  peakPowerW: number;
  sampleCount: number;
};
type EnergyResponse = {
  energyKwh: number;
  estimatedCost: number | null;
  currency: string | null;
  points: EnergyPoint[];
};

export function EnergyHistory() {
  const t = useTranslations("Energy");
  const locale = useLocale();
  const [homes, setHomes] = useState<Home[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [homeId, setHomeId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [days, setDays] = useState(7);
  const [energy, setEnergy] = useState<EnergyResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const number = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest<Home[]>("/v1/homes"), apiRequest<Device[]>("/v1/devices")])
      .then(([homeItems, deviceItems]) => {
        if (!active) return;
        setHomes(homeItems);
        setDevices(deviceItems);
        const firstHome = homeItems[0]?.id ?? "";
        setHomeId(firstHome);
        setDeviceId("");
      })
      .catch(() => setError(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const loadEnergy = useCallback(() => {
    if (!homeId) return;
    setLoading(true); setError(false);
    const to = new Date();
    to.setUTCDate(to.getUTCDate() + 1);
    to.setUTCHours(0, 0, 0, 0);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - days);
    const query = new URLSearchParams({
      homeId,
      bucket: "DAY",
      from: from.toISOString(),
      to: to.toISOString(),
      ...(deviceId ? { deviceId } : {})
    });
    apiRequest<EnergyResponse>(`/v1/energy?${query}`)
      .then(setEnergy)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [days, deviceId, homeId]);

  useEffect(loadEnergy, [loadEnergy]);

  const visibleDevices = devices.filter((device) => device.homeId === homeId);
  const byDay = new Map<string, number>();
  for (const point of energy?.points ?? []) {
    byDay.set(point.bucketStart, (byDay.get(point.bucketStart) ?? 0) + point.energyKwh);
  }
  const chartData = [...byDay].sort(([left], [right]) => left.localeCompare(right)).map(([date, value]) => ({
    label: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(date)),
    energy: value,
  }));
  const average = energy && chartData.length > 0 ? energy.energyKwh / chartData.length : 0;
  const peak = Math.max(0, ...(energy?.points ?? []).map((point) => point.peakPowerW));
  const byDevice = new Map<string, number>();
  for (const point of energy?.points ?? []) {
    byDevice.set(point.deviceId, (byDevice.get(point.deviceId) ?? 0) + point.energyKwh);
  }
  const breakdown = visibleDevices.filter((device) => byDevice.has(device.id))
    .sort((left, right) => (byDevice.get(right.id) ?? 0) - (byDevice.get(left.id) ?? 0));
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: energy?.currency ?? "THB" });

  if (!loading && homes.length === 0) {
    return <div className="panel flex min-h-80 flex-col items-center justify-center p-8 text-center"><PlugZap size={34} className="text-[#239443]"/><h2 className="mt-4 text-xl font-black">{t("setupRequired")}</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#5d6b71]">{t("setupBody")}</p><Link href="/devices/add" className="mt-5 rounded-2xl bg-[#285b70] px-5 py-3 font-bold text-white">{t("setupAction")}</Link></div>;
  }

  return <div>
    <div className="flex flex-col gap-4 rounded-3xl border border-[#e0e8e1] bg-white p-4 sm:flex-row sm:items-end">
      <label className="flex-1"><span className="mb-2 block text-xs font-bold text-[#6f7a72]">{t("home")}</span><select value={homeId} onChange={(event) => { setHomeId(event.target.value); setDeviceId(""); }} className="h-11 w-full rounded-xl border border-[#dae4db] px-3">{homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select></label>
      <label className="flex-1"><span className="mb-2 block text-xs font-bold text-[#6f7a72]">{t("device")}</span><select value={deviceId} onChange={(event) => setDeviceId(event.target.value)} className="h-11 w-full rounded-xl border border-[#dae4db] px-3"><option value="">{t("allDevices")}</option>{visibleDevices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.type === "SIMULATED_SMART_PLUG" ? ` · ${t("simulated")}` : ""}</option>)}</select></label>
      <div><span className="mb-2 block text-xs font-bold text-[#6f7a72]">{t("range")}</span><div className="ruan-filters">{[7, 30].map((value) => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>{value === 7 ? t("sevenDays") : t("thirtyDays")}</button>)}</div></div>
    </div>

    {error ? <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{t("loadFailed")} <button onClick={loadEnergy} className="ml-2 underline">{t("retry")}</button></div> : null}
    <section className="stagger-in mt-5 grid gap-4 sm:grid-cols-3">
      {[{ label: t("total"), value: number.format(energy?.energyKwh ?? 0), unit: "kWh", icon: Zap, tone: "bg-[#e9f7ec] text-[#218d40]" }, { label: t("dailyAverage"), value: number.format(average), unit: "kWh", icon: TrendingUp, tone: "bg-[#eaf4fb] text-[#2678b9]" }, { label: t("estimatedCost"), value: energy?.estimatedCost == null ? "—" : number.format(energy.estimatedCost), unit: energy?.currency ?? "THB", icon: CircleDollarSign, tone: "bg-[#fff5df] text-[#a96b0a]" }].map(({ label, value, unit, icon: Icon, tone }) => <article key={label} className="panel flex items-center gap-4 p-5"><span className={`grid size-11 place-items-center rounded-2xl ${tone}`}><Icon size={20}/></span><div><p className="text-xs font-bold text-[#748078]">{label}</p><p className="metric-number mt-1 text-2xl font-black">{value} <span className="text-xs font-semibold text-[#6e796f]">{unit}</span></p></div></article>)}
    </section>
    {!loading && breakdown.length > 0 && (
      <section className="panel mt-5 p-5 md:p-7">
        <h2 className="text-xl font-black">{locale === "th" ? "การใช้ไฟแยกตามอุปกรณ์" : "Usage by appliance"}</h2>
        <ul className="mt-3 divide-y divide-[#d7e5eb]">
          {breakdown.map((device) => {
            const usage = byDevice.get(device.id) ?? 0;
            const cost = energy?.estimatedCost == null || !energy.energyKwh ? null : usage / energy.energyKwh * energy.estimatedCost;
            return (
              <li key={device.id}>
                <Link className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3.5 hover:text-[#315f72]" href={`/devices/${device.id}`}>
                  <span className="flex items-center gap-3 font-bold"><ApplianceIcon name={device.name} size={42} />{device.name}</span>
                  <span className="text-right">
                    <strong className="block tabular-nums">{number.format(usage)} kWh</strong>
                    {cost != null && <small className="text-[#5d6b71]">{locale === "th" ? "ประมาณ" : "Est."} {money.format(cost)}</small>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    )}

    <section className="panel mt-5 p-5 md:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">{t("history")}</h2><p className="mt-1 text-xs text-[#748078]">{t("estimateNotice")}</p></div><div className="rounded-xl bg-[#f3f7f3] px-3 py-2 text-xs font-bold text-[#4d6955]"><Activity className="mr-1 inline" size={14}/>{t("peak")}: {number.format(peak)} W</div></div>
      <div className="mt-5 min-h-72">
        {loading ? (
          <div className="flex h-72 items-center justify-center gap-2 text-sm font-bold text-[#5d6b71]"><LoaderCircle className="animate-spin" size={19}/>{t("loading")}</div>
        ) : chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-center text-sm font-semibold text-[#778179]">{t("empty")}</div>
        ) : (
          <EnergyChart data={chartData.map((point) => ({ label: point.label, value: point.energy }))} />
        )}
      </div>
    </section>
  </div>;
}
