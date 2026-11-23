"use client";

import { ArrowUpRight, DoorOpen, House, LoaderCircle, Plus, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { FormEvent, useCallback, useEffect, useState, useTransition } from "react";
import { apiRequest } from "../lib/api-client";
import { Link } from "../i18n/navigation";
import { roomCategories, roomKind, roomName } from "../lib/rooms";
import { ApplianceIcon } from "./appliance-icon";

type Home = {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  _count: { rooms: number; devices: number };
};

type Room = {
  id: string;
  homeId: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  _count: { devices: number };
};

type RoomAppliance = { id: string; homeId: string; roomId: string | null; name: string };

export function HomeRoomManager() {
  const t = useTranslations("HomeRooms");
  const locale = useLocale();
  const thai = locale === "th";
  const [homes, setHomes] = useState<Home[]>([]);
  const [homeId, setHomeId] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [appliances, setAppliances] = useState<RoomAppliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, startTransition] = useTransition();

  const loadHomes = useCallback(async (preferredHomeId?: string) => {
    const values = await apiRequest<Home[]>("/v1/homes");
    setHomes(values);
    setHomeId((current) => (preferredHomeId ?? current) || values[0]?.id || "");
    return values;
  }, []);

  useEffect(() => {
    let active = true;
    loadHomes()
      .catch(() => active && setError(t("loadFailed")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [loadHomes, t]);

  useEffect(() => {
    if (!homeId) { setRooms([]); return; }
    let active = true;
    setLoading(true);
    Promise.all([
      apiRequest<Room[]>(`/v1/homes/${homeId}/rooms`),
      apiRequest<RoomAppliance[]>(`/v1/devices?homeId=${encodeURIComponent(homeId)}`),
    ])
      .then(([values, items]) => {
        if (!active) return;
        setRooms(values);
        setAppliances(items.filter((item) => item.homeId === homeId));
      })
      .catch(() => active && setError(t("loadFailed")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [homeId, t]);

  function createHome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(undefined); setNotice(undefined);
    startTransition(async () => {
      try {
        const created = await apiRequest<Home>("/v1/homes", {
          method: "POST",
          body: JSON.stringify({ name: String(data.get("homeName") ?? ""), timezone: "Asia/Bangkok", currency: "THB" })
        });
        await loadHomes(created.id);
        form.reset();
        setNotice(t("homeCreated"));
      } catch { setError(t("saveFailed")); }
    });
  }

  function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!homeId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(undefined); setNotice(undefined);
    startTransition(async () => {
      try {
        await apiRequest<Room>(`/v1/homes/${homeId}/rooms`, {
          method: "POST",
          body: JSON.stringify({
            name: String(data.get("roomName") ?? ""),
            ...(data.get("roomType") ? { icon: data.get("roomType") } : {}),
          })
        });
        setRooms(await apiRequest<Room[]>(`/v1/homes/${homeId}/rooms`));
        await loadHomes(homeId);
        form.reset();
        setNotice(t("roomCreated"));
      } catch { setError(t("saveFailed")); }
    });
  }

  const selectedHome = homes.find((home) => home.id === homeId);

  return <div className="space-y-6">
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
    {notice ? <p role="status" className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">{notice}</p> : null}
    <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
      <aside className="panel h-fit p-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-[#e2f0f5] text-[#228d40]"><House size={23}/></span>
        <h2 className="mt-4 text-xl font-black">{t("homes")}</h2>
        <p className="mt-2 text-sm leading-6 text-[#5d6b71]">{t("homeHelp")}</p>
        {homes.length ? <label className="mt-5 block"><span className="mb-2 block text-sm font-bold">{t("selectedHome")}</span><select value={homeId} onChange={(event) => setHomeId(event.target.value)} className="h-12 w-full rounded-2xl border border-[#d1e1e8] bg-white px-4">{homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select></label> : null}
        {selectedHome ? <dl className="mt-4 grid grid-cols-2 gap-3 text-center"><div className="rounded-2xl bg-[#f4f7f4] p-3"><dt className="text-xs text-[#718076]">{t("rooms")}</dt><dd className="mt-1 text-xl font-black">{selectedHome._count.rooms}</dd></div><div className="rounded-2xl bg-[#f4f7f4] p-3"><dt className="text-xs text-[#718076]">{t("devices")}</dt><dd className="mt-1 text-xl font-black">{selectedHome._count.devices}</dd></div></dl> : null}
        <form onSubmit={createHome} className="mt-6 border-t border-[#e3e9e4] pt-5"><label><span className="mb-2 block text-sm font-bold">{t("newHome")}</span><input required name="homeName" maxLength={120} placeholder={t("homePlaceholder")} className="h-12 w-full rounded-2xl border border-[#d1e1e8] px-4"/></label><button disabled={pending} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#b9d9c0] bg-[#eff8f1] text-sm font-bold text-[#1c7e38] disabled:opacity-60"><Plus size={17}/>{t("addHome")}</button></form>
      </aside>
      <section className="panel p-6 md:p-8">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">{t("rooms")}</h2><p className="mt-1 text-sm text-[#5d6b71]">{selectedHome?.name ?? t("noHome")}</p></div>{loading ? <LoaderCircle className="animate-spin text-[#278f43]" size={20}/> : null}</div>
        {!loading && !homeId ? <div className="mt-8 rounded-3xl border border-dashed border-[#bcd6c1] bg-[#eff8f1] p-7 text-center text-sm font-semibold text-[#39764a]">{t("createHomeFirst")}</div> : null}
        {!loading && homeId && rooms.length === 0 ? <div className="mt-8 rounded-3xl border border-dashed border-[#bcd6c1] bg-[#eff8f1] p-7 text-center text-sm font-semibold text-[#39764a]">{t("empty")}</div> : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {rooms.map((room) => {
            const items = appliances.filter((item) => item.roomId === room.id);
            return <article key={room.id} className="room-directory-card" data-room={roomKind(room)}>
              <Link href={{ pathname: "/devices", query: { room: room.id } }} className="flex min-h-11 items-center gap-3">
                <DoorOpen size={19} className="shrink-0 text-[#315f72]" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <strong className="block">{roomName(room, locale)}</strong>
                  <small className="text-[#5d6b71]">{t("deviceCount", { count: room._count.devices })}</small>
                </span>
                <ArrowUpRight size={16} className="shrink-0" aria-hidden="true" />
              </Link>
              {items.length > 0 && <ul className="mt-2 space-y-1">
                {items.map((item) => <li key={item.id}>
                  <Link href={`/devices/${item.id}`} className="floor-device">
                    <ApplianceIcon name={item.name} size={38} />
                    <strong>{item.name}</strong>
                  </Link>
                </li>)}
              </ul>}
            </article>;
          })}
        </div>
        {homeId && <form onSubmit={createRoom} className="mt-7 border-t border-[#d7e5eb] pt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="mb-2 block text-sm font-bold">{t("newRoom")}</span>
              <input required name="roomName" maxLength={120} placeholder={t("roomPlaceholder")} className="h-12 w-full rounded-xl border border-[#d1e1e8] px-4" />
            </label>
            <label><span className="mb-2 block text-sm font-bold">{thai ? "ประเภทห้อง" : "Room type"}</span>
              <select name="roomType" className="h-12 w-full rounded-xl border border-[#d1e1e8] bg-white px-3">
                <option value="">{thai ? "ระบุจากชื่อห้อง" : "Infer from room name"}</option>
                {roomCategories.map((category) => <option key={category.key} value={category.key}>{thai ? category.th : category.en}</option>)}
              </select>
            </label>
          </div>
          <button disabled={pending} className="ruan-action mt-3 disabled:opacity-60">
            {pending ? <LoaderCircle className="animate-spin" size={17}/> : <Plus size={17}/>}
            {t("addRoom")}
          </button>
          <div className="mt-4 flex gap-2 rounded-2xl bg-[#f0f6f8] p-3 text-xs leading-5 text-[#5d6b71]">
            <ShieldCheck className="mt-0.5 shrink-0" size={16}/>{t("ownerNotice")}
          </div>
        </form>}
      </section>
    </div>
  </div>;
}
