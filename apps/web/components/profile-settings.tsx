"use client";

import { LoaderCircle, LogOut, Save, ShieldCheck, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { useRouter } from "../i18n/navigation";
import { apiRequest } from "../lib/api-client";
import { createClient } from "../lib/supabase/client";

type AccountProfile = {
  id: string;
  email?: string;
  displayName: string | null;
  locale: "th" | "en";
  timezone: string;
  updatedAt: string;
};

const timezones = [
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC"
] as const;

export function ProfileSettings() {
  const t = useTranslations("Profile");
  const router = useRouter();
  const [profile, setProfile] = useState<AccountProfile>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    apiRequest<AccountProfile>("/v1/me")
      .then((value) => active && setProfile(value))
      .catch(() => active && setError(t("loadFailed")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [t]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    setSaved(false);
    startTransition(async () => {
      try {
        const updated = await apiRequest<AccountProfile>("/v1/me", {
          method: "PATCH",
          body: JSON.stringify({
            displayName: String(form.get("displayName") ?? ""),
            timezone: String(form.get("timezone") ?? "Asia/Bangkok")
          })
        });
        setProfile(updated);
        setSaved(true);
      } catch {
        setError(t("saveFailed"));
      }
    });
  }

  function signOut() {
    startTransition(async () => {
      await createClient().auth.signOut();
      router.replace("/auth/login");
      router.refresh();
    });
  }

  if (loading) {
    return <div className="panel flex min-h-72 items-center justify-center gap-2 p-8 text-sm font-bold text-[#68736a]"><LoaderCircle className="animate-spin" size={19}/>{t("loading")}</div>;
  }

  if (!profile) {
    return <div className="panel min-h-56 p-8"><p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error ?? t("loadFailed")}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-2xl border border-[#dce5dd] bg-white px-5 py-3 text-sm font-bold">{t("retry")}</button></div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr]">
      <aside className="panel h-fit p-6">
        <span className="grid size-12 place-items-center rounded-2xl bg-[#eaf7ed] text-[#228d40]"><UserRound size={23}/></span>
        <h2 className="mt-4 text-xl font-black">{profile.displayName ?? t("unnamed")}</h2>
        <p className="mt-1 break-all text-sm text-[#68736a]">{profile.email ?? t("emailUnavailable")}</p>
        <div className="mt-5 flex gap-2 rounded-2xl bg-[#edf7ef] p-4 text-xs leading-6 text-[#356d43]"><ShieldCheck className="mt-1 shrink-0" size={17}/>{t("privacy")}</div>
        <button type="button" onClick={signOut} disabled={pending} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white text-sm font-bold text-red-700 disabled:opacity-60"><LogOut size={17}/>{t("signOut")}</button>
      </aside>
      <section className="panel p-6 md:p-8">
        {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        {saved ? <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">{t("saved")}</p> : null}
        <form key={profile.updatedAt} onSubmit={submit} className="space-y-5">
          <label className="block"><span className="mb-2 block text-sm font-bold">{t("displayName")}</span><input required name="displayName" defaultValue={profile.displayName ?? ""} maxLength={120} autoComplete="name" className="h-12 w-full rounded-2xl border border-[#dce5dd] px-4"/></label>
          <label className="block"><span className="mb-2 block text-sm font-bold">{t("email")}</span><input readOnly value={profile.email ?? ""} className="h-12 w-full cursor-not-allowed rounded-2xl border border-[#e2e8e3] bg-[#f5f7f5] px-4 text-[#68736a]"/><span className="mt-2 block text-xs text-[#78827a]">{t("emailHelp")}</span></label>
          <label className="block"><span className="mb-2 block text-sm font-bold">{t("timezone")}</span><select name="timezone" defaultValue={profile.timezone} className="h-12 w-full rounded-2xl border border-[#dce5dd] bg-white px-4">{!timezones.includes(profile.timezone as typeof timezones[number]) ? <option value={profile.timezone}>{profile.timezone}</option> : null}{timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}</select><span className="mt-2 block text-xs text-[#78827a]">{t("timezoneHelp")}</span></label>
          <button disabled={pending} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#209842] font-bold text-white disabled:opacity-60">{pending ? <LoaderCircle className="animate-spin" size={18}/> : <Save size={18}/>} {t("save")}</button>
        </form>
      </section>
    </div>
  );
}
