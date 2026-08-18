"use client";

import { Check, House, LoaderCircle, MapPin, PlugZap, Plus, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";

type Home = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  _count?: { rooms: number; devices: number };
};

type Room = {
  id: string;
  homeId: string;
  name: string;
  icon: string | null;
  _count?: { devices: number };
};

export function OnboardingFlow() {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [homes, setHomes] = useState<Home[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [homeId, setHomeId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    apiRequest<Home[]>("/v1/homes")
      .then((items) => {
        if (!active) return;
        setHomes(items);
        setHomeId(items[0]?.id ?? "");
      })
      .catch(() => active && setError(t("loadFailed")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [t]);

  useEffect(() => {
    if (!homeId) {
      setRooms([]);
      setRoomId("");
      return;
    }
    let active = true;
    apiRequest<Room[]>(`/v1/homes/${homeId}/rooms`)
      .then((items) => {
        if (!active) return;
        setRooms(items);
        setRoomId((current) => items.some((room) => room.id === current) ? current : items[0]?.id ?? "");
      })
      .catch(() => active && setError(t("loadFailed")));
    return () => { active = false; };
  }, [homeId, t]);

  function submitHome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(undefined); setNotice(undefined);
    startTransition(async () => {
      try {
        const home = await apiRequest<Home>("/v1/homes", {
          method: "POST",
          body: JSON.stringify({
            name: String(data.get("name") ?? ""),
            timezone: "Asia/Bangkok",
            currency: "THB"
          })
        });
        setHomes((items) => [...items, home]);
        setHomeId(home.id);
        setNotice(t("homeCreated"));
        form.reset();
      } catch { setError(t("saveFailed")); }
    });
  }

  function submitRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!homeId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(undefined); setNotice(undefined);
    startTransition(async () => {
      try {
        const room = await apiRequest<Room>(`/v1/homes/${homeId}/rooms`, {
          method: "POST",
          body: JSON.stringify({ name: String(data.get("name") ?? ""), icon: "room" })
        });
        setRooms((items) => [...items, room]);
        setRoomId(room.id);
        setNotice(t("roomCreated"));
        form.reset();
      } catch { setError(t("saveFailed")); }
    });
  }

  function submitDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!homeId || !roomId) return;
    const data = new FormData(event.currentTarget);
    setError(undefined); setNotice(undefined);
    startTransition(async () => {
      try {
        await apiRequest("/v1/devices/simulated", {
          method: "POST",
          body: JSON.stringify({
            homeId,
            roomId,
            name: String(data.get("name") ?? ""),
            icon: "plug"
          })
        });
        router.push("/devices");
        router.refresh();
      } catch { setError(t("saveFailed")); }
    });
  }

  if (loading) {
    return <div className="panel flex min-h-80 items-center justify-center gap-3 p-8 text-sm font-semibold text-[#58705f]"><LoaderCircle className="animate-spin" size={20}/>{t("loading")}</div>;
  }

  const stages = [
    { label: t("homeStep"), done: homes.length > 0, icon: House },
    { label: t("roomStep"), done: rooms.length > 0, icon: MapPin },
    { label: t("deviceStep"), done: false, icon: PlugZap }
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
      <aside className="panel h-fit p-6 md:p-7">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#e8f7eb] text-[#218f41]"><ShieldCheck size={22}/></span><div><p className="text-xs font-bold tracking-[.14em] text-[#218f41]">{t("eyebrow")}</p><h2 className="mt-1 text-xl font-black">{t("progress")}</h2></div></div>
        <ol className="mt-7 space-y-3">
          {stages.map(({ label, done, icon: Icon }, index) => <li key={label} className={`flex items-center gap-3 rounded-2xl border p-4 ${done ? "border-[#cce7d1] bg-[#f0f9f2]" : "border-[#e2e9e3] bg-white"}`}><span className={`grid size-9 place-items-center rounded-xl ${done ? "bg-[#269c47] text-white" : "bg-[#f0f3f0] text-[#6f7a71]"}`}>{done ? <Check size={18}/> : <Icon size={18}/>}</span><div><p className="text-xs font-bold text-[#7a857c]">{index + 1}</p><p className="font-bold">{label}</p></div></li>)}
        </ol>
        <p className="mt-5 rounded-2xl bg-[#fff8e8] p-4 text-xs leading-6 text-[#76571b]">{t("simulationNote")}</p>
      </aside>

      <section className="space-y-5">
        {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
        {notice ? <div role="status" className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{notice}</div> : null}

        <article className="panel p-6 md:p-7">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf6ec] text-[#218f41]"><House size={20}/></span><div><p className="text-xs font-bold text-[#238e41]">{t("step", { number: 1 })}</p><h2 className="text-xl font-black">{t("createHome")}</h2></div></div>
          {homes.length > 0 ? <label className="mt-5 block"><span className="mb-2 block text-sm font-bold">{t("selectHome")}</span><select value={homeId} onChange={(event) => setHomeId(event.target.value)} className="h-12 w-full rounded-2xl border border-[#dce5dd] bg-white px-4 outline-none focus:border-[#269b47]">{homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select></label> : <form onSubmit={submitHome} className="mt-4 flex flex-col gap-3 sm:flex-row"><input required name="name" maxLength={120} placeholder={t("homeNamePlaceholder")} className="h-12 min-w-0 flex-1 rounded-2xl border border-[#dce5dd] px-4 outline-none focus:border-[#269b47]"/><button disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#1f9440] px-5 font-bold text-white disabled:opacity-60"><Plus size={18}/>{t("addHome")}</button></form>}
        </article>

        <article className={`panel p-6 md:p-7 ${!homeId ? "opacity-60" : ""}`}>
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#eef5fb] text-[#2877ad]"><MapPin size={20}/></span><div><p className="text-xs font-bold text-[#2877ad]">{t("step", { number: 2 })}</p><h2 className="text-xl font-black">{t("createRoom")}</h2></div></div>
          {rooms.length > 0 ? <div className="mt-5 flex flex-wrap gap-2">{rooms.map((room) => <button type="button" key={room.id} onClick={() => setRoomId(room.id)} className={`rounded-full px-4 py-2 text-sm font-bold ${roomId === room.id ? "bg-[#247eae] text-white" : "bg-[#edf4f8] text-[#416b81]"}`}>{room.name}</button>)}</div> : null}
          <form onSubmit={submitRoom} className="mt-4 flex flex-col gap-3 sm:flex-row"><input required disabled={!homeId} name="name" maxLength={120} placeholder={t("roomNamePlaceholder")} className="h-12 min-w-0 flex-1 rounded-2xl border border-[#dce5dd] px-4 outline-none focus:border-[#269b47] disabled:bg-[#f1f3f1]"/><button disabled={!homeId || pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#287dad] px-5 font-bold text-white disabled:opacity-50"><Plus size={18}/>{t("addRoom")}</button></form>
        </article>

        <article className={`panel p-6 md:p-7 ${!roomId ? "opacity-60" : ""}`}>
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#f0ebfb] text-[#6b45a6]"><PlugZap size={20}/></span><div><p className="text-xs font-bold text-[#6b45a6]">{t("step", { number: 3 })}</p><h2 className="text-xl font-black">{t("addSimulator")}</h2></div></div>
          <p className="mt-3 text-sm leading-6 text-[#68736a]">{t("simulatorDescription")}</p>
          <form onSubmit={submitDevice} className="mt-4 flex flex-col gap-3 sm:flex-row"><input required disabled={!roomId} name="name" maxLength={120} placeholder={t("deviceNamePlaceholder")} className="h-12 min-w-0 flex-1 rounded-2xl border border-[#dce5dd] px-4 outline-none focus:border-[#269b47] disabled:bg-[#f1f3f1]"/><button disabled={!roomId || pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#6842a2] px-5 font-bold text-white disabled:opacity-50">{pending ? <LoaderCircle className="animate-spin" size={18}/> : <PlugZap size={18}/>} {t("createSimulator")}</button></form>
        </article>
      </section>
    </div>
  );
}
