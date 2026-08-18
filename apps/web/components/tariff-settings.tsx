"use client";

import { CircleDollarSign, House, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { Link } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";

type Home = { id: string; name: string; currency: string };
type Tariff = {
  id: string;
  homeId: string;
  name: string;
  currency: string;
  flatRatePerKwh: number;
  updatedAt: string;
};

export function TariffSettings() {
  const t = useTranslations("Tariff");
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [tariff, setTariff] = useState<Tariff | null>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    apiRequest<Home[]>("/v1/homes")
      .then((items) => {
        if (!active) return;
        setHomes(items);
        setHomeId(items[0]?.id ?? "");
      })
      .catch(() => setError(t("loadFailed")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [t]);

  useEffect(() => {
    if (!homeId) return;
    setLoading(true); setError(undefined);
    apiRequest<Tariff | null>(`/v1/homes/${homeId}/tariff`)
      .then(setTariff)
      .catch(() => setError(t("loadFailed")))
      .finally(() => setLoading(false));
  }, [homeId, t]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!homeId) return;
    const form = new FormData(event.currentTarget);
    setError(undefined); setSaved(false);
    startTransition(async () => {
      try {
        const updated = await apiRequest<Tariff>(`/v1/homes/${homeId}/tariff`, {
          method: "PUT",
          body: JSON.stringify({
            name: String(form.get("name") ?? ""),
            flatRatePerKwh: Number(form.get("rate"))
          })
        });
        setTariff(updated);
        setSaved(true);
      } catch { setError(t("saveFailed")); }
    });
  }

  if (loading && homes.length === 0) return <div className="panel flex min-h-72 items-center justify-center gap-2 p-8 text-sm font-bold text-[#68736a]"><LoaderCircle className="animate-spin" size={19}/>{t("loading")}</div>;
  if (!loading && homes.length === 0) return <div className="panel flex min-h-72 flex-col items-center justify-center p-8 text-center"><House size={34} className="text-[#259544]"/><h2 className="mt-4 text-xl font-black">{t("noHome")}</h2><Link href="/devices/add" className="mt-5 rounded-2xl bg-[#209842] px-5 py-3 font-bold text-white">{t("createHome")}</Link></div>;

  const selectedHome = homes.find((home) => home.id === homeId);
  return <div className="grid gap-6 lg:grid-cols-[.78fr_1.22fr]">
    <aside className="panel h-fit p-6"><span className="grid size-12 place-items-center rounded-2xl bg-[#fff5df] text-[#a96b0a]"><CircleDollarSign size={23}/></span><h2 className="mt-4 text-xl font-black">{t("estimateTitle")}</h2><p className="mt-2 text-sm leading-7 text-[#68736a]">{t("estimateBody")}</p><div className="mt-5 flex gap-2 rounded-2xl bg-[#edf7ef] p-4 text-xs leading-6 text-[#356d43]"><ShieldCheck className="mt-1 shrink-0" size={17}/>{t("notice")}</div></aside>
    <section className="panel p-6 md:p-8">
      <label><span className="mb-2 block text-sm font-bold">{t("home")}</span><select value={homeId} onChange={(event) => setHomeId(event.target.value)} className="h-12 w-full rounded-2xl border border-[#dce5dd] bg-white px-4">{homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select></label>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
      {saved ? <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">{t("saved")}</p> : null}
      <form key={`${homeId}:${tariff?.updatedAt ?? "new"}`} onSubmit={submit} className="mt-6 space-y-5">
        <label className="block"><span className="mb-2 block text-sm font-bold">{t("name")}</span><input required name="name" defaultValue={tariff?.name ?? t("defaultName")} maxLength={120} className="h-12 w-full rounded-2xl border border-[#dce5dd] px-4"/></label>
        <label className="block"><span className="mb-2 block text-sm font-bold">{t("rate")}</span><div className="flex items-center rounded-2xl border border-[#dce5dd] bg-white px-4"><input required name="rate" type="number" min="0.0001" max="100" step="0.0001" defaultValue={tariff?.flatRatePerKwh ?? 4.2} className="h-12 min-w-0 flex-1 outline-none"/><span className="text-sm font-bold text-[#657168]">{selectedHome?.currency ?? "THB"}/kWh</span></div></label>
        <button disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#209842] font-bold text-white disabled:opacity-60">{pending ? <LoaderCircle className="animate-spin" size={18}/> : <Save size={18}/>} {t("save")}</button>
      </form>
    </section>
  </div>;
}
