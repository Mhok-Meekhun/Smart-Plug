"use client";

import { Activity, CircleDollarSign, LoaderCircle, PlugZap, TrendingUp, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";

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
        setDeviceId(deviceItems.find((device) => device.homeId === firstHome)?.id ?? "");
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
  const chartData = (energy?.points ?? []).map((point) => ({
    label: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(point.bucketStart)),
    energy: point.energyKwh,
    peak: point.peakPowerW
  }));
  const average = energy && chartData.length > 0 ? energy.energyKwh / chartData.length : 0;
  const peak = Math.max(0, ...(energy?.points ?? []).map((point) => point.peakPowerW));

  if (!loading && homes.length === 0) {
    return <div className="panel flex min-h-80 flex-col items-center justify-center p-8 text-center"><PlugZap size={34} className="text-[#239443]"/><h2 className="mt-4 text-xl font-black">{t("setupRequired")}</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#68736a]">{t("setupBody")}</p><Link href="/devices/add" className="mt-5 rounded-2xl bg-[#209842] px-5 py-3 font-bold text-white">{t("setupAction")}</Link></div>;
  }

  return <div>
    <div className="flex flex-col gap-4 rounded-3xl border border-[#e0e8e1] bg-white p-4 sm:flex-row sm:items-end">
      <label className="flex-1"><span className="mb-2 block text-xs font-bold text-[#6f7a72]">{t("home")}</span><select value={homeId} onChange={(event) => { const nextHome = event.target.value; setHomeId(nextHome); setDeviceId(devices.find((device) => device.homeId === nextHome)?.id ?? ""); }} className="h-11 w-full rounded-xl border border-[#dae4db] px-3">{homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select></label>
      <label className="flex-1"><span className="mb-2 block text-xs font-bold text-[#6f7a72]">{t("device")}</span><select value={deviceId} onChange={(event) => setDeviceId(event.target.value)} className="h-11 w-full rounded-xl border border-[#dae4db] px-3"><option value="">{t("allDevices")}</option>{visibleDevices.map((device) => <option key={device.id} value={device.id}>{device.name}{device.type === "SIMULATED_SMART_PLUG" ? ` · ${t("simulated")}` : ""}</option>)}</select></label>
      <div><span className="mb-2 block text-xs font-bold text-[#6f7a72]">{t("range")}</span><div className="flex rounded-xl bg-[#eef4ef] p-1">{[7, 30].map((value) => <button key={value} onClick={() => setDays(value)} className={`h-9 rounded-lg px-4 text-xs font-bold ${days === value ? "bg-white text-[#197c37] shadow-sm" : "text-[#69746b]"}`}>{value === 7 ? t("sevenDays") : t("thirtyDays")}</button>)}</div></div>
    </div>

    {error ? <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{t("loadFailed")} <button onClick={loadEnergy} className="ml-2 underline">{t("retry")}</button></div> : null}
    <section className="mt-5 grid gap-4 sm:grid-cols-3">
      {[{ label: t("total"), value: number.format(energy?.energyKwh ?? 0), unit: "kWh", icon: Zap, tone: "bg-[#e9f7ec] text-[#218d40]" }, { label: t("dailyAverage"), value: number.format(average), unit: "kWh", icon: TrendingUp, tone: "bg-[#eaf4fb] text-[#2678b9]" }, { label: t("estimatedCost"), value: energy?.estimatedCost == null ? "—" : number.format(energy.estimatedCost), unit: energy?.currency ?? "THB", icon: CircleDollarSign, tone: "bg-[#fff5df] text-[#a96b0a]" }].map(({ label, value, unit, icon: Icon, tone }) => <article key={label} className="panel flex items-center gap-4 p-5"><span className={`grid size-11 place-items-center rounded-2xl ${tone}`}><Icon size={20}/></span><div><p className="text-xs font-bold text-[#748078]">{label}</p><p className="metric-number mt-1 text-2xl font-black">{value} <span className="text-xs font-semibold text-[#6e796f]">{unit}</span></p></div></article>)}
    </section>

    <section className="panel mt-5 p-5 md:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">{t("history")}</h2><p className="mt-1 text-xs text-[#748078]">{t("estimateNotice")}</p></div><div className="rounded-xl bg-[#f3f7f3] px-3 py-2 text-xs font-bold text-[#4d6955]"><Activity className="mr-1 inline" size={14}/>{t("peak")}: {number.format(peak)} W</div></div>
      <div className="mt-5 h-72" role="img" aria-label={t("chartLabel")}>{loading ? <div className="flex h-full items-center justify-center gap-2 text-sm font-bold text-[#68736a]"><LoaderCircle className="animate-spin" size={19}/>{t("loading")}</div> : chartData.length === 0 ? <div className="flex h-full items-center justify-center text-center text-sm font-semibold text-[#778179]">{t("empty")}</div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2baa4d" stopOpacity={0.32}/><stop offset="1" stopColor="#2baa4d" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e9eee9" strokeDasharray="4 5" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#7a857c", fontSize: 11 }}/><YAxis tickLine={false} axisLine={false} tick={{ fill: "#7a857c", fontSize: 11 }}/><Tooltip formatter={(value) => [`${number.format(Number(value))} kWh`, t("energy")]}/><Area type="monotone" dataKey="energy" stroke="#249b45" strokeWidth={3} fill="url(#historyFill)"/></AreaChart></ResponsiveContainer>}</div>
    </section>
  </div>;
}
