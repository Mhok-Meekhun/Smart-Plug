import { Activity, CalendarClock, CircleDollarSign, Fan, LampDesk, PlugZap, Refrigerator, Wifi, Zap } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EnergyChart } from "../../../../components/energy-chart";
import { PowerToggle } from "../../../../components/power-toggle";
import { RealtimeRefresh } from "../../../../components/realtime-refresh";
import { Link } from "../../../../i18n/navigation";
import { createClient } from "../../../../lib/supabase/server";
import { demoMode } from "../../../../lib/supabase/config";

const demoDevices = [
  { id: "demo-tv", nameTh: "ปลั๊กทีวี", nameEn: "Living room TV", roomTh: "ห้องนั่งเล่น", roomEn: "Living room", power: 65, online: true, relay: true, icon: PlugZap, tone: "bg-emerald-50 text-emerald-700" },
  { id: "demo-fan", nameTh: "ปลั๊กพัดลม", nameEn: "Bedroom fan", roomTh: "ห้องนอน", roomEn: "Bedroom", power: 28, online: true, relay: true, icon: Fan, tone: "bg-blue-50 text-blue-700" },
  { id: "demo-lamp", nameTh: "ปลั๊กโคมไฟ", nameEn: "Desk lamp", roomTh: "ห้องทำงาน", roomEn: "Study", power: 0, online: false, relay: false, icon: LampDesk, tone: "bg-amber-50 text-amber-700" },
  { id: "demo-fridge", nameTh: "ปลั๊กตู้เย็น", nameEn: "Kitchen fridge", roomTh: "ห้องครัว", roomEn: "Kitchen", power: 120, online: true, relay: true, icon: Refrigerator, tone: "bg-violet-50 text-violet-700" }
];

async function loadDevices() {
  if (demoMode()) return { homeId: undefined, devices: demoDevices, demo: true };
  const supabase=await createClient();
  const {data:homes}=await supabase.from("homes").select("id").order("created_at").limit(1);
  const homeId=homes?.[0]?.id;
  if(!homeId)return {homeId:undefined,devices:[],demo:false};
  const [{data:rows},{data:rooms}]=await Promise.all([
    supabase.from("devices").select("id,name,room_id,icon,device_states(connection_status,relay_state,power_w)").eq("home_id",homeId).order("name"),
    supabase.from("rooms").select("id,name").eq("home_id",homeId)
  ]);
  const roomNames=new Map((rooms??[]).map((room)=>[room.id,room.name]));
  return {homeId,demo:false,devices:(rows??[]).map((device)=>({id:device.id,nameTh:device.name,nameEn:device.name,roomTh:device.room_id?roomNames.get(device.room_id)??"—":"—",roomEn:device.room_id?roomNames.get(device.room_id)??"—":"—",power:Number(device.device_states?.power_w??0),online:device.device_states?.connection_status==="ONLINE",relay:Boolean(device.device_states?.relay_state),icon:PlugZap,tone:"bg-emerald-50 text-emerald-700"}))};
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations("Dashboard");
  const d = await getTranslations("Device");
  const isThai = locale === "th";
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const dashboard=await loadDevices();
  const totalPower=dashboard.devices.reduce((sum,device)=>sum+device.power,0);
  const onlineCount=dashboard.devices.filter((device)=>device.online).length;

  return (
    <main className="mx-auto max-w-[92rem] px-5 py-7 md:px-8 lg:px-10 lg:py-10">
      <RealtimeRefresh homeId={dashboard.homeId}/>
      <section className="relative overflow-hidden rounded-[2rem] bg-[#123d25] px-6 py-8 text-white shadow-[0_22px_60px_rgba(15,69,35,.18)] md:px-10 md:py-10">
        <div className="absolute -right-20 -top-28 size-80 rounded-full border-[58px] border-white/5" aria-hidden="true" />
        <div className="relative grid gap-8 xl:grid-cols-[1.2fr_.8fr] xl:items-end">
          <div>
            <p className="text-xs font-bold tracking-[.18em] text-[#89dda0]">{t("eyebrow")}</p>
            <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-[-.04em] md:text-5xl">{t("title")}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 md:text-base">{t("subtitle")}</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/80"><Activity size={15} />{dashboard.demo?`${t("demo")} · `:""}{t("updated")}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur"><div className="flex items-center gap-2 text-xs text-white/65"><Zap size={16}/>{t("livePower")}</div><div className="metric-number mt-3 text-4xl font-black">{number.format(totalPower)} <span className="text-base font-semibold text-white/60">W</span></div></div>
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur"><div className="flex items-center gap-2 text-xs text-white/65"><Wifi size={16}/>{t("online")}</div><div className="metric-number mt-3 text-4xl font-black">{onlineCount}<span className="text-base font-semibold text-white/60">/{dashboard.devices.length}</span></div></div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: t("livePower"), value: number.format(totalPower), unit: "W", icon: Zap, color: "text-[#218d40] bg-[#e9f7ec]" },
          { label: t("todayEnergy"), value: number.format(3.84), unit: "kWh", icon: Activity, color: "text-[#2678b9] bg-[#eaf4fb]" },
          { label: t("estimatedCost"), value: number.format(16.51), unit: isThai ? "บาท" : "THB", icon: CircleDollarSign, color: "text-[#a96b0a] bg-[#fff5df]" }
        ].map(({ label, value, unit, icon: Icon, color }) => (
          <article key={label} className="panel flex items-center gap-4 p-5 md:p-6"><span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${color}`}><Icon size={22}/></span><div><p className="text-xs font-semibold text-[#748078]">{label}</p><p className="metric-number mt-1 text-2xl font-black">{value} <span className="text-sm font-semibold text-[#6e796f]">{unit}</span></p></div></article>
        ))}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.18fr_.82fr]">
        <section className="panel p-5 md:p-7">
          <div className="flex items-center justify-between"><div><h2 className="text-xl font-black">{t("devices")}</h2><p className="mt-1 text-xs text-[#778279]">{onlineCount} {d("online")} · {dashboard.devices.length-onlineCount} {d("offline")}</p></div><Link href="/devices" className="rounded-full bg-[#edf7ef] px-4 py-2 text-xs font-bold text-[#1a7f38]">{t("viewAll")}</Link></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {dashboard.devices.length===0?<div className="col-span-full rounded-3xl border border-dashed border-[#bdd7c2] bg-[#f1f8f2] p-8 text-center text-sm font-semibold text-[#477552]">{t("empty")}</div>:dashboard.devices.map((device) => {
              const Icon = device.icon;
              return <article key={device.id} className="flex min-h-32 items-center gap-4 rounded-[1.25rem] border border-[#e4ebe5] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-950/5"><span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${device.tone}`}><Icon size={23}/></span><div className="min-w-0 flex-1"><h3 className="truncate font-bold">{isThai ? device.nameTh : device.nameEn}</h3><p className="mt-1 truncate text-xs text-[#7b857d]">{isThai ? device.roomTh : device.roomEn}</p><div className="mt-3 flex items-center gap-2"><span className={`size-2 rounded-full ${device.online ? "bg-[#27a64a]" : "bg-[#aab2ac]"}`}/><span className={`text-xs font-semibold ${device.online ? "text-[#258b41]" : "text-[#89928b]"}`}>{device.online ? d("online") : d("offline")}</span><span className="ml-auto text-sm font-black tabular-nums">{device.power} W</span></div></div><PowerToggle deviceId={device.id} initialState={device.relay} demo={dashboard.demo}/></article>;
            })}
          </div>
        </section>

        <section className="panel p-5 md:p-7">
          <div className="flex items-start justify-between"><div><h2 className="text-xl font-black">{t("todayUsage")}</h2><p className="mt-1 text-xs text-[#778279]">{t("weeklyAverage")}: 3.46 kWh</p></div><div className="rounded-2xl bg-[#e9f7ec] px-3 py-2 text-right"><strong className="block text-[#188039]">3.84 kWh</strong><span className="text-[.65rem] text-[#4f735a]">+11%</span></div></div>
          <div className="mt-4"><EnergyChart /></div>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#f4f7f4] p-4"><span className="grid size-10 place-items-center rounded-xl bg-white text-[#218e40]"><CalendarClock size={19}/></span><div><p className="text-xs text-[#768078]">{t("nextSchedule")}</p><p className="mt-1 text-sm font-bold">{isThai ? "ปิดปลั๊กทีวี" : "Turn off living room TV"} · 22:30</p></div></div>
        </section>
      </div>
    </main>
  );
}
