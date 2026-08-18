"use client";

import { Check, Clipboard, House, LoaderCircle, Router, ShieldCheck, Smartphone, Wifi } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { Link, useRouter } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";

type Home = { id: string; name: string };
type Room = { id: string; homeId: string; name: string };
type VirtualPairing = { id: string; hardwareId: string; pairingCode: string; expiresAt: string; expiresInSeconds: number; virtual: true };
type ClaimResult = {
  device: { id: string; name: string; type: string; lifecycleStatus: string };
  credential: { id: string; credentialId: string; status: string; secretReturnedOnce: true };
  virtual: boolean;
  brokerRegistration: "PENDING";
};

export function ProvisioningWizard() {
  const t = useTranslations("Provisioning");
  const router = useRouter();
  const [mode, setMode] = useState<"virtual" | "physical">("virtual");
  const [homes, setHomes] = useState<Home[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [homeId, setHomeId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [pairing, setPairing] = useState<VirtualPairing>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    apiRequest<Home[]>("/v1/homes")
      .then((values) => { if (active) { setHomes(values); setHomeId(values[0]?.id ?? ""); } })
      .catch(() => active && setError(t("loadFailed")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [t]);

  useEffect(() => {
    if (!homeId) { setRooms([]); setRoomId(""); return; }
    let active = true;
    apiRequest<Room[]>(`/v1/homes/${homeId}/rooms`)
      .then((values) => { if (active) { setRooms(values); setRoomId(values[0]?.id ?? ""); } })
      .catch(() => active && setError(t("loadFailed")));
    return () => { active = false; };
  }, [homeId, t]);

  function createVirtualCode() {
    setError(undefined); setCopied(false);
    startTransition(async () => {
      try {
        const value = await apiRequest<VirtualPairing>("/v1/provisioning/virtual", { method: "POST" });
        setPairing(value);
        setCode(value.pairingCode);
      } catch { setError(t("codeFailed")); }
    });
  }

  function copyCode() {
    if (!code) return;
    void navigator.clipboard.writeText(code).then(() => setCopied(true));
  }

  function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!homeId || !roomId) return;
    const data = new FormData(event.currentTarget);
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await apiRequest<ClaimResult>("/v1/provisioning/claim", {
          method: "POST",
          body: JSON.stringify({ pairingCode: code, homeId, roomId, name: String(data.get("name") ?? ""), icon: "plug" })
        });
        // The one-time virtual secret is intentionally never rendered, logged, or persisted in browser storage.
        router.push(`/devices/${result.device.id}`);
        router.refresh();
      } catch { setError(t("claimFailed")); }
    });
  }

  if (loading) return <div className="panel flex min-h-80 items-center justify-center gap-2 p-8 text-sm font-bold text-[#68736a]"><LoaderCircle className="animate-spin" size={19}/>{t("loading")}</div>;
  if (!homes.length) return <div className="panel flex min-h-72 flex-col items-center justify-center p-8 text-center"><House size={36} className="text-[#259544]"/><h2 className="mt-4 text-xl font-black">{t("homeRequired")}</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#68736a]">{t("homeRequiredBody")}</p><Link href="/home/rooms" className="mt-5 rounded-2xl bg-[#209842] px-5 py-3 font-bold text-white">{t("manageHome")}</Link></div>;

  return <div className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
    <aside className="panel h-fit p-6 md:p-7">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#e8f7eb] text-[#218f41]"><ShieldCheck size={22}/></span><h2 className="text-xl font-black">{t("safeTitle")}</h2></div>
      <ol className="mt-6 space-y-4 text-sm leading-6 text-[#56635a]">
        <li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#249c45] font-black text-white">1</span>{t("softApStep")}</li>
        <li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#249c45] font-black text-white">2</span>{t("wifiStep")}</li>
        <li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#249c45] font-black text-white">3</span>{t("codeStep")}</li>
      </ol>
      <div className="mt-6 flex gap-2 rounded-2xl bg-[#fff8e8] p-4 text-xs leading-6 text-[#76571b]"><Wifi className="mt-1 shrink-0" size={17}/>{t("wifiPrivacy")}</div>
      <div className="mt-3 flex gap-2 rounded-2xl bg-[#f2f5f2] p-4 text-xs leading-6 text-[#58665c]"><Smartphone className="mt-1 shrink-0" size={17}/>{t("browserLimit")}</div>
    </aside>

    <section className="space-y-5">
      <div className="panel p-6 md:p-7">
        <h2 className="text-xl font-black">{t("chooseMode")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => { setMode("virtual"); setCode(pairing?.pairingCode ?? ""); }} aria-pressed={mode === "virtual"} className={`rounded-3xl border p-5 text-left ${mode === "virtual" ? "border-[#249c45] bg-[#eff9f1]" : "border-[#dce5dd]"}`}><Router size={22} className="text-[#258f42]"/><span className="mt-3 block font-black">{t("virtual")}</span><span className="mt-1 block text-xs leading-5 text-[#68736a]">{t("virtualHelp")}</span></button>
          <button type="button" onClick={() => { setMode("physical"); setCode(""); }} aria-pressed={mode === "physical"} className={`rounded-3xl border p-5 text-left ${mode === "physical" ? "border-[#249c45] bg-[#eff9f1]" : "border-[#dce5dd]"}`}><Wifi size={22} className="text-[#258f42]"/><span className="mt-3 block font-black">{t("physical")}</span><span className="mt-1 block text-xs leading-5 text-[#68736a]">{t("physicalHelp")}</span></button>
        </div>
      </div>

      <form onSubmit={claim} className="panel p-6 md:p-7">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">{t("pairingCode")}</h2>{code ? <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf7ed] px-3 py-1 text-xs font-bold text-[#1c7b38]"><Check size={14}/>{t("ready")}</span> : null}</div>
        {mode === "virtual" ? <div className="mt-4"><button type="button" onClick={createVirtualCode} disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#b9d9c0] bg-[#eff8f1] font-bold text-[#1c7e38] disabled:opacity-60">{pending ? <LoaderCircle className="animate-spin" size={18}/> : <Router size={18}/>} {pairing ? t("replaceCode") : t("generateCode")}</button>{pairing ? <p className="mt-2 text-center text-xs text-[#748078]">{t("expires", { value: new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(pairing.expiresAt)) })}</p> : null}</div> : <p className="mt-3 text-sm leading-6 text-[#68736a]">{t("physicalCodeHelp")}</p>}
        <label className="mt-5 block"><span className="mb-2 block text-sm font-bold">{t("codeLabel")}</span><div className="flex rounded-2xl border border-[#dce5dd] bg-white px-4"><input required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} minLength={16} maxLength={24} autoComplete="one-time-code" placeholder="ABCD-EF01-2345-6789" className="h-12 min-w-0 flex-1 font-mono tracking-[.08em] outline-none"/><button type="button" onClick={copyCode} aria-label={t("copy")} className="px-2 text-[#67736a]"><Clipboard size={18}/></button></div>{copied ? <span role="status" className="mt-2 block text-xs font-bold text-[#218740]">{t("copied")}</span> : null}</label>

        <div className="mt-6 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-bold">{t("home")}</span><select value={homeId} onChange={(event) => setHomeId(event.target.value)} className="h-12 w-full rounded-2xl border border-[#dce5dd] bg-white px-4">{homes.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select></label><label><span className="mb-2 block text-sm font-bold">{t("room")}</span><select required value={roomId} onChange={(event) => setRoomId(event.target.value)} className="h-12 w-full rounded-2xl border border-[#dce5dd] bg-white px-4"><option value="">{t("selectRoom")}</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label></div>
        <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">{t("deviceName")}</span><input required name="name" maxLength={120} placeholder={t("namePlaceholder")} className="h-12 w-full rounded-2xl border border-[#dce5dd] px-4"/></label>
        {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        <button disabled={pending || !code || !roomId} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#209842] font-bold text-white disabled:opacity-50">{pending ? <LoaderCircle className="animate-spin" size={18}/> : <ShieldCheck size={18}/>} {t("claim")}</button>
        <p className="mt-3 text-center text-xs leading-5 text-[#748078]">{t("credentialNotice")}</p>
      </form>
    </section>
  </div>;
}
